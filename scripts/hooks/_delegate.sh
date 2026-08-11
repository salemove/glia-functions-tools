#!/bin/sh
#
# Helper for the hooks in this directory.
#
# Installing a repo-local core.hooksPath shadows any globally configured hooks
# directory. Rather than silently disabling whatever the developer already had
# installed there (a gitleaks pre-commit, for example), each hook here calls
# delegate_to_global_hook first and fails if the inherited hook fails.

delegate_to_global_hook() {
  hook_name="$1"
  shift

  global_hooks_dir="$(git config --global --get core.hooksPath 2>/dev/null || true)"
  [ -n "$global_hooks_dir" ] || return 0

  # Expand a leading ~ ourselves; git stores the literal string.
  case "$global_hooks_dir" in
    "~/"*) global_hooks_dir="$HOME/${global_hooks_dir#\~/}" ;;
  esac

  inherited="$global_hooks_dir/$hook_name"
  [ -x "$inherited" ] || return 0

  # Do not recurse into ourselves if the global dir is this one.
  case "$(cd "$global_hooks_dir" 2>/dev/null && pwd)" in
    "$(cd "$(dirname "$0")" 2>/dev/null && pwd)") return 0 ;;
  esac

  "$inherited" "$@"
}
