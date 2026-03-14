-- Migration: Create receipt_scans table for tracking receipt processing status.
-- Solves silent failure when process-receipt times out or crashes:
-- the client can poll this table independently of the SSE stream.

CREATE TABLE public.receipt_scans (
  scan_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,
  photo_urls    text[] NOT NULL,
  photo_paths   text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'processing',
  receipt_id    uuid REFERENCES public.receipts(receipt_id),
  error_code    text,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.receipt_scans IS
  'Tracks receipt processing jobs so the client can detect success/failure independently of SSE.';

ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own scans"
  ON public.receipt_scans FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE INDEX idx_receipt_scans_user_status
  ON public.receipt_scans (user_id, status)
  WHERE status = 'processing';
