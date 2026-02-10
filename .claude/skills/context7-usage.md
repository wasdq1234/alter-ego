# Context7 사용 규칙

코드 작성 전 **반드시** Context7 MCP로 최신 공식 문서를 확인한 후 구현한다.

## 호출 순서
1. `resolve-library-id` — 라이브러리 이름으로 ID 조회
2. `query-docs` — 조회된 ID로 문서 검색

## 주요 라이브러리 ID

| 라이브러리 | Context7 ID |
|-----------|-------------|
| LangGraph | `/langchain-ai/langgraph` |
| LangChain | `/langchain-ai/langchain` |
| FastAPI | `/websites/fastapi_tiangolo` |
| Supabase Python | `/websites/supabase_reference_python` |
| Supabase (전체) | `/websites/supabase` |
| React | `/facebook/react` |

## 규칙
- LangGraph/LangChain API는 자주 변경되므로, 캐시된 지식보다 **Context7 결과를 우선**한다.
- 한 질문당 최대 3번까지 호출. 3번 내에 못 찾으면 가진 정보로 진행.
- 검색 쿼리는 구체적으로 작성 (Bad: "auth", Good: "How to set up JWT authentication with Supabase").
