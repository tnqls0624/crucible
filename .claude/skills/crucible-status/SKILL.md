---
name: crucible-status
description: |
  Crucible 파이프라인의 현재 상태를 대시보드로 표시합니다. 현재 단계(spec/plan/build/gate/ship), 프로젝트 정보, 활성 피처, 최근 ADR, 세션 로그, Git 상태를 한눈에 보여줍니다. 모든 단계에서 사용 가능하며, 특히 새 세션 시작 시 이전 컨텍스트 복구에 유용합니다.

  ALWAYS use this skill when:
  - 사용자가 `/crucible-status` 명령을 사용할 때
  - "현황", "상태", "status", "대시보드", "dashboard" 언급 시
  - "어디까지 했어?", "지금 뭐 하고 있었지?", "진행 상황" 질문 시
  - "이전 세션에서 뭐 했어?", "세션 로그", "작업 이력" 질문 시
  - "프로젝트 현재 상태", "파이프라인 상태", "지금 어느 단계야?" 질문 시
  - 새 세션을 시작할 때 이전 컨텍스트를 빠르게 파악해야 할 때
  - Crucible 프로젝트에서 다음에 무엇을 해야 할지 판단이 필요할 때

  Example triggers: "현재 프로젝트 상태가 어떻게 되는지 보여줘", "어디까지 했어? 이전 세션에서 뭐 작업했는지 모르겠어", "파이프라인 대시보드 좀 보여줘"
---

# /crucible-status — 파이프라인 대시보드

세션 간 컨텍스트 전환이나 중단 후 재개 시 가장 먼저 실행하면 좋은 스킬입니다. 프로젝트의 현재 상태를 빠르게 파악하여 어디서부터 이어서 작업할지 판단할 수 있습니다.

## Workflow

### Step 1: 데이터 수집

6가지 소스에서 정보를 수집합니다. 파일이 없거나 비어있으면 해당 섹션을 "없음"으로 표시합니다.

1. **Phase**: `.claude/settings.json` → `env.CRUCIBLE_PHASE`
2. **Project Info**: `.claude/CLAUDE.md`
3. **Active Specs**: `.claude/memory/specs/*.spec.md` (Glob)
4. **Decisions**: `.claude/memory/decisions/*.md` (Glob)
5. **Session Log**: `.claude/memory/session-log/` (최근 3개)
6. **Git Status**: `git status --short` + `git log --oneline -5`

### Step 2: 대시보드 출력

수집된 데이터를 아래 형식으로 정리합니다. 파이프라인 진행 상태를 시각적으로 표현하여 현재 위치를 즉시 파악할 수 있게 합니다.

**Example:**
```markdown
## Crucible Dashboard

### Project
| 항목 | 값 |
|------|-----|
| Name | Claude-First Pack Compiler |
| Type | ai-agent |
| Stack | Markdown-first canonical spec + Bash hooks |
| Phase | plan |

### Pipeline
  [spec] → [PLAN] → [build] → [gate] → [ship]
             ↑ current

### Active Features
| ID | Name | Phase | Spec |
|----|------|-------|------|
| F001 | Claude-First Pack Compiler v0 | plan | pack-compiler-v0.spec.md |

### Recent Decisions
| ADR | Title |
|-----|-------|
| 001 | Claude-First Pack Compiler v0 Architecture |

### Recent Sessions
| Date | Summary |
|------|---------|
| 2026-03-26 | 구현 스캐폴드를 제거하고 `.claude` 문서 기준선을 재정렬 |

### Git Status
(미커밋 변경사항 또는 "clean")

### Recent Commits
(최근 5개 커밋 oneline)
```

현재 Phase를 대문자로 강조하여 즉시 식별 가능하게 합니다. 세션 로그가 있으면 가장 최근 것의 요약을 포함하여 이전 작업 맥락을 빠르게 복구합니다.

## Related Files

- `.claude/settings.json` — Phase 정보
- `.claude/CLAUDE.md` — 프로젝트 개요
- `.claude/memory/specs/` — 활성 스펙
- `.claude/memory/decisions/` — ADR
- `.claude/memory/session-log/` — 세션 로그
