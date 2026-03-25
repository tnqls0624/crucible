# Memory Layout

`.claude/memory/`는 현재 프로젝트의 작업 문맥을 저장하는 위치입니다.

공개 starter 기준에서는 이 디렉토리를 가능한 한 중립적으로 유지합니다.

## Directory Guide

- `specs/`
  - 현재 프로젝트의 활성 feature spec을 저장합니다.
  - fresh clone 상태에서는 비어 있는 것이 정상입니다.
  - 새 스펙은 보통 `/crucible-spec`가 `{feature-name}.spec.md` 형식으로 생성합니다.
- `decisions/`
  - 현재 프로젝트의 ADR(Architecture Decision Record)을 저장합니다.
  - fresh clone 상태에서는 비어 있는 것이 정상입니다.
  - 새 ADR은 보통 `/crucible-plan`이 `{nnn}-{decision-name}.md` 형식으로 생성합니다.
- `templates/`
  - 여러 프로젝트에서 재사용할 수 있는 템플릿을 저장합니다.
  - 이 저장소에서는 evidence 수집 템플릿을 기본 제공한다.
- `session-log/`
  - 로컬 작업 세션 로그를 저장합니다.
  - 실제 세션 로그는 공개 저장소에 커밋하지 않습니다.

## Starter Principle

- 이 저장소는 활성 spec/ADR를 기본 포함하지 않습니다.
- clone 후 첫 real project 문맥은 사용자의 프로젝트에 맞는 spec과 ADR로 채우는 것이 기본 흐름입니다.
- 과거 저장소 전용 작업 기록을 starter에 남기지 않는 것이 원칙입니다.
