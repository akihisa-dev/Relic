#!/usr/bin/env python3
"""Measure repository-owned instruction surfaces and enforce a stable budget."""

from __future__ import annotations

import argparse
import json
import statistics
import tempfile
from pathlib import Path

from validate_routing_ledger import ROUTING_PHASES, load_json, phase_skills


def character_count(text: str) -> int:
    return len(text)


def frontmatter_description(text: str) -> str:
    lines = text.lstrip("\ufeff").splitlines()
    if not lines or lines[0].strip() != "---":
        return ""
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith("description:"):
            return line.removeprefix("description:").strip()
    return ""


def skill_source_metrics(skill_root: Path) -> dict[str, dict[str, int]]:
    metrics: dict[str, dict[str, int]] = {}
    for skill_path in sorted(skill_root.glob("*/SKILL.md")):
        source = skill_path.read_text(encoding="utf-8")
        name = ""
        for line in source.splitlines():
            if line.startswith("name:"):
                name = line.removeprefix("name:").strip()
                break
        if not name:
            continue
        description = frontmatter_description(source)
        metrics[name] = {
            "sourceChars": character_count(source),
            "sourceBytes": len(source.encode("utf-8")),
            "descriptionChars": character_count(description),
            "descriptionBytes": len(description.encode("utf-8")),
        }
    return metrics


def cumulative_skills(phases: dict[str, list[str]], through_phase: str) -> list[str]:
    selected: list[str] = []
    for phase in ROUTING_PHASES:
        for skill in phases[phase]:
            if skill not in selected:
                selected.append(skill)
        if phase == through_phase:
            break
    return selected


def selected_chars(skills: list[str], source_metrics: dict[str, dict[str, int]]) -> int:
    return sum(source_metrics[skill]["sourceChars"] for skill in skills)


def mean(values: list[int]) -> float:
    return sum(values) / len(values) if values else 0.0


def measure(workspace: Path, ledger_path: Path) -> dict:
    agents_source = (workspace / "AGENTS.md").read_text(encoding="utf-8")
    source_metrics = skill_source_metrics(workspace / ".agents/skills")
    ledger = load_json(ledger_path)
    cases: list[dict] = []
    for case in ledger.get("cases", []):
        phases = phase_skills(case)
        orientation = cumulative_skills(phases, "orientation")
        pre_write = cumulative_skills(phases, "preWrite")
        all_skills = cumulative_skills(phases, "publication")
        cases.append({
            "id": case.get("id"),
            "orientationSkillCount": len(orientation),
            "orientationSkillChars": selected_chars(orientation, source_metrics),
            "preWriteSkillCount": len(pre_write),
            "preWriteSkillChars": selected_chars(pre_write, source_metrics),
            "allSkillCount": len(all_skills),
            "allSkillChars": selected_chars(all_skills, source_metrics),
        })
    description_chars = sum(item["descriptionChars"] for item in source_metrics.values())
    pre_write_chars = [case["preWriteSkillChars"] for case in cases]
    return {
        "measurementUnit": "unicode-code-points",
        "skillCount": len(source_metrics),
        "caseCount": len(cases),
        "alwaysOn": {
            "agentsChars": character_count(agents_source),
            "descriptionChars": description_chars,
            "totalChars": character_count(agents_source) + description_chars,
        },
        "aggregate": {
            "orientationSkillCountMean": mean([
                case["orientationSkillCount"] for case in cases
            ]),
            "preWriteSkillCountMean": mean([
                case["preWriteSkillCount"] for case in cases
            ]),
            "preWriteSkillCharsMedian": (
                statistics.median(pre_write_chars) if pre_write_chars else 0
            ),
            "allSkillCharsMean": mean([
                case["allSkillChars"] for case in cases
            ]),
        },
        "cases": cases,
    }


def budget_errors(metrics: dict, baseline: dict) -> list[str]:
    limits = baseline.get("limits", {})
    checks = [
        (
            "alwaysOn.totalChars",
            metrics["alwaysOn"]["totalChars"],
            limits.get("alwaysOnCharsMax"),
        ),
        (
            "aggregate.orientationSkillCountMean",
            metrics["aggregate"]["orientationSkillCountMean"],
            limits.get("orientationSkillCountMeanMax"),
        ),
        (
            "aggregate.preWriteSkillCountMean",
            metrics["aggregate"]["preWriteSkillCountMean"],
            limits.get("preWriteSkillCountMeanMax"),
        ),
        (
            "aggregate.preWriteSkillCharsMedian",
            metrics["aggregate"]["preWriteSkillCharsMedian"],
            limits.get("preWriteSkillCharsMedianMax"),
        ),
        (
            "aggregate.allSkillCharsMean",
            metrics["aggregate"]["allSkillCharsMean"],
            limits.get("allSkillCharsMeanMax"),
        ),
    ]
    errors = []
    for label, actual, maximum in checks:
        if not isinstance(maximum, (int, float)):
            errors.append(f"missing numeric limit: {label}")
        elif actual > maximum:
            errors.append(f"{label} exceeds budget: {actual:.2f} > {maximum:.2f}")
    return errors


def print_report(metrics: dict, baseline: dict) -> None:
    previous = baseline.get("baseline", {})
    previous_always_on = previous.get("alwaysOnChars", 0)
    current_always_on = metrics["alwaysOn"]["totalChars"]
    reduction = (
        (previous_always_on - current_always_on) / previous_always_on * 100
        if previous_always_on
        else 0.0
    )
    aggregate = metrics["aggregate"]
    print("Instruction budget check:")
    print(
        f"- always-on chars: {previous_always_on} -> {current_always_on} "
        f"({reduction:.1f}% reduction)"
    )
    print(
        "- orientation skills mean: "
        f"{previous.get('selectedSkillCountMean', 0):.2f} -> "
        f"{aggregate['orientationSkillCountMean']:.2f}"
    )
    print(
        "- pre-write skills mean: "
        f"{previous.get('selectedSkillCountMean', 0):.2f} -> "
        f"{aggregate['preWriteSkillCountMean']:.2f}"
    )
    print(
        "- pre-write skill chars median: "
        f"{previous.get('selectedSkillCharsMedian', 0):.0f} -> "
        f"{aggregate['preWriteSkillCharsMedian']:.0f}"
    )
    print(
        "- all selected skill chars mean: "
        f"{previous.get('selectedSkillCharsMean', 0):.0f} -> "
        f"{aggregate['allSkillCharsMean']:.0f}"
    )


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="relic-instruction-budget-") as directory:
        workspace = Path(directory)
        (workspace / "AGENTS.md").write_text("# Rules\n", encoding="utf-8")
        for name in ("entry", "guard", "commit"):
            skill_dir = workspace / f".agents/skills/{name}"
            skill_dir.mkdir(parents=True)
            (skill_dir / "SKILL.md").write_text(
                f"---\nname: {name}\ndescription: {name} description\n---\nbody\n",
                encoding="utf-8",
            )
        phases = {
            "orientation": ["entry"],
            "preWrite": ["guard"],
            "verification": [],
            "commit": ["commit"],
            "publication": [],
        }
        ledger_path = workspace / "ledger.json"
        ledger_path.write_text(
            json.dumps({"version": 2, "cases": [{
                "id": "case",
                "expectedSkillsByPhase": phases,
            }]}),
            encoding="utf-8",
        )
        metrics = measure(workspace, ledger_path)
        assert metrics["skillCount"] == 3
        assert metrics["caseCount"] == 1
        assert metrics["aggregate"]["orientationSkillCountMean"] == 1
        assert metrics["aggregate"]["preWriteSkillCountMean"] == 2
        assert metrics["cases"][0]["allSkillCount"] == 3
        baseline = {
            "limits": {
                "alwaysOnCharsMax": metrics["alwaysOn"]["totalChars"],
                "orientationSkillCountMeanMax": 1,
                "preWriteSkillCountMeanMax": 2,
                "preWriteSkillCharsMedianMax": metrics["aggregate"]["preWriteSkillCharsMedian"],
                "allSkillCharsMeanMax": metrics["aggregate"]["allSkillCharsMean"],
            }
        }
        assert budget_errors(metrics, baseline) == []
        baseline["limits"]["orientationSkillCountMeanMax"] = 0
        assert any("orientationSkillCountMean" in error for error in budget_errors(metrics, baseline))
    print("instruction-budget self-test: ok")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--baseline")
    parser.add_argument("--format", choices=("summary", "json"), default="summary")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    workspace = Path(args.workspace).resolve()
    reference_root = workspace / ".agents/skills/relic-audit-skills/references"
    ledger_path = reference_root / "routing-cases.json"
    baseline_path = (
        Path(args.baseline).resolve()
        if args.baseline
        else reference_root / "instruction-budget-baseline.json"
    )
    metrics = measure(workspace, ledger_path)
    baseline = load_json(baseline_path)
    errors = budget_errors(metrics, baseline)
    if args.format == "json":
        print(json.dumps(
            {"metrics": metrics, "baseline": baseline, "errors": errors},
            ensure_ascii=False,
            indent=2,
        ))
    else:
        print_report(metrics, baseline)
        if errors:
            print("Instruction budget check failed:")
            for error in errors:
                print(f"- {error}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
