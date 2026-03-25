# Worktree 병렬 실행 전략

## 언제 Worktree를 사용하는가

| 조건 | Worktree 사용 | Main에서 직접 실행 |
|------|:---:|:---:|
| 독립적 태스크 2개 이상 | O | |
| 태스크 간 의존성 있음 | | O |
| 같은 파일을 수정하는 태스크 | | O |
| 단일 태스크 | | O |

## Worktree 실행 패턴

```
main branch
  │
  ├── worktree/task-1 (engineer #1)
  │     └── [구현] → [리뷰] → [완료]
  │
  ├── worktree/task-2 (engineer #2)
  │     └── [구현] → [리뷰] → [완료]
  │
  └── merge task-1, task-2 → main
```

## Agent 호출 예시

```
Agent(
  description: "Task 1 구현",
  prompt: "...",
  isolation: "worktree",
  model: "sonnet"
)
```

## 충돌 해결

1. 자동 머지 시도 (`git merge --no-edit`)
2. 충돌 발생 시:
   - 충돌 파일 목록 출력
   - 사용자에게 수동 해결 요청 또는
   - engineer 에이전트에게 충돌 해결 위임

## 주의사항

- Worktree당 하나의 에이전트만 할당
- 공유 설정 파일 (package.json, pyproject.toml) 수정은 순차 실행
- Worktree는 태스크 완료 후 자동 정리됨
