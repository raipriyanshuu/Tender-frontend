/*
  # Fix Pipeline Stages Trigger Security

  1. Changes
    - Drop and recreate the initialize_pipeline_stages function with SECURITY DEFINER
    - This allows the trigger to bypass RLS policies when creating pipeline stages
    
  2. Security
    - The function is safe to run as SECURITY DEFINER because it only inserts predefined stages
    - No user input is used in the INSERT statement
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS initialize_pipeline_stages() CASCADE;

-- Recreate with SECURITY DEFINER so it bypasses RLS
CREATE OR REPLACE FUNCTION initialize_pipeline_stages()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
$$;

-- Recreate the trigger
CREATE TRIGGER init_pipeline_stages_on_batch_create
  AFTER INSERT ON tender_upload_batches
  FOR EACH ROW
  EXECUTE FUNCTION initialize_pipeline_stages();
