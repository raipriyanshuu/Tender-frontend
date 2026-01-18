/*
  # Add Price Validation Features

  1. New Tables
    - `historical_prices`
      - Stores historical pricing data for LV positions
      - Used for price matching and benchmarking
    - `standard_positions`
      - Standard positions that should be included in tenders
      - Used for missing position alerts
    - `calculation_validations`
      - Stores validation results for tender calculations
      - Tracks anomalies, missing positions, and calculation errors

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Features
    - Historical price matching
    - Anomaly detection for quantities
    - Missing position alerts
    - Calculation validation (GP = EP × Menge)
*/

-- Historical Prices Table
CREATE TABLE IF NOT EXISTS historical_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_code text NOT NULL,
  position_name text NOT NULL,
  unit text NOT NULL,
  unit_price decimal(12,2) NOT NULL,
  tender_id uuid,
  project_type text NOT NULL,
  region text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historical_prices_position_code ON historical_prices(position_code);
CREATE INDEX IF NOT EXISTS idx_historical_prices_project_type ON historical_prices(project_type);
CREATE INDEX IF NOT EXISTS idx_historical_prices_region ON historical_prices(region);

ALTER TABLE historical_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read historical prices"
  ON historical_prices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert historical prices"
  ON historical_prices FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Standard Positions Table
CREATE TABLE IF NOT EXISTS standard_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_code text NOT NULL,
  position_name text NOT NULL,
  category text NOT NULL,
  project_type text NOT NULL,
  is_mandatory boolean DEFAULT false,
  typical_unit text,
  typical_quantity_min decimal(12,2),
  typical_quantity_max decimal(12,2),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_standard_positions_category ON standard_positions(category);
CREATE INDEX IF NOT EXISTS idx_standard_positions_project_type ON standard_positions(project_type);

ALTER TABLE standard_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read standard positions"
  ON standard_positions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert standard positions"
  ON standard_positions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update standard positions"
  ON standard_positions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Calculation Validations Table
CREATE TABLE IF NOT EXISTS calculation_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid REFERENCES tenders(id) ON DELETE CASCADE,
  validation_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
  position_code text,
  position_name text,
  issue_description text NOT NULL,
  expected_value text,
  actual_value text,
  suggestion text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calculation_validations_tender_id ON calculation_validations(tender_id);
CREATE INDEX IF NOT EXISTS idx_calculation_validations_type ON calculation_validations(validation_type);
CREATE INDEX IF NOT EXISTS idx_calculation_validations_severity ON calculation_validations(severity);

ALTER TABLE calculation_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their calculation validations"
  ON calculation_validations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert calculation validations"
  ON calculation_validations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update calculation validations"
  ON calculation_validations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert sample standard positions for Baustelleneinrichtung
INSERT INTO standard_positions (position_code, position_name, category, project_type, is_mandatory, typical_unit, typical_quantity_min, typical_quantity_max, description) VALUES
  ('01.01.001', 'Baustelleneinrichtung und Vorhaltekosten', 'Baustelleneinrichtung', 'Baugeräte', true, 'Psch', 1, 1, 'Grundlegende Baustelleneinrichtung'),
  ('01.01.002', 'Baustrom', 'Energie', 'Baugeräte', true, 'Monat', 3, 24, 'Stromversorgung für Baustelle'),
  ('01.01.003', 'Bauwasser', 'Ver- und Entsorgung', 'Baugeräte', true, 'Monat', 3, 24, 'Wasserversorgung für Baustelle'),
  ('01.02.001', 'Gerätevorhaltung Bagger', 'Erdbau', 'Baugeräte', false, 'Tag', 30, 180, 'Vorhaltung Mobilbagger'),
  ('01.02.002', 'Gerätevorhaltung Radlader', 'Erdbau', 'Baugeräte', false, 'Tag', 30, 180, 'Vorhaltung Radlader'),
  ('01.03.001', 'Gerüstbau und -vorhaltung', 'Gerüstbau', 'Baugeräte', false, 'm²', 100, 5000, 'Gerüststellung und Vorhaltung'),
  ('01.04.001', 'Stromerzeuger', 'Energie', 'Baugeräte', false, 'Tag', 30, 180, 'Stromaggregat'),
  ('01.05.001', 'Container Büro/Lager', 'Baustelleneinrichtung', 'Baugeräte', false, 'Monat', 3, 24, 'Büro- und Lagercontainer'),
  ('01.06.001', 'Kran', 'Hebezeuge', 'Baugeräte', false, 'Tag', 30, 180, 'Kranvorhaltung'),
  ('01.07.001', 'Sicherheitseinrichtungen', 'Arbeitssicherheit', 'Baugeräte', true, 'Psch', 1, 1, 'Absperrungen, Warnschilder, etc.')
ON CONFLICT DO NOTHING;

-- Insert sample historical prices
INSERT INTO historical_prices (position_code, position_name, unit, unit_price, project_type, region) VALUES
  ('01.01.001', 'Baustelleneinrichtung und Vorhaltekosten', 'Psch', 12500.00, 'Baugeräte', 'DE-HH'),
  ('01.01.001', 'Baustelleneinrichtung und Vorhaltekosten', 'Psch', 11800.00, 'Baugeräte', 'DE-NI'),
  ('01.01.001', 'Baustelleneinrichtung und Vorhaltekosten', 'Psch', 13200.00, 'Baugeräte', 'DE-HB'),
  ('01.01.002', 'Baustrom', 'Monat', 450.00, 'Baugeräte', 'DE-HH'),
  ('01.01.002', 'Baustrom', 'Monat', 420.00, 'Baugeräte', 'DE-NI'),
  ('01.01.003', 'Bauwasser', 'Monat', 280.00, 'Baugeräte', 'DE-HH'),
  ('01.02.001', 'Gerätevorhaltung Bagger', 'Tag', 850.00, 'Baugeräte', 'DE-HH'),
  ('01.02.001', 'Gerätevorhaltung Bagger', 'Tag', 820.00, 'Baugeräte', 'DE-NI'),
  ('01.02.002', 'Gerätevorhaltung Radlader', 'Tag', 650.00, 'Baugeräte', 'DE-HH'),
  ('01.03.001', 'Gerüstbau und -vorhaltung', 'm²', 28.50, 'Baugeräte', 'DE-HH'),
  ('01.04.001', 'Stromerzeuger', 'Tag', 120.00, 'Baugeräte', 'DE-HH'),
  ('01.05.001', 'Container Büro/Lager', 'Monat', 380.00, 'Baugeräte', 'DE-HH'),
  ('01.06.001', 'Kran', 'Tag', 1200.00, 'Baugeräte', 'DE-HH'),
  ('01.07.001', 'Sicherheitseinrichtungen', 'Psch', 3500.00, 'Baugeräte', 'DE-HH')
ON CONFLICT DO NOTHING;