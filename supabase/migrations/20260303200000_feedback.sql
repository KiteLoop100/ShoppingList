-- F25: Customer Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('product', 'general', 'post_shopping')),
  product_id UUID REFERENCES products(product_id) ON DELETE SET NULL,
  trip_id UUID REFERENCES shopping_trips(trip_id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(store_id) ON DELETE SET NULL,
  category TEXT,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  message TEXT NOT NULL CHECK (char_length(message) >= 10 AND char_length(message) <= 2000),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_type ON feedback(feedback_type);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Admin can select all feedback"
  ON feedback FOR SELECT
  USING (true);

CREATE POLICY "Admin can update feedback"
  ON feedback FOR UPDATE
  USING (true);

CREATE POLICY "Admin can delete feedback"
  ON feedback FOR DELETE
  USING (true);
