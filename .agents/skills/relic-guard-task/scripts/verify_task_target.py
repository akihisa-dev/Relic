#!/usr/bin/env python3
"""Verify that a Git operation still targets the task's expected repository."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from collections.abc import Iterable
from pathlib import Path
from urllib.parse import urlparse


DEFAULT_EXPECTED_HOST = "github.com"
DEFAULT_ALLOWED_HOSTS = frozenset({DEFAULT_EXPECTED_HOST})
SUPPORTED_REMOTE_SCHEMES = frozenset({"https", "ssh"})


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


def canonical_host(host: str) -> str | None:
    value = host.strip().casefold().removesuffix(".")
    if not value or any(character.isspace() or character in "/:@\\" for character in value):
        return None
    try:
        return value.encode("idna").decode("ascii")
    except UnicodeError:
        return None


def normalized_allowed_hosts(allowed_hosts: Iterable[str] | None) -> frozenset[str]:
    if allowed_hosts is None:
        values: Iterable[str] = DEFAULT_ALLOWED_HOSTS
    elif isinstance(allowed_hosts, str):
        values = [allowed_hosts]
    else:
        values = allowed_hosts
    normalized = {
        host
        for value in values
        if (host := canonical_host(value)) is not None
    }
    return frozenset(normalized)


def repository_identity(
    remote_url: str,
    allowed_hosts: Iterable[str] | None = None,
) -> str | None:
    value = remote_url.strip().removesuffix("/")
    if not value:
        return None
    if "://" not in value and ":" in value:
        remote_host, _, remote_path = value.partition(":")
        if "@" in remote_host and remote_path:
            host = remote_host.rsplit("@", 1)[-1]
        else:
            return None
    else:
        parsed = urlparse(value)
        if parsed.scheme not in SUPPORTED_REMOTE_SCHEMES or not parsed.netloc or not parsed.hostname:
            return None
        host = parsed.hostname
        remote_path = parsed.path
    canonical = canonical_host(host)
    if canonical is None or canonical not in normalized_allowed_hosts(allowed_hosts):
        return None
    parts = [part for part in remote_path.strip("/").split("/") if part]
    if len(parts) < 2:
        return None
    owner, repository = parts[-2], parts[-1].removesuffix(".git")
    if not owner or not repository:
        return None
    return f"{canonical}/{owner}/{repository}"


def expected_repository_identity(
    expected_repository: str,
    expected_host: str,
    allowed_hosts: Iterable[str],
) -> str | None:
    parts = [part for part in expected_repository.strip("/").split("/") if part]
    if len(parts) == 2:
        host = expected_host
        owner, repository = parts
    elif len(parts) == 3:
        host, owner, repository = parts
    else:
        return None
    canonical = canonical_host(host)
    if canonical is None or canonical not in normalized_allowed_hosts(allowed_hosts):
        return None
    repository = repository.removesuffix(".git")
    if not owner or not repository:
        return None
    return f"{canonical}/{owner}/{repository}"


def verify(
    expected_root: Path,
    candidate: Path,
    expected_repository: str | None = None,
    remote: str = "origin",
    expected_host: str = DEFAULT_EXPECTED_HOST,
    allowed_hosts: Iterable[str] | None = None,
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
        # The expected host is an assertion about the repository identity, not
        # an implicit expansion of the remote allowlist.  Alternate hosts must
        # be explicitly opted into with --allowed-host; otherwise an arbitrary
        # --expected-host would bypass the default github.com boundary.
        effective_allowed_hosts = normalized_allowed_hosts(allowed_hosts)
        remote_url = git(candidate_git_root, "remote", "get-url", remote)
        actual_repository = repository_identity(remote_url, effective_allowed_hosts)
        expected_identity = expected_repository_identity(
            expected_repository,
            expected_host,
            effective_allowed_hosts,
        )
        result.update({
            "remote": remote,
            "repository": actual_repository,
            "expectedRepository": expected_identity,
        })
        if actual_repository is None:
            result["ok"] = False
            result["reason"] = "remote URL does not identify an allowed host and repository"
        elif expected_identity is None:
            result["ok"] = False
            result["reason"] = "expected repository must identify an allowed host and repository"
        elif actual_repository.casefold() != expected_identity.casefold():
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
    assert repository_identity("git@github.com:owner/repository.git") == "github.com/owner/repository"
    assert repository_identity("https://github.com/owner/repository.git") == "github.com/owner/repository"
    assert repository_identity("ssh://git@github.com/owner/repository.git") == "github.com/owner/repository"
    assert repository_identity("http://github.com/owner/repository.git") is None
    assert repository_identity("https://example.com/owner/repository.git") is None
    assert repository_identity(
        "https://example.com/owner/repository.git",
        allowed_hosts={"example.com"},
    ) == "example.com/owner/repository"
    assert repository_identity("/local/repository") is None
    with tempfile.TemporaryDirectory(prefix="relic-task-target-") as directory:
        root = Path(directory)
        expected = root / "expected"
        other = root / "other"
        alternate = root / "alternate"
        init_repository(expected, "https://github.com/owner/repository.git")
        init_repository(other, "https://github.com/owner/other.git")
        init_repository(alternate, "https://example.com/owner/repository.git")
        subprocess.run(
            ["git", "-C", str(expected), "remote", "set-url", "origin",
             "git@github.com:owner/repository.git"],
            check=True,
        )
        nested = expected / "nested"
        nested.mkdir()
        assert verify(expected, nested)["ok"] is True
        assert verify(expected, other)["ok"] is False
        matching_remote = verify(expected, nested, "owner/repository")
        assert matching_remote["ok"] is True
        explicit_host = verify(expected, nested, "github.com/owner/repository")
        assert explicit_host["ok"] is True
        assert verify(
            expected,
            nested,
            "owner/repository",
            expected_host="example.com",
        )["ok"] is False
        assert "remoteUrl" not in matching_remote
        assert verify(expected, nested, "owner/other")["ok"] is False
        assert verify(expected, alternate, "owner/repository")["ok"] is False
        assert verify(expected, alternate, "example.com/owner/repository")["ok"] is False
        assert verify(
            expected,
            alternate,
            "example.com/owner/repository",
            allowed_hosts={"example.com"},
        )["ok"] is False
        assert verify(
            alternate,
            alternate,
            "example.com/owner/repository",
            expected_host="example.com",
            allowed_hosts={"example.com"},
        )["ok"] is True

        script = Path(__file__).resolve()

        def run_cli(directory: Path, *arguments: str) -> tuple[int, dict[str, object]]:
            result = subprocess.run(
                [sys.executable, str(script), "--expected-root", str(directory),
                 "--candidate", str(directory), *arguments],
                check=False,
                capture_output=True,
                text=True,
            )
            return result.returncode, json.loads(result.stdout)

        code, output = run_cli(expected, "--expected-repository", "owner/repository")
        assert code == 0 and output["ok"] is True
        code, output = run_cli(
            expected,
            "--expected-repository", "owner/repository",
            "--expected-host", "example.com",
        )
        assert code != 0 and output["ok"] is False
        code, output = run_cli(
            alternate,
            "--expected-repository", "example.com/owner/repository",
            "--expected-host", "example.com",
        )
        assert code != 0 and output["ok"] is False
        code, output = run_cli(
            alternate,
            "--expected-repository", "example.com/owner/repository",
            "--expected-host", "example.com",
            "--allowed-host", "example.com",
        )
        assert code == 0 and output["ok"] is True
    print("verify-task-target self-test: ok")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected-root")
    parser.add_argument("--candidate", default=".")
    parser.add_argument(
        "--expected-repository",
        help="host/owner/repository (or owner/repository with --expected-host)",
    )
    parser.add_argument("--expected-host", default=DEFAULT_EXPECTED_HOST)
    parser.add_argument(
        "--allowed-host",
        dest="allowed_hosts",
        action="append",
        help="explicitly allow a remote host; may be repeated",
    )
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
            args.expected_host,
            args.allowed_hosts,
        )
    except (OSError, ValueError) as error:
        result = {"ok": False, "reason": str(error)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
