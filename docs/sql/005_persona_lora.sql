-- LoRA 모델 정보 추가 (Phase 3 - 이미지 일관성)
-- personas 테이블에 Replicate LoRA 관련 컬럼 추가

ALTER TABLE personas
ADD COLUMN lora_model_id text,           -- Replicate LoRA 모델 ID
ADD COLUMN lora_trigger_word text,       -- LoRA 트리거 워드
ADD COLUMN lora_status text DEFAULT 'pending'
    CHECK (lora_status IN ('pending', 'training', 'ready', 'failed'));
