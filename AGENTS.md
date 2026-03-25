# Crucible Framework

## Project Identity

- **Name**: Claude-First Pack Compiler
- **Type**: ai-agent
- **Stack**: Markdown-first canonical spec, Bash hooks/setup, GitHub release distribution (planned)
- **Phase**: plan
- **Status**: F001 스펙/아키텍처 정리 완료 — `.claude` 문서 기준선 고도화 중

## Current Focus

- 현재 저장소의 source of truth는 구현 코드가 아니라 `.claude/**/*.md` 문서다.
- build 단계로 넘어가기 전 `10-session evidence gate`, `Constrained Claude Dialect`, `Codex target semantics` 문서를 먼저 안정화한다.
- v0 범위는 `Claude-first canonical source`와 `Codex repo-local target` 정의까지이며, 실제 구현 산출물은 아직 커밋하지 않는다.

## Core Rules

1. **5단계 파이프라인 준수**: spec → plan → build → gate → ship
2. **게이트 통과 필수**: main 진입 전 `.claude/gates/` 의 모든 조건 충족
3. **스펙 우선**: 모든 피처는 `.claude/memory/specs/` 의 검증된 스펙으로 시작
4. **결정 기록**: 아키텍처 결정은 `.claude/memory/decisions/` 에 ADR로 기록
5. **Worktree 격리**: 병렬 태스크 실행 시 worktree 사용으로 컨텍스트 부패 방지
6. **Zero-Tolerance 게이트**: 린트 0 경고, 타입 에러 0개, 테스트 전체 통과
7. **문서 우선 구현 보류**: `.claude` 문서 기준선이 잠기기 전에는 구현 스캐폴드를 커밋하지 않는다.

## Skills Registry

| Skill | Purpose | Phase |
|-------|---------|-------|
| `crucible-init` | 프로젝트 부트스트랩 | - |
| `crucible-spec` | 피처 사양 작성 및 검증 | spec |
| `crucible-plan` | 아키텍처 설계 + 태스크 분해 | plan |
| `crucible-build` | 구현 오케스트레이션 | build |
| `crucible-qa` | 브라우저 기반 QA 테스팅 | build/gate |
| `crucible-gate` | 품질 게이트 실행 및 보고 | gate |
| `crucible-ship` | 릴리스, 배포, Canary 모니터링 | ship |
| `crucible-status` | 파이프라인 대시보드 | any |

## Agent Team Registry

| Agent | Model | Role |
|-------|-------|------|
| cto | opus | 오케스트레이터 — 작업 라우팅, 단계 전환 강제 |
| architect | opus | 시스템 설계, ADR 작성, 태스크 분해 |
| engineer | sonnet | 구현 전문가 (worktree 격리) |
| reviewer | sonnet | 코드 리뷰, 스펙 드리프트 검출 |
| security-auditor | sonnet | OWASP Top 10, STRIDE 위협 모델링 |
| qa | sonnet | 테스트 설계 및 실행 |
| devops | sonnet | CI/CD, 배포, 인프라 |
| tech-writer | sonnet | API 문서, README, 변경이력 |

## Phase Transition Rules

```
spec  → plan  : gate-spec 통과 시
plan  → build : gate-plan 통과 시
build → gate  : 구현 완료 시
gate  → ship  : gate-build 통과 시
ship  → spec  : 배포 완료 후 다음 피처 사이클
```

## Context References (Tier 1 — 필요 시 로드)

- 프로젝트 개요: `.claude/CLAUDE.md`
- 아키텍처 결정: `.claude/memory/decisions/`
- 피처 사양: `.claude/memory/specs/`
- canonical 형식: `.claude/protocols/constrained-claude-dialect.md`
- Codex 타깃 의미: `.claude/protocols/codex-target-semantics.md`
- evidence 템플릿: `.claude/memory/templates/evidence-session-template.md`
- 세션 로그: `.claude/memory/session-log/`
