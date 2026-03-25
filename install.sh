#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET=""
WITH_BROWSER=0
FORCE=0
DRY_RUN=0

GENERATOR_MARKER="generated-by: claude-first-pack-compiler v0"
GENERATOR_SENTINEL=".generated-by-claude-first-pack-compiler"

usage() {
  cat <<'EOF'
사용법:
  ./install.sh claude [--with-browser] [--dry-run]
  ./install.sh codex [--with-browser] [--force] [--dry-run]

설명:
  claude  - .claude 기반 사용 준비 (hook 권한 정리)
  codex   - .claude 문서에서 repo-local .agents 산출물 생성

옵션:
  --with-browser  crucible-qa용 브라우저 바이너리까지 생성
  --force         기존 generated .agents를 삭제하고 다시 생성
  --dry-run       실제 변경 없이 수행 예정 작업만 출력
EOF
}

log() {
  printf '[install] %s\n' "$1"
}

fail() {
  printf '[install:error] %s\n' "$1" >&2
  exit 1
}

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] %s\n' "$*"
    return 0
  fi

  "$@"
}

run_in_root() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] (cd %s && %s)\n' "$ROOT_DIR" "$*"
    return 0
  fi

  (
    cd "$ROOT_DIR"
    "$@"
  )
}

ensure_target() {
  [[ -n "$TARGET" ]] || fail "설치 대상을 지정해야 합니다. 예: ./install.sh claude"
  [[ "$TARGET" == "claude" || "$TARGET" == "codex" ]] || fail "지원하지 않는 대상입니다: $TARGET"
}

make_hooks_executable() {
  if [[ -d "$ROOT_DIR/.claude/hooks" ]]; then
    log "hook 스크립트 실행 권한을 정리합니다."
    while IFS= read -r hook_file; do
      run chmod +x "$hook_file"
    done < <(find "$ROOT_DIR/.claude/hooks" -maxdepth 1 -type f -name '*.sh' | sort)
  fi
}

write_generated_markdown() {
  local source_file="$1"
  local target_file="$2"
  local first_line

  run mkdir -p "$(dirname "$target_file")"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] generate %s -> %s\n' "$source_file" "$target_file"
    return 0
  fi

  first_line="$(head -n 1 "$source_file" || true)"

  if [[ "$first_line" == "---" ]]; then
    awk -v marker="$GENERATOR_MARKER" '
      NR == 1 { print; next }
      frontmatter == 0 {
        print
        if ($0 == "---") {
          print ""
          print "<!-- " marker " -->"
          print ""
          frontmatter = 1
        }
        next
      }
      { print }
    ' "$source_file" > "$target_file"
  else
    {
      printf '<!-- %s -->\n\n' "$GENERATOR_MARKER"
      cat "$source_file"
    } > "$target_file"
  fi
}

generate_codex_agents() {
  local agents_dir="$ROOT_DIR/.agents"
  local source_agents_dir="$ROOT_DIR/.claude/agents"
  local source_skills_dir="$ROOT_DIR/.claude/skills"

  if [[ -e "$agents_dir" && ! -f "$agents_dir/$GENERATOR_SENTINEL" && "$FORCE" -ne 1 ]]; then
    fail ".agents가 이미 존재하고 generated marker가 없습니다. 안전하게 중단합니다. --force로 덮어쓸 수 있습니다."
  fi

  if [[ -e "$agents_dir" ]]; then
    log "기존 generated .agents를 정리합니다."
    run rm -rf "$agents_dir"
  fi

  log "Codex용 repo-local .agents 산출물을 생성합니다."
  run mkdir -p "$agents_dir/skills"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] write %s/%s\n' "$agents_dir" "$GENERATOR_SENTINEL"
  else
    printf '%s\n' "$GENERATOR_MARKER" > "$agents_dir/$GENERATOR_SENTINEL"
  fi

  while IFS= read -r agent_file; do
    write_generated_markdown "$agent_file" "$agents_dir/$(basename "$agent_file")"
  done < <(find "$source_agents_dir" -maxdepth 1 -type f -name '*.md' | sort)

  while IFS= read -r skill_dir; do
    local skill_name
    skill_name="$(basename "$skill_dir")"

    while IFS= read -r source_file; do
      local relative_path
      relative_path="${source_file#$skill_dir/}"
      write_generated_markdown "$source_file" "$agents_dir/skills/$skill_name/$relative_path"
    done < <(find "$skill_dir" -type f -name '*.md' | sort)
  done < <(find "$source_skills_dir" -mindepth 1 -maxdepth 1 -type d ! -name '*-workspace' | sort)
}

install_browser_tool() {
  local browser_dir="$ROOT_DIR/.claude/tools/browser"

  [[ -d "$browser_dir" ]] || fail "브라우저 도구 디렉토리를 찾을 수 없습니다: $browser_dir"
  command -v bun >/dev/null 2>&1 || fail "--with-browser 사용 시 bun이 필요합니다."

  log "브라우저 QA 도구를 빌드합니다."

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] (cd %s && bun install)\n' "$browser_dir"
    printf '[dry-run] (cd %s && bun run build)\n' "$browser_dir"
    return 0
  fi

  (
    cd "$browser_dir"
    bun install
    bun run build
  )
}

print_next_steps() {
  case "$TARGET" in
    claude)
      cat <<'EOF'

다음 단계:
  1. Claude Code에서 이 저장소를 엽니다.
  2. `.claude/CLAUDE.md`와 `.claude/memory/specs/`를 먼저 확인합니다.
  3. 문서 수정은 항상 `.claude`에서 진행합니다.
EOF
      ;;
    codex)
      cat <<'EOF'

다음 단계:
  1. Codex는 repo root의 `AGENTS.md`와 generated `.agents/`를 함께 읽습니다.
  2. `.agents/`를 직접 수정하지 말고, `.claude/`를 수정한 뒤 `./install.sh codex`를 다시 실행합니다.
  3. 기존 사용자 파일과 충돌하는 경우 `--force` 대신 `.claude` source를 먼저 점검합니다.
EOF
      ;;
  esac

  if [[ "$WITH_BROWSER" -eq 1 ]]; then
    cat <<'EOF'
  4. 브라우저 QA 도구는 `.claude/tools/browser/bin/crucible-browse`에 생성됩니다.
EOF
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    claude|codex)
      [[ -z "$TARGET" ]] || fail "설치 대상은 하나만 지정할 수 있습니다."
      TARGET="$1"
      shift
      ;;
    --with-browser)
      WITH_BROWSER=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "알 수 없는 옵션입니다: $1"
      ;;
  esac
done

ensure_target
make_hooks_executable

case "$TARGET" in
  claude)
    log "Claude Code용 문서 기준선을 준비합니다."
    ;;
  codex)
    generate_codex_agents
    ;;
esac

if [[ "$WITH_BROWSER" -eq 1 ]]; then
  install_browser_tool
fi

log "설치가 완료되었습니다."
print_next_steps
