# 테스트 규칙 - Alter Ego 프로젝트

## 실행 명령

```bash
# Backend (pytest)
cd /c/git/alter-ego/backend && py -m uv run pytest tests/ -v          # 전체
cd /c/git/alter-ego/backend && py -m uv run pytest tests/test_xxx.py  # 단일
cd /c/git/alter-ego/backend && py -m uv run pytest -k "test_create"   # 키워드

# Frontend (빌드 + 린트)
cd /c/git/alter-ego/frontend && npm run build
cd /c/git/alter-ego/frontend && npm run lint

# E2E (Playwright)
cd /c/git/alter-ego/frontend && npx playwright test
cd /c/git/alter-ego/frontend && npx playwright test --reporter=list
```

## Backend 테스트 (pytest)

### 구조
```
backend/tests/
├── conftest.py          # 공통 fixture: client, auth_headers, test_user
├── test_persona.py
├── test_chat.py
├── test_sns.py
├── test_follow.py
├── test_lora.py
├── test_schedule.py
└── test_activity.py
```

### 규칙
- 테스트용 계정: `test@alter-ego.dev` / `test123456`
- fixture 사용: `client` (TestClient), `auth_headers` (JWT 헤더)
- 생성 데이터는 테스트 후 정리 (fixture teardown 또는 직접 삭제)
- 외부 API (Replicate, OpenAI)는 `unittest.mock.patch`로 mock
- 테스트 이름: `test_<동작>_<시나리오>`
- Happy path + Error path (no auth, not found) 모두 작성

## E2E 테스트 (Playwright)

### 주의사항
- `locator.isVisible()` → 타임아웃 없음. `expect(locator).toBeVisible({ timeout })` 사용
- Supabase `signOut()` → `scope=global` 기본. URL predicate로 인터셉트:
  ```typescript
  page.route((url) => url.pathname.includes('/auth/v1/logout'), handler)
  ```
- storageState 토큰 만료 대비: `loginAndWaitForList()` 헬퍼 사용
- `heading.or(loginForm)` 패턴으로 Loading 상태 핸들링

## QA 체크리스트
- [ ] `py -m uv run pytest tests/ -v` — 전체 통과
- [ ] `npm run build` — 에러 0
- [ ] `npm run lint` — 에러 0 (경고 허용)
- [ ] 신규 API에 테스트 작성됨
- [ ] no-auth / 404 엣지 케이스 포함
