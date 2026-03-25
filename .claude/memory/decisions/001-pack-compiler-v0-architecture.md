# ADR-001: Claude-First Pack Compiler v0 Architecture

- **Status**: accepted
- **Date**: 2026-03-26
- **Feature**: F001 — Claude-First Pack Compiler v0
- **Spec**: `.claude/memory/specs/pack-compiler-v0.spec.md`

## Context

F001은 원래의 painkiller 문제인 `모호한 요청 -> 계약 파손 -> 재질의 루프`를 직접 완성형으로 해결하는 제품이 아니다. v0에서는 가장 작은 구현으로 `Claude-first constrained pack`을 정의하고, 이를 Codex용 repo-local artifact로 컴파일하는 경로를 만들며, 이 경로가 실제 Codex 세션에서 guardrail로 작동하는지 검증해야 한다.

현재 저장소에는 구현 코드가 없고, 재사용 가능한 것은 `.claude` 문서의 `Context Contract`, `Acceptance Criteria`, `cross-model compatibility` 철학뿐이다. 또한 엔지니어링 리뷰에서 다음 원칙이 잠겼다.

- canonical source는 자유 서술 Markdown이 아니라 `Constrained Claude Dialect`
- compiler는 `parse -> typed IR -> validate -> emit`
- parity 약속은 `supported semantic surface` 안에서만 유효
- v0는 `Codex emitter only`, `repo-local install only`
- `single schema core`, `compiler core / distribution layer` 분리
- `golden fixture`, `runtime-in-the-loop acceptance`, `10-session evidence gate` 필수

즉, 이번 결정의 핵심은 "작고 검증 가능한 v0 아키텍처"를 명확히 고정하는 것이다.

현재 중요한 점은 이 ADR이 "바로 구현을 시작했다"는 뜻이 아니라는 것이다. 이 ADR은 `.claude` 문서를 source of truth로 먼저 안정화한 뒤, 이후 build 단계에서 사용할 기준선을 잠그는 문서다.

## Decision

v0는 `compiler core`와 `distribution layer`가 분리된 단일 CLI 프로젝트로 구현한다. canonical input은 `Constrained Claude Dialect` 단일 Markdown 파일이며, parser는 이를 `PackIR`로 변환한다. validator는 `single schema core`와 `Codex-targeted rule table`을 사용해 `supported semantic surface` 안의 입력만 통과시킨다. emitter는 검증된 IR에서 repo-local Codex artifact를 생성한다.

배포/업데이트는 compiler core와 분리된 distribution layer가 담당한다. 이 레이어는 GitHub release artifact 설치, cached/non-blocking update-check, deterministic updater tests를 포함한다. v0에서 runtime 확장은 하지 않고 Codex 단일 타깃만 지원한다.

**핵심 선택**:
- `Constrained Claude Dialect + PackIR`: 자유 Markdown 해석 대신 기계가 읽을 수 있는 명시적 구조를 사용한다.
- `Codex-only + repo-local`: 첫 구현의 설치 경계와 타깃 semantics를 단순하게 유지한다.
- `Fail-closed supported surface`: 지원하지 않는 기능은 축소 변환하지 않고 compile error로 거부한다.
- `Golden fixture + runtime acceptance`: 출력 구조 회귀와 실제 Codex 런타임 동작을 모두 검증한다.
- `Evidence gate included`: 구현 시작 전 10세션 로그를 확보해 원래 painkiller 문제와의 연결을 유지한다.

## Alternatives Considered

### Option A: 자유 Markdown + heuristic parser
- **장점**: 처음 입력 문서를 쓰기 쉽다.
- **단점**: parser, validator, emitter가 서로 다른 규칙을 추측하게 되고 drift가 생긴다.
- **탈락 사유**: `single schema core`와 fail-closed 보장을 깨뜨린다.

### Option B: 다중 런타임 범용 플랫폼을 v0부터 구현
- **장점**: 장기 비전에 직접 연결된다.
- **단점**: Gemini emitter, 범용 capability, migration, provenance까지 한 번에 커져 첫 구현 검증이 무거워진다.
- **탈락 사유**: 현재 painkiller 검증보다 생태계 인프라 구축이 앞서게 된다.

### Option C: preflight CLI로 되돌리고 portability는 완전히 제외
- **장점**: 원래 문제와 가장 직접적으로 맞닿는다.
- **단점**: 이미 확정한 Claude-first pack 흐름과 현재 사용자 의도를 버리게 된다.
- **탈락 사유**: 이번 사이클에서는 pack compiler v0를 구현 대상으로 고정하되, evidence gate로 문제 적합성을 다시 검증하는 쪽이 더 현실적이다.

## Consequences

### Positive
- 구현 경계가 `schema -> IR -> validate -> emit -> distribute`로 명확해진다.
- Codex 단일 타깃으로 시작해 runtime semantics와 테스트 기준을 선명하게 잡을 수 있다.
- golden fixture와 runtime acceptance를 함께 두어 거짓 안정감을 줄인다.
- evidence gate를 v0 범위에 포함해 문제-해결 드리프트를 제어할 수 있다.

### Negative
- canonical source는 사실상 새 DSL이므로 authoring cost가 있다.
- fail-closed 전략 때문에 초기 지원 범위 밖의 입력은 많이 거절될 수 있다.
- repo-local only는 global install보다 사용성은 낮지만 단순함을 택한 결정이다.

### Risks
- `문제 적합성 드리프트`: portability/toolchain으로 기울 수 있다.
  - **완화 방안**: 구현 시작 전 `10-session evidence gate`를 필수 조건으로 둔다.
- `Codex target semantics 모호성`: emitter가 단순 텍스트 생성기로 끝날 수 있다.
  - **완화 방안**: 산출물 경로, 파일명, merge 규칙, 우선순위를 태스크 3에서 먼저 명세한다.
- `테스트 착시`: fixture만 통과하고 실제 런타임 동작은 다를 수 있다.
  - **완화 방안**: 최소 1개의 runtime-in-the-loop acceptance를 태스크 3에 포함한다.

## Current Boundary

- 이 저장소에는 현재 compiler 구현 코드가 없다.
- build 시작 전까지는 `.claude` 내부 문서가 유일한 기준선이다.
- 아래 태스크는 현재 커밋된 구현 목록이 아니라, 이후 build 단계에서 실행할 `planned implementation tasks`다.

## Planned Implementation Tasks

### Task 1: 프로젝트 골격과 단일 스키마 코어 부트스트랩

- **Description**: v0 구현을 위한 CLI 프로젝트 골격, 테스트 하네스, `single schema core`와 `PackIR` 타입의 뼈대를 만든다.
- **Files**:
  - `(planned) package.json`
  - `(planned) tsconfig.json`
  - `(planned) vitest.config.ts`
  - `(planned) src/schema/pack-schema.ts`
  - `(planned) src/schema/pack-ir.ts`
  - `(planned) tests/fixtures/README.md`
- **Dependencies**: 없음
- **Acceptance Criteria**:
  - [ ] 테스트 러너와 기본 스크립트가 동작한다.
  - [ ] dialect schema와 `PackIR` 타입이 한 모듈 집합에서 정의된다.
  - [ ] fixture 디렉토리 구조가 canonical input / expected output / expected failure 용도로 나뉜다.
- **Estimated Complexity**: medium

### Task 2: parser / validator와 Codex rule table 구현

- **Description**: constrained Claude dialect를 파싱해 `PackIR`로 변환하고, supported semantic surface 및 `Codex-targeted rule table`로 검증한다.
- **Files**:
  - `(planned) src/compiler/parse-pack.ts`
  - `(planned) src/compiler/validate-pack.ts`
  - `(planned) src/runtime/codex-rule-table.ts`
  - `(planned) tests/compiler/parse-pack.test.ts`
  - `(planned) tests/compiler/validate-pack.test.ts`
  - `(planned) tests/fixtures/canonical/`
- **Dependencies**: Task 1
- **Acceptance Criteria**:
  - [ ] 필수 frontmatter/섹션/policy block 누락이 명시적 에러로 검출된다.
  - [ ] supported semantic surface 밖 입력은 compile error로 실패한다.
  - [ ] parser/validator는 같은 schema core를 참조한다.
- **Estimated Complexity**: medium

### Task 3: Codex emitter와 runtime acceptance 구현

- **Description**: repo-local Codex artifact 생성 규칙을 명세하고 emitter를 구현하며, 최소 1개의 runtime-in-the-loop acceptance test를 추가한다.
- **Files**:
  - `(planned) src/emitter/emit-codex.ts`
  - `(planned) src/emitter/codex-layout.ts`
  - `(planned) tests/emitter/emit-codex.test.ts`
  - `(planned) tests/runtime/codex-acceptance.test.ts`
  - `(planned) tests/fixtures/expected-codex/`
  - `.claude/protocols/codex-target-semantics.md`
- **Dependencies**: Task 2
- **Acceptance Criteria**:
  - [ ] 산출물 경로, 파일명, merge 규칙, 기존 `AGENTS.md`/`.agents`와의 공존 규칙이 문서화된다.
  - [ ] 동일 입력은 동일 출력 artifact를 생성한다.
  - [ ] 최소 1개의 runtime-in-the-loop acceptance가 정의되고 PASS한다.
- **Estimated Complexity**: large

### Task 4: conformance / distribution / evidence gate 구현

- **Description**: golden fixture 기반 conformance runner, deterministic updater tests, GitHub release/update-check 경로, 10-session evidence gate 입력 구조를 구현한다.
- **Files**:
  - `(planned) src/conformance/run-conformance.ts`
  - `(planned) src/distribution/install-release.ts`
  - `(planned) src/distribution/update-check.ts`
  - `(planned) tests/conformance/run-conformance.test.ts`
  - `(planned) tests/distribution/update-check.test.ts`
  - `.claude/memory/templates/evidence-session-template.md`
- **Dependencies**: Task 2, Task 3
- **Acceptance Criteria**:
  - [ ] golden fixture drift가 테스트 실패로 검출된다.
  - [ ] updater tests가 same/newer/offline/malformed remote 응답을 커버한다.
  - [ ] update-check는 cached/non-blocking 경로로 동작한다.
  - [ ] `10-session evidence gate` 입력 템플릿이 구현 시작 전 사용할 수 있는 형태로 제공된다.
- **Estimated Complexity**: medium
