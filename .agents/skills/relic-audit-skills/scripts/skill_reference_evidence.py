"""Resolve Skill resource files and local path evidence without writing files."""

from __future__ import annotations

import re
import shlex
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence
from urllib.parse import unquote


INLINE_CODE_PATTERN = re.compile(r"`([^`\n]+)`")
MARKDOWN_LINK_PATTERN = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
ROOT_RELATIVE_PREFIXES = (
    ".agents/",
    ".github/",
    "app/",
    "docs/",
    "sbom/",
)
SKILL_RELATIVE_PREFIXES = ("agents/", "assets/", "evals/", "references/", "scripts/")
INLINE_PATH_IGNORE_MARKER = "<!-- skill-audit: ignore-inline-paths -->"
ROOT_FILENAMES = {
    "AGENTS.md",
    "CONTRIBUTING.md",
    "README.md",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md",
}


@dataclass
class ReferenceEvidence:
    source: str
    target: str
    resolved: str
    exists: bool
    kind: str


def display_path(path: Path, workspace: Path) -> str:
    """Prefer stable workspace-relative paths while retaining external paths."""
    try:
        return path.resolve().relative_to(workspace.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def markdown_target(raw_target: str) -> str:
    target = raw_target.strip()
    if target.startswith("<") and ">" in target:
        return target[1 : target.index(">")]
    try:
        parts = shlex.split(target)
    except ValueError:
        parts = target.split()
    return parts[0] if parts else ""


def has_glob(value: str) -> bool:
    return any(character in value for character in "*?[")


def path_exists(path: Path, raw_target: str) -> bool:
    if has_glob(raw_target):
        try:
            return any(path.parent.glob(path.name))
        except (OSError, ValueError):
            return False
    return path.exists()


def resolve_markdown_reference(source: Path, target: str) -> Path | None:
    if not target or target.startswith("#"):
        return None
    lowered = target.lower()
    if re.match(r"^[a-z][a-z0-9+.-]*:", lowered) or target.startswith("//"):
        return None
    decoded = unquote(target.split("#", 1)[0])
    return (source.parent / decoded).resolve()


def inline_path_candidate(value: str) -> str | None:
    candidate = value.strip().rstrip(".,;:")
    if not candidate or "\n" in candidate:
        return None
    if any(token in candidate for token in ("<", ">", "{", "}", "$")):
        return None
    if candidate.startswith(("http://", "https://", "file://")):
        return None
    if " " in candidate and not candidate.startswith("<"):
        return None
    if candidate in ROOT_FILENAMES or candidate == "SKILL.md":
        return candidate
    if candidate.startswith(ROOT_RELATIVE_PREFIXES + SKILL_RELATIVE_PREFIXES + ("./", "../")):
        return candidate
    return None


def resolve_inline_reference(
    candidate: str, source: Path, skill_directory: Path, workspace: Path
) -> Path:
    clean = candidate.split("#", 1)[0]
    clean = re.sub(r":\d+(?::\d+)?$", "", clean)
    if clean == "SKILL.md" or clean.startswith(SKILL_RELATIVE_PREFIXES):
        return (skill_directory / clean).resolve()
    if clean in ROOT_FILENAMES or clean.startswith(ROOT_RELATIVE_PREFIXES):
        return (workspace / clean).resolve()
    if clean.startswith(("./", "../")):
        return (source.parent / clean).resolve()
    return (workspace / clean).resolve()


def collect_references(
    markdown_files: Sequence[Path], skill_directory: Path, workspace: Path
) -> list[ReferenceEvidence]:
    evidence: list[ReferenceEvidence] = []
    seen: set[tuple[str, str, str]] = set()
    for source in markdown_files:
        try:
            text = source.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            continue
        source_name = display_path(source, workspace)
        for raw_target in MARKDOWN_LINK_PATTERN.findall(text):
            target = markdown_target(raw_target)
            resolved = resolve_markdown_reference(source, target)
            if resolved is None:
                continue
            item = ReferenceEvidence(
                source=source_name,
                target=target,
                resolved=display_path(resolved, workspace),
                exists=path_exists(resolved, target),
                kind="markdown-link",
            )
            key = (item.source, item.target, item.kind)
            if key not in seen:
                evidence.append(item)
                seen.add(key)
        if INLINE_PATH_IGNORE_MARKER in text:
            continue
        for inline_value in INLINE_CODE_PATTERN.findall(text):
            candidate = inline_path_candidate(inline_value)
            if candidate is None:
                continue
            resolved = resolve_inline_reference(candidate, source, skill_directory, workspace)
            item = ReferenceEvidence(
                source=source_name,
                target=candidate,
                resolved=display_path(resolved, workspace),
                exists=path_exists(resolved, candidate),
                kind="inline-path-candidate",
            )
            key = (item.source, item.target, item.kind)
            if key not in seen:
                evidence.append(item)
                seen.add(key)
    return sorted(evidence, key=lambda item: (item.source, item.kind, item.target))


def collect_resource_files(skill_directory: Path, workspace: Path) -> dict[str, list[str]]:
    resources: dict[str, list[str]] = {}
    for resource_name in ("references", "scripts", "assets", "evals"):
        resource_directory = skill_directory / resource_name
        if not resource_directory.is_dir():
            resources[resource_name] = []
            continue
        try:
            resources[resource_name] = sorted(
                display_path(path, workspace)
                for path in resource_directory.rglob("*")
                if path.is_file()
            )
        except OSError:
            resources[resource_name] = []
    return resources
