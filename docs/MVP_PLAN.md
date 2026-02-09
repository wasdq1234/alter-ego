# Alter Ego - AI Influencer MVP 기획서

## 프로젝트 개요

나만의 AI 페르소나(인플루언서)를 만들고, 해당 페르소나와 실시간 채팅하는 서비스.

## 기술 스택

| 구분 | 기술 | 선택 이유 |
|------|------|-----------|
| **Backend** | FastAPI (Python) + uv | 비동기 WebSocket 네이티브 지원, LangGraph와 동일 언어, uv로 빠른 패키지 관리 |
| **AI Engine** | LangGraph | 상태 기반 대화 그래프, 메모리/체크포인터 내장, 스트리밍 지원 |
| **Frontend** | React + Vite | MVP에 가장 빠른 개발 속도, Cloudflare Pages 즉시 배포 가능 |
| **Styling** | TailwindCSS | 채팅 UI를 빠르게 구축 |
| **DB / Auth** | Supabase | PostgreSQL + 인증 + RLS 통합, 무료 티어 충분 |
| **배포** | Render (FE: Static Site + BE: Web Service) | 동일 생태계, 완전 무료, GitHub 자동 배포 |
| **LLM** | OpenAI GPT 또는 Anthropic Claude (선택) | |

### Backend 패키지 관리: uv

- pip 대비 10~100배 빠른 의존성 설치/해석
- `pyproject.toml` 기반 표준 프로젝트 관리 (PEP 621)
- `uv.lock` 으로 재현 가능한 빌드 보장
- 가상환경 자동 생성/관리 (`uv sync` 한 번으로 완료)

```bash
# 주요 명령어
uv init                    # 프로젝트 초기화 (pyproject.toml 생성)
uv add fastapi langgraph   # 의존성 추가
uv sync                    # 의존성 설치 + 락파일 갱신
uv run uvicorn main:app    # 가상환경 내에서 실행
```

### Frontend 선택: React + Vite 추천 이유

- Cloudflare Pages에 `npm run build` 한 번으로 배포 완료
- Next.js 대비 설정이 단순하고 MVP에 불필요한 SSR 오버헤드 없음
- 채팅 앱은 SPA 구조가 적합 (WebSocket 연결 유지)
- 생태계가 크고 UI 라이브러리 풍부

---

## MVP 범위 (Phase 1)

### 핵심 기능 3가지

#### 1. 회원가입 / 로그인 (Supabase Auth)
- 이메일 + 비밀번호 회원가입/로그인
- Supabase JWT 토큰으로 API 인증
- FE에서 `@supabase/supabase-js`, BE에서 `supabase-py`로 토큰 검증

#### 2. AI 페르소나 설정
- 페르소나 이름, 성격, 말투, 배경 설정
- System Prompt로 변환하여 LangGraph 노드에 주입
- Supabase DB에 저장 (user_id로 소유권 관리)

#### 3. 페르소나와 실시간 채팅
- WebSocket 기반 실시간 대화
- LangGraph 스트리밍 응답 (토큰 단위)
- 대화 히스토리 Supabase DB에 저장 (thread 기반)

---

## 시스템 아키텍처

```
┌─────────────────┐         WebSocket          ┌─────────────────────┐
│                 │  ◄─────────────────────►   │                     │
│   React + Vite  │                            │      FastAPI        │
│   (Chat UI)     │         REST API           │                     │
│                 │  ◄─────────────────────►   │  /api/auth          │
│                 │                            │  /api/persona       │
│  Supabase Auth  │                            │  /ws/chat/{thread}  │
│  (@supabase/js) │                            │                     │
└─────────────────┘                            └──────────┬──────────┘
   Render Static Site                                     │
                                              ┌───────────┼───────────┐
                                              │           │           │
                                    ┌─────────▼────┐ ┌────▼────────┐  │
                                    │              │ │             │  │
                                    │  LangGraph   │ │  Supabase   │  │
                                    │              │ │  (DB+Auth)  │  │
                                    │ ┌──────────┐ │ │             │  │
                                    │ │ Persona  │ │ │ ┌─────────┐ │  │
                                    │ │  Node    │ │ │ │personas │ │  │
                                    │ └────┬─────┘ │ │ │threads  │ │  │
                                    │ ┌────▼─────┐ │ │ │messages │ │  │
                                    │ │  Chat    │ │ │ └─────────┘ │  │
                                    │ │  Node    │ │ │             │  │
                                    │ └──────────┘ │ │  Auth/JWT   │  │
                                    └──────────────┘ └─────────────┘  │
                                              Render Web Service      │
                                              ────────────────────────┘
```

---

## API 설계

### 인증 (Supabase Auth - FE에서 직접 처리)

```
# FE에서 @supabase/supabase-js로 직접 호출
supabase.auth.signUp({ email, password })       # 회원가입
supabase.auth.signInWithPassword({ email, password })  # 로그인
supabase.auth.signOut()                          # 로그아웃
```

> BE에서는 FE가 전달하는 Supabase JWT 토큰을 검증하여 user_id 추출

### REST Endpoints (인증 필요)

```
POST   /api/persona          # 페르소나 생성 (JWT 필수)
GET    /api/persona           # 내 페르소나 목록 (JWT 필수)
GET    /api/persona/{id}     # 페르소나 조회
PUT    /api/persona/{id}     # 페르소나 수정 (소유자만)
```

### WebSocket Endpoint

```
WS     /ws/chat/{thread_id}?token={jwt}  # 실시간 채팅 (JWT로 인증)
```

### 페르소나 데이터 모델

```json
{
  "id": "uuid",
  "user_id": "uuid (supabase auth.uid)",
  "name": "루나",
  "personality": "밝고 긍정적인 성격, 유머러스",
  "speaking_style": "반말, 이모티콘 자주 사용, ~요 체",
  "background": "25세 여성, 서울 거주, 패션과 음악을 좋아함",
  "system_prompt": "(자동 생성됨)",
  "created_at": "timestamp"
}
```

### 채팅 WebSocket 메시지 형식

```json
// Client → Server
{
  "type": "message",
  "content": "오늘 뭐했어?",
  "persona_id": "uuid"
}

// Server → Client (스트리밍)
{
  "type": "stream",
  "content": "오늘",
  "done": false
}
{
  "type": "stream",
  "content": "은 카페에서",
  "done": false
}
{
  "type": "stream",
  "content": "",
  "done": true
}
```

---

## LangGraph 그래프 설계

```python
# 핵심 구조 (의사코드)

class ChatState(MessagesState):
    persona_id: str
    system_prompt: str

def load_persona(state: ChatState) -> dict:
    """페르소나 정보를 로드하여 system prompt 구성"""
    persona = get_persona(state["persona_id"])
    system_prompt = build_system_prompt(persona)
    return {"system_prompt": system_prompt}

def chat(state: ChatState) -> dict:
    """LLM 호출 - 페르소나 system prompt + 대화 히스토리"""
    messages = [SystemMessage(content=state["system_prompt"])] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

# 그래프 구성
graph = StateGraph(ChatState)
graph.add_node("load_persona", load_persona)
graph.add_node("chat", chat)
graph.add_edge(START, "load_persona")
graph.add_edge("load_persona", "chat")
graph.add_edge("chat", END)

# 메모리 (대화 히스토리 유지)
checkpointer = MemorySaver()
app = graph.compile(checkpointer=checkpointer)
```

---

## Supabase DB 스키마

### personas 테이블

```sql
create table public.personas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  personality text not null,
  speaking_style text not null,
  background text,
  system_prompt text,
  created_at timestamptz default now()
);

alter table public.personas enable row level security;

-- 본인 페르소나만 CRUD 가능
create policy "Users manage own personas"
  on public.personas for all
  using ((select auth.uid()) = user_id);
```

### chat_threads 테이블

```sql
create table public.chat_threads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  persona_id uuid references public.personas(id) on delete cascade not null,
  title text,
  created_at timestamptz default now()
);

alter table public.chat_threads enable row level security;

create policy "Users manage own threads"
  on public.chat_threads for all
  using ((select auth.uid()) = user_id);
```

### chat_messages 테이블

```sql
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.chat_threads(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;

create policy "Users read own messages"
  on public.chat_messages for all
  using (
    thread_id in (
      select id from public.chat_threads
      where user_id = (select auth.uid())
    )
  );
```

### 인증 흐름

```
1. FE: supabase.auth.signUp / signInWithPassword → JWT 토큰 획득
2. FE: API 요청 시 Authorization: Bearer {jwt} 헤더 첨부
3. BE: supabase-py로 JWT 검증 → user_id 추출
4. BE: user_id 기반으로 DB 쿼리 (RLS가 자동으로 권한 체크)
```

---

## 프로젝트 디렉토리 구조

```
alter-ego/
├── docs/
│   └── MVP_PLAN.md
├── backend/
│   ├── main.py                 # FastAPI 엔트리포인트
│   ├── api/
│   │   ├── persona.py          # 페르소나 CRUD 라우터
│   │   ├── chat.py             # WebSocket 채팅 라우터
│   │   └── deps.py             # 의존성 (JWT 검증, Supabase 클라이언트)
│   ├── core/
│   │   ├── graph.py            # LangGraph 그래프 정의
│   │   └── supabase_client.py  # Supabase 클라이언트 초기화
│   ├── models/
│   │   └── schemas.py          # Pydantic 모델
│   ├── pyproject.toml          # uv 프로젝트 설정 + 의존성 관리
│   ├── uv.lock                 # 의존성 락파일 (자동 생성)
│   └── .env                    # SUPABASE_URL, SUPABASE_KEY, LLM_API_KEY
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   └── supabase.ts         # Supabase 클라이언트 초기화
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx       # 채팅 화면
│   │   │   ├── MessageBubble.tsx    # 메시지 말풍선
│   │   │   ├── PersonaForm.tsx      # 페르소나 설정 폼
│   │   │   └── AuthForm.tsx         # 로그인/회원가입 폼
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts      # WebSocket 커스텀 훅
│   │   │   └── useAuth.ts           # 인증 상태 훅
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

---

## MVP 구현 순서

| 순서 | 작업 | 설명 |
|------|------|------|
| 1 | 프로젝트 초기 세팅 | Backend(FastAPI) + Frontend(React+Vite) 프로젝트 생성 |
| 2 | Supabase 프로젝트 생성 | DB 테이블 + RLS 정책 + Auth 설정 |
| 3 | 인증 구현 | FE: 로그인/회원가입 UI, BE: JWT 검증 미들웨어 |
| 4 | 페르소나 CRUD | Pydantic 스키마 + Supabase DB 연동 API |
| 5 | LangGraph 채팅 그래프 | 페르소나 로드 → LLM 호출 → 메시지 DB 저장 |
| 6 | WebSocket 채팅 API | /ws/chat/{thread_id} 스트리밍 응답 |
| 7 | Frontend 채팅 UI | 채팅 화면 + WebSocket 연결 |
| 8 | Frontend 페르소나 설정 | 페르소나 생성/수정 폼 |
| 9 | 통합 테스트 | 전체 플로우 검증 |
| 10 | Render 배포 | Static Site(FE) + Web Service(BE) |

---

## 배포 전략: Render (무료)

FE와 BE를 동일 플랫폼에서 무료로 배포.

### 왜 Render인가?

| 항목 | 내용 |
|------|------|
| **비용** | 완전 무료 (카드 등록 불필요) |
| **FE 배포** | Static Site → `npm run build` 자동 배포, 무료 HTTPS |
| **BE 배포** | Web Service → FastAPI + LangGraph 풀 Python 환경 |
| **자동 배포** | GitHub 연동, push 시 자동 빌드/배포 |
| **관리** | 같은 대시보드에서 FE/BE 통합 관리 |

### 무료 티어 제약 (MVP에 충분)

- Web Service: 750시간/월, 15분 미사용 시 슬립 (콜드스타트 ~30초)
- PostgreSQL: Supabase에서 관리 (Render DB 불필요)
- 대역폭: 100GB/월

### 배포 설정

```
# Backend (Web Service)
Build Command: pip install uv && uv sync
Start Command: uv run uvicorn main:app --host 0.0.0.0 --port $PORT

# Frontend (Static Site)
Build Command: npm run build
Publish Directory: dist
```

### 이후 스케일업 경로

Render 무료 → Render 유료($7/월, 슬립 없음) → Cloudflare/AWS 마이그레이션
