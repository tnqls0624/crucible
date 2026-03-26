# Crucible Framework

## Project Identity

- **Name**: Crucible
- **Type**: ai-agent workflow framework
- **Stack**: Markdown workflow docs, Bash hooks/setup, Bun runtime tooling, optional Bun browser tool
- **Phase**: spec
- **Status**: public alpha — fresh install 기준선 준비 완료

## Current Focus

- 일반 사용자 기본 경로는 `.claude` 문서 수정이 아니라 `/crucible-*` 워크플로우로 프로젝트 코드를 작업하는 것이다.
- `.claude/`는 framework source of truth이며, maintainer가 skill / gate / protocol을 바꿀 때 수정한다.
- `.claude/memory/specs/` 와 `.claude/memory/decisions/` 는 starter 기준으로 비워 두고, 실제 프로젝트 문맥으로 채운다.
- portable metadata가 필요하면 optional manifest를 추가할 수 있지만, canonical source는 계속 `.claude/`다.

## Core Rules

1. **5단계 파이프라인 준수**: spec → plan → build → gate → ship
2. **게이트 통과 필수**: main 진입 전 `.claude/gates/` 의 모든 조건 충족
3. **스펙 우선**: 모든 피처는 `.claude/memory/specs/` 의 검증된 스펙으로 시작
4. **결정 기록**: 아키텍처 결정은 `.claude/memory/decisions/` 에 ADR로 기록
5. **Worktree 격리**: 병렬 태스크 실행 시 worktree 사용으로 컨텍스트 부패 방지
6. **Zero-Tolerance 게이트**: 린트 0 경고, 타입 에러 0개, 테스트 전체 통과
7. **Generated Output 보호**: `.agents/` 는 generated artifact이며 source of truth가 아니다
8. **Optional Manifest는 보조 계층**: portable metadata는 허용되지만 canonical source를 대체하지 않는다

## Skills Registry

| Skill | Purpose | Phase |
|-------|---------|-------|
| `crucible-init` | 프로젝트 부트스트랩 | - |
| `crucible-spec` | 피처 사양 작성 및 검증 | spec |
| `crucible-plan` | 아키텍처 설계 + 태스크 분해 | plan |
| `crucible-build` | 구현 오케스트레이션 | build |
| `crucible-qa` | 브라우저/런타임 QA 테스팅 | build/gate |
| `crucible-gate` | 품질 게이트 실행 및 보고 | gate |
| `crucible-ship` | 릴리스 및 배포 정리 | ship |
| `crucible-status` | 파이프라인 대시보드 | any |

## Agent Team Registry

| Agent | Role |
|-------|------|
| cto | 작업 라우팅, 단계 전환, 에스컬레이션 |
| architect | 시스템 설계, ADR 작성, 태스크 분해 |
| engineer | 구현 및 테스트 |
| reviewer | 코드 리뷰, 스펙 드리프트 탐지 |
| security-auditor | 보안 감사 |
| qa | 브라우저 및 시나리오 테스트 |
| devops | 릴리스, 배포, CI/CD |
| tech-writer | README/CHANGELOG/운영 문서 정리 |

## Phase Transition Rules

```text
spec  → plan  : gate-spec 통과 시
plan  → build : gate-plan 통과 시
build → gate  : 구현 완료 시
gate  → ship  : gate-build 통과 시
ship  → spec  : 다음 피처 사이클 시작 시
```

## Working Modes

### User Mode

- `/crucible-status` → `/crucible-spec` → `/crucible-plan` → `/crucible-build`
- 작업 대상은 보통 프로젝트 코드와 테스트다
- `.claude` 수정은 거의 필요 없다

### Maintainer Mode

- `.claude/skills/`, `.claude/gates/`, `.claude/protocols/` 를 수정한다
- Codex 반영이 필요하면 `./setup --host codex` 를 다시 실행한다
- generated `.agents/` 는 직접 수정하지 않는다

## Context References (Tier 1 — 필요 시 로드)

- 프로젝트 개요: 이 문서 자체(`.claude/CLAUDE.md`)
- 피처 사양: `.claude/memory/specs/`
- 아키텍처 결정: `.claude/memory/decisions/`
- canonical 형식: `.claude/protocols/constrained-claude-dialect.md`
- Codex 타깃 의미: `.claude/protocols/codex-target-semantics.md`
- optional portable metadata: `.claude/protocols/agent-manifest.md`
- optional manifest file: `.claude/agent-manifest.yaml`
- evidence 템플릿: `.claude/memory/templates/evidence-session-template.md`
- 세션 로그 정책: `.claude/memory/session-log/README.md`
- runtime state 정책: `.claude/runtime/README.md`
- worktree runtime log: `.claude/runtime/worktree-runtime.md`
- task report 정책: `.claude/runtime/reports/README.md`
- telemetry 도구: `.claude/tools/telemetry/tracker.sh`
