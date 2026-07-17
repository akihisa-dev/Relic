#!/usr/bin/env python3
"""Verify that a Git operation still targets the task's expected repository."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse


def git(path: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(path), *args],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "git command failed"
        raise ValueError(detail)
    return result.stdout.strip()


def git_root(path: Path) -> Path:
    return Path(git(path, "rev-parse", "--show-toplevel")).resolve()


def repository_identity(remote_url: str) -> str | None:
    value = remote_url.strip().removesuffix("/")
    if not value:
        return None
    if "://" not in value and ":" in value:
        host, _, remote_path = value.partition(":")
        if "@" in host and remote_path:
            value = remote_path
        else:
            return None
    else:
        parsed = urlparse(value)
        if not parsed.scheme or not parsed.netloc:
            return None
        value = parsed.path
    parts = [part for part in value.strip("/").split("/") if part]
    if len(parts) < 2:
        return None
    owner, repository = parts[-2], parts[-1].removesuffix(".git")
    if not owner or not repository:
        return None
    return f"{owner}/{repository}"


def verify(
    expected_root: Path,
    candidate: Path,
    expected_repository: str | None = None,
    remote: str = "origin",
) -> dict[str, object]:
    expected_git_root = git_root(expected_root)
    candidate_git_root = git_root(candidate)
    result: dict[str, object] = {
        "ok": expected_git_root == candidate_git_root,
        "expectedRoot": str(expected_git_root),
        "candidatePath": str(candidate.resolve()),
        "candidateRoot": str(candidate_git_root),
        "branch": git(candidate_git_root, "branch", "--show-current"),
    }
    if expected_git_root != candidate_git_root:
        result["reason"] = "candidate Git root differs from the task-start Git root"
        return result

    if expected_repository is not None:
        remote_url = git(candidate_git_root, "remote", "get-url", remote)
        actual_repository = repository_identity(remote_url)
        result.update({
            "remote": remote,
            "repository": actual_repository,
            "expectedRepository": expected_repository,
        })
        if actual_repository is None:
            result["ok"] = False
            result["reason"] = "remote URL does not identify an owner/repository pair"
        elif actual_repository.casefold() != expected_repository.removesuffix(".git").casefold():
            result["ok"] = False
            result["reason"] = "remote repository differs from the task's expected repository"
    if result["ok"]:
        result["reason"] = "task target verified"
    return result


def init_repository(path: Path, remote_url: str) -> None:
    path.mkdir(parents=True)
    subprocess.run(["git", "init", "-q", str(path)], check=True)
    subprocess.run(["git", "-C", str(path), "remote", "add", "origin", remote_url], check=True)


def self_test() -> None:
    assert repository_identity("git@example.com:owner/repository.git") == "owner/repository"
    assert repository_identity("https://example.com/owner/repository.git") == "owner/repository"
    assert repository_identity("/local/repository") is None
    with tempfile.TemporaryDirectory(prefix="relic-task-target-") as directory:
        root = Path(directory)
        expected = root / "expected"
        other = root / "other"
        init_repository(expected, "https://example.com/owner/repository.git")
        init_repository(other, "https://example.com/owner/other.git")
        nested = expected / "nested"
        nested.mkdir()
        assert verify(expected, nested)["ok"] is True
        assert verify(expected, other)["ok"] is False
        matching_remote = verify(expected, nested, "owner/repository")
        assert matching_remote["ok"] is True
        assert "remoteUrl" not in matching_remote
        assert verify(expected, nested, "owner/other")["ok"] is False
    print("verify-task-target self-test: ok")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-root")
    parser.add_argument("--candidate", default=".")
    parser.add_argument("--expected-repository")
    parser.add_argument("--remote", default="origin")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    if not args.expected_root:
        parser.error("--expected-root is required unless --self-test is used")
    try:
        result = verify(
            Path(args.expected_root),
            Path(args.candidate),
            args.expected_repository,
            args.remote,
        )
    except (OSError, ValueError) as error:
        result = {"ok": False, "reason": str(error)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
