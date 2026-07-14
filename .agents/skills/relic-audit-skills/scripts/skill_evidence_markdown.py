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
        f"- Repository-owned Skills: {summary['repository_skill_count']}",
        f"- External Skills: {summary['external_skill_count']}",
        (
            "- Repository structural issues: "
            f"{summary['repository_structural_issue_count']}"
        ),
        (
            "- External informational findings: "
            f"{summary['external_informational_finding_count']}"
        ),
        f"- Repository missing references: {summary['missing_reference_count']}",
        (
            "- External missing references: "
            f"{summary['external_missing_reference_count']}"
        ),
        f"- Missing reference candidates: {summary['missing_reference_candidate_count']}",
        f"- Repository duplicate names: {summary['duplicate_name_count']}",
        (
            "- Consolidated catalog duplicate groups: "
            f"{summary['catalog_duplicate_group_count']}"
        ),
        f"- Catalog name variants: {summary['catalog_name_variant_count']}",
        "",
        "## Inventory",
        "",
        "| Name | Scope | Variant | Description | Path / catalog locations | Related Skills | Issues / findings |",
        "|---|---|---|---|---|---|---|",
    ]
    for skill in skills:
        locations = skill["catalog_locations"] or [skill["skill_file"]]
        findings = [*skill["issues"], *skill["informational_findings"]]
        lines.append(
            "| {name} | {scope} | {variant} | {description} | {paths} | {related} | {issues} |".format(
                name=markdown_escape(skill["name"]),
                scope=markdown_escape(skill["scope"]),
                variant=markdown_escape(skill["catalog_variant_id"] or "-"),
                description=markdown_escape(skill["description"]),
                paths=markdown_escape(", ".join(locations)),
                related=markdown_escape(", ".join(skill["referenced_skills"]) or "-"),
                issues=markdown_escape(", ".join(findings) or "-"),
            )
        )
    lines.extend(["", "## External informational findings", ""])
    external_findings = evidence["external_informational_findings"]
    if external_findings:
        lines.extend(["| Skill | Skill file | Finding |", "|---|---|---|"])
        for item in external_findings:
            lines.append(
                "| {skill} | {skill_file} | {finding} |".format(
                    skill=markdown_escape(item["skill"]),
                    skill_file=markdown_escape(item["skill_file"]),
                    finding=markdown_escape(item["finding"]),
                )
            )
    else:
        lines.append("None detected.")
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
    lines.extend(["", "## External missing references", ""])
    external_missing = evidence["external_missing_references"]
    if external_missing:
        lines.extend(["| Skill | Source | Target | Kind |", "|---|---|---|---|"])
        for item in external_missing:
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
    lines.extend(["", "## Catalog name variants", ""])
    catalog_variants = evidence["catalog_name_variants"]
    if catalog_variants:
        lines.extend(["| Name | Variant | Scope | Locations |", "|---|---|---|---|"])
        for item in catalog_variants:
            for variant in item["variants"]:
                lines.append(
                    "| {name} | {variant} | {scope} | {locations} |".format(
                        name=markdown_escape(item["name"]),
                        variant=markdown_escape(variant["variant_id"]),
                        scope=markdown_escape(variant["scope"]),
                        locations=markdown_escape(", ".join(variant["skill_files"])),
                    )
                )
    else:
        lines.append("None detected.")
    return "\n".join(lines)
