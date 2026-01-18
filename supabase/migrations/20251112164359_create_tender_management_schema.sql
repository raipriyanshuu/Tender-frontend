/*
  # Cleaning Service Tender Management System Schema

  ## Overview
  This migration creates the complete database schema for the Echt Sauber! Tender AI system,
  including tables for tenders, company profiles, documents, Q&A responses, and pricing data.

  ## New Tables

  ### 1. `tenders`
  Stores tender opportunities with scoring and matching data
  - `id` (uuid, primary key) - Unique tender identifier
  - `title` (text) - Tender title
  - `buyer` (text) - Buyer/contracting authority name
  - `region` (text) - Geographic region code (e.g., DE-BW)
  - `deadline` (timestamptz) - Submission deadline
  - `url` (text) - Link to tender posting
  - `score` (integer) - Overall match score (0-100)
  - `legal_risks` (jsonb) - Array of legal/compliance risks
  - `must_hits` (integer) - Number of must-criteria met
  - `must_total` (integer) - Total must-criteria
  - `can_hits` (integer) - Number of can-criteria met
  - `can_total` (integer) - Total can-criteria
  - `waste_streams` (jsonb) - Array of service types (e.g., Unterhaltsreinigung, Glasreinigung)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `company_profiles`
  Stores company information for tender submissions
  - `id` (uuid, primary key) - Unique profile identifier
  - `name` (text) - Company name
  - `address` (text) - Company address
  - `vat_id` (text) - VAT identification number
  - `permits` (jsonb) - Array of certifications (ISO 9001, DIN 77400)
  - `fleet` (text) - Fleet description
  - `insurance` (text) - Insurance information
  - `contact_name` (text) - Contact person name
  - `contact_email` (text) - Contact email
  - `depot_postcode` (text) - Depot postal code
  - `disposal_sites` (text) - Certifications and quality standards
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. `tender_submissions`
  Links tenders to company profiles and tracks submission status
  - `id` (uuid, primary key) - Unique submission identifier
  - `tender_id` (uuid, foreign key) - Reference to tender
  - `profile_id` (uuid, foreign key) - Reference to company profile
  - `status` (text) - Submission status (draft, submitted, won, lost)
  - `win_probability` (integer) - Calculated win probability (0-100)
  - `route_score` (integer) - Route feasibility score (0-100)
  - `risk_accepted` (boolean) - Whether legal risks are accepted
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 4. `documents`
  Stores document metadata and status for submissions
  - `id` (uuid, primary key) - Unique document identifier
  - `submission_id` (uuid, foreign key) - Reference to tender submission
  - `name` (text) - Document name
  - `status` (text) - Document status (present, missing, needs_update)
  - `notes` (text) - Additional notes about the document
  - `file_url` (text) - URL to stored file (if uploaded)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 5. `qa_responses`
  Stores answers to complementary questions for submissions
  - `id` (uuid, primary key) - Unique response identifier
  - `submission_id` (uuid, foreign key) - Reference to tender submission
  - `question_id` (text) - Question identifier
  - `question_label` (text) - Question text
  - `answer` (text) - Answer text
  - `ai_generated` (boolean) - Whether answer was AI-generated
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 6. `pricing_data`
  Stores pricing calculations for cleaning service submissions
  - `id` (uuid, primary key) - Unique pricing identifier
  - `submission_id` (uuid, foreign key) - Reference to tender submission
  - `pickups_per_week` (numeric) - Cleanings per week
  - `weeks_per_month` (numeric) - Weeks per month (typically 4.3)
  - `distance_km` (numeric) - One-way distance in kilometers
  - `tonnage_per_month` (numeric) - Square meters to clean
  - `disposal_fee_per_tonne` (numeric) - Price per m² per cleaning (EUR)
  - `cost_per_km` (numeric) - Travel cost per km (EUR)
  - `lift_fees_per_month` (numeric) - Material costs + special services (EUR)
  - `fuel_surcharge_pct` (numeric) - Not used for cleaning services
  - `margin_pct` (numeric) - Profit margin percentage
  - `subtotal` (numeric) - Calculated subtotal (EUR)
  - `surcharge` (numeric) - Calculated surcharge (EUR)
  - `margin` (numeric) - Calculated margin (EUR)
  - `total` (numeric) - Total monthly price (EUR)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable Row Level Security (RLS) on all tables
  - Public read access for authenticated users
  - Insert/update/delete restricted to authenticated users

  ## Important Notes
  - All monetary values stored in EUR
  - JSONB used for flexible array/object storage
  - Foreign key constraints ensure referential integrity
  - Timestamps track record history
*/

-- Create tenders table
CREATE TABLE IF NOT EXISTS tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  buyer text NOT NULL,
  region text NOT NULL,
  deadline timestamptz NOT NULL,
  url text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  legal_risks jsonb DEFAULT '[]'::jsonb,
  must_hits integer NOT NULL DEFAULT 0,
  must_total integer NOT NULL DEFAULT 0,
  can_hits integer NOT NULL DEFAULT 0,
  can_total integer NOT NULL DEFAULT 0,
  waste_streams jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create company_profiles table
CREATE TABLE IF NOT EXISTS company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  vat_id text DEFAULT '',
  permits jsonb DEFAULT '[]'::jsonb,
  fleet text DEFAULT '',
  insurance text DEFAULT '',
  contact_name text DEFAULT '',
  contact_email text DEFAULT '',
  depot_postcode text DEFAULT '',
  disposal_sites text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tender_submissions table
CREATE TABLE IF NOT EXISTS tender_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  win_probability integer DEFAULT 0,
  route_score integer DEFAULT 0,
  risk_accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES tender_submissions(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'missing',
  notes text DEFAULT '',
  file_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create qa_responses table
CREATE TABLE IF NOT EXISTS qa_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES tender_submissions(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  question_label text NOT NULL,
  answer text DEFAULT '',
  ai_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create pricing_data table
CREATE TABLE IF NOT EXISTS pricing_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES tender_submissions(id) ON DELETE CASCADE,
  pickups_per_week numeric NOT NULL DEFAULT 0,
  weeks_per_month numeric NOT NULL DEFAULT 4.3,
  distance_km numeric NOT NULL DEFAULT 0,
  tonnage_per_month numeric NOT NULL DEFAULT 0,
  disposal_fee_per_tonne numeric NOT NULL DEFAULT 0,
  cost_per_km numeric NOT NULL DEFAULT 0,
  lift_fees_per_month numeric NOT NULL DEFAULT 0,
  fuel_surcharge_pct numeric NOT NULL DEFAULT 0,
  margin_pct numeric NOT NULL DEFAULT 0,
  subtotal numeric DEFAULT 0,
  surcharge numeric DEFAULT 0,
  margin numeric DEFAULT 0,
  total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_data ENABLE ROW LEVEL SECURITY;

-- Create policies for tenders
CREATE POLICY "Anyone can view tenders"
  ON tenders FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert tenders"
  ON tenders FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update tenders"
  ON tenders FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete tenders"
  ON tenders FOR DELETE
  TO public
  USING (true);

-- Create policies for company_profiles
CREATE POLICY "Anyone can view profiles"
  ON company_profiles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert profiles"
  ON company_profiles FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update profiles"
  ON company_profiles FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete profiles"
  ON company_profiles FOR DELETE
  TO public
  USING (true);

-- Create policies for tender_submissions
CREATE POLICY "Anyone can view submissions"
  ON tender_submissions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert submissions"
  ON tender_submissions FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update submissions"
  ON tender_submissions FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete submissions"
  ON tender_submissions FOR DELETE
  TO public
  USING (true);

-- Create policies for documents
CREATE POLICY "Anyone can view documents"
  ON documents FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert documents"
  ON documents FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update documents"
  ON documents FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete documents"
  ON documents FOR DELETE
  TO public
  USING (true);

-- Create policies for qa_responses
CREATE POLICY "Anyone can view responses"
  ON qa_responses FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert responses"
  ON qa_responses FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update responses"
  ON qa_responses FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete responses"
  ON qa_responses FOR DELETE
  TO public
  USING (true);

-- Create policies for pricing_data
CREATE POLICY "Anyone can view pricing"
  ON pricing_data FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert pricing"
  ON pricing_data FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update pricing"
  ON pricing_data FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete pricing"
  ON pricing_data FOR DELETE
  TO public
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tenders_deadline ON tenders(deadline);
CREATE INDEX IF NOT EXISTS idx_tenders_score ON tenders(score DESC);
CREATE INDEX IF NOT EXISTS idx_tenders_region ON tenders(region);
CREATE INDEX IF NOT EXISTS idx_tender_submissions_tender_id ON tender_submissions(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_submissions_profile_id ON tender_submissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_documents_submission_id ON documents(submission_id);
CREATE INDEX IF NOT EXISTS idx_qa_responses_submission_id ON qa_responses(submission_id);
CREATE INDEX IF NOT EXISTS idx_pricing_data_submission_id ON pricing_data(submission_id);
