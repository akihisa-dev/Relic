#!/usr/bin/env python3
"""Validate the routing ledger and separate static expectations from executions."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
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
STATIC_STATUSES = {"static-pass", "static-fail", "not-reviewed"}
COMMIT_HASH_PATTERN = re.compile(r"^[0-9a-f]{40}$")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


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


def routing_surface_digest(workspace: Path, ledger_path: Path) -> str:
    digest = hashlib.sha256()
    paths = [workspace / "AGENTS.md", ledger_path]
    paths.extend(sorted((workspace / ".agents/skills").glob("*/SKILL.md")))
    for path in paths:
        relative_path = path.relative_to(workspace)
        digest.update(relative_path.as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def commit_exists(workspace: Path, commit_hash: str) -> bool | None:
    if not (workspace / ".git").exists():
        return None
    result = subprocess.run(
        ["git", "cat-file", "-e", f"{commit_hash}^{{commit}}"],
        cwd=workspace,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def evidence_freshness(recorded_digest: str | None, current_digest: str) -> str:
    return "current" if recorded_digest == current_digest else "stale"


def current_execution_cases(results: dict, current_digest: str) -> set[str]:
    return {
        case.get("caseId")
        for case in results.get("cases", [])
        if case.get("execution", {}).get("status") == "execution-pass"
        and case.get("execution", {}).get("routingSurfaceDigest") == current_digest
    }


def validate(
    workspace: Path,
    ledger_path: Path,
    results_path: Path,
    *,
    known_commits: set[str] | None = None,
) -> list[str]:
    errors: list[str] = []
    ledger = load_json(ledger_path)
    results = load_json(results_path)
    if ledger.get("version") != 1:
        errors.append(f"unsupported routing case schema version: {ledger.get('version')}")
    if results.get("version") != 2:
        errors.append(f"unsupported routing result schema version: {results.get('version')}")
    skills = repository_skill_names(workspace / ".agents/skills")
    cases = ledger.get("cases", [])
    case_ids: set[str] = set()
    covered_skills: set[str] = set()
    for case in cases:
        missing = REQUIRED_CASE_FIELDS - set(case)
        if missing:
            errors.append(f"{case.get('id', '<missing>')}: missing fields: {', '.join(sorted(missing))}")
        case_id = case.get("id")
        if not case_id or case_id in case_ids:
            errors.append(f"duplicate or missing case id: {case_id}")
        case_ids.add(case_id)
        expected = {case.get("expectedEntrySkill")}
        expected.update(case.get("expectedSpecialistSkills", []))
        named = set(expected)
        named.update(case.get("forbiddenSkills", []))
        unknown = {name for name in named if name and name not in skills}
        if unknown:
            errors.append(f"{case_id}: unknown skills: {', '.join(sorted(unknown))}")
        covered_skills.update(name for name in expected if name in skills)
        for required_doc in case.get("requiredDocs", []):
            if not (workspace / required_doc).exists():
                errors.append(f"{case_id}: required document does not exist: {required_doc}")

    uncovered = skills - covered_skills
    if uncovered:
        errors.append(f"repository-owned skills missing from routing cases: {', '.join(sorted(uncovered))}")

    case_by_id = {case.get("id"): case for case in cases}
    result_entries = results.get("cases", [])
    result_ids = [entry.get("caseId") for entry in result_entries]
    duplicate_result_ids = sorted({
        case_id for case_id in result_ids if case_id and result_ids.count(case_id) > 1
    })
    if duplicate_result_ids:
        errors.append(f"duplicate routing result case IDs: {', '.join(duplicate_result_ids)}")
    result_by_case = {entry.get("caseId"): entry for entry in result_entries}
    if set(result_by_case) != case_ids:
        errors.append("routing result case IDs must exactly match the ledger")
    for case_id, result in result_by_case.items():
        static_status = result.get("staticStatus")
        if static_status not in STATIC_STATUSES:
            errors.append(f"{case_id}: invalid staticStatus: {static_status}")
        if static_status in {"static-fail", "not-reviewed"} and not result.get("staticReason"):
            errors.append(f"{case_id}: {static_status} requires staticReason")
        execution = result.get("execution", {})
        status = execution.get("status")
        if status not in EXECUTION_STATUSES:
            errors.append(f"{case_id}: invalid execution status: {status}")
        if status in {"not-executed", "environment-mismatch", "execution-fail"} and not execution.get("reason"):
            errors.append(f"{case_id}: {status} requires a reason")
        if status in {"execution-pass", "execution-fail"} and not execution.get("actualSkills"):
            errors.append(f"{case_id}: {status} requires actualSkills")
        if status in {"execution-pass", "execution-fail"}:
            execution_head = execution.get("head")
            if not isinstance(execution_head, str) or not COMMIT_HASH_PATTERN.fullmatch(execution_head):
                errors.append(f"{case_id}: {status} requires a full execution head")
            else:
                exists = (
                    execution_head in known_commits
                    if known_commits is not None
                    else commit_exists(workspace, execution_head)
                )
                if exists is False:
                    errors.append(f"{case_id}: execution head does not exist: {execution_head}")
            surface_digest = execution.get("routingSurfaceDigest")
            if not isinstance(surface_digest, str) or not SHA256_PATTERN.fullmatch(surface_digest):
                errors.append(f"{case_id}: {status} requires routingSurfaceDigest")
        actual_unknown = sorted(set(execution.get("actualSkills", [])) - skills)
        if actual_unknown:
            errors.append(f"{case_id}: execution contains unknown skills: {', '.join(actual_unknown)}")
        if status == "execution-pass" and case_id in case_by_id:
            case = case_by_id[case_id]
            actual_skills = set(execution.get("actualSkills", []))
            expected_skills = {
                case.get("expectedEntrySkill"),
                *case.get("expectedSpecialistSkills", []),
            }
            missing_expected = sorted(skill for skill in expected_skills if skill and skill not in actual_skills)
            selected_forbidden = sorted(set(case.get("forbiddenSkills", [])) & actual_skills)
            if missing_expected:
                errors.append(
                    f"{case_id}: execution-pass is missing expected skills: "
                    f"{', '.join(missing_expected)}"
                )
            if selected_forbidden:
                errors.append(
                    f"{case_id}: execution-pass selected forbidden skills: "
                    f"{', '.join(selected_forbidden)}"
                )

    environment = results.get("environment", {})
    for field in [
        "repository", "head", "skillRoot", "externalCatalogs", "historyScope",
        "executionAvailable", "routingSurfaceDigest",
    ]:
        if field not in environment:
            errors.append(f"results environment missing: {field}")
    environment_head = environment.get("head")
    if not isinstance(environment_head, str) or not COMMIT_HASH_PATTERN.fullmatch(environment_head):
        errors.append("results environment head must be a full commit hash")
    else:
        exists = (
            environment_head in known_commits
            if known_commits is not None
            else commit_exists(workspace, environment_head)
        )
        if exists is False:
            errors.append(f"results environment head does not exist: {environment_head}")
    environment_digest = environment.get("routingSurfaceDigest")
    if not isinstance(environment_digest, str) or not SHA256_PATTERN.fullmatch(environment_digest):
        errors.append("results environment routingSurfaceDigest must be a SHA-256 digest")
    return errors


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="relic-routing-ledger-") as directory:
        workspace = Path(directory)
        (workspace / "AGENTS.md").write_text("# Test rules\n", encoding="utf-8")
        for name in ("example", "specialist", "forbidden"):
            skill_dir = workspace / f".agents/skills/{name}"
            skill_dir.mkdir(parents=True)
            (skill_dir / "SKILL.md").write_text(
                f"---\nname: {name}\ndescription: {name}\n---\n",
                encoding="utf-8",
            )
        ledger = {"version": 1, "cases": [
            {
                "id": "case", "request": "request", "expectedEntrySkill": "example",
                "expectedSpecialistSkills": ["specialist"], "forbiddenSkills": ["forbidden"],
                "requiredDocs": [], "permissionMode": "read-only",
                "expectedEndState": "reported", "misrouteImpact": "none",
            },
            {
                "id": "forbidden-positive", "request": "positive request",
                "expectedEntrySkill": "forbidden", "expectedSpecialistSkills": [],
                "forbiddenSkills": [], "requiredDocs": [], "permissionMode": "read-only",
                "expectedEndState": "reported", "misrouteImpact": "none",
            },
        ]}
        ledger_path = workspace / "ledger.json"
        results_path = workspace / "results.json"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        surface_digest = routing_surface_digest(workspace, ledger_path)
        valid_head = "1" * 40
        results = {"version": 2, "environment": {
            "repository": "example/repo", "head": valid_head, "skillRoot": ".agents/skills",
            "externalCatalogs": [], "historyScope": "full", "executionAvailable": False,
            "routingSurfaceDigest": surface_digest,
        }, "cases": [
            {"caseId": "case", "staticStatus": "static-pass", "execution": {
                "status": "not-executed", "reason": "test environment"
            }},
            {"caseId": "forbidden-positive", "staticStatus": "not-reviewed",
             "staticReason": "fixture", "execution": {
                "status": "not-executed", "reason": "test environment"
            }},
        ]}
        results_path.write_text(json.dumps(results), encoding="utf-8")
        initial_errors = validate(
            workspace, ledger_path, results_path, known_commits={valid_head}
        )
        assert initial_errors == [], initial_errors
        assert evidence_freshness(surface_digest, routing_surface_digest(workspace, ledger_path)) == "current"
        (workspace / ".agents/skills/example/SKILL.md").write_text(
            "---\nname: example\ndescription: changed\n---\n",
            encoding="utf-8",
        )
        changed_digest = routing_surface_digest(workspace, ledger_path)
        assert evidence_freshness(surface_digest, changed_digest) == "stale"
        (workspace / ".agents/skills/example/SKILL.md").write_text(
            "---\nname: example\ndescription: example\n---\n",
            encoding="utf-8",
        )
        del results["cases"][1]["staticReason"]
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "not-reviewed requires staticReason" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        results["cases"][1]["staticReason"] = "fixture"
        results["version"] = 1
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "unsupported routing result schema version" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        results["version"] = 2
        results_path.write_text(json.dumps(results), encoding="utf-8")
        ledger["cases"][0]["expectedEntrySkill"] = "missing"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        assert any(
            "unknown skills" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        ledger["cases"][0]["expectedEntrySkill"] = "example"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        results["cases"][0]["execution"] = {
            "status": "execution-pass",
            "actualSkills": ["example", "specialist"],
            "head": valid_head,
            "routingSurfaceDigest": surface_digest,
        }
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert validate(workspace, ledger_path, results_path, known_commits={valid_head}) == []
        assert current_execution_cases(results, surface_digest) == {"case"}
        assert current_execution_cases(results, "0" * 64) == set()
        results["cases"][0]["execution"]["actualSkills"] = ["example"]
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "missing expected skills" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        results["cases"][0]["execution"]["actualSkills"] = ["example", "specialist", "forbidden"]
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "selected forbidden skills" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        results["cases"][0]["execution"]["actualSkills"] = ["example", "specialist", "missing"]
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "execution contains unknown skills" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        results["cases"][0]["execution"]["actualSkills"] = ["example", "specialist"]
        results["cases"][0]["execution"]["head"] = "2" * 40
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "execution head does not exist" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        del results["cases"][0]["execution"]["head"]
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "requires a full execution head" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        ledger["cases"] = [ledger["cases"][0]]
        results["cases"] = [results["cases"][0]]
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "repository-owned skills missing from routing cases: forbidden" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        results["cases"] = [results["cases"][0], results["cases"][0]]
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "duplicate routing result case IDs" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
    print("routing-ledger self-test: ok")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--require-current-execution", action="append", default=[])
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
    results = load_json(reference_root / "routing-results.json")
    current_surface_digest = routing_surface_digest(
        workspace, reference_root / "routing-cases.json"
    )
    environment_digest = results.get("environment", {}).get("routingSurfaceDigest")
    static_freshness = evidence_freshness(environment_digest, current_surface_digest)
    statuses: dict[str, int] = {}
    for case in results.get("cases", []):
        execution = case.get("execution", {})
        status = execution.get("status", "missing")
        statuses[status] = statuses.get(status, 0) + 1
    current_cases = current_execution_cases(results, current_surface_digest)
    missing_current = sorted(set(args.require_current_execution) - current_cases)
    if missing_current:
        print(
            "Skill routing ledger lacks current execution evidence for: "
            + ", ".join(missing_current)
        )
        return 1
    summary = ", ".join(f"{name}={count}" for name, count in sorted(statuses.items()))
    print(
        "Skill routing ledger metadata is valid; this does not prove current routing quality "
        f"({len(repository_skill_names(workspace / '.agents/skills'))} repository-owned skills; "
        f"static-evidence={static_freshness}; current-execution-pass={len(current_cases)}; "
        f"{summary})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
