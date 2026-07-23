#!/usr/bin/env python3
"""Collect deterministic, read-only evidence for a Skill-set audit.

The script intentionally reports candidates rather than deciding whether a Skill
should be changed. Repository-owned structural gates and external informational
findings remain separate. It uses only the Python standard library so it can run
in a fresh repository checkout without installing a YAML package.
"""

from __future__ import annotations

import argparse
import ast
import contextlib
import hashlib
import io
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
    r"\$([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?![A-Za-z0-9_-]|\.\*|系Skill)"
    r"|(?<![A-Za-z0-9_./:-])((?:relic|gh)(?:-[a-z0-9]+)+|skill-creator)"
    r"(?![A-Za-z0-9_-]|\.\*|系Skill)"
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
REPOSITORY_SCOPE = "repository-owned"
EXTERNAL_SCOPE = "external"


class CollectionError(RuntimeError):
    """Raised for an invalid or inaccessible collection target."""


@dataclass(frozen=True)
class SkillTarget:
    skill_file: Path
    catalog_name: str | None = None
    repository_owned: bool | None = None
    catalog_locations: tuple[Path, ...] = ()
    catalog_content_digest: str | None = None


@dataclass
class SkillEvidence:
    name: str
    catalog_name: str | None
    scope: str
    frontmatter_name: str
    description: str
    folder_name: str
    skill_file: str
    skill_directory: str
    catalog_locations: list[str] = field(default_factory=list)
    catalog_content_digest: str | None = None
    catalog_variant_id: str | None = None
    frontmatter_keys: list[str] = field(default_factory=list)
    headings: list[str] = field(default_factory=list)
    resource_files: dict[str, list[str]] = field(default_factory=dict)
    openai_yaml: str | None = None
    commands: list[str] = field(default_factory=list)
    referenced_skills: list[str] = field(default_factory=list)
    unresolved_skill_references: list[str] = field(default_factory=list)
    references: list[ReferenceEvidence] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)
    informational_findings: list[str] = field(default_factory=list)
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


def is_repository_owned(path: Path, workspace: Path) -> bool:
    try:
        path.resolve().relative_to(workspace.resolve())
    except ValueError:
        return False
    return True


def skill_package_digest(skill_file: Path) -> str:
    """Hash the complete Skill package so merged catalog entries retain semantics."""
    digest = hashlib.sha256()
    skill_directory = skill_file.parent
    try:
        package_files = sorted(
            (
                path
                for path in skill_directory.rglob("*")
                if path.is_file()
                and "__pycache__" not in path.relative_to(skill_directory).parts
                and path.name != ".DS_Store"
                and path.suffix != ".pyc"
            ),
            key=lambda path: path.relative_to(skill_directory).as_posix(),
        )
    except OSError as error:
        raise CollectionError(
            f"Cannot fingerprint catalog Skill package {skill_directory}: {error}"
        ) from error
    for package_file in package_files:
        relative_path = package_file.relative_to(skill_directory).as_posix()
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        try:
            digest.update(package_file.read_bytes())
        except OSError as error:
            raise CollectionError(
                f"Cannot fingerprint catalog Skill resource {package_file}: {error}"
            ) from error
        digest.update(b"\0")
    return digest.hexdigest()


def discover_skill_files(
    workspace: Path,
    roots: Sequence[Path],
    explicit_skills: Sequence[Path],
    catalog_entries: Sequence[SkillTarget],
) -> list[SkillTarget]:
    discovered: set[Path] = set()
    for root in roots:
        resolved = root.expanduser().resolve()
        if not resolved.exists():
            raise CollectionError(f"Skill root does not exist: {resolved}")
        if resolved.is_file():
            if resolved.name != "SKILL.md":
                raise CollectionError(f"Skill root file is not SKILL.md: {resolved}")
            discovered.add(resolved)
            continue
        try:
            for path in resolved.rglob("SKILL.md"):
                if path.is_file():
                    discovered.add(path.resolve())
        except OSError as error:
            raise CollectionError(f"Cannot scan Skill root {resolved}: {error}") from error

    for skill_file in explicit_skills:
        resolved = checked_skill_file(skill_file, "Explicit Skill")
        discovered.add(resolved)

    catalog_groups: dict[tuple[str, str], set[Path]] = {}
    for entry in catalog_entries:
        resolved = checked_skill_file(entry.skill_file, f"Catalog entry {entry.catalog_name}")
        assert entry.catalog_name is not None
        content_digest = skill_package_digest(resolved)
        catalog_groups.setdefault((entry.catalog_name, content_digest), set()).add(resolved)

    targets: list[SkillTarget] = []
    catalog_paths: set[Path] = set()
    for (catalog_name, content_digest), grouped_paths in sorted(
        catalog_groups.items(), key=lambda item: (item[0][0], item[0][1])
    ):
        locations = tuple(sorted(grouped_paths, key=lambda path: path.as_posix()))
        repository_locations = [
            path for path in locations if is_repository_owned(path, workspace)
        ]
        primary = repository_locations[0] if repository_locations else locations[0]
        targets.append(
            SkillTarget(
                skill_file=primary,
                catalog_name=catalog_name,
                repository_owned=bool(repository_locations),
                catalog_locations=locations,
                catalog_content_digest=content_digest,
            )
        )
        catalog_paths.update(locations)

    for path in sorted(discovered - catalog_paths, key=lambda item: item.as_posix()):
        targets.append(
            SkillTarget(
                skill_file=path,
                repository_owned=is_repository_owned(path, workspace),
            )
        )
    return sorted(
        targets,
        key=lambda target: (
            target.catalog_name or "",
            target.skill_file.as_posix(),
            target.catalog_content_digest or "",
        ),
    )


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


def external_finding(issue: str) -> str:
    if issue.startswith("frontmatter-unexpected-key:"):
        return issue.replace(
            "frontmatter-unexpected-key:", "external-frontmatter-extension:", 1
        )
    return f"external-structure:{issue}"


def collect_skill(target: SkillTarget, workspace: Path) -> SkillEvidence:
    skill_file = target.skill_file
    skill_directory = skill_file.parent
    folder_name = skill_directory.name
    repository_owned = (
        target.repository_owned
        if target.repository_owned is not None
        else is_repository_owned(skill_file, workspace)
    )
    issues: list[str] = []
    informational_findings: list[str] = []
    try:
        text = skill_file.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        text = ""
        read_issue = f"skill-read-error:{type(error).__name__}"
        if repository_owned:
            issues.append(read_issue)
        else:
            informational_findings.append(external_finding(read_issue))
    frontmatter, body, parse_issues = parse_frontmatter(text)
    validation_issues = validate_frontmatter(frontmatter, folder_name, parse_issues)
    if repository_owned:
        issues.extend(validation_issues)
    else:
        informational_findings.extend(
            external_finding(issue) for issue in validation_issues
        )

    try:
        markdown_files = sorted(
            path for path in skill_directory.rglob("*.md") if path.is_file()
        )
    except OSError:
        markdown_files = [skill_file]
        if repository_owned:
            issues.append("resource-scan-error")
        else:
            informational_findings.append(external_finding("resource-scan-error"))
    references = collect_references(markdown_files, skill_directory, workspace)
    for reference in references:
        if not reference.exists and reference.kind == "markdown-link":
            missing_issue = f"missing-{reference.kind}:{reference.target}"
            if repository_owned:
                issues.append(missing_issue)
            else:
                informational_findings.append(external_finding(missing_issue))

    combined_markdown: list[str] = []
    for markdown_file in markdown_files:
        try:
            combined_markdown.append(markdown_file.read_text(encoding="utf-8"))
        except (OSError, UnicodeError):
            read_issue = f"resource-read-error:{display_path(markdown_file, workspace)}"
            if repository_owned:
                issues.append(read_issue)
            else:
                informational_findings.append(external_finding(read_issue))
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
        scope=REPOSITORY_SCOPE if repository_owned else EXTERNAL_SCOPE,
        frontmatter_name=frontmatter_name,
        description=description,
        folder_name=folder_name,
        skill_file=display_path(skill_file, workspace),
        skill_directory=display_path(skill_directory, workspace),
        catalog_locations=[
            display_path(path, workspace) for path in target.catalog_locations
        ],
        catalog_content_digest=target.catalog_content_digest,
        catalog_variant_id=(
            target.catalog_content_digest[:12]
            if target.catalog_content_digest is not None
            else None
        ),
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
        informational_findings=sorted(set(informational_findings)),
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
        if skill.scope != REPOSITORY_SCOPE:
            continue
        paths_by_name.setdefault(skill.name, []).append(skill.skill_file)
    return [
        {"name": name, "skill_files": sorted(paths)}
        for name, paths in sorted(paths_by_name.items())
        if len(paths) > 1
    ]


def catalog_duplicate_groups(skills: Sequence[SkillEvidence]) -> list[dict[str, object]]:
    return [
        {
            "name": skill.catalog_name,
            "content_digest": skill.catalog_content_digest,
            "variant_id": skill.catalog_variant_id,
            "skill_files": skill.catalog_locations,
        }
        for skill in skills
        if skill.catalog_name is not None and len(skill.catalog_locations) > 1
    ]


def catalog_name_variants(skills: Sequence[SkillEvidence]) -> list[dict[str, object]]:
    variants_by_name: dict[str, list[dict[str, object]]] = {}
    for skill in skills:
        if skill.catalog_name is None:
            continue
        variants_by_name.setdefault(skill.catalog_name, []).append(
            {
                "content_digest": skill.catalog_content_digest,
                "variant_id": skill.catalog_variant_id,
                "scope": skill.scope,
                "skill_files": skill.catalog_locations,
            }
        )
    return [
        {"name": name, "variants": sorted(variants, key=lambda item: str(item["variant_id"]))}
        for name, variants in sorted(variants_by_name.items())
        if len(variants) > 1
    ]


def resolve_skill_relations(skills: Sequence[SkillEvidence]) -> None:
    known_names = {skill.name for skill in skills}
    effective_by_frontmatter: dict[str, set[str]] = {}
    for skill in skills:
        effective_by_frontmatter.setdefault(skill.frontmatter_name, set()).add(skill.name)

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
            candidates = sorted(effective_by_frontmatter.get(reference, set()))
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
    skill_targets = discover_skill_files(
        workspace, roots, explicit_skills, catalog_entries
    )
    skills = [collect_skill(target, workspace) for target in skill_targets]
    resolve_skill_relations(skills)
    duplicates = duplicate_names(skills)
    catalog_duplicates = catalog_duplicate_groups(skills)
    catalog_variants = catalog_name_variants(skills)
    missing_references = [
        {
            "skill": skill.name,
            "scope": skill.scope,
            **asdict(reference),
        }
        for skill in skills
        for reference in skill.references
        if skill.scope == REPOSITORY_SCOPE
        and not reference.exists
        and reference.kind == "markdown-link"
    ]
    external_missing_references = [
        {
            "skill": skill.name,
            "scope": skill.scope,
            **asdict(reference),
        }
        for skill in skills
        for reference in skill.references
        if skill.scope == EXTERNAL_SCOPE
        and not reference.exists
        and reference.kind == "markdown-link"
    ]
    missing_reference_candidates = [
        {
            "skill": skill.name,
            "scope": skill.scope,
            **asdict(reference),
        }
        for skill in skills
        for reference in skill.references
        if not reference.exists and reference.kind == "inline-path-candidate"
    ]
    external_informational_findings = [
        {
            "skill": skill.name,
            "skill_file": skill.skill_file,
            "finding": finding,
        }
        for skill in skills
        if skill.scope == EXTERNAL_SCOPE
        for finding in skill.informational_findings
    ]
    repository_issue_count = (
        sum(len(skill.issues) for skill in skills if skill.scope == REPOSITORY_SCOPE)
        + len(duplicates)
    )
    return {
        "schema_version": 4,
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
            "repository_skill_count": sum(
                skill.scope == REPOSITORY_SCOPE for skill in skills
            ),
            "external_skill_count": sum(skill.scope == EXTERNAL_SCOPE for skill in skills),
            "repository_structural_issue_count": repository_issue_count,
            "structural_issue_count": repository_issue_count,
            "external_informational_finding_count": len(
                external_informational_findings
            ),
            "catalog_informational_finding_count": len(catalog_variants),
            "missing_reference_count": len(missing_references),
            "external_missing_reference_count": len(external_missing_references),
            "missing_reference_candidate_count": len(missing_reference_candidates),
            "duplicate_name_count": len(duplicates),
            "catalog_duplicate_group_count": len(catalog_duplicates),
            "catalog_name_variant_count": len(catalog_variants),
        },
        "skills": [skill.public_dict() for skill in skills],
        "duplicate_names": duplicates,
        "catalog_duplicate_groups": catalog_duplicates,
        "catalog_name_variants": catalog_variants,
        "missing_references": missing_references,
        "external_missing_references": external_missing_references,
        "missing_reference_candidates": missing_reference_candidates,
        "external_informational_findings": external_informational_findings,
        "similarity_candidates": similarity_candidates(skills, threshold),
        "notes": [
            "Similarity and inline-path results are candidates, not confirmed audit findings or fail-on-issues conditions.",
            (
                "--fail-on-issues evaluates repository-owned structural issues only. "
                "External Skill schema differences and unresolved references remain informational."
            ),
            (
                "Repeated --catalog-entry names are accepted. Byte-identical Skill "
                "packages are consolidated with all locations retained; distinct "
                "packages are reported as catalog name variants."
            ),
            (
                "Fenced code examples are excluded from Markdown-link checks. A Markdown "
                "file containing the skill-audit ignore marker skips inline-path candidates."
            ),
            (
                "Purpose, triggers, inputs, outputs, tools, conflicts, and change "
                "decisions require reading the source Skill."
            ),
        ],
    }


def has_repository_issues(evidence: dict[str, object]) -> bool:
    summary = evidence["summary"]
    assert isinstance(summary, dict)
    return bool(summary["repository_structural_issue_count"])


def run_self_test() -> None:
    assert extract_skill_references(
        "$relic-change-uiを使い、relic-change-settingsも使う。skill-creatorを使う。"
    ) == {"relic-change-ui", "relic-change-settings", "skill-creator"}
    assert extract_skill_references(
        "relic-change-*、relic-change系Skill、$relic-change系Skill、relic-change-"
    ) == set()
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
            + "\n---\n# Second\n\n"
            + "```markdown\n[example](references/example.md)\n```\n\n"
            + "For illustration, use `references/schema.md`.\n",
            encoding="utf-8",
        )
        evidence = collect_evidence(workspace, [root], [], [], 0.5)
        assert evidence["summary"]["skill_count"] == 2
        assert evidence["summary"]["duplicate_name_count"] == 1
        assert evidence["summary"]["missing_reference_count"] == 1
        assert evidence["summary"]["missing_reference_candidate_count"] == 1
        assert len(evidence["similarity_candidates"]) == 1
        assert evidence["missing_reference_candidates"][0]["target"] == "references/schema.md"
        assert not any(
            issue.startswith("missing-inline-path-candidate:")
            for skill in evidence["skills"]
            for issue in skill["issues"]
        )
        assert all(
            "frontmatter-folder-name-mismatch" in skill["issues"]
            for skill in evidence["skills"]
        )
        assert has_repository_issues(evidence)
        with contextlib.redirect_stdout(io.StringIO()):
            assert (
                main(
                    [
                        "--workspace",
                        workspace.as_posix(),
                        "--root",
                        root.as_posix(),
                        "--fail-on-issues",
                    ]
                )
                == 1
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
        assert catalog_evidence["summary"]["missing_reference_candidate_count"] == 0
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

        with tempfile.TemporaryDirectory(
            prefix="skill-audit-external-"
        ) as external_directory:
            external_root = Path(external_directory)
            identical_skill_text = (
                "---\n"
                "name: Worker\n"
                "description: Inspect an external catalog worker.\n"
                "user-invocable: false\n"
                "---\n"
                "# Worker\n\n"
                "[API route](/api/docs/workers)\n\n"
                "[Web docs](https://example.com/docs)\n\n"
                "[Optional local detail](references/detail.md)\n\n"
                "A price such as `$12` is not a Skill reference.\n"
            )
            external_paths: list[Path] = []
            for plugin_name in ("copy-a", "copy-b"):
                skill_directory = external_root / plugin_name / "worker"
                skill_directory.mkdir(parents=True)
                skill_file = skill_directory / "SKILL.md"
                skill_file.write_text(identical_skill_text, encoding="utf-8")
                external_paths.append(skill_file)

            variant_directory = external_root / "variant" / "worker"
            variant_directory.mkdir(parents=True)
            variant_file = variant_directory / "SKILL.md"
            variant_file.write_text(
                identical_skill_text.replace(
                    "Inspect an external catalog worker.",
                    "Route a distinct external catalog worker.",
                ),
                encoding="utf-8",
            )
            external_paths.append(variant_file)
            raw_entries = [
                f"external:worker={path.as_posix()}" for path in external_paths
            ]
            parsed_entries = parse_catalog_entries(raw_entries, workspace)
            assert len(parsed_entries) == 3
            external_evidence = collect_evidence(
                workspace, [], [], parsed_entries, 0.5
            )
            external_summary = external_evidence["summary"]
            assert external_summary["skill_count"] == 2
            assert external_summary["repository_skill_count"] == 0
            assert external_summary["external_skill_count"] == 2
            assert external_summary["repository_structural_issue_count"] == 0
            assert external_summary["catalog_duplicate_group_count"] == 1
            assert external_summary["catalog_name_variant_count"] == 1
            assert external_summary["external_missing_reference_count"] == 2
            assert not has_repository_issues(external_evidence)
            duplicate_group = external_evidence["catalog_duplicate_groups"][0]
            assert len(duplicate_group["skill_files"]) == 2
            assert len(external_evidence["catalog_name_variants"][0]["variants"]) == 2
            assert all(skill["issues"] == [] for skill in external_evidence["skills"])
            assert all(
                "12" not in skill["referenced_skills"]
                for skill in external_evidence["skills"]
            )
            assert all(
                len(skill["catalog_locations"]) in {1, 2}
                for skill in external_evidence["skills"]
            )
            assert any(
                finding["finding"]
                == "external-frontmatter-extension:user-invocable"
                for finding in external_evidence["external_informational_findings"]
            )
            assert all(
                item["target"] == "references/detail.md"
                for item in external_evidence["external_missing_references"]
            )
            rendered_external = render_markdown(external_evidence)
            assert "## External informational findings" in rendered_external
            assert "external-frontmatter-extension:user-invocable" in rendered_external
            assert "## Catalog name variants" in rendered_external
            cli_arguments = ["--workspace", workspace.as_posix(), "--fail-on-issues"]
            for raw_entry in raw_entries:
                cli_arguments.extend(["--catalog-entry", raw_entry])
            with contextlib.redirect_stdout(io.StringIO()):
                assert main(cli_arguments) == 0
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
        help=(
            "Available-catalog name and SKILL.md path; repeat to preserve namespaces "
            "and every location, including repeated names."
        ),
    )
    parser.add_argument("--format", choices=("json", "markdown", "summary"), default="json")
    parser.add_argument(
        "--similarity-threshold",
        type=float,
        default=0.38,
        help="Jaccard threshold for description candidates, from 0 through 1.",
    )
    parser.add_argument(
        "--fail-on-issues",
        action="store_true",
        help=(
            "Exit 1 when repository-owned structural, duplicate-name, or "
            "missing-reference issues exist; external findings remain informational."
        ),
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
    elif args.format == "summary":
        summary = evidence["summary"]
        print(
            "Skill structure check: "
            f"{summary['repository_skill_count']} repository-owned, "
            f"{summary['repository_structural_issue_count']} structural issue(s), "
            f"{summary['missing_reference_count']} missing reference(s)."
        )
    else:
        print(json.dumps(evidence, ensure_ascii=False, indent=2))
    if args.fail_on_issues and has_repository_issues(evidence):
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
