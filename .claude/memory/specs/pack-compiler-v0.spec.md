# Feature Specification: Claude-First Pack Compiler v0

- **Feature ID**: F001
- **Created**: 2026-03-25
- **Author**: Codex
- **Status**: approved

---

## Problem Statement

AI 코딩 에이전트를 기존 프로젝트에 사용할 때, 개발자는 넓고 모호한 요청을 바로 던지는 경우가 많고 그 결과 기존 인터페이스와 계약을 깨는 출력이 나온다. 이로 인해 같은 작업을 여러 번 다시 질의하게 되고, 시간과 토큰이 동시에 낭비된다.

이번 v0 피처는 이 문제를 한 번에 모두 해결하는 완성형 제품이 아니다. 대신 `Claude-first constrained pack`을 정의하고 이를 Codex용 repo-local artifact로 컴파일하는 가장 작은 구현을 통해, 계약을 더 명시적으로 전달했을 때 실제 세션에서 재질의 루프와 계약 파손이 줄어드는지 검증한다.

즉, v0의 목표는 두 가지다.

1. `Constrained Claude Dialect -> PackIR -> Codex artifact` 경로를 fail-closed하게 구현한다.
2. 이 경로가 실제 Codex 사용 세션에서 guardrail로 작동하는지 증명한다.

## Current Execution Boundary

현재 저장소는 build 단계 구현물이 아니라 문서 기준선을 먼저 잠그는 상태다. 따라서 이 스펙은 "즉시 구현된 코드"를 설명하는 문서가 아니라, `.claude` 내부의 canonical source와 target semantics를 먼저 확정하기 위한 source of truth다.

구현 시작 전 필수 선행조건:

1. `10-session evidence gate` 로그 양식과 최소 사례를 준비한다.
2. `Constrained Claude Dialect` 문서를 먼저 잠근다.
3. `Codex target semantics` 문서를 먼저 잠근다.

## Source of Truth Documents

- Canonical dialect: `.claude/protocols/constrained-claude-dialect.md`
- Codex target semantics: `.claude/protocols/codex-target-semantics.md`
- Cross-model expansion policy: `.claude/protocols/cross-model-compat.md`
- Evidence gate template: `.claude/memory/templates/evidence-session-template.md`

## User Journey

핵심 사용자는 기존 코드베이스를 다루는 AI 코딩 에이전트 파워 유저이며, v0에서는 `pack author`와 `runtime user`가 같은 사람일 수 있다.

1. 사용자가 Claude-first constrained pack Markdown 파일을 작성하거나 수정한다.
2. 시스템이 pack을 파싱하여 `PackIR`로 변환하고, 지원된 semantic surface인지 검증한다.
3. 사용자가 Codex 타깃으로 compile/install을 실행한다.
4. 시스템이 repo-local Codex artifact를 생성하고, 동일 입력에 대해 결정적인 출력과 검증 결과를 제공한다.
5. 사용자가 생성된 artifact를 실제 Codex 세션에서 사용해 작업을 수행한다.
6. 결과: pack 기반 워크플로가 기존 자유 프롬프트 방식보다 계약 보존과 재질의 감소에 도움이 되는지 evidence gate로 기록된다.

### Alternative Flows

- pack이 지원하지 않는 semantic surface를 포함하는 경우: compile을 중단하고 unsupported feature를 명시한 에러를 반환한다.
- Codex emitter target semantics와 충돌하는 기존 파일이 있는 경우: 산출물 생성을 중단하고 충돌 경로와 해결 가이드를 반환한다.
- 원격 `VERSION` 확인이 실패하거나 오프라인인 경우: compile/install 경로는 계속 진행하고 update-check는 non-blocking fallback으로 종료한다.

## Feature Requirements

### F001.1 — Constrained Claude Dialect 정의

- **Description**: Canonical source는 자유 서술 Markdown이 아니라, YAML frontmatter, 고정 섹션 이름, 구조화된 `Policy/Contract Block`을 포함하는 제한된 Claude 호환 방언이어야 한다.
- **Priority**: must-have
- **Acceptance Criteria**:
  - [ ] 입력 pack 형식은 단일 Markdown 파일로 유지된다.
  - [ ] 필수 frontmatter 키와 필수 섹션 이름이 스키마로 정의된다.
  - [ ] `Policy/Contract Block`의 허용 필드와 값 제약이 문서화된다.

### F001.2 — Compiler Core와 Supported Semantic Surface

- **Description**: Compiler core는 `parse -> typed IR -> validate -> emit` 파이프라인으로 동작하며, v0에서 지원하는 semantic surface 안에서만 parity를 보장해야 한다.
- **Priority**: must-have
- **Acceptance Criteria**:
  - [ ] parser, validator, emitter는 공통 `single schema core`와 `PackIR`를 사용한다.
  - [ ] 지원된 semantic surface는 명시 목록으로 정의된다.
  - [ ] 지원 밖의 기능은 warning이 아니라 compile error로 실패한다.
  - [ ] 한 번의 compile session 안에서 입력 문서, IR, capability rule, validation 결과를 재사용한다.

### F001.3 — Codex Emitter와 Repo-Local 설치

- **Description**: v0는 Codex 단일 타깃만 지원하며, emitter는 repo-local install 전제를 갖는 실행 가능한 artifact를 생성해야 한다.
- **Priority**: must-have
- **Acceptance Criteria**:
  - [ ] 생성 산출물의 경로, 파일명, 우선순위, 기존 `AGENTS.md`/`.agents`와의 공존 규칙이 명시된다.
  - [ ] 동일 입력은 동일 출력 artifact를 생성한다.
  - [ ] 충돌 경로 또는 overwrite 금지 상황에서는 중단하고 원인을 설명한다.
  - [ ] global install은 v0 범위에 포함되지 않는다.

### F001.4 — Conformance와 Runtime Acceptance

- **Description**: golden fixture 기반 conformance와 실제 Codex 런타임 검증을 모두 제공해야 한다.
- **Priority**: must-have
- **Acceptance Criteria**:
  - [ ] 지원 pack, expected failure, emitter output을 포함한 golden fixture 세트가 존재한다.
  - [ ] fixture drift는 테스트 실패로 검출된다.
  - [ ] 최소 1개의 runtime-in-the-loop acceptance test가 실제 Codex 세션 기준으로 정의된다.
  - [ ] deterministic updater test가 same-version, newer-version, offline, malformed remote 응답을 커버한다.

### F001.5 — Evidence Gate와 배포 경로

- **Description**: 이 피처는 compiler 구현뿐 아니라, 원래 painkiller 문제와의 연결을 증명하는 evidence gate와 최소 배포 경로를 포함해야 한다.
- **Priority**: must-have
- **Acceptance Criteria**:
  - [ ] `10-session evidence gate`가 구현 시작 전 필수 체크로 정의된다.
  - [ ] 세션 로그에는 원래 요청, 첫 실패 이유, 재질의 횟수, 총 소요 시간, 깨진 계약을 기록한다.
  - [ ] GitHub Release artifact 기반 배포와 repo-local 설치 흐름이 정의된다.
  - [ ] update-check는 non-blocking cached path로 동작하며 compile 경로를 막지 않는다.

## Technical Constraints

- **Performance**:
  - v0 compile은 single-pass session 기반으로 동작해야 한다.
  - update-check는 cached/non-blocking이어야 하며 compile 성공 여부를 막지 않아야 한다.
- **Security**:
  - unsupported feature는 축소 변환하지 않고 fail-closed로 거부한다.
  - v0는 repo-local install only를 사용하여 설치 경계를 단순하게 유지한다.
  - release artifact는 provenance/무결성 검증이 가능한 경로를 사용해야 한다.
- **Compatibility**:
  - v0 타깃은 Codex 하나만 지원한다.
  - canonical source는 Claude-first constrained dialect이지만, 자유 서술 Markdown 전체를 지원한다고 가정하지 않는다.
  - capability 구현은 범용 프레임워크가 아니라 `Codex-targeted rule table`로 시작한다.
- **Dependencies**:
  - Markdown parser 및 frontmatter 파서
  - 타입 검증 라이브러리 또는 명시적 schema layer
  - 테스트 러너와 golden fixture harness
  - GitHub release artifact 및 `VERSION` 조회 경로

## Data Model

```text
Entity: CanonicalPackSource
  - path: string
  - frontmatter: object
  - sections: ordered section list
  - policy_block: structured object
  -> transforms to: PackIR

Entity: PackIR
  - metadata: PackMetadata
  - instructions: normalized instruction nodes
  - policy: PolicyContract
  - supported_surface_flags: string[]
  -> validated against: CodexRuleTable
  -> emitted as: CodexArtifact

Entity: CodexRuleTable
  - runtime: "codex"
  - supported_features: string[]
  - forbidden_features: string[]
  - install_layout: object

Entity: CodexArtifact
  - output_paths: string[]
  - generated_files: GeneratedFile[]
  - deterministic_hash: string

Entity: EvidenceSession
  - original_request: string
  - first_failure_reason: string
  - requery_count: number
  - total_minutes: number
  - broken_contracts: string[]
```

## Planned CLI Contract

```text
compile <source.md> --target codex
  Input: constrained Claude dialect markdown
  Output: repo-local Codex artifacts + validation report
  Errors:
    - unsupported_semantic_surface
    - malformed_policy_block
    - target_layout_conflict

validate <source.md>
  Output: schema/semantic validation result

conformance <fixture-name|all>
  Output: golden fixture pass/fail summary

update-check
  Output: upgrade available / no update / remote unavailable
  Constraint: must not block compile/install success path
```

## Acceptance Criteria (전체)

이 피처가 완료되었다고 판단하기 위한 최종 기준:

- [ ] `Constrained Claude Dialect` 스펙이 문서와 코드에서 같은 규칙을 사용한다.
- [ ] `parse -> typed IR -> validate -> emit` 경로가 Codex 단일 타깃에서 동작한다.
- [ ] `supported semantic surface` 밖의 입력은 compile error로 실패한다.
- [ ] repo-local Codex artifact 생성 규칙과 충돌 처리 규칙이 명확히 정의된다.
- [ ] golden fixture 중심 conformance가 PASS하고 drift를 검출한다.
- [ ] deterministic updater tests가 same/newer/offline/malformed remote 응답을 커버한다.
- [ ] 최소 1개의 runtime-in-the-loop acceptance test가 정의되고 PASS한다.
- [ ] `10-session evidence gate`가 구현 시작 전 필수 입력으로 준비되고 최소 1건 이상 샘플 로그가 채워진다.
- [ ] 모든 기존 테스트 통과
- [ ] gate-build 전체 PASS

## Out of Scope

- Gemini emitter
- 범용 migration tool
- custom provenance chain 구현
- 전체 Claude semantics 100% 보장
- global install 지원
- 범용 multi-runtime capability framework
- 자유 프롬프트 narrowing 도구 자체 구현
