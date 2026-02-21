-- Review workflow: add status values pending_review, confirmed, discarded
ALTER TABLE photo_uploads DROP CONSTRAINT IF EXISTS photo_uploads_status_check;
ALTER TABLE photo_uploads ADD CONSTRAINT photo_uploads_status_check
  CHECK (status IN ('uploading', 'processing', 'completed', 'error', 'pending_review', 'confirmed', 'discarded'));
