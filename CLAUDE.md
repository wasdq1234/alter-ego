# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Alter Ego — AI 인플루언서 플랫폼. 사용자가 AI 페르소나를 만들고 실시간 채팅하는 서비스.

## Architecture

모노레포 구조. `backend/`(FastAPI + LangGraph)와 `frontend/`(React + Vite)가 한 저장소에 존재.

- **Backend**: FastAPI → `api/` 라우터들이 요청 처리 → `core/graph.py` LangGraph가 LLM 호출 → Supabase DB 저장
- **Frontend**: React SPA → Supabase Auth로 직접 로그인 → JWT를 BE에 전달 → WebSocket으로 채팅 스트리밍
- **DB/Auth**: Supabase (PostgreSQL + Auth + RLS). FE에서 `@supabase/supabase-js`, BE에서 `supabase-py` 사용
- **Vite 프록시**: 개발 시 `/api` → `localhost:8000`, `/ws` → WebSocket 프록시 설정됨

## Commands

```bash
# Backend
cd backend && uv run uvicorn main:app --reload    # 개발 서버 (port 8000)
cd backend && uv add <package>                     # 의존성 추가
cd backend && uv sync                              # 의존성 설치

# Frontend
cd frontend && npm run dev                         # 개발 서버 (port 5173)
cd frontend && npm run build                       # 프로덕션 빌드
cd frontend && npm run lint                        # ESLint
```

## Workflow Rules

### Task & Document Driven

- **모든 작업은 Tasks와 `docs/` 문서 기반**으로 진행. 기획서(`docs/MVP_PLAN.md`)를 참조하고, 변경 사항이 있으면 문서를 먼저 업데이트.
- 새 기능이나 설계 변경 시 `docs/` 아래에 관련 문서를 생성 또는 수정하여 최신 상태 유지.

### Git Branch Strategy

- **기능 개발 시 반드시 새 브랜치를 생성**하고 작업. 워크트리 방식을 따름.
- 브랜치 네이밍: `feature/<task-number>-<short-description>` (예: `feature/3-auth-jwt`)
- **테스트가 완료된 후에만 `main`에 머지**. 테스트 미완료 상태에서 머지 금지.
- 머지 전 PR 생성하여 변경 내용 문서화.

```bash
git checkout -b feature/<task-number>-<description>   # 브랜치 생성
# ... 작업 및 테스트 ...
git push -u origin feature/<task-number>-<description> # 푸시
gh pr create                                           # PR 생성
# 테스트 완료 확인 후 머지
```

## Environment Variables

Backend(`.env`): `SUPABASE_URL`, `SUPABASE_KEY`, `OPENAI_API_KEY`
Frontend(`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

## Documentation Reference (Context7)

- 코드 작성 전 **반드시 Context7 MCP를 통해 최신 공식 문서를 확인**한 후 구현.
- `resolve-library-id` → `query-docs` 순서로 호출하여 라이브러리별 최신 API/패턴 참조.
- 주요 라이브러리 ID:
  - LangGraph: `/langchain-ai/langgraph`
  - FastAPI: `/websites/fastapi_tiangolo`
  - Supabase Python: `/websites/supabase_reference_python`
  - Supabase (전체): `/websites/supabase`
  - React: `/facebook/react`

## Key Conventions

- Backend 패키지 관리는 **uv** 사용 (`pyproject.toml` + `uv.lock`). pip/requirements.txt 사용 금지.
- Frontend 스타일링은 **TailwindCSS v4** (`@import "tailwindcss"` 방식).
- Supabase 테이블은 반드시 **RLS 활성화**. 모든 테이블에 `user_id` 기반 정책 적용.
- BE API 인증: Supabase JWT → `Authorization: Bearer {token}` 헤더.
- WebSocket 인증: 쿼리 파라미터 `?token={jwt}`.
