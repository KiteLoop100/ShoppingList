-- Pipeline step tracking for resumable image processing.
-- Allows the system to restart from the last successful step on failure.

ALTER TABLE photo_uploads ADD COLUMN IF NOT EXISTS pipeline_step TEXT;
ALTER TABLE photo_uploads ADD COLUMN IF NOT EXISTS pipeline_state JSONB;

COMMENT ON COLUMN photo_uploads.pipeline_step IS 'Current pipeline step: classify, extract, bg_remove, enhance, verify, completed';
COMMENT ON COLUMN photo_uploads.pipeline_state IS 'Intermediate results per step (classification, extraction JSON; binary intermediates stored in Storage)';

-- Update status check to allow 'pipeline_running' for step-by-step processing
ALTER TABLE photo_uploads DROP CONSTRAINT IF EXISTS photo_uploads_status_check;
ALTER TABLE photo_uploads ADD CONSTRAINT photo_uploads_status_check
  CHECK (status IN ('uploading', 'processing', 'pipeline_running', 'pending_review', 'completed', 'error'));
