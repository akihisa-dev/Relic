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
    "id", "request", "expectedSkillsByPhase",
    "forbiddenSkills", "requiredDocs", "permissionMode", "expectedEndState",
    "misrouteImpact",
}
ROUTING_PHASES = ("orientation", "preWrite", "verification", "commit", "publication")
EXECUTION_STATUSES = {
    "execution-pass", "execution-fail", "not-executed", "environment-mismatch"
}
STATIC_STATUSES = {"static-pass", "static-fail", "not-reviewed"}
COMMIT_HASH_PATTERN = re.compile(r"^[0-9a-f]{40}$")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
LOCAL_MUTATION_MARKERS = ("local-change", "local-commit")
GUI_REQUEST_MARKERS = ("実画面", "起動", "操作確認", "スクリーンショット")


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


def phase_skills(case: dict) -> dict[str, list[str]]:
    phases = case.get("expectedSkillsByPhase", {})
    return {
        phase: phases.get(phase, []) if isinstance(phases, dict) else []
        for phase in ROUTING_PHASES
    }


def flattened_phase_skills(phases: dict[str, list[str]]) -> list[str]:
    return [
        skill
        for phase in ROUTING_PHASES
        for skill in phases.get(phase, [])
    ]


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
    if ledger.get("version") != 2:
        errors.append(f"unsupported routing case schema version: {ledger.get('version')}")
    if results.get("version") != 3:
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
        raw_phases = case.get("expectedSkillsByPhase")
        if not isinstance(raw_phases, dict):
            errors.append(f"{case_id}: expectedSkillsByPhase must be an object")
            raw_phases = {}
        unknown_phases = sorted(set(raw_phases) - set(ROUTING_PHASES))
        missing_phases = sorted(set(ROUTING_PHASES) - set(raw_phases))
        if unknown_phases:
            errors.append(f"{case_id}: unknown routing phases: {', '.join(unknown_phases)}")
        if missing_phases:
            errors.append(f"{case_id}: missing routing phases: {', '.join(missing_phases)}")
        phases = phase_skills(case)
        for phase, phase_entries in phases.items():
            if not isinstance(phase_entries, list) or not all(
                isinstance(skill, str) and skill for skill in phase_entries
            ):
                errors.append(f"{case_id}: {phase} skills must be non-empty strings")
            if len(phase_entries) != len(set(phase_entries)):
                errors.append(f"{case_id}: duplicate skills in {phase} phase")
        expected_list = flattened_phase_skills(phases)
        duplicate_expected = sorted({
            skill for skill in expected_list if expected_list.count(skill) > 1
        })
        if duplicate_expected:
            errors.append(
                f"{case_id}: skills must have one owning phase: {', '.join(duplicate_expected)}"
            )
        permission_mode = case.get("permissionMode", "")
        if (
            not phases["orientation"]
            and not permission_mode.startswith("read-only-stop")
        ):
            errors.append(f"{case_id}: orientation phase must contain the entry skill")
        expected = set(expected_list)
        named = set(expected)
        named.update(case.get("forbiddenSkills", []))
        unknown = {name for name in named if name and name not in skills}
        if unknown:
            errors.append(f"{case_id}: unknown skills: {', '.join(sorted(unknown))}")
        covered_skills.update(name for name in expected if name in skills)
        expected_skills = {name for name in expected if name}
        forbidden_skills = set(case.get("forbiddenSkills", []))
        if any(marker in permission_mode for marker in LOCAL_MUTATION_MARKERS):
            if "relic-guard-task" not in set(phases["preWrite"]):
                errors.append(
                    f"{case_id}: local mutation case must use relic-guard-task in preWrite"
                )
            commit_phase_skills = set(phases["commit"])
            if permission_mode.startswith("local-commit"):
                commit_phase_skills.update(
                    set(phases["orientation"])
                    & {"relic-manage-version", "relic-commit"}
                )
            missing_commit_skills = {
                "relic-manage-version", "relic-commit"
            } - commit_phase_skills
            if missing_commit_skills:
                errors.append(
                    f"{case_id}: local mutation case is missing commit phase skills: "
                    f"{', '.join(sorted(missing_commit_skills))}"
                )
        if permission_mode.startswith("read-only"):
            missing_forbidden = {
                "relic-manage-version", "relic-commit"
            } - forbidden_skills
            if missing_forbidden:
                errors.append(
                    f"{case_id}: read-only case must forbid: "
                    f"{', '.join(sorted(missing_forbidden))}"
                )
        if "relic-test-development-app" in expected_skills:
            request = case.get("request", "")
            if (
                "explicit" not in permission_mode
                or not any(marker in request for marker in GUI_REQUEST_MARKERS)
            ):
                errors.append(
                    f"{case_id}: development-app testing requires an explicit GUI request"
                )
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
        actual_phases = execution.get("actualSkillsByPhase")
        if status in {"execution-pass", "execution-fail"} and not isinstance(actual_phases, dict):
            errors.append(f"{case_id}: {status} requires actualSkillsByPhase")
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
        normalized_actual_phases = {
            phase: actual_phases.get(phase, []) if isinstance(actual_phases, dict) else []
            for phase in ROUTING_PHASES
        }
        if isinstance(actual_phases, dict):
            unknown_actual_phases = sorted(set(actual_phases) - set(ROUTING_PHASES))
            if unknown_actual_phases:
                errors.append(
                    f"{case_id}: execution has unknown phases: "
                    f"{', '.join(unknown_actual_phases)}"
                )
        actual_list = flattened_phase_skills(normalized_actual_phases)
        actual_unknown = sorted(set(actual_list) - skills)
        if actual_unknown:
            errors.append(f"{case_id}: execution contains unknown skills: {', '.join(actual_unknown)}")
        if status == "execution-pass" and case_id in case_by_id:
            case = case_by_id[case_id]
            expected_phases = phase_skills(case)
            expected_skills = set(flattened_phase_skills(expected_phases))
            actual_skills = set(actual_list)
            for phase in ROUTING_PHASES:
                missing_expected = sorted(
                    set(expected_phases[phase]) - set(normalized_actual_phases[phase])
                )
                if missing_expected:
                    errors.append(
                        f"{case_id}: execution-pass is missing {phase} skills: "
                        f"{', '.join(missing_expected)}"
                    )
            unexpected_skills = sorted(actual_skills - expected_skills)
            if unexpected_skills:
                errors.append(
                    f"{case_id}: execution-pass selected unexpected skills: "
                    f"{', '.join(unexpected_skills)}"
                )
            selected_forbidden = sorted(set(case.get("forbiddenSkills", [])) & actual_skills)
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
        for name in (
            "example", "specialist", "forbidden", "relic-test-development-app",
            "relic-guard-task", "relic-manage-version", "relic-commit",
        ):
            skill_dir = workspace / f".agents/skills/{name}"
            skill_dir.mkdir(parents=True)
            (skill_dir / "SKILL.md").write_text(
                f"---\nname: {name}\ndescription: {name}\n---\n",
                encoding="utf-8",
            )
        empty_phases = {
            "orientation": [],
            "preWrite": [],
            "verification": [],
            "commit": [],
            "publication": [],
        }
        ledger = {"version": 2, "cases": [
            {
                "id": "case", "request": "request",
                "expectedSkillsByPhase": {
                    **empty_phases,
                    "orientation": ["example", "specialist"],
                },
                "forbiddenSkills": ["forbidden"],
                "requiredDocs": [], "permissionMode": "analysis-only",
                "expectedEndState": "reported", "misrouteImpact": "none",
            },
            {
                "id": "forbidden-positive", "request": "実画面を操作確認する",
                "expectedSkillsByPhase": {
                    **empty_phases,
                    "orientation": ["forbidden"],
                    "verification": ["relic-test-development-app"],
                },
                "forbiddenSkills": [], "requiredDocs": [],
                "permissionMode": "explicit-gui-check",
                "expectedEndState": "reported", "misrouteImpact": "none",
            },
            {
                "id": "local-change", "request": "change",
                "expectedSkillsByPhase": {
                    **empty_phases,
                    "orientation": ["example"],
                    "preWrite": ["relic-guard-task"],
                    "commit": ["relic-manage-version", "relic-commit"],
                },
                "forbiddenSkills": [], "requiredDocs": [],
                "permissionMode": "local-change",
                "expectedEndState": "committed", "misrouteImpact": "none",
            },
        ]}
        ledger_path = workspace / "ledger.json"
        results_path = workspace / "results.json"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        surface_digest = routing_surface_digest(workspace, ledger_path)
        valid_head = "1" * 40
        results = {"version": 3, "environment": {
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
            {"caseId": "local-change", "staticStatus": "static-pass", "execution": {
                "status": "not-executed", "reason": "test environment"
            }},
        ]}
        results_path.write_text(json.dumps(results), encoding="utf-8")
        initial_errors = validate(
            workspace, ledger_path, results_path, known_commits={valid_head}
        )
        assert initial_errors == [], initial_errors
        ledger["cases"][1]["request"] = "positive request"
        ledger["cases"][1]["permissionMode"] = "gui-check"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        assert any(
            "development-app testing requires an explicit GUI request" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        ledger["cases"][1]["request"] = "実画面を操作確認する"
        ledger["cases"][1]["permissionMode"] = "explicit-gui-check"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
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
        results["version"] = 3
        results_path.write_text(json.dumps(results), encoding="utf-8")
        ledger["cases"][0]["expectedSkillsByPhase"]["orientation"][0] = "missing"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        assert any(
            "unknown skills" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        ledger["cases"][0]["expectedSkillsByPhase"]["orientation"][0] = "example"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        results["cases"][0]["execution"] = {
            "status": "execution-pass",
            "actualSkillsByPhase": {
                **empty_phases,
                "orientation": ["example", "specialist"],
            },
            "head": valid_head,
            "routingSurfaceDigest": surface_digest,
        }
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert validate(workspace, ledger_path, results_path, known_commits={valid_head}) == []
        assert current_execution_cases(results, surface_digest) == {"case"}
        assert current_execution_cases(results, "0" * 64) == set()
        results["cases"][0]["execution"]["actualSkillsByPhase"]["orientation"] = ["example"]
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "missing orientation skills" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        results["cases"][0]["execution"]["actualSkillsByPhase"]["orientation"] = [
            "example", "specialist", "forbidden",
        ]
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "selected forbidden skills" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        results["cases"][0]["execution"]["actualSkillsByPhase"]["orientation"] = [
            "example", "specialist", "missing",
        ]
        results_path.write_text(json.dumps(results), encoding="utf-8")
        assert any(
            "execution contains unknown skills" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        results["cases"][0]["execution"]["actualSkillsByPhase"]["orientation"] = [
            "example", "specialist",
        ]
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
        ledger["cases"] = [ledger["cases"][0], ledger["cases"][2]]
        results["cases"] = [results["cases"][0], results["cases"][2]]
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        results_path.write_text(json.dumps(results), encoding="utf-8")
        ledger["cases"][1]["expectedSkillsByPhase"]["preWrite"] = []
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        assert any(
            "local mutation case must use relic-guard-task in preWrite" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        ledger["cases"][1]["expectedSkillsByPhase"]["preWrite"] = ["relic-guard-task"]
        ledger["cases"][1]["expectedSkillsByPhase"]["commit"] = []
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        assert any(
            "local mutation case is missing commit phase skills" in error
            for error in validate(workspace, ledger_path, results_path, known_commits={valid_head})
        )
        ledger["cases"][1]["expectedSkillsByPhase"]["commit"] = [
            "relic-manage-version", "relic-commit",
        ]
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        results["cases"] = [results["cases"][0], results["cases"][0], results["cases"][1]]
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
