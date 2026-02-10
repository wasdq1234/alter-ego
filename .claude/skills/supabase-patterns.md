# Supabase 사용 패턴 - Alter Ego 프로젝트

## 프로젝트 정보
- Supabase 프로젝트 ID: `ixbdvyeuljkhjoaipztr`
- Backend: `supabase-py` (`core/supabase_client.py`의 `get_supabase()`)
- Frontend: `@supabase/supabase-js` (`useAuth` 훅)

## DB 스키마 규칙
- 모든 테이블에 `user_id` 컬럼 (RLS 기반)
- snake_case 컬럼 네이밍
- UUID 기본키 (`gen_random_uuid()`)
- `created_at` timestamp with time zone default `now()`
- FK에 `ON DELETE CASCADE` 적용

## RLS (Row Level Security)
- **모든 테이블에 RLS 활성화 필수**
- 기본 정책: `auth.uid() = user_id`
- SNS 공개 데이터 (posts, comments, likes, follows): SELECT 전체 허용
- INSERT/UPDATE/DELETE: 소유자만 허용
- 정책 이름 형식: `{table}_{operation}_policy` (예: `posts_select_policy`)

## 쿼리 패턴
```python
# 단일 조회 (maybe_single 사용 금지!)
result = supabase.table("personas").select("*").eq("id", pid).limit(1).execute()
if not result.data:
    raise HTTPException(404, "Not found")
persona = result.data[0]

# 목록 조회 + cursor 페이지네이션
query = supabase.table("posts").select("*").order("created_at", desc=True).limit(limit)
if cursor:
    query = query.lt("created_at", cursor)
result = query.execute()

# 삽입
result = supabase.table("posts").insert({...}).execute()

# 수정
result = supabase.table("posts").update({...}).eq("id", post_id).execute()

# 삭제
supabase.table("posts").delete().eq("id", post_id).execute()
```

## 기존 테이블 목록
personas, persona_images, chat_threads, chat_messages, posts, comments, likes, follows, activity_schedules, activity_logs

## 마이그레이션
- 파일 위치: `docs/sql/`
- Supabase MCP `apply_migration` 도구로 실행
- 이름: snake_case (예: `add_notification_table`)
