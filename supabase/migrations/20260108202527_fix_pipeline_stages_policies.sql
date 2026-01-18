/*
  # Fix Pipeline Stages RLS Policies

  1. Changes
    - Add INSERT policy for pipeline_stages (needed by trigger)
    - Add UPDATE policy for pipeline_stages (needed by edge functions)
    - These are permissive policies since the table is managed by system functions

  2. Security
    - Allow public access since this table tracks processing state
    - Data integrity maintained by application logic and triggers
*/

-- Allow anyone to insert pipeline stages (needed by trigger)
CREATE POLICY "Anyone can insert pipeline stages"
  ON pipeline_stages FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anyone to update pipeline stages (needed by edge functions)
CREATE POLICY "Anyone can update pipeline stages"
  ON pipeline_stages FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
