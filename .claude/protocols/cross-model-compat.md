# Cross-Model Compatibility Protocol

이 문서는 `.claude`를 canonical source of truth로 삼고, 다른 런타임용 산출물을 어떻게 파생시킬지 정의합니다.

중요한 점은 "장기 비전"과 "현재 v0 범위"를 구분하는 것입니다. 현재 이 저장소에서 잠긴 범위는 `Claude-first canonical source`와 `Codex repo-local target`까지이며, Gemini/Cursor는 설계 대상이지 구현 완료 대상이 아닙니다.

## 현재 지원 상태

| Runtime | Canonical authoring | v0 산출물 대상 | 현재 상태 |
|---------|---------------------|----------------|----------|
| **Claude Code** | `.claude/**/*.md` | source of truth only | 현재 사용 중 |
| **Codex** | 생성 대상 아님 | `.agents/` repo-local artifact | v0 계획 범위 |
| **Gemini CLI** | 생성 대상 아님 | future `.agents/` artifact | v0 범위 밖 |
| **Cursor** | 생성 대상 아님 | future rules export | v0 범위 밖 |

## 장기 호환 대상

| Runtime | 스킬 형식 | 에이전트 형식 | 설치 경로 |
|---------|---------|------------|----------|
| **Claude Code** | `.claude/skills/*/SKILL.md` | `.claude/agents/*.md` | `.claude/` |
| **Codex** | `.agents/skills/*/SKILL.md` | `.agents/*.md` | `.agents/` |
| **Gemini CLI** | `.agents/skills/*/SKILL.md` | `.agents/*.md` | `.agents/` |
| **Cursor** | `.cursor/rules/*.md` | 통합 | `.cursor/rules/` |

## 호환성 원칙

### 1. Claude-First Canonical Source

원본 문서는 `.claude/**/*.md` 안에만 존재합니다.
다른 런타임 산출물은 원본이 아니라 파생물입니다.
즉, Codex/Gemini용 아티팩트는 언제든 다시 생성 가능해야 하며 수동 편집을 source of truth로 삼지 않습니다.

### 2. Markdown-First

모든 스킬과 에이전트 정의는 Markdown을 기반으로 유지합니다.
다만 v0에서는 "자유로운 Markdown 전체"가 아니라, 기계적으로 읽을 수 있는 `Constrained Claude Dialect`를 canonical source로 정의합니다.

관련 문서:

- `.claude/protocols/constrained-claude-dialect.md`
- `.claude/protocols/codex-target-semantics.md`

### 3. Fail-Closed Translation

지원하지 않는 feature가 보이면 warning이 아니라 compile error로 실패해야 합니다.
런타임별 capability 차이는 문서에 명시된 규칙으로 다루고, "대충 축소 변환"하지 않습니다.

### 4. Tool-Agnostic Instructions

스킬 지시사항에서는 특정 제품 UI보다 의도를 우선합니다.
다만 v0 범위에서는 Codex 타깃 semantics를 먼저 고정하고, Gemini/Cursor는 후속 확장으로 남깁니다.

### 5. Bash-Based Harness

Hook 스크립트와 setup 흐름은 POSIX-호환 Bash를 우선합니다.
Claude Code의 hook 시스템이 아닌 다른 런타임에서는 CI/CD 파이프라인이나 설치 스크립트로 대체할 수 있습니다.

```bash
# Claude Code hook
"command": "bash .claude/hooks/post-edit-lint.sh"

# Git pre-commit hook (동일 스크립트)
#!/bin/bash
bash .claude/hooks/post-edit-lint.sh
```

### 6. Generated Artifact Safety

생성 산출물은 기존 사용자 파일을 조용히 덮어쓰지 않습니다.

- target path가 비어 있으면 생성
- generator marker가 있는 파일이면 재생성 가능
- 사용자 수동 파일과 충돌하면 중단
- root `AGENTS.md`는 생성 대상이 아님

## Translation Contract

### Source of Truth

- canonical 문서는 `.claude`에만 존재한다.
- `.agents` 등 다른 경로는 생성 결과물이다.
- generated file은 generator marker를 포함해야 한다.

### v0 Translation Rule

- source: `.claude` canonical pack
- target: Codex repo-local `.agents/` artifact
- overwrite rule: marker 없는 기존 파일과 충돌하면 실패
- update rule: compile/install 경로와 update-check는 분리

## 설치 흐름 원칙

- v0는 repo-local install only
- global install은 v0 범위 밖
- GitHub release artifact와 `VERSION` heartbeat는 distribution layer 설계로만 유지
- update-check는 non-blocking cached path여야 한다
- 공개 저장소 기준 설치 진입점은 repo root `./install.sh` 이다
- `.agents/` 는 canonical source가 아니라 install 시 생성되는 generated artifact다

## 런타임별 제약사항

| 기능 | Claude Code | Codex | Gemini | Cursor |
|------|-----------|-------|--------|--------|
| Canonical authoring | ✅ | ❌ | ❌ | ❌ |
| Repo-local generated pack | source only | ✅ (v0 planned) | future | future |
| Hook 시스템 | ✅ (settings.json) | ❌ (CI로 대체) | ❌ | ❌ |
| Worktree 격리 | ✅ | ✅ | 미정 | 미정 |
| MCP 서버 | ✅ | ❌ | ❌ | 부분 지원 |
| Fail-closed capability check | 문서 기준 | ✅ (v0 planned) | future | future |

## Graceful Degradation

장기적으로는 기능이 적은 런타임에서 우아하게 퇴화할 수 있어야 한다. 다만 v0에서는 그 원칙을 곧바로 구현하지 않는다. 대신 다음 순서를 따른다.

1. Claude canonical source를 먼저 고정한다.
2. Codex repo-local target semantics를 먼저 고정한다.
3. 이후 Gemini/Cursor로 확장할 때 degradation 규칙을 별도로 추가한다.

## Out of Scope for v0

- Gemini emitter 구현
- Cursor rules exporter 구현
- global install
- 범용 multi-runtime capability framework
- best-effort 축소 변환
