# 코딩 컨벤션 - Alter Ego 프로젝트

## 공통
- 타입 힌트 / TypeScript 타입 필수
- 의미 있는 에러 메시지 포함
- 불필요한 주석 금지, 코드가 자명하게 작성

## Backend (Python / FastAPI)
- **패키지 관리**: `uv` 사용. pip/requirements.txt 금지
- **네이밍**: snake_case (함수, 변수, 파일, DB 컬럼)
- **async/await**: 이벤트 루프 차단 금지
- **API 설계**: RESTful 패턴, Pydantic 모델 검증
- **상태코드**: 200(조회), 201(생성), 204(삭제), 400/401/403/404/500
- **페이지네이션**: cursor 기반 (`?cursor=...&limit=20`)
- **인증**: Supabase JWT → `Authorization: Bearer {token}`
- **WebSocket 인증**: `?token={jwt}` 쿼리 파라미터
- **실행**: `py -m uv run <command>` (Windows 환경)

## Frontend (React / TypeScript)
- **컴포넌트**: 함수형 + hooks 패턴
- **스타일링**: TailwindCSS v4 (`@import "tailwindcss"`)
- **상태**: loading/error 상태 항상 처리
- **다국어**: `useI18n()` 훅의 `t()` 사용. 하드코딩 문자열 금지
- **API 통신**: fetch API 사용 (axios 미사용)
- **타입**: `types/index.ts`에 정의
- **빌드**: `npm run build` 에러 0, `npm run lint` 에러 0

## 알려진 함정
- `maybe_single()` 사용 금지 → `.limit(1)` + `result.data[0]` 패턴 사용
- React StrictMode WebSocket 이중 마운트 → `if (wsRef.current === ws)` 가드
- render 중 `Date.now()` 직접 호출 금지 → 함수 추출 또는 변수 저장
- useEffect 내 동기적 setState 금지 → 초기값 설정으로 대체
