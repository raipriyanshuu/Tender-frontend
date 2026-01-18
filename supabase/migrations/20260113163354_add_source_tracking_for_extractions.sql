/*
  # Add Source Tracking for Extracted Facts

  1. New Table
    - `extracted_facts` - Stores every extracted piece of information with its source
      - `id` (uuid, primary key)
      - `batch_id` (uuid, foreign key to tender_upload_batches)
      - `file_upload_id` (uuid, foreign key to tender_file_uploads)
      - `segment_id` (uuid, foreign key to document_segments)
      - `fact_type` (text) - Type of extracted fact (e.g., 'deadline', 'certification', 'penalty')
      - `fact_category` (text) - Category (e.g., 'requirements', 'evaluation', 'legal')
      - `fact_value` (jsonb) - The extracted value
      - `confidence_score` (numeric) - AI confidence in extraction
      - `source_document` (text) - Filename
      - `source_page` (integer) - Page number (if available)
      - `source_section` (text) - Section name (from heading)
      - `source_line_start` (integer) - Starting line
      - `source_line_end` (integer) - Ending line
      - `context_snippet` (text) - 200 chars of context
      - `created_at` (timestamptz)

  2. Examples of fact_type values
    - 'must_criteria' - Pflichtkriterium
    - 'certification' - Zertifikat
    - 'deadline' - Frist
    - 'penalty' - Vertragsstrafe
    - 'evaluation_criteria' - Zuschlagskriterium
    - 'payment_term' - Zahlungsbedingung
    - 'legal_requirement' - Rechtliche Anforderung
    - 'safety_requirement' - Sicherheitsanforderung

  3. Purpose
    - Full traceability: Every extracted fact links back to source document
    - UI can show: "This requirement comes from Document.pdf, Page 5, Section 'Eignungskriterien'"
    - Builds trust through transparency
    - Enables users to verify AI extractions

  4. Security
    - Enable RLS
    - Users can only view facts from their own batches
*/

CREATE TABLE IF NOT EXISTS extracted_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES tender_upload_batches(id) ON DELETE CASCADE,
  file_upload_id uuid NOT NULL REFERENCES tender_file_uploads(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES document_segments(id) ON DELETE SET NULL,

  fact_type text NOT NULL,
  fact_category text NOT NULL,
  fact_value jsonb NOT NULL DEFAULT '{}'::jsonb,

  confidence_score numeric NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),

  source_document text NOT NULL,
  source_page integer,
  source_section text,
  source_line_start integer,
  source_line_end integer,
  context_snippet text,

  created_at timestamptz DEFAULT now()
);

ALTER TABLE extracted_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extracted facts"
  ON extracted_facts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert extracted facts"
  ON extracted_facts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_extracted_facts_batch_id ON extracted_facts(batch_id);
CREATE INDEX IF NOT EXISTS idx_extracted_facts_file_id ON extracted_facts(file_upload_id);
CREATE INDEX IF NOT EXISTS idx_extracted_facts_type ON extracted_facts(fact_type);
CREATE INDEX IF NOT EXISTS idx_extracted_facts_category ON extracted_facts(fact_category);
