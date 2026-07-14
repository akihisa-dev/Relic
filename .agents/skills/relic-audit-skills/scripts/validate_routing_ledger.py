#!/usr/bin/env python3
"""Validate the routing ledger and separate static expectations from executions."""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from pathlib import Path

REQUIRED_CASE_FIELDS = {
    "id", "request", "expectedEntrySkill", "expectedSpecialistSkills",
    "forbiddenSkills", "requiredDocs", "permissionMode", "expectedEndState",
    "misrouteImpact",
}
EXECUTION_STATUSES = {
    "execution-pass", "execution-fail", "not-executed", "environment-mismatch"
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def repository_skill_names(skill_root: Path) -> set[str]:
    names: set[str] = set()
    for skill_path in skill_root.glob("*/SKILL.md"):
        for line in skill_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("name:"):
                names.add(line.removeprefix("name:").strip())
                break
    return names


def skill_description_digest(skill_root: Path) -> str:
    entries: list[tuple[str, str]] = []
    for skill_path in skill_root.glob("*/SKILL.md"):
        fields: dict[str, str] = {}
        for line in skill_path.read_text(encoding="utf-8").splitlines()[1:]:
            if line == "---":
                break
            if ": " in line:
                key, value = line.split(": ", 1)
                fields[key] = value
        entries.append((fields.get("name", ""), fields.get("description", "")))
    payload = "".join(f"{name}\0{description}\n" for name, description in sorted(entries))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def validate(workspace: Path, ledger_path: Path, results_path: Path) -> list[str]:
    errors: list[str] = []
    ledger = load_json(ledger_path)
    results = load_json(results_path)
    skills = repository_skill_names(workspace / ".agents/skills")
    cases = ledger.get("cases", [])
    case_ids: set[str] = set()
    covered_skills: set[str] = set()
    actual_digest = skill_description_digest(workspace / ".agents/skills")
    if ledger.get("skillDescriptionDigest") != actual_digest:
        errors.append("Skill names or descriptions changed; review routing cases and update skillDescriptionDigest")

    for case in cases:
        missing = REQUIRED_CASE_FIELDS - set(case)
        if missing:
            errors.append(f"{case.get('id', '<missing>')}: missing fields: {', '.join(sorted(missing))}")
        case_id = case.get("id")
        if not case_id or case_id in case_ids:
            errors.append(f"duplicate or missing case id: {case_id}")
        case_ids.add(case_id)
        named = {case.get("expectedEntrySkill")}
        named.update(case.get("expectedSpecialistSkills", []))
        named.update(case.get("forbiddenSkills", []))
        unknown = {name for name in named if name and name not in skills}
        if unknown:
            errors.append(f"{case_id}: unknown skills: {', '.join(sorted(unknown))}")
        covered_skills.update(name for name in named if name in skills)
        for required_doc in case.get("requiredDocs", []):
            if not (workspace / required_doc).exists():
                errors.append(f"{case_id}: required document does not exist: {required_doc}")

    uncovered = skills - covered_skills
    if uncovered:
        errors.append(f"repository-owned skills missing from routing cases: {', '.join(sorted(uncovered))}")

    result_by_case = {entry.get("caseId"): entry for entry in results.get("cases", [])}
    if set(result_by_case) != case_ids:
        errors.append("routing result case IDs must exactly match the ledger")
    for case_id, result in result_by_case.items():
        if result.get("staticStatus") != "static-pass":
            errors.append(f"{case_id}: staticStatus must be static-pass after ledger validation")
        execution = result.get("execution", {})
        status = execution.get("status")
        if status not in EXECUTION_STATUSES:
            errors.append(f"{case_id}: invalid execution status: {status}")
        if status in {"not-executed", "environment-mismatch", "execution-fail"} and not execution.get("reason"):
            errors.append(f"{case_id}: {status} requires a reason")
        if status in {"execution-pass", "execution-fail"} and not execution.get("actualSkills"):
            errors.append(f"{case_id}: {status} requires actualSkills")

    environment = results.get("environment", {})
    for field in ["repository", "head", "skillRoot", "externalCatalogs", "historyScope", "executionAvailable"]:
        if field not in environment:
            errors.append(f"results environment missing: {field}")
    return errors


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="relic-routing-ledger-") as directory:
        workspace = Path(directory)
        skill_dir = workspace / ".agents/skills/example"
        skill_dir.mkdir(parents=True)
        (skill_dir / "SKILL.md").write_text("---\nname: example\ndescription: example\n---\n", encoding="utf-8")
        ledger = {"version": 1, "skillDescriptionDigest": skill_description_digest(workspace / ".agents/skills"), "cases": [{
            "id": "case", "request": "request", "expectedEntrySkill": "example",
            "expectedSpecialistSkills": [], "forbiddenSkills": [], "requiredDocs": [],
            "permissionMode": "read-only", "expectedEndState": "reported",
            "misrouteImpact": "none"
        }]}
        results = {"version": 1, "environment": {
            "repository": "example/repo", "head": "0" * 40, "skillRoot": ".agents/skills",
            "externalCatalogs": [], "historyScope": "full", "executionAvailable": False
        }, "cases": [{"caseId": "case", "staticStatus": "static-pass", "execution": {
            "status": "not-executed", "reason": "test environment"
        }}]}
        ledger_path = workspace / "ledger.json"
        results_path = workspace / "results.json"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert validate(workspace, ledger_path, results_path) == []
        ledger["cases"][0]["expectedEntrySkill"] = "missing"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        assert any("unknown skills" in error for error in validate(workspace, ledger_path, results_path))
    print("routing-ledger self-test: ok")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    workspace = Path(args.workspace).resolve()
    reference_root = workspace / ".agents/skills/relic-audit-skills/references"
    errors = validate(workspace, reference_root / "routing-cases.json", reference_root / "routing-results.json")
    if errors:
        print("Skill routing ledger validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Skill routing ledger is valid ({len(repository_skill_names(workspace / '.agents/skills'))} repository-owned skills).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
