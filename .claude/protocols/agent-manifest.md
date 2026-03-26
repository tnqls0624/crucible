# Optional Agent Manifest Protocol

이 문서는 gitagent에서 벤치마킹한 portable manifest 개념을 Crucible에 어떻게 도입할지 정의합니다.
핵심 원칙은 간단합니다.

- manifest는 **선택 기능**이다.
- manifest는 **metadata layer**다.
- `.claude` canonical source를 **대체하지 않는다**.

즉, Crucible의 원본은 계속 `.claude/CLAUDE.md`, `.claude/agents/`, `.claude/skills/`, `.claude/gates/`, `.claude/memory/` 이고, manifest는 이를 다른 호스트나 검증 도구가 더 쉽게 읽도록 돕는 얇은 인덱스다.

## Goals

1. host 간 이식성을 높인다.
2. 역할 분리와 handoff 구조를 더 명시적으로 표현한다.
3. runtime memory와 generated target의 경계를 기계적으로 설명한다.
4. 감사와 자동 검증을 위한 metadata를 제공한다.

## Non-Goals

- `.claude` canonical source를 manifest 기반으로 치환
- skill/agent 본문을 YAML로 재작성
- `.agents` generated artifact를 source of truth로 승격
- gitagent 전체 구조를 그대로 복제

## Design Principles

### 1. Metadata-Only

manifest는 본문을 복사하지 않고 참조만 해야 합니다.
긴 지시문, 상세 프롬프트, 게이트 규칙은 계속 Markdown 문서에 둡니다.

### 2. Canonical-First

우선순위는 항상 아래 순서를 따릅니다.

1. `.claude` canonical source
2. protocol validation 결과
3. optional manifest metadata
4. generated `.agents` artifact

### 3. Reference, Don’t Duplicate

manifest는 경로와 관계를 설명합니다.
예를 들어 reviewer의 규칙은 manifest 안에 다시 쓰지 않고 `.claude/agents/reviewer.md`를 참조합니다.

### 4. Portable but Fail-Closed

호스트별로 표현할 수 없는 필드가 있으면 조용히 버리지 말고 validation에서 실패해야 합니다.

## Recommended Layout

optional manifest를 도입할 경우 다음 파일을 사용할 수 있습니다.

- `.claude/agent-manifest.yaml`
- `.claude/tools/protocols/manifest_validator.ts`
- `.claude/protocols/agent-manifest.md` (이 문서)

manifest는 단일 파일로 유지하고, 세부 내용은 기존 `.claude` 문서를 참조합니다.

## Suggested Schema

```yaml
version: 0.1
name: crucible
canonical_root: .claude
metadata_only: true

supports:
  canonical_hosts: [claude]
  generated_hosts: [codex]

generated_targets:
  - host: codex
    path: .agents/
    source: .claude/

roles:
  - id: architect
    ref: .claude/agents/architect.md
  - id: engineer
    ref: .claude/agents/engineer.md
  - id: qa
    ref: .claude/agents/qa.md
  - id: reviewer
    ref: .claude/agents/reviewer.md

duties:
  maker: engineer
  evaluator: qa
  checker: reviewer
  escalation: cto

runtime_memory:
  specs: .claude/memory/specs/
  decisions: .claude/memory/decisions/
  session_log: .claude/memory/session-log/
  runtime_state: .claude/runtime/
  reports: .claude/runtime/reports/

generated_artifacts:
  codex_agents: .agents/
```

## Duties Mapping

gitagent의 segregation-of-duties 개념은 Crucible에서 아래처럼 대응됩니다.

| Duty | Crucible Role | Source |
|------|---------------|--------|
| maker | engineer | `.claude/agents/engineer.md` |
| evaluator | qa | `.claude/agents/qa.md` |
| checker | reviewer | `.claude/agents/reviewer.md` |
| escalation | cto | `.claude/agents/cto.md` |

이 매핑은 role boundary를 설명하기 위한 metadata이며, 실제 행동 규칙은 각 agent 문서와 skill workflow가 결정합니다.

## Runtime Memory Mapping

manifest가 참조해야 하는 runtime memory는 아래 세 영역입니다.

| Kind | Path | Purpose |
|------|------|---------|
| Specs | `.claude/memory/specs/` | feature contract |
| Decisions | `.claude/memory/decisions/` | ADR / architecture rationale |
| Session Log | `.claude/memory/session-log/` | session summary / evidence trace |
| Runtime State | `.claude/runtime/` | live worktree registry, local runtime state |
| Reports | `.claude/runtime/reports/` | canonical reviewer / evaluator / QA reports |

runtime memory는 canonical content와 다릅니다.
이 영역은 세션 중 업데이트될 수 있으며, generated artifact의 source로 직접 복제하지 않습니다.

## Generated Artifact Boundary

manifest는 `.agents/`와 같은 generated artifact 경계를 설명할 수 있지만, generated artifact를 canonical source로 취급해서는 안 됩니다.

- `.claude/`는 원본
- `.agents/`는 파생물
- manifest는 원본과 파생물 사이의 관계를 설명하는 metadata

## Validation Rules

manifest를 사용할 경우 다음 조건을 지켜야 합니다.

1. canonical source 경로는 반드시 `.claude`를 가리켜야 한다.
2. role reference는 실제 존재하는 `.claude/agents/*.md` 파일만 가리켜야 한다.
3. runtime memory 경로는 실제 `.claude/memory/` 또는 `.claude/runtime/` 하위만 가리켜야 한다.
4. generated target 경로는 `.agents/` 같은 파생 경로만 가리켜야 한다.
5. manifest가 canonical rule과 충돌하면 manifest를 폐기하고 `.claude`를 따른다.

## Validation Entry Points

manifest 파일이 존재하면 아래 경로에서 fail-closed 검증을 수행합니다.

- `./setup --host claude`
- `./setup --host codex`
- `.claude/hooks/post-edit-lint.sh`에서 manifest 파일 편집 직후

수동 검증 명령:

```bash
bun .claude/tools/protocols/manifest_validator.ts --manifest .claude/agent-manifest.yaml
```

## When to Use

- 다른 host/tool에 Crucible 구조를 설명해야 할 때
- CI나 validator에서 역할/메모리/산출물 경계를 기계적으로 확인하고 싶을 때
- 장기적으로 Codex 외 host를 지원하기 위한 metadata 계층이 필요할 때

## When Not to Use

- 단일 Claude Code 환경에서만 사용할 때
- `.claude` 문서만으로도 충분히 운영 가능한 작은 프로젝트
- metadata가 실제 문서보다 먼저 진실의 원천이 되기 시작할 때
