/*
  # Add Detailed Tender Extraction Fields

  1. New Columns Added to `tenders` table
    - `certifications_required` (jsonb) - ISO, DIN, and other certifications needed
    - `insurance_requirements` (jsonb) - Required insurance types and amounts
    - `payment_terms` (jsonb) - Payment schedule, terms, and conditions
    - `contract_penalties` (jsonb) - Penalty clauses and amounts
    - `equipment_requirements` (jsonb) - Required equipment and specifications
    - `personnel_requirements` (jsonb) - Required personnel qualifications
    - `technical_specifications` (jsonb) - Detailed technical specs
    - `compliance_requirements` (jsonb) - Legal and compliance requirements
    - `safety_requirements` (jsonb) - Safety standards and requirements (DGUV, etc.)
    - `standards` (jsonb) - Standards that must be followed (VOB/C, BGL, etc.)
    - `submission_requirements` (jsonb) - Documents and formats required for submission
    - `evaluation_criteria` (jsonb) - How bids will be evaluated
    - `key_dates` (jsonb) - Important dates beyond deadline
    - `budget_info` (jsonb) - Budget range or estimated value
    - `scope_of_work` (text) - Detailed description of work
    - `extraction_summary` (text) - AI-generated summary of key points
    
  2. Purpose
    - Store comprehensive tender information to help clients prepare winning bids
    - Extract all critical business information from tender documents
    - Save time by identifying requirements, risks, and key terms upfront
*/

DO $$
BEGIN
  -- Add certifications_required column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'certifications_required'
  ) THEN
    ALTER TABLE tenders ADD COLUMN certifications_required jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add insurance_requirements column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'insurance_requirements'
  ) THEN
    ALTER TABLE tenders ADD COLUMN insurance_requirements jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add payment_terms column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'payment_terms'
  ) THEN
    ALTER TABLE tenders ADD COLUMN payment_terms jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add contract_penalties column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'contract_penalties'
  ) THEN
    ALTER TABLE tenders ADD COLUMN contract_penalties jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add equipment_requirements column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'equipment_requirements'
  ) THEN
    ALTER TABLE tenders ADD COLUMN equipment_requirements jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add personnel_requirements column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'personnel_requirements'
  ) THEN
    ALTER TABLE tenders ADD COLUMN personnel_requirements jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add technical_specifications column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'technical_specifications'
  ) THEN
    ALTER TABLE tenders ADD COLUMN technical_specifications jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add compliance_requirements column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'compliance_requirements'
  ) THEN
    ALTER TABLE tenders ADD COLUMN compliance_requirements jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add safety_requirements column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'safety_requirements'
  ) THEN
    ALTER TABLE tenders ADD COLUMN safety_requirements jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add standards column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'standards'
  ) THEN
    ALTER TABLE tenders ADD COLUMN standards jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add submission_requirements column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'submission_requirements'
  ) THEN
    ALTER TABLE tenders ADD COLUMN submission_requirements jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add evaluation_criteria column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'evaluation_criteria'
  ) THEN
    ALTER TABLE tenders ADD COLUMN evaluation_criteria jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add key_dates column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'key_dates'
  ) THEN
    ALTER TABLE tenders ADD COLUMN key_dates jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add budget_info column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'budget_info'
  ) THEN
    ALTER TABLE tenders ADD COLUMN budget_info jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Add scope_of_work column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'scope_of_work'
  ) THEN
    ALTER TABLE tenders ADD COLUMN scope_of_work text DEFAULT '';
  END IF;

  -- Add extraction_summary column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenders' AND column_name = 'extraction_summary'
  ) THEN
    ALTER TABLE tenders ADD COLUMN extraction_summary text DEFAULT '';
  END IF;
END $$;
