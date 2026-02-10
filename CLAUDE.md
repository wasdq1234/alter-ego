# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Alter Ego — AI 인플루언서 자율 활동 플랫폼. 사용자가 만든 AI 페르소나가 스스로 SNS에서 포스팅, 댓글, 좋아요, 팔로우 등의 활동을 하며, 과거 활동을 기억하고 경험을 쌓아가면서 점점 고유한 정체성과 자아를 형성해가는 서비스. 궁극적으로 YouTube, Instagram, X(Twitter), 커뮤니티 등 외부 플랫폼까지 활동 범위를 확장하여 실제 인플루언서로 성장시키는 것이 목표.

## Architecture

모노레포 구조. `backend/`(FastAPI + LangGraph)와 `frontend/`(React + Vite)가 한 저장소에 존재.

- **Backend**: FastAPI → `api/` 라우터 8개 → `core/` 비즈니스 로직 (LangGraph 채팅/활동 엔진, APScheduler, Replicate LoRA) → Supabase DB
- **Frontend**: React SPA → Supabase Auth 직접 로그인 → JWT를 BE에 전달 → WebSocket 채팅 스트리밍
- **DB/Auth**: Supabase (PostgreSQL + Auth + Storage + RLS)
- **AI 엔진**: LangGraph StateGraph로 활동 결정 (포스팅/댓글/좋아요/팔로우), APScheduler로 자율 스케줄링
- **이미지**: DALL-E 3 + Replicate LoRA로 캐릭터 일관성 있는 이미지 생성

## Commands

```bash
# Backend
cd backend && uv run uvicorn main:app --reload       # 개발 서버 (port 8000)
cd backend && uv add <package>                        # 의존성 추가
cd backend && uv run pytest tests/ -v                 # 테스트

# Frontend
cd frontend && npm run dev                            # 개발 서버 (port 5173)
cd frontend && npm run build                          # 프로덕션 빌드
cd frontend && npm run lint                           # ESLint
cd frontend && npx playwright test                    # E2E 테스트
```

## Workflow Rules

### Task & Document Driven

- **모든 작업은 Tasks와 `docs/` 문서 기반**으로 진행. 기획서(`docs/FULL_PLAN.md`)를 참조.
- 새 기능이나 설계 변경 시 `docs/` 아래에 관련 문서를 생성 또는 수정하여 최신 상태 유지.

### Git Branch Strategy

- 기능 개발 시 반드시 새 브랜치 생성: `feature/<task-number>-<short-description>`
- **`uv run pytest` 전체 통과 + `npm run build` + `npm run lint` 에러 0 확인 후에만 머지**.
- 머지 전 PR 생성하여 변경 내용 문서화.

## Environment Variables

Backend(`.env`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`
Frontend(`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

## Team Skills & Agents (팀 스킬 & 에이전트)

팀 작업 시 `.claude/skills/`(공통 규칙)과 `.claude/agents/`(역할별 전문성)을 조합하여 사용한다.
상세 컨벤션(코딩 규칙, Supabase 패턴, Context7 사용법, 테스트 규칙)은 skills 파일에 정의되어 있다.

### Skills (공통 규칙)

| 파일 | 내용 |
|------|------|
| `skills/context7-usage.md` | Context7 MCP 사용 규칙, 라이브러리 ID 목록 |
| `skills/coding-conventions.md` | 코딩 컨벤션, 네이밍, 알려진 함정 |
| `skills/supabase-patterns.md` | Supabase 쿼리 패턴, RLS 규칙, DB 스키마 |
| `skills/testing-rules.md` | pytest/Playwright 실행법, QA 체크리스트 |

### Agents (역할별 전문성)

| 파일 | 역할 | 사용 Skills | 특수 사항 |
|------|------|------------|-----------|
| `agents/db-engineer.md` | DB 엔지니어 | context7-usage, supabase-patterns | Supabase MCP 도구 접근 |
| `agents/backend-dev.md` | 백엔드 개발자 | context7-usage, coding-conventions, supabase-patterns | — |
| `agents/langgraph-dev.md` | LangGraph 개발자 | context7-usage, coding-conventions, supabase-patterns | opus 모델 |
| `agents/frontend-dev.md` | 프론트엔드 개발자 | context7-usage, coding-conventions | — |
| `agents/test-engineer.md` | 테스트 엔지니어 | context7-usage, testing-rules, coding-conventions | — |

### 팀원 spawn 규칙
팀원을 `Task` 도구로 spawn할 때:
```
1. Read(".claude/agents/<agent-name>.md") — 에이전트 정의 읽기
2. Read(".claude/skills/<skill>.md") — 해당 에이전트의 skills 읽기
3. Task(subagent_type="general-purpose", prompt=<에이전트 정의 + skills 내용 + 작업 지시>) 로 spawn
```

### 팀 운영 흐름
1. `TeamCreate`로 팀 생성
2. `TaskCreate`로 작업 정의 (의존관계 포함)
3. 에이전트 파일 + skills 파일을 읽고 prompt에 포함하여 팀원 spawn
4. 팀원은 작업 완료 후 `TaskUpdate`로 상태 변경
5. 모든 작업 완료 후 `test-engineer`로 QA 수행
