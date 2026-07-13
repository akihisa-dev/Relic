#!/usr/bin/env python3
"""Collect deterministic, read-only evidence for a Skill-set audit.

The script intentionally reports candidates rather than deciding whether a Skill
should be changed. It uses only the Python standard library so it can run in a
fresh repository checkout without installing a YAML package.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import shlex
import sys
import tempfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from skill_reference_evidence import (
    ReferenceEvidence,
    collect_references,
    collect_resource_files,
    display_path,
)
from skill_evidence_markdown import render_markdown


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
INLINE_CODE_PATTERN = re.compile(r"`([^`\n]+)`")
SKILL_REFERENCE_PATTERN = re.compile(
    r"\$([a-z0-9]+(?:-[a-z0-9]+)*)"
    r"|(?<![A-Za-z0-9_./:-])((?:relic|gh)-[a-z0-9-]+|skill-creator)"
    r"(?![A-Za-z0-9_.-])"
)
ALLOWED_FRONTMATTER_KEYS = {
    "name",
    "description",
    "license",
    "allowed-tools",
    "metadata",
}
COMMAND_HEADS = {
    "cargo",
    "git",
    "node",
    "npm",
    "npx",
    "pnpm",
    "python",
    "python3",
    "rg",
    "ruby",
    "swift",
    "xcodebuild",
}


class CollectionError(RuntimeError):
    """Raised for an invalid or inaccessible collection target."""


@dataclass(frozen=True)
class SkillTarget:
    skill_file: Path
    catalog_name: str | None = None


@dataclass
class SkillEvidence:
    name: str
    catalog_name: str | None
    frontmatter_name: str
    description: str
    folder_name: str
    skill_file: str
    skill_directory: str
    frontmatter_keys: list[str] = field(default_factory=list)
    headings: list[str] = field(default_factory=list)
    resource_files: dict[str, list[str]] = field(default_factory=dict)
    openai_yaml: str | None = None
    commands: list[str] = field(default_factory=list)
    referenced_skills: list[str] = field(default_factory=list)
    unresolved_skill_references: list[str] = field(default_factory=list)
    references: list[ReferenceEvidence] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)
    _search_text: str = field(default="", repr=False)

    def public_dict(self) -> dict[str, object]:
        data = asdict(self)
        data.pop("_search_text", None)
        return data


def decode_scalar(raw_value: str) -> tuple[str, str | None]:
    value = raw_value.strip()
    if value.startswith(("'", '"')):
        if len(value) < 2 or value[-1] != value[0]:
            return value, "unclosed-quoted-scalar"
        try:
            decoded = ast.literal_eval(value)
        except (SyntaxError, ValueError):
            return value[1:-1], "invalid-quoted-scalar"
        if not isinstance(decoded, str):
            return str(decoded), "non-string-scalar"
        return decoded, None
    if re.fullmatch(r"(?i:true|false|null|~|[-+]?\d+(?:\.\d+)?)", value):
        return value, "non-string-scalar"
    return value, None


def parse_frontmatter(text: str) -> tuple[dict[str, str], str, list[str]]:
    """Parse the top-level scalar subset needed for Skill frontmatter checks."""
    lines = text.lstrip("\ufeff").splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text, ["frontmatter-missing"]

    try:
        closing_index = next(
            index for index, line in enumerate(lines[1:], start=1) if line.strip() == "---"
        )
    except StopIteration:
        return {}, text, ["frontmatter-unclosed"]

    values: dict[str, str] = {}
    issues: list[str] = []
    block_key: str | None = None
    block_lines: list[str] = []

    def finish_block() -> None:
        nonlocal block_key, block_lines
        if block_key is not None:
            values[block_key] = "\n".join(block_lines).strip()
        block_key = None
        block_lines = []

    for line_number, line in enumerate(lines[1:closing_index], start=2):
        if line.startswith((" ", "\t")):
            if block_key is not None:
                block_lines.append(line.lstrip())
            continue
        finish_block()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if not match:
            issues.append(f"frontmatter-unparsed-line:{line_number}")
            continue
        key, raw_value = match.groups()
        if key in values:
            issues.append(f"frontmatter-duplicate-key:{key}")
        if raw_value.strip() in {"|", "|-", "|+", ">", ">-", ">+"}:
            block_key = key
            block_lines = []
        else:
            values[key], scalar_issue = decode_scalar(raw_value)
            if scalar_issue is not None and key in {"name", "description"}:
                issues.append(f"frontmatter-{scalar_issue}:{key}")
    finish_block()
    body = "\n".join(lines[closing_index + 1 :])
    return values, body, issues


def validate_frontmatter(
    frontmatter: dict[str, str], folder_name: str, parse_issues: Sequence[str]
) -> list[str]:
    issues = list(parse_issues)
    unexpected = sorted(set(frontmatter) - ALLOWED_FRONTMATTER_KEYS)
    issues.extend(f"frontmatter-unexpected-key:{key}" for key in unexpected)

    name = frontmatter.get("name", "").strip()
    description = frontmatter.get("description", "").strip()
    if not name:
        issues.append("frontmatter-name-missing")
    else:
        if not NAME_PATTERN.fullmatch(name):
            issues.append("frontmatter-name-invalid")
        if len(name) > 64:
            issues.append("frontmatter-name-too-long")
        if name != folder_name:
            issues.append("frontmatter-folder-name-mismatch")
    if not description:
        issues.append("frontmatter-description-missing")
    else:
        if len(description) > 1024:
            issues.append("frontmatter-description-too-long")
        if "<" in description or ">" in description:
            issues.append("frontmatter-description-angle-bracket")
    return sorted(set(issues))


def checked_skill_file(path: Path, label: str) -> Path:
    resolved = path.expanduser().resolve()
    if resolved.is_dir():
        resolved = resolved / "SKILL.md"
    if not resolved.is_file() or resolved.name != "SKILL.md":
        raise CollectionError(f"{label} is not a readable SKILL.md: {resolved}")
    return resolved


def discover_skill_files(
    roots: Sequence[Path],
    explicit_skills: Sequence[Path],
    catalog_entries: Sequence[SkillTarget],
) -> list[SkillTarget]:
    discovered: dict[Path, str | None] = {}
    for root in roots:
        resolved = root.expanduser().resolve()
        if not resolved.exists():
            raise CollectionError(f"Skill root does not exist: {resolved}")
        if resolved.is_file():
            if resolved.name != "SKILL.md":
                raise CollectionError(f"Skill root file is not SKILL.md: {resolved}")
            discovered.setdefault(resolved, None)
            continue
        try:
            for path in resolved.rglob("SKILL.md"):
                if path.is_file():
                    discovered.setdefault(path.resolve(), None)
        except OSError as error:
            raise CollectionError(f"Cannot scan Skill root {resolved}: {error}") from error

    for skill_file in explicit_skills:
        resolved = checked_skill_file(skill_file, "Explicit Skill")
        discovered.setdefault(resolved, None)
    for entry in catalog_entries:
        resolved = checked_skill_file(entry.skill_file, f"Catalog entry {entry.catalog_name}")
        discovered[resolved] = entry.catalog_name
    return [
        SkillTarget(skill_file=path, catalog_name=catalog_name)
        for path, catalog_name in sorted(discovered.items(), key=lambda item: item[0].as_posix())
    ]


def extract_commands(text: str) -> set[str]:
    commands: set[str] = set()
    candidates = list(INLINE_CODE_PATTERN.findall(text))
    candidates.extend(line.strip() for line in text.splitlines())
    for candidate in candidates:
        stripped = candidate.strip().lstrip("$ ")
        try:
            parts = shlex.split(stripped)
        except ValueError:
            continue
        if parts and parts[0] in COMMAND_HEADS:
            commands.add(stripped)
    return commands


def extract_skill_references(text: str) -> set[str]:
    references: set[str] = set()
    for match in SKILL_REFERENCE_PATTERN.finditer(text):
        references.add(match.group(1) or match.group(2))
    return references


def collect_skill(target: SkillTarget, workspace: Path) -> SkillEvidence:
    skill_file = target.skill_file
    skill_directory = skill_file.parent
    folder_name = skill_directory.name
    issues: list[str] = []
    try:
        text = skill_file.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        text = ""
        issues.append(f"skill-read-error:{type(error).__name__}")
    frontmatter, body, parse_issues = parse_frontmatter(text)
    issues.extend(validate_frontmatter(frontmatter, folder_name, parse_issues))

    try:
        markdown_files = sorted(
            path for path in skill_directory.rglob("*.md") if path.is_file()
        )
    except OSError:
        markdown_files = [skill_file]
        issues.append("resource-scan-error")
    references = collect_references(markdown_files, skill_directory, workspace)
    for reference in references:
        if not reference.exists:
            issues.append(f"missing-{reference.kind}:{reference.target}")

    combined_markdown: list[str] = []
    for markdown_file in markdown_files:
        try:
            combined_markdown.append(markdown_file.read_text(encoding="utf-8"))
        except (OSError, UnicodeError):
            issues.append(f"resource-read-error:{display_path(markdown_file, workspace)}")
    search_text = "\n".join(combined_markdown)
    frontmatter_name = frontmatter.get("name", "").strip() or folder_name
    name = target.catalog_name or frontmatter_name
    description = frontmatter.get("description", "").strip()
    referenced_skills = extract_skill_references(search_text)
    referenced_skills.discard(name)
    referenced_skills.discard(frontmatter_name)
    openai_yaml_path = skill_directory / "agents" / "openai.yaml"

    return SkillEvidence(
        name=name,
        catalog_name=target.catalog_name,
        frontmatter_name=frontmatter_name,
        description=description,
        folder_name=folder_name,
        skill_file=display_path(skill_file, workspace),
        skill_directory=display_path(skill_directory, workspace),
        frontmatter_keys=sorted(frontmatter),
        headings=[match.group(2).strip() for match in HEADING_PATTERN.finditer(body)],
        resource_files=collect_resource_files(skill_directory, workspace),
        openai_yaml=(
            display_path(openai_yaml_path, workspace) if openai_yaml_path.is_file() else None
        ),
        commands=sorted(extract_commands(search_text)),
        referenced_skills=sorted(referenced_skills),
        references=references,
        issues=sorted(set(issues)),
        _search_text=search_text,
    )


def description_features(text: str) -> set[str]:
    normalized = re.sub(r"\s+", "", text.lower())
    normalized = re.sub(r"[^a-z0-9\u3040-\u30ff\u3400-\u9fff-]", "", normalized)
    features = set(re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", normalized))
    japanese = re.sub(r"[^\u3040-\u30ff\u3400-\u9fff]", "", normalized)
    features.update(japanese[index : index + 3] for index in range(max(0, len(japanese) - 2)))
    return {feature for feature in features if feature}


def jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 0.0


def similarity_candidates(
    skills: Sequence[SkillEvidence], threshold: float
) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    features = [description_features(skill.description) for skill in skills]
    for left_index, left in enumerate(skills):
        for right_index in range(left_index + 1, len(skills)):
            score = jaccard(features[left_index], features[right_index])
            if score >= threshold:
                candidates.append(
                    {
                        "left": left.name,
                        "right": skills[right_index].name,
                        "score": round(score, 4),
                    }
                )
    return sorted(candidates, key=lambda item: (-float(item["score"]), str(item["left"])))


def duplicate_names(skills: Sequence[SkillEvidence]) -> list[dict[str, object]]:
    paths_by_name: dict[str, list[str]] = {}
    for skill in skills:
        paths_by_name.setdefault(skill.name, []).append(skill.skill_file)
    return [
        {"name": name, "skill_files": sorted(paths)}
        for name, paths in sorted(paths_by_name.items())
        if len(paths) > 1
    ]


def resolve_skill_relations(skills: Sequence[SkillEvidence]) -> None:
    known_names = {skill.name for skill in skills}
    effective_by_frontmatter: dict[str, list[str]] = {}
    for skill in skills:
        effective_by_frontmatter.setdefault(skill.frontmatter_name, []).append(skill.name)

    for skill in skills:
        namespace = (
            skill.catalog_name.split(":", 1)[0]
            if skill.catalog_name and ":" in skill.catalog_name
            else None
        )
        resolved: set[str] = set()
        unresolved: set[str] = set()
        for reference in skill.referenced_skills:
            if reference in known_names:
                resolved.add(reference)
                continue
            namespaced = f"{namespace}:{reference}" if namespace else None
            if namespaced and namespaced in known_names:
                resolved.add(namespaced)
                continue
            candidates = effective_by_frontmatter.get(reference, [])
            if len(candidates) == 1:
                resolved.add(candidates[0])
            else:
                resolved.add(reference)
                unresolved.add(reference)
        skill.referenced_skills = sorted(resolved)
        skill.unresolved_skill_references = sorted(unresolved)


def collect_evidence(
    workspace: Path,
    roots: Sequence[Path],
    explicit_skills: Sequence[Path],
    catalog_entries: Sequence[SkillTarget],
    threshold: float,
) -> dict[str, object]:
    skill_targets = discover_skill_files(roots, explicit_skills, catalog_entries)
    skills = [collect_skill(target, workspace) for target in skill_targets]
    resolve_skill_relations(skills)
    duplicates = duplicate_names(skills)
    missing_references = [
        {
            "skill": skill.name,
            **asdict(reference),
        }
        for skill in skills
        for reference in skill.references
        if not reference.exists
    ]
    issue_count = sum(len(skill.issues) for skill in skills) + len(duplicates)
    return {
        "schema_version": 2,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "workspace": workspace.resolve().as_posix(),
        "roots": [path.expanduser().resolve().as_posix() for path in roots],
        "explicit_skills": [path.expanduser().resolve().as_posix() for path in explicit_skills],
        "catalog_entries": [
            {
                "name": entry.catalog_name,
                "skill_file": entry.skill_file.expanduser().resolve().as_posix(),
            }
            for entry in catalog_entries
        ],
        "summary": {
            "skill_count": len(skills),
            "structural_issue_count": issue_count,
            "missing_reference_count": len(missing_references),
            "duplicate_name_count": len(duplicates),
        },
        "skills": [skill.public_dict() for skill in skills],
        "duplicate_names": duplicates,
        "missing_references": missing_references,
        "similarity_candidates": similarity_candidates(skills, threshold),
        "notes": [
            "Similarity and inline-path results are candidates, not confirmed audit findings.",
            (
                "Use --catalog-entry for Skills whose available-catalog name differs "
                "from frontmatter name."
            ),
            (
                "A Markdown file containing the skill-audit ignore marker skips "
                "inline-path candidates but still checks Markdown links."
            ),
            (
                "Purpose, triggers, inputs, outputs, tools, conflicts, and change "
                "decisions require reading the source Skill."
            ),
        ],
    }


def run_self_test() -> None:
    parsed, _, parse_issues = parse_frontmatter(
        "---\nname: 123\ndescription: 'unterminated\n---\n# Invalid\n"
    )
    assert parsed["name"] == "123"
    assert "frontmatter-non-string-scalar:name" in parse_issues
    assert "frontmatter-unclosed-quoted-scalar:description" in parse_issues
    with tempfile.TemporaryDirectory(prefix="skill-audit-") as temporary_directory:
        workspace = Path(temporary_directory)
        root = workspace / ".agents" / "skills"
        first = root / "first"
        second = root / "second"
        first.mkdir(parents=True)
        second.mkdir(parents=True)
        description = "同じ文書リンクを検査し、安全な修正案を提示する。リンク監査の依頼に使う。"
        first.joinpath("SKILL.md").write_text(
            "---\nname: duplicate-skill\ndescription: "
            + description
            + "\n---\n# First\n\n[missing](references/missing.md)\n",
            encoding="utf-8",
        )
        second.joinpath("SKILL.md").write_text(
            "---\nname: duplicate-skill\ndescription: "
            + description
            + "\n---\n# Second\n",
            encoding="utf-8",
        )
        evidence = collect_evidence(workspace, [root], [], [], 0.5)
        assert evidence["summary"]["skill_count"] == 2
        assert evidence["summary"]["duplicate_name_count"] == 1
        assert evidence["summary"]["missing_reference_count"] == 1
        assert len(evidence["similarity_candidates"]) == 1
        assert all(
            "frontmatter-folder-name-mismatch" in skill["issues"]
            for skill in evidence["skills"]
        )

        catalog_targets: list[SkillTarget] = []
        for plugin_name in ("plugin-a", "plugin-b"):
            plugin_root = workspace / plugin_name
            skill_directory = plugin_root / "skills" / "index"
            skill_directory.mkdir(parents=True)
            plugin_root.joinpath("src").mkdir()
            plugin_root.joinpath("src", "canonical.md").write_text("# Canonical\n")
            skill_file = skill_directory / "SKILL.md"
            skill_file.write_text(
                "---\nname: index\ndescription: Route requests for this plugin.\n---\n"
                "# Index\n\nRead `../../src/canonical.md` and use $worker.\n",
                encoding="utf-8",
            )
            catalog_targets.append(
                SkillTarget(skill_file=skill_file, catalog_name=f"{plugin_name}:index")
            )
            worker_directory = plugin_root / "skills" / "worker"
            worker_directory.mkdir()
            worker_file = worker_directory / "SKILL.md"
            worker_file.write_text(
                "---\nname: worker\ndescription: Perform focused plugin work.\n---\n"
                "# Worker\n",
                encoding="utf-8",
            )
            catalog_targets.append(
                SkillTarget(skill_file=worker_file, catalog_name=f"{plugin_name}:worker")
            )
        catalog_evidence = collect_evidence(
            workspace, [], [], catalog_targets, 0.5
        )
        assert catalog_evidence["summary"]["duplicate_name_count"] == 0
        assert catalog_evidence["summary"]["missing_reference_count"] == 0
        assert {skill["name"] for skill in catalog_evidence["skills"]} == {
            "plugin-a:index",
            "plugin-a:worker",
            "plugin-b:index",
            "plugin-b:worker",
        }
        for skill in catalog_evidence["skills"]:
            if skill["name"].endswith(":index"):
                expected_worker = skill["name"].replace(":index", ":worker")
                assert skill["referenced_skills"] == [expected_worker]
    print("self-test: ok")


def parse_arguments(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect read-only structural evidence for a Skill-set audit."
    )
    parser.add_argument(
        "--workspace",
        type=Path,
        default=Path.cwd(),
        help="Repository root used to resolve repository-relative references (default: cwd).",
    )
    parser.add_argument(
        "--root",
        action="append",
        type=Path,
        default=[],
        help="Skill root to scan recursively; repeat for multiple roots.",
    )
    parser.add_argument(
        "--skill",
        action="append",
        type=Path,
        default=[],
        help="Explicit SKILL.md or Skill directory; repeat for multiple Skills.",
    )
    parser.add_argument(
        "--catalog-entry",
        action="append",
        default=[],
        metavar="NAME=PATH",
        help="Available-catalog name and SKILL.md path; repeat to preserve namespaces.",
    )
    parser.add_argument("--format", choices=("json", "markdown"), default="json")
    parser.add_argument(
        "--similarity-threshold",
        type=float,
        default=0.38,
        help="Jaccard threshold for description candidates, from 0 through 1.",
    )
    parser.add_argument(
        "--fail-on-issues",
        action="store_true",
        help="Exit 1 when structural, duplicate-name, or missing-reference issues exist.",
    )
    parser.add_argument(
        "--self-test", action="store_true", help="Run deterministic temporary-fixture checks."
    )
    args = parser.parse_args(argv)
    if not 0 <= args.similarity_threshold <= 1:
        parser.error("--similarity-threshold must be between 0 and 1")
    return args


def parse_catalog_entries(raw_entries: Sequence[str], workspace: Path) -> list[SkillTarget]:
    entries: list[SkillTarget] = []
    seen_names: set[str] = set()
    for raw_entry in raw_entries:
        if "=" not in raw_entry:
            raise CollectionError(
                f"Catalog entry must use NAME=PATH syntax: {raw_entry}"
            )
        name, raw_path = raw_entry.split("=", 1)
        name = name.strip()
        raw_path = raw_path.strip()
        if not name or re.search(r"\s", name) or not raw_path:
            raise CollectionError(f"Invalid catalog entry: {raw_entry}")
        if name in seen_names:
            raise CollectionError(f"Duplicate catalog entry name: {name}")
        seen_names.add(name)
        path = Path(raw_path).expanduser()
        if not path.is_absolute():
            path = workspace / path
        entries.append(SkillTarget(skill_file=path, catalog_name=name))
    return entries


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_arguments(argv if argv is not None else sys.argv[1:])
    if args.self_test:
        run_self_test()
        return 0

    workspace = args.workspace.expanduser().resolve()
    if not workspace.is_dir():
        raise CollectionError(f"Workspace is not a directory: {workspace}")
    roots = [path if path.is_absolute() else workspace / path for path in args.root]
    explicit_skills = [
        path if path.is_absolute() else workspace / path for path in args.skill
    ]
    catalog_entries = parse_catalog_entries(args.catalog_entry, workspace)
    if not roots and not explicit_skills and not catalog_entries:
        roots = [workspace / ".agents" / "skills"]
    evidence = collect_evidence(
        workspace=workspace,
        roots=roots,
        explicit_skills=explicit_skills,
        catalog_entries=catalog_entries,
        threshold=args.similarity_threshold,
    )
    if args.format == "markdown":
        print(render_markdown(evidence))
    else:
        print(json.dumps(evidence, ensure_ascii=False, indent=2))
    if args.fail_on_issues and evidence["summary"]["structural_issue_count"]:
        return 1
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except CollectionError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(2)
    except KeyboardInterrupt:
        print("error: interrupted", file=sys.stderr)
        raise SystemExit(130)
