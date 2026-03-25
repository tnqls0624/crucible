---
name: crucible-plan
description: |
  검증된 스펙을 ADR(Architecture Decision Record)과 구현 태스크 리스트로 분해합니다. architect 에이전트로 시스템 설계를 수행하고, GSD 원칙에 따라 각 태스크를 컨텍스트 윈도우 50% 이내로 분할합니다. 이 단계를 거쳐야 engineer 에이전트가 정확하게 구현할 수 있습니다.

  ALWAYS use this skill when:
  - 사용자가 `/crucible-plan` 명령을 사용할 때
  - "설계", "아키텍처", "구조 잡아줘", "design", "architecture" 언급 시
  - "태스크 분해", "작업 나눠줘", "플랜 세워줘", "계획 세워줘" 언급 시
  - "어떻게 구현할지", "구현 방법", "접근 방식" 논의 시
  - "ADR 작성", "기술적 결정", "대안 비교" 요청 시
  - crucible-spec이 완료되어 설계 단계로 넘어갈 때
  - 스펙 기반으로 태스크를 분해하고 구현 순서를 정해야 할 때

  Example triggers: "pack compiler 스펙이 완성됐으니까 아키텍처를 설계하고 태스크로 나눠줘", "이 피처를 어떻게 구현할지 플랜을 세워줘"
---

# /crucible-plan — 아키텍처 설계 + 태스크 분해

스펙이 있어도 바로 코딩에 들어가면 AI가 전체 그림을 놓치고 파편적으로 구현합니다. 설계 단계에서 아키텍처를 확정하고 작업을 적절한 크기로 나누면, 각 에이전트가 fresh context에서 정확하게 동작할 수 있습니다. 이것이 GSD(Get Shit Done) 프레임워크의 핵심 원칙입니다.

## Prerequisites

- 현재 Phase가 `plan`
- `.claude/memory/specs/`에 gate-spec을 통과한 스펙 파일 존재

## Workflow

### Step 1: 스펙 로드 및 분석

`.claude/memory/specs/`에서 대상 스펙을 읽고 핵심 요소를 추출합니다:
- Feature ID와 하위 요구사항
- 기술 제약사항
- `.claude/CLAUDE.md`의 프로젝트 스택 정보

### Step 2: ADR(Architecture Decision Record) 작성

`.claude/skills/crucible-plan/references/adr-template.md`를 읽어 템플릿으로 사용합니다.

**파일 경로**: `.claude/memory/decisions/{nnn}-{decision-name}.md`

ADR은 "왜 이 방식을 선택했는가"를 기록하는 문서입니다. 나중에 다른 에이전트나 미래의 자신이 맥락 없이 이 코드를 볼 때 결정의 이유를 이해할 수 있어야 합니다.

작성 시 고려사항:
- 기존 코드베이스를 탐색(Glob, Grep)하여 패턴과 컨벤션 파악
- 기존 ADR이 있으면 충돌 여부 확인
- 최소 2개 대안을 비교하고 트레이드오프를 명시

**Example:**
```
## Decision
Constrained Claude Dialect를 단일 canonical source로 사용한다.

### Alternatives Considered
- Option A: 자유 Markdown + heuristic parser → drift 위험
- Option B: 범용 multi-runtime 플랫폼 동시 구현 → v0 과대 범위
```

### Step 3: 태스크 분해 (GSD 원칙)

각 태스크는 하나의 에이전트가 fresh context에서 독립적으로 완료할 수 있어야 합니다. 태스크가 너무 크면 컨텍스트 부패가 발생하고, 너무 작으면 오버헤드가 늘어납니다.

**분해 기준:**
- 관련 파일 3-7개 이내 (컨텍스트 윈도우의 ~50%)
- 자체 수용 기준 보유 (독립 검증 가능)
- 의존성 최소화 (가능하면 병렬 실행)
- 하나의 plan에 2-5개 태스크가 적정

**각 태스크에 포함할 내용:**
```markdown
### Task {n}: {태스크 이름}
- **Description**: {구현할 내용}
- **Files**: {생성/수정할 파일 경로 목록}
- **Dependencies**: {선행 태스크 번호, 없으면 "없음"}
- **Acceptance Criteria**:
  - [ ] {구체적이고 기계적으로 검증 가능한 기준}
- **Estimated Complexity**: small | medium | large
```

### Step 4: gate-plan 검증

`.claude/gates/gate-plan.md`를 읽고 통과 조건을 확인합니다. 핵심:
- ADR에 Context, Decision, Consequences 섹션 존재
- 모든 태스크에 수용 기준과 관련 파일 명시
- 스펙 파일 참조 존재

### Step 5: 사용자 리뷰

아키텍처 결정과 태스크 리스트를 사용자에게 제시합니다. 승인받으면 Phase를 전환합니다.

### Step 6: Phase 전환 및 태스크 등록

1. 사용자가 실제 구현 시작을 승인한 경우에만 `CLAUDE.md`와 `settings.json`의 Phase를 `build`로 업데이트
2. 문서 기준선 고도화만 진행 중이면 `plan` 유지
3. TodoWrite로 태스크 리스트를 등록하여 진행 추적 시작

## Output Format

```markdown
## Crucible Plan Report

| 항목 | 값 |
|------|-----|
| Feature | Claude-First Pack Compiler v0 (F001) |
| ADR | 001-pack-compiler-v0-architecture.md |
| Tasks | 4개 |
| Gate | PASS |

### Architecture Decision
`Constrained Claude Dialect -> typed IR -> validate -> emit` 파이프라인 채택. 현재는 `.claude` 문서를 source of truth로 고정.

### Task Overview
| # | Task | Complexity | Dependencies |
|---|------|-----------|-------------|
| 1 | single schema core 초안 | medium | - |
| 2 | dialect / policy 규칙 정리 | medium | Task 1 |
| 3 | Codex target semantics 정리 | medium | Task 2 |
| 4 | evidence gate / distribution 메모 정리 | medium | Task 2, Task 3 |

### 다음 단계
문서 기준선이 잠기면 `/crucible-build` 로 구현을 시작하세요.
```

## Related Files

- **ADR Template**: `.claude/skills/crucible-plan/references/adr-template.md` — ADR 작성 시 읽어서 구조 참고
- **Gate**: `.claude/gates/gate-plan.md` — 통과 조건 정의
- **Specs**: `.claude/memory/specs/` — 입력 스펙
- **Decisions**: `.claude/memory/decisions/` — ADR 저장 위치
