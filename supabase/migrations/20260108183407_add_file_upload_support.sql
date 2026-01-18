/*
  # Add File Upload Support for Tender Documents

  ## Overview
  This migration adds support for uploading tender documents and tracking their processing status.

  ## New Tables

  ### 1. `tender_file_uploads`
  Stores metadata about uploaded tender files
  - `id` (uuid, primary key) - Unique file upload identifier
  - `original_filename` (text) - Original name of the uploaded file
  - `file_path` (text) - Path in Supabase Storage
  - `file_size` (bigint) - File size in bytes
  - `mime_type` (text) - File MIME type
  - `upload_batch_id` (uuid) - Groups files uploaded together
  - `processing_status` (text) - Status: pending, processing, completed, failed
  - `extraction_result` (jsonb) - AI-extracted data from the document
  - `error_message` (text) - Error details if processing failed
  - `created_at` (timestamptz) - Upload timestamp
  - `processed_at` (timestamptz) - Processing completion timestamp

  ### 2. `tender_upload_batches`
  Groups multiple file uploads together
  - `id` (uuid, primary key) - Unique batch identifier
  - `total_files` (integer) - Total number of files in batch
  - `processed_files` (integer) - Number of files processed
  - `status` (text) - Status: uploading, processing, completed, failed
  - `tender_id` (uuid) - Reference to created tender (if extraction successful)
  - `created_at` (timestamptz) - Batch creation timestamp
  - `completed_at` (timestamptz) - Batch completion timestamp

  ## Storage Bucket

  Creates a storage bucket for tender documents with public read access for authenticated users.

  ## Security
  - Enable RLS on all tables
  - Public access for reading and writing (demo purposes)
  - In production, restrict to authenticated users

  ## Important Notes
  - Files are stored in Supabase Storage bucket 'tender-documents'
  - AI extraction results stored as JSONB for flexibility
  - Batch processing allows tracking progress for multi-file uploads
*/

-- Create tender_upload_batches table
CREATE TABLE IF NOT EXISTS tender_upload_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_files integer NOT NULL DEFAULT 0,
  processed_files integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploading',
  tender_id uuid REFERENCES tenders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create tender_file_uploads table
CREATE TABLE IF NOT EXISTS tender_file_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_batch_id uuid NOT NULL REFERENCES tender_upload_batches(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending',
  extraction_result jsonb DEFAULT '{}'::jsonb,
  error_message text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Add storage bucket for tender documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tender-documents',
  'tender-documents',
  true,
  10485760,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE tender_upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_file_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies for tender_upload_batches
CREATE POLICY "Anyone can view upload batches"
  ON tender_upload_batches FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert upload batches"
  ON tender_upload_batches FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update upload batches"
  ON tender_upload_batches FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete upload batches"
  ON tender_upload_batches FOR DELETE
  TO public
  USING (true);

-- Create policies for tender_file_uploads
CREATE POLICY "Anyone can view file uploads"
  ON tender_file_uploads FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert file uploads"
  ON tender_file_uploads FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update file uploads"
  ON tender_file_uploads FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete file uploads"
  ON tender_file_uploads FOR DELETE
  TO public
  USING (true);

-- Create storage policies
CREATE POLICY "Public can view tender documents"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'tender-documents');

CREATE POLICY "Public can upload tender documents"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'tender-documents');

CREATE POLICY "Public can update tender documents"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'tender-documents');

CREATE POLICY "Public can delete tender documents"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'tender-documents');

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tender_file_uploads_batch_id ON tender_file_uploads(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_tender_file_uploads_status ON tender_file_uploads(processing_status);
CREATE INDEX IF NOT EXISTS idx_tender_upload_batches_status ON tender_upload_batches(status);
