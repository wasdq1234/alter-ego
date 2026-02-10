-- SNS 테이블: posts, comments, likes, follows
-- Phase 2 - SNS 기초 DB 스키마

-- 1. sns_posts (포스트)
CREATE TABLE sns_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
    content text,                          -- 텍스트 내용 (nullable: 이미지 전용 포스트)
    image_url text,                        -- Supabase Storage public URL (nullable: 텍스트 전용)
    image_file_path text,                  -- Storage 내 경로 (삭제용)
    created_at timestamptz DEFAULT now(),
    CONSTRAINT content_or_image CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

ALTER TABLE sns_posts ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자가 읽기 가능 (공개 SNS)
CREATE POLICY "Anyone can read posts"
    ON sns_posts FOR SELECT TO authenticated USING (true);

-- 페르소나 소유자만 생성/수정/삭제
CREATE POLICY "Owners manage posts"
    ON sns_posts FOR INSERT TO authenticated
    WITH CHECK (
        persona_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Owners update posts"
    ON sns_posts FOR UPDATE TO authenticated
    USING (
        persona_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Owners delete posts"
    ON sns_posts FOR DELETE TO authenticated
    USING (
        persona_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

-- 2. sns_comments (댓글)
CREATE TABLE sns_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id uuid REFERENCES sns_posts(id) ON DELETE CASCADE NOT NULL,
    persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
    parent_id uuid REFERENCES sns_comments(id) ON DELETE CASCADE,  -- 대댓글 (1 depth)
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE sns_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
    ON sns_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners create comments"
    ON sns_comments FOR INSERT TO authenticated
    WITH CHECK (
        persona_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Owners delete comments"
    ON sns_comments FOR DELETE TO authenticated
    USING (
        persona_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

-- 3. sns_likes (좋아요)
CREATE TABLE sns_likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id uuid REFERENCES sns_posts(id) ON DELETE CASCADE NOT NULL,
    persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (post_id, persona_id)           -- 중복 좋아요 방지
);

ALTER TABLE sns_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes"
    ON sns_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners create likes"
    ON sns_likes FOR INSERT TO authenticated
    WITH CHECK (
        persona_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Owners delete likes"
    ON sns_likes FOR DELETE TO authenticated
    USING (
        persona_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

-- 4. sns_follows (팔로우)
CREATE TABLE sns_follows (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
    following_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (follower_id, following_id),
    CHECK (follower_id != following_id)    -- 자기 팔로우 방지
);

ALTER TABLE sns_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read follows"
    ON sns_follows FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners create follows"
    ON sns_follows FOR INSERT TO authenticated
    WITH CHECK (
        follower_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Owners delete follows"
    ON sns_follows FOR DELETE TO authenticated
    USING (
        follower_id IN (
            SELECT id FROM personas WHERE user_id = (SELECT auth.uid())
        )
    );

-- 인덱스 (피드 쿼리 성능 최적화)
CREATE INDEX idx_sns_posts_persona_id ON sns_posts(persona_id);
CREATE INDEX idx_sns_posts_created_at ON sns_posts(created_at DESC);
CREATE INDEX idx_sns_comments_post_id ON sns_comments(post_id);
CREATE INDEX idx_sns_comments_parent_id ON sns_comments(parent_id);
CREATE INDEX idx_sns_likes_post_id ON sns_likes(post_id);
CREATE INDEX idx_sns_follows_follower_id ON sns_follows(follower_id);
CREATE INDEX idx_sns_follows_following_id ON sns_follows(following_id);
