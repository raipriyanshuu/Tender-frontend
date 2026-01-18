/*
  # Add INSERT policies for pipeline tables

  1. Changes
    - Add INSERT policies for document_segments (needed by process-tender-documents)
    - Add INSERT policies for tender_profiles (needed by aggregate-tender-batch)
    - Add INSERT policies for document_conflicts (needed by aggregate-tender-batch)
    - Add INSERT policies for extraction_validations (needed by aggregate-tender-batch)
    - These tables need to be writable by edge functions using service role

  2. Security
    - Allow public INSERT since edge functions use service role
    - Frontend uses authenticated role for reads only
*/

-- Allow edge functions to insert document segments
CREATE POLICY "Allow inserting document segments"
  ON document_segments FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow edge functions to insert tender profiles
CREATE POLICY "Allow inserting tender profiles"
  ON tender_profiles FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow edge functions to update tender profiles
CREATE POLICY "Allow updating tender profiles"
  ON tender_profiles FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Allow edge functions to insert document conflicts
CREATE POLICY "Allow inserting document conflicts"
  ON document_conflicts FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow edge functions to insert extraction validations
CREATE POLICY "Allow inserting extraction validations"
  ON extraction_validations FOR INSERT
  TO public
  WITH CHECK (true);
