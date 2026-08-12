#!/bin/sh
set -eu

blocked=0
zero=0000000000000000000000000000000000000000
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
script_path="$script_dir/secret-guard.sh"

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

  classic_gh_prefix=$(printf '%s%s' 'gh' 'p')
  oauth_gh_prefix=$(printf '%s%s' 'gh' 'o')
  app_gh_prefix=$(printf '%s%s' 'gh' 'u')
  server_gh_prefix=$(printf '%s%s' 'gh' 's')
  refresh_gh_prefix=$(printf '%s%s' 'gh' 'r')
  fine_grained_gh_prefix=$(printf '%s%s' 'github' '_pat')
  github_token_pattern=$(printf '(^|[^A-Za-z0-9_])(%s_|%s_|%s_|%s_|%s_|%s_[A-Za-z0-9_])' \
    "$classic_gh_prefix" "$oauth_gh_prefix" "$app_gh_prefix" "$server_gh_prefix" \
    "$refresh_gh_prefix" "$fine_grained_gh_prefix")
  private_key_words=$(printf '%s%s' 'PRIVATE' ' KEY')
  open_ssh_private_key=$(printf '%s%s%s' 'BEGIN OPENSSH ' 'PRIVATE' ' KEY')
  private_key_pattern=$(printf '%s%s|%s' 'BEGIN (RSA |DSA |EC |OPENSSH |PGP )?' \
    "$private_key_words" "$open_ssh_private_key")
  credential_names=$(printf '%s%s|%s%s|%s%s|%s%s|%s%s|%s%s|%s%s' \
    'access' '_token' 'client' '_secret' 'refresh' '_token' 'id' '_token' \
    'private' '_key' '_auth' 'Token' 'NPM' '_TOKEN')
  credential_assignment_pattern=$(printf "(^|[^A-Za-z0-9_])(%s)[[:space:]]*[:=][[:space:]]*[\\\"']?[A-Za-z0-9_./+=:@-]{16,}" \
    "$credential_names")
  npm_prefix=$(printf '%s%s' 'npm' '_')
  slack_hook_prefix=$(printf '%s%s' 'https://hooks.slack.com' '/services/')
  sk_live_prefix=$(printf '%s%s' 'sk' '_live_')
  rk_live_prefix=$(printf '%s%s' 'rk' '_live_')
  provider_token_pattern=$(printf '(%s[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{20,}|%s[A-Za-z0-9/_-]{20,}|%s[A-Za-z0-9]{16,}|%s[A-Za-z0-9]{16,})' \
    "$npm_prefix" "$slack_hook_prefix" "$sk_live_prefix" "$rk_live_prefix")
  postgres_scheme=$(printf '%s%s' 'postgres' '(ql)?')
  database_url_pattern=$(printf '(mongodb(\\+srv)?|mysql|%s):\\/\\/[^[:space:]@:/]+:[^[:space:]@/]+@' "$postgres_scheme")
  aws_key_prefix=$(printf '%s%s' 'AK' 'IA')
  aws_session_prefix=$(printf '%s%s' 'AS' 'IA')
  aws_key_pattern=$(printf '%s[0-9A-Z]{16}|%s[0-9A-Z]{16}' "$aws_key_prefix" "$aws_session_prefix")

  if printf '%s\n' "$content" | grep -Eiq 'Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9_./+=:@-]{16,}'; then
    echo "Blocked HTTP Bearer credential: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq 'Authorization:[[:space:]]*Basic[[:space:]]+[A-Za-z0-9+/=]{16,}'; then
    echo "Blocked HTTP Basic credential: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq "$github_token_pattern"; then
    echo "Blocked GitHub token pattern: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq "$private_key_pattern"; then
    echo "Blocked private key material: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq "$credential_assignment_pattern"; then
    echo "Blocked credential assignment pattern: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq "$provider_token_pattern"; then
    echo "Blocked supported provider token pattern: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eiq "$database_url_pattern"; then
    echo "Blocked database connection string with credentials: $path ($commit)" >&2
    return 1
  fi

  if printf '%s\n' "$content" | grep -Eq "$aws_key_pattern"; then
    echo "Blocked AWS access key identifier: $path ($commit)" >&2
    return 1
  fi

  return 0
}

check_blob_content() {
  commit="$1"
  path="$2"

  if ! is_text_path "$path"; then
    return 0
  fi

  if ! content=$(git show "$commit:$path" 2>/dev/null); then
    echo "Blocked unreadable commit blob: $path ($commit)" >&2
    return 1
  fi

  if [ -z "$content" ]; then
    return 0
  fi

  check_content "$content" "$path" "$commit"
}

check_commit() {
  commit="$1"
  path_list=$(mktemp "${TMPDIR:-/tmp}/relic-secret-guard.paths.XXXXXX")
  if ! git diff-tree --root --no-commit-id --name-only -r -z "$commit" > "$path_list"; then
    echo "Blocked unreadable commit tree: $commit" >&2
    blocked=1
  elif ! xargs -0 -n 1 "$script_path" --commit-path "$commit" < "$path_list"; then
    blocked=1
  fi
  rm -f "$path_list"
}

check_commit_path() {
  commit="$1"
  path="$2"
  failed=0
  if ! check_path_name "$path"; then
    failed=1
  fi
  if ! check_blob_content "$commit" "$path"; then
    failed=1
  fi
  [ "$failed" -eq 0 ]
}

check_staged_path() {
  path="$1"
  failed=0

  if ! check_path_name "$path"; then
    failed=1
  fi

  if is_text_path "$path"; then
    if ! content=$(git show ":$path" 2>/dev/null); then
      echo "Blocked unreadable staged blob: $path" >&2
      failed=1
    fi
    if [ -n "$content" ] && ! check_content "$content" "$path" staged; then
      failed=1
    fi
  fi

  [ "$failed" -eq 0 ]
}

check_staged() {
  path_list=$(mktemp "${TMPDIR:-/tmp}/relic-secret-guard.paths.XXXXXX")
  if ! git diff --cached --name-only --diff-filter=ACMR -z > "$path_list"; then
    echo "Blocked unreadable staged index" >&2
    blocked=1
  elif [ ! -s "$path_list" ]; then
    rm -f "$path_list"
    return 0
  elif ! xargs -0 -n 1 "$script_path" --staged-path < "$path_list"; then
    blocked=1
  fi
  rm -f "$path_list"
}

check_range() {
  range="$1"

  if ! commits=$(git rev-list "$range"); then
    echo "Blocked unreadable commit range: $range" >&2
    blocked=1
    return
  fi
  for commit in $commits; do
    check_commit "$commit"
  done
}

check_new_ref() {
  local_sha="$1"

  if ! commits=$(git rev-list "$local_sha" --not --remotes); then
    echo "Blocked unreadable commit history: $local_sha" >&2
    blocked=1
    return
  fi
  for commit in $commits; do
    check_commit "$commit"
  done
}

check_pre_push() {
  while read local_ref local_sha remote_ref remote_sha; do
    if [ "$local_sha" = "$zero" ]; then
      continue
    fi

    if [ "$remote_sha" = "$zero" ]; then
      check_new_ref "$local_sha"
    else
      range="$remote_sha..$local_sha"
      check_range "$range"
    fi
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

    printf '%s\n' "safe fixture" > "safe fixture.txt"
    git add "safe fixture.txt"
    blocked=0
    check_staged
    if [ "$blocked" -ne 0 ]; then
      echo "Secret guard self-test failed: safe staged fixture was blocked." >&2
      exit 1
    fi
    git commit -q -m "safe"
    safe_commit=$(git rev-parse HEAD)
    git update-ref refs/remotes/origin/main "$safe_commit"
    blocked=0
    check_commit "$safe_commit"
    if [ "$blocked" -ne 0 ]; then
      echo "Secret guard self-test failed: safe fixture was blocked." >&2
      exit 1
    fi
    blocked=0
    check_new_ref "$safe_commit"
    if [ "$blocked" -ne 0 ]; then
      echo "Secret guard self-test failed: a new ref to a published commit was blocked." >&2
      exit 1
    fi

    real_git=$(command -v git)
    fake_git_dir="$temp_dir/fake-git"
    mkdir -p "$fake_git_dir"
    {
      printf '%s\n' '#!/bin/sh'
      printf '%s\n' 'if [ "${1:-}" = "diff-tree" ] || [ "${1:-}" = "rev-list" ] || { [ "${1:-}" = "diff" ] && [ "${2:-}" = "--cached" ]; }; then'
      printf '%s\n' '  echo "fixture git read failure" >&2'
      printf '%s\n' '  exit 42'
      printf '%s\n' 'fi'
      printf 'exec %s "$@"\n' "$real_git"
    } > "$fake_git_dir/git"
    chmod +x "$fake_git_dir/git"
    old_path="$PATH"
    PATH="$fake_git_dir:$PATH"
    blocked=0
    check_commit "$safe_commit"
    PATH="$old_path"
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: diff-tree failure was not blocked." >&2
      exit 1
    fi
    PATH="$fake_git_dir:$old_path"
    blocked=0
    check_staged
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: staged index failure was not blocked." >&2
      exit 1
    fi
    PATH="$fake_git_dir:$old_path"
    blocked=0
    check_range "$safe_commit"
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: rev-list range failure was not blocked." >&2
      exit 1
    fi
    blocked=0
    check_new_ref "$safe_commit"
    PATH="$old_path"
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: rev-list history failure was not blocked." >&2
      exit 1
    fi

    mkdir -p .githooks .github/workflows
    printf '%s\n' "safe guard policy fixture" > .githooks/secret-guard.sh
    printf '%s\n' "name: Secret Guard" > .github/workflows/secret-guard.yml
    git add .githooks/secret-guard.sh .github/workflows/secret-guard.yml
    blocked=0
    check_staged
    if [ "$blocked" -ne 0 ]; then
      echo "Secret guard self-test failed: safe guard paths were blocked." >&2
      exit 1
    fi
    git commit -q -m "safe guard paths"
    safe_guard_commit=$(git rev-parse HEAD)
    blocked=0
    check_commit "$safe_guard_commit"
    if [ "$blocked" -ne 0 ]; then
      echo "Secret guard self-test failed: safe guard paths were blocked in history." >&2
      exit 1
    fi

    dummy_token="$(printf '%s%s' 'gh' 'p_dummy_token_for_secret_guard_only')"
    printf '%s\n' "$dummy_token" > leak.txt
    git add leak.txt
    blocked=0
    check_staged
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: staged dummy token fixture was not blocked." >&2
      exit 1
    fi
    git commit -q -m "blocked"
    blocked_commit=$(git rev-parse HEAD)
    blocked=0
    check_commit "$blocked_commit"
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: dummy token fixture was not blocked." >&2
      exit 1
    fi
    blocked=0
    check_new_ref "$blocked_commit"
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: a new ref with an unpublished credential was not blocked." >&2
      exit 1
    fi

    printf '%s\n' "$dummy_token" > .githooks/secret-guard.sh
    git add .githooks/secret-guard.sh
    blocked=0
    check_staged
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: a token in a guard script was not blocked." >&2
      exit 1
    fi
    git commit -q -m "blocked guard token"
    blocked_guard_commit=$(git rev-parse HEAD)
    blocked=0
    check_commit "$blocked_guard_commit"
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: a token in guard history was not blocked." >&2
      exit 1
    fi

    pem_begin=$(printf '%s%s%s' '-----BEGIN RSA ' 'PRIVATE' ' KEY-----')
    pem_end=$(printf '%s%s%s' '-----END RSA ' 'PRIVATE' ' KEY-----')
    printf '%s\n' "$pem_begin" "fixture" "$pem_end" > .github/workflows/secret-guard.yml
    git add .github/workflows/secret-guard.yml
    blocked=0
    check_staged
    if [ "$blocked" -eq 0 ]; then
      echo "Secret guard self-test failed: private key material in a guard workflow was not blocked." >&2
      exit 1
    fi
  )
}

print_blocked_message() {
  cat >&2 <<'EOF'

Blocked by Relic secret guard.
The checked changes or commits contain a token, client secret, private key, .env file, keychain export, or local credential file.
Remove the sensitive data from history before pushing or merging.
EOF
}

case "${1:---pre-push}" in
  --staged)
    check_staged
    ;;
  --staged-path)
    if [ "${2:-}" = "" ]; then
      exit 0
    fi
    if ! check_staged_path "$2"; then
      print_blocked_message
      exit 1
    fi
    exit 0
    ;;
  --commit-path)
    if [ "${2:-}" = "" ] || [ "${3:-}" = "" ]; then
      exit 0
    fi
    if ! check_commit_path "$2" "$3"; then
      print_blocked_message
      exit 1
    fi
    exit 0
    ;;
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
    echo "Usage: secret-guard.sh [--staged | --pre-push | --range <git-rev-range> | --self-test]" >&2
    exit 2
    ;;
esac

if [ "$blocked" -ne 0 ]; then
  print_blocked_message
  exit 1
fi

exit 0
