"""Render collected Skill evidence as a compact Markdown inventory."""

from __future__ import annotations


def markdown_escape(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def render_markdown(evidence: dict[str, object]) -> str:
    summary = evidence["summary"]
    skills = evidence["skills"]
    lines = [
        "# Skill evidence",
        "",
        f"- Skills: {summary['skill_count']}",
        f"- Structural issues: {summary['structural_issue_count']}",
        f"- Missing references: {summary['missing_reference_count']}",
        f"- Missing reference candidates: {summary['missing_reference_candidate_count']}",
        f"- Duplicate names: {summary['duplicate_name_count']}",
        "",
        "## Inventory",
        "",
        "| Name | Description | Path | Related Skills | Issues |",
        "|---|---|---|---|---|",
    ]
    for skill in skills:
        lines.append(
            "| {name} | {description} | {path} | {related} | {issues} |".format(
                name=markdown_escape(skill["name"]),
                description=markdown_escape(skill["description"]),
                path=markdown_escape(skill["skill_file"]),
                related=markdown_escape(", ".join(skill["referenced_skills"]) or "-"),
                issues=markdown_escape(", ".join(skill["issues"]) or "-"),
            )
        )
    lines.extend(["", "## Similarity candidates", ""])
    similarities = evidence["similarity_candidates"]
    if similarities:
        lines.extend(["| Left | Right | Jaccard score |", "|---|---|---|"])
        for candidate in similarities:
            lines.append(
                f"| {candidate['left']} | {candidate['right']} | {candidate['score']} |"
            )
    else:
        lines.append("None at the selected threshold.")
    lines.extend(["", "## Missing references", ""])
    missing = evidence["missing_references"]
    if missing:
        lines.extend(["| Skill | Source | Target | Kind |", "|---|---|---|---|"])
        for item in missing:
            lines.append(
                "| {skill} | {source} | {target} | {kind} |".format(
                    skill=markdown_escape(item["skill"]),
                    source=markdown_escape(item["source"]),
                    target=markdown_escape(item["target"]),
                    kind=markdown_escape(item["kind"]),
                )
            )
    else:
        lines.append("None detected.")
    lines.extend(["", "## Missing reference candidates", ""])
    candidates = evidence["missing_reference_candidates"]
    if candidates:
        lines.extend(["| Skill | Source | Target | Kind |", "|---|---|---|---|"])
        for item in candidates:
            lines.append(
                "| {skill} | {source} | {target} | {kind} |".format(
                    skill=markdown_escape(item["skill"]),
                    source=markdown_escape(item["source"]),
                    target=markdown_escape(item["target"]),
                    kind=markdown_escape(item["kind"]),
                )
            )
    else:
        lines.append("None detected.")
    return "\n".join(lines)
