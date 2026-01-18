/*
  # Pipeline Architecture for Tender Document Processing

  ## Overview
  This migration creates a comprehensive pipeline architecture for processing 30+ tender documents
  with segmentation, classification, validation, and cross-document aggregation.

  ## New Tables

  ### 1. `section_types`
  Classification categories for document sections:
  - `id` (uuid, primary key)
  - `name` (text) - e.g., "Leistungsbeschreibung", "Eignungskriterien"
  - `description` (text) - Human-readable description
  - `keywords` (text[]) - Keywords for rule-based classification
  - `parent_type_id` (uuid) - For hierarchical classification
  - `created_at` (timestamptz)

  ### 2. `document_segments`
  Individual segments extracted from documents:
  - `id` (uuid, primary key)
  - `file_upload_id` (uuid, foreign key to tender_file_uploads)
  - `batch_id` (uuid, foreign key to tender_upload_batches)
  - `section_type_id` (uuid, foreign key to section_types)
  - `content` (text) - Segment text content
  - `normalized_content` (text) - Cleaned/normalized version
  - `page_number` (integer) - Source page
  - `sequence_number` (integer) - Order within document
  - `confidence_score` (numeric) - Classification confidence (0-1)
  - `is_relevant` (boolean) - Filtered out if false
  - `metadata` (jsonb) - Structural info (headings, numbering, etc.)
  - `created_at` (timestamptz)

  ### 3. `tender_profiles`
  Consolidated profile from all documents in a batch:
  - `id` (uuid, primary key)
  - `batch_id` (uuid, foreign key to tender_upload_batches, unique)
  - `consolidated_data` (jsonb) - Merged structured data
  - `meta_info` (jsonb) - Fristen, Vergabestelle, etc.
  - `leistungsumfang` (jsonb) - Service scope details
  - `pflichtnachweise` (jsonb) - Required documents/certificates
  - `zuschlagskriterien` (jsonb) - Award criteria
  - `validation_status` (text) - 'pending', 'valid', 'invalid'
  - `validation_errors` (jsonb) - Array of validation errors
  - `conflict_count` (integer) - Number of detected conflicts
  - `confidence_avg` (numeric) - Average confidence across all segments
  - `processing_completed_at` (timestamptz)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `document_conflicts`
  Detected conflicts between documents:
  - `id` (uuid, primary key)
  - `tender_profile_id` (uuid, foreign key to tender_profiles)
  - `field_name` (text) - Which field has conflict
  - `conflict_type` (text) - 'duplicate', 'contradiction', 'inconsistency'
  - `source_segments` (uuid[]) - Array of segment IDs involved
  - `conflicting_values` (jsonb) - The different values found
  - `resolution_status` (text) - 'pending', 'resolved', 'ignored'
  - `resolution_note` (text) - How it was resolved
  - `created_at` (timestamptz)
  - `resolved_at` (timestamptz)

  ### 5. `extraction_validations`
  Validation results for extracted data:
  - `id` (uuid, primary key)
  - `tender_profile_id` (uuid, foreign key to tender_profiles)
  - `field_path` (text) - JSON path to field (e.g., "meta_info.deadline")
  - `field_type` (text) - Expected data type
  - `is_required` (boolean) - Is this a mandatory field?
  - `is_valid` (boolean) - Validation result
  - `validation_rule` (text) - Rule that was applied
  - `error_message` (text) - What went wrong
  - `created_at` (timestamptz)

  ### 6. `pipeline_stages`
  Track pipeline progress for each batch:
  - `id` (uuid, primary key)
  - `batch_id` (uuid, foreign key to tender_upload_batches)
  - `stage_name` (text) - 'ingestion', 'normalization', 'segmentation', etc.
  - `status` (text) - 'pending', 'processing', 'completed', 'failed'
  - `progress_percent` (integer) - 0-100
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz)
  - `error_message` (text)
  - `metadata` (jsonb) - Stage-specific data

  ## Security
  - Enable RLS on all new tables
  - Authenticated users can access all data (user-specific filtering to be added later)

  ## Indexes
  - Performance indexes for common queries
  - Foreign key indexes
  - JSONB path indexes for common lookups
*/

-- Create section_types table
CREATE TABLE IF NOT EXISTS section_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  keywords text[] DEFAULT '{}',
  parent_type_id uuid REFERENCES section_types(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create document_segments table
CREATE TABLE IF NOT EXISTS document_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_upload_id uuid NOT NULL REFERENCES tender_file_uploads(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES tender_upload_batches(id) ON DELETE CASCADE,
  section_type_id uuid REFERENCES section_types(id) ON DELETE SET NULL,
  content text NOT NULL,
  normalized_content text,
  page_number integer,
  sequence_number integer,
  confidence_score numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  is_relevant boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create tender_profiles table
CREATE TABLE IF NOT EXISTS tender_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL UNIQUE REFERENCES tender_upload_batches(id) ON DELETE CASCADE,
  consolidated_data jsonb DEFAULT '{}',
  meta_info jsonb DEFAULT '{}',
  leistungsumfang jsonb DEFAULT '{}',
  pflichtnachweise jsonb DEFAULT '{}',
  zuschlagskriterien jsonb DEFAULT '{}',
  validation_status text DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'partial')),
  validation_errors jsonb DEFAULT '[]',
  conflict_count integer DEFAULT 0,
  confidence_avg numeric(3,2),
  processing_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create document_conflicts table
CREATE TABLE IF NOT EXISTS document_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_profile_id uuid NOT NULL REFERENCES tender_profiles(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  conflict_type text NOT NULL CHECK (conflict_type IN ('duplicate', 'contradiction', 'inconsistency', 'missing')),
  source_segments uuid[] DEFAULT '{}',
  conflicting_values jsonb DEFAULT '[]',
  resolution_status text DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'ignored', 'manual_review')),
  resolution_note text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Create extraction_validations table
CREATE TABLE IF NOT EXISTS extraction_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_profile_id uuid NOT NULL REFERENCES tender_profiles(id) ON DELETE CASCADE,
  field_path text NOT NULL,
  field_type text,
  is_required boolean DEFAULT false,
  is_valid boolean NOT NULL,
  validation_rule text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Create pipeline_stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES tender_upload_batches(id) ON DELETE CASCADE,
  stage_name text NOT NULL CHECK (stage_name IN ('ingestion', 'normalization', 'segmentation', 'classification', 'extraction', 'validation', 'aggregation', 'completed')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  progress_percent integer DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(batch_id, stage_name)
);

-- Insert default section types
INSERT INTO section_types (name, description, keywords) VALUES
  ('meta', 'Metadaten und Grundinformationen', ARRAY['vergabestelle', 'auftraggeber', 'frist', 'deadline', 'angebotsfrist', 'vergabenummer']),
  ('leistungsbeschreibung', 'Beschreibung der zu erbringenden Leistungen', ARRAY['leistung', 'umfang', 'beschreibung', 'gegenstand', 'aufgabe', 'tätigkeit']),
  ('eignungskriterien', 'Anforderungen an die Eignung des Bieters', ARRAY['eignung', 'qualifikation', 'referenz', 'erfahrung', 'umsatz', 'mitarbeiter']),
  ('nachweise', 'Einzureichende Nachweise und Dokumente', ARRAY['nachweis', 'bescheinigung', 'zertifikat', 'versicherung', 'eigenerklärung', 'register']),
  ('technische_spezifikationen', 'Technische Anforderungen', ARRAY['technisch', 'spezifikation', 'standard', 'norm', 'din', 'vob', 'bgl']),
  ('zuschlagskriterien', 'Bewertungskriterien für Angebote', ARRAY['zuschlag', 'bewertung', 'kriterium', 'gewichtung', 'preis', 'qualität']),
  ('vertragsbedingungen', 'Vertragliche Regelungen', ARRAY['vertrag', 'haftung', 'strafe', 'gewährleistung', 'zahlung', 'abnahme']),
  ('fristen', 'Termine und Fristen', ARRAY['termin', 'frist', 'zeitplan', 'datum', 'veranstaltung', 'rückfragen']),
  ('rechtliches', 'Rechtliche Anforderungen', ARRAY['tariftreue', 'mindestlohn', 'compliance', 'datenschutz', 'geheimhaltung']),
  ('sicherheit', 'Sicherheitsanforderungen', ARRAY['sicherheit', 'dguv', 'unfallverhütung', 'arbeitsschutz', 'sige'])
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_segments_file_upload ON document_segments(file_upload_id);
CREATE INDEX IF NOT EXISTS idx_document_segments_batch ON document_segments(batch_id);
CREATE INDEX IF NOT EXISTS idx_document_segments_section_type ON document_segments(section_type_id);
CREATE INDEX IF NOT EXISTS idx_document_segments_confidence ON document_segments(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_document_segments_relevant ON document_segments(is_relevant) WHERE is_relevant = true;
CREATE INDEX IF NOT EXISTS idx_document_segments_sequence ON document_segments(file_upload_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_tender_profiles_batch ON tender_profiles(batch_id);
CREATE INDEX IF NOT EXISTS idx_tender_profiles_validation_status ON tender_profiles(validation_status);

CREATE INDEX IF NOT EXISTS idx_document_conflicts_profile ON document_conflicts(tender_profile_id);
CREATE INDEX IF NOT EXISTS idx_document_conflicts_resolution ON document_conflicts(resolution_status);

CREATE INDEX IF NOT EXISTS idx_extraction_validations_profile ON extraction_validations(tender_profile_id);
CREATE INDEX IF NOT EXISTS idx_extraction_validations_valid ON extraction_validations(is_valid);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_batch ON pipeline_stages(batch_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_status ON pipeline_stages(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_stage_name ON pipeline_stages(stage_name);

-- JSONB indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tender_profiles_meta_info ON tender_profiles USING gin(meta_info);
CREATE INDEX IF NOT EXISTS idx_tender_profiles_consolidated ON tender_profiles USING gin(consolidated_data);
CREATE INDEX IF NOT EXISTS idx_document_segments_metadata ON document_segments USING gin(metadata);

-- Enable Row Level Security
ALTER TABLE section_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (simplified - all authenticated users can access)
CREATE POLICY "Authenticated users can read section types"
  ON section_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read document segments"
  ON document_segments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read tender profiles"
  ON tender_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read conflicts"
  ON document_conflicts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update conflicts"
  ON document_conflicts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read validations"
  ON extraction_validations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read pipeline stages"
  ON pipeline_stages FOR SELECT
  TO authenticated
  USING (true);

-- Function to update tender_profile updated_at timestamp
CREATE OR REPLACE FUNCTION update_tender_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tender_profiles_updated_at ON tender_profiles;
CREATE TRIGGER tender_profiles_updated_at
  BEFORE UPDATE ON tender_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_tender_profile_updated_at();

-- Function to initialize pipeline stages when batch is created
CREATE OR REPLACE FUNCTION initialize_pipeline_stages()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pipeline_stages (batch_id, stage_name, status)
  VALUES
    (NEW.id, 'ingestion', 'completed'),
    (NEW.id, 'normalization', 'pending'),
    (NEW.id, 'segmentation', 'pending'),
    (NEW.id, 'classification', 'pending'),
    (NEW.id, 'extraction', 'pending'),
    (NEW.id, 'validation', 'pending'),
    (NEW.id, 'aggregation', 'pending'),
    (NEW.id, 'completed', 'pending')
  ON CONFLICT (batch_id, stage_name) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS init_pipeline_stages_on_batch_create ON tender_upload_batches;
CREATE TRIGGER init_pipeline_stages_on_batch_create
  AFTER INSERT ON tender_upload_batches
  FOR EACH ROW
  EXECUTE FUNCTION initialize_pipeline_stages();

-- Function to update conflict count on tender_profiles
CREATE OR REPLACE FUNCTION update_conflict_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tender_profiles
  SET conflict_count = (
    SELECT COUNT(*)
    FROM document_conflicts
    WHERE tender_profile_id = COALESCE(NEW.tender_profile_id, OLD.tender_profile_id)
      AND resolution_status = 'pending'
  )
  WHERE id = COALESCE(NEW.tender_profile_id, OLD.tender_profile_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conflict_count_on_change ON document_conflicts;
CREATE TRIGGER update_conflict_count_on_change
  AFTER INSERT OR UPDATE OR DELETE ON document_conflicts
  FOR EACH ROW
  EXECUTE FUNCTION update_conflict_count();

-- Function to calculate average confidence score for tender profile
CREATE OR REPLACE FUNCTION update_tender_profile_confidence()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tender_profiles
  SET confidence_avg = (
    SELECT ROUND(AVG(confidence_score)::numeric, 2)
    FROM document_segments
    WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)
      AND confidence_score IS NOT NULL
  )
  WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profile_confidence_on_segment_change ON document_segments;
CREATE TRIGGER update_profile_confidence_on_segment_change
  AFTER INSERT OR UPDATE OR DELETE ON document_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_tender_profile_confidence();