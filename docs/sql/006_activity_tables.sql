-- Activity 테이블: schedules, logs
-- Phase 4 - AI 자율 활동 DB 스키마

-- 1. activity_schedules (활동 스케줄)
CREATE TABLE activity_schedules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    schedule_type text NOT NULL CHECK (schedule_type IN ('cron', 'interval')),
    schedule_value text NOT NULL,           -- cron: "0 10 * * *", interval: "3h"
    activity_type text NOT NULL CHECK (activity_type IN ('post', 'react', 'free')),
    activity_prompt text,                   -- 활동 지침 (자연어)
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_schedules ENABLE ROW LEVEL SECURITY;

-- 사용자가 자신의 스케줄만 관리
CREATE POLICY "Users read own schedules"
    ON activity_schedules FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users create own schedules"
    ON activity_schedules FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own schedules"
    ON activity_schedules FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users delete own schedules"
    ON activity_schedules FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 2. activity_logs (활동 로그)
CREATE TABLE activity_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
    activity_type text NOT NULL,            -- 'post', 'comment', 'like', 'follow'
    detail jsonb NOT NULL DEFAULT '{}',     -- 활동 상세 (post_id, target_persona_id 등)
    triggered_by text NOT NULL CHECK (triggered_by IN ('manual', 'schedule', 'auto')),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 사용자가 자신의 페르소나 로그만 조회
CREATE POLICY "Users read own persona logs"
    ON activity_logs FOR SELECT TO authenticated
    USING (
        persona_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

-- 시스템(서비스 롤)에서 로그 삽입 허용 - 서비스 롤 키 사용
-- 일반 사용자는 로그를 직접 생성/수정/삭제할 수 없음

-- 인덱스 (쿼리 성능 최적화)
CREATE INDEX idx_activity_schedules_persona_id ON activity_schedules(persona_id);
CREATE INDEX idx_activity_schedules_user_id ON activity_schedules(user_id);
CREATE INDEX idx_activity_schedules_is_active ON activity_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_activity_logs_persona_id ON activity_logs(persona_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_activity_type ON activity_logs(activity_type);
