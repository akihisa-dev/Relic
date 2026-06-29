#!/bin/sh
set -eu

blocked=0
zero=0000000000000000000000000000000000000000

is_text_path() {
  case "$1" in
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.icns|*.pdf|*.zip|*.dmg|*.exe|*.dll|*.node)
      return 1
      ;;
  esac
  return 0
}

is_guard_path() {
  case "$1" in
    .githooks/pre-commit|.githooks/pre-push|.githooks/secret-guard.sh|.github/workflows/secret-guard.yml)
      return 0
      ;;
  esac
  return 1
}

check_path_name() {
  path="$1"
  base=$(basename "$path")

  if is_guard_path "$path"; then
    return 0
  fi

  case "$base" in
    .env|.env.*|*.env|*.env.*)
      case "$base" in
        .env.example|*.example)
          return 0
          ;;
      esac
      echo "Blocked local env file: $path" >&2
      return 1
      ;;
    *client-secret*|*credentials*|*secret*|*token*|*.keychain|*.keychain-db|*keychain-export*)
      echo "Blocked credential-bearing filename: $path" >&2
      return 1
      ;;
  esac

  return 0
}

check_content() {
  content="$1"
  path="$2"
  commit="$3"

  if printf '%s\n' "$content" | grep -Eiq 'Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9_./+=:@-]{16,}'; then
    echo "Blocked HTTP Bearer credential: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq 'Authorization:[[:space:]]*Basic[[:space:]]+[A-Za-z0-9+/=]{16,}'; then
    echo "Blocked HTTP Basic credential: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq '(^|[^A-Za-z0-9_])(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_[A-Za-z0-9_])'; then
    echo "Blocked GitHub token pattern: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq 'BEGIN (RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY|BEGIN PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY'; then
    echo "Blocked private key material: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq '(^|[^A-Za-z0-9_])(access_token|client_secret|refresh_token|id_token|private_key|_authToken|NPM_TOKEN)[[:space:]]*[:=][[:space:]]*["'\'']?[A-Za-z0-9_./+=:@-]{16,}'; then
    echo "Blocked credential assignment pattern: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq '(npm_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{20,}|https://hooks\.slack\.com/services/[A-Za-z0-9/_-]{20,}|sk_live_[A-Za-z0-9]{16,}|rk_live_[A-Za-z0-9]{16,})'; then
    echo "Blocked supported provider token pattern: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq '(mongodb(\+srv)?|mysql|postgres(ql)?):\/\/[^[:space:]@:/]+:[^[:space:]@/]+@'; then
    echo "Blocked database connection string with credentials: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eq 'AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}'; then
    echo "Blocked AWS access key identifier: $path ($commit)" >&2
    return 1
  fi

  return 0
}

check_blob_content() {
  commit="$1"
  path="$2"

  if is_guard_path "$path"; then
    return 0
  fi

  if ! is_text_path "$path"; then
    return 0
  fi

  content=$(git show "$commit:$path" 2>/dev/null || true)

  if [ -z "$content" ]; then
    return 0
  fi

  check_content "$content" "$path" "$commit"
}

check_commit() {
  commit="$1"

  files=$(git diff-tree --root --no-commit-id --name-only -r "$commit")

  for path in $files; do
    if ! check_path_name "$path"; then
      blocked=1
    fi

    if ! check_blob_content "$commit" "$path"; then
      blocked=1
    fi
  done
}

check_range() {
  range="$1"

  for commit in $(git rev-list "$range"); do
    check_commit "$commit"
  done
}

check_pre_push() {
  while read local_ref local_sha remote_ref remote_sha; do
    if [ "$local_sha" = "$zero" ]; then
      continue
    fi

    if [ "$remote_sha" = "$zero" ]; then
      range="$local_sha"
    else
      range="$remote_sha..$local_sha"
    fi

    check_range "$range"
  done
}

run_self_test() {
  temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/relic-secret-guard.XXXXXX")
  trap 'rm -rf "$temp_dir"' EXIT HUP INT TERM

  (
    cd "$temp_dir"
    git init -q
    git config user.email relic-secret-guard@example.invalid
    git config user.name "Relic Secret Guard"

    printf '%s\n' "safe fixture" > safe.txt
    git add safe.txt
    git commit -q -m "safe"
    safe_commit=$(git rev-parse HEAD)
    blocked=0
    check_commit "$safe_commit"
    if [ "$blocked" -ne 0 ]; then
      echo "Secret guard self-test failed: safe fixture was blocked." >&2
      exit 1
    fi

    dummy_token="$(printf '%s%s' 'gh' 'p_dummy_token_for_secret_guard_only')"
    printf '%s\n' "$dummy_token" > leak.txt
    git add leak.txt
    git commit -q -m "blocked"
    blocked_commit=$(git rev-parse HEAD)
    blocked=0
    check_commit "$blocked_commit"
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: dummy token fixture was not blocked." >&2
      exit 1
    fi
  )
}

print_blocked_message() {
  cat >&2 <<'EOF'

Blocked by Relic secret guard.
The checked commits contain a token, client secret, private key, .env file, keychain export, or local credential file.
Remove the sensitive data from history before pushing or merging.
EOF
}

case "${1:---pre-push}" in
  --pre-push)
    check_pre_push
    ;;
  --range)
    if [ "${2:-}" = "" ]; then
      echo "Usage: secret-guard.sh --range <git-rev-range>" >&2
      exit 2
    fi
    check_range "$2"
    ;;
  --self-test)
    run_self_test
    ;;
  *)
    echo "Usage: secret-guard.sh [--pre-push | --range <git-rev-range> | --self-test]" >&2
    exit 2
    ;;
esac

if [ "$blocked" -ne 0 ]; then
  print_blocked_message
  exit 1
fi

exit 0
