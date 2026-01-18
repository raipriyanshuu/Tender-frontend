/*
  # Fix batch completion logic with atomic operations

  1. Changes
    - Create a function to atomically increment processed_files counter
    - Automatically marks batch as completed when all files are processed
    - Prevents race conditions from concurrent file processing
  
  2. Security
    - Function uses SECURITY DEFINER to ensure proper permissions
*/

CREATE OR REPLACE FUNCTION increment_batch_progress(batch_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_files integer;
  v_new_processed_count integer;
BEGIN
  UPDATE tender_upload_batches
  SET processed_files = processed_files + 1
  WHERE id = batch_id_param
  RETURNING total_files, processed_files INTO v_total_files, v_new_processed_count;
  
  IF v_new_processed_count >= v_total_files THEN
    UPDATE tender_upload_batches
    SET 
      status = 'completed',
      completed_at = NOW()
    WHERE id = batch_id_param;
  END IF;
END;
$$;