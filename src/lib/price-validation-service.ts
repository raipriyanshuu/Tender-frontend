import { supabase } from './supabase';

export interface HistoricalPrice {
  id: string;
  position_code: string;
  position_name: string;
  unit: string;
  unit_price: number;
  project_type: string;
  region?: string;
  recorded_at: string;
}

export interface StandardPosition {
  id: string;
  position_code: string;
  position_name: string;
  category: string;
  project_type: string;
  is_mandatory: boolean;
  typical_unit?: string;
  typical_quantity_min?: number;
  typical_quantity_max?: number;
  description?: string;
}

export interface ValidationIssue {
  id?: string;
  tender_id?: string;
  validation_type: 'price_deviation' | 'quantity_anomaly' | 'missing_position' | 'calculation_error';
  severity: 'error' | 'warning' | 'info';
  position_code?: string;
  position_name?: string;
  issue_description: string;
  expected_value?: string;
  actual_value?: string;
  suggestion?: string;
  resolved?: boolean;
}

export interface LVPosition {
  position_code: string;
  position_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

class PriceValidationService {
  async getHistoricalPrices(
    positionCode?: string,
    projectType?: string,
    region?: string
  ): Promise<HistoricalPrice[]> {
    let query = supabase.from('historical_prices').select('*');

    if (positionCode) {
      query = query.eq('position_code', positionCode);
    }
    if (projectType) {
      query = query.eq('project_type', projectType);
    }
    if (region) {
      query = query.eq('region', region);
    }

    const { data, error } = await query.order('recorded_at', { ascending: false });

    if (error) {
      console.error('Error fetching historical prices:', error);
      return [];
    }

    return data || [];
  }

  async getStandardPositions(projectType: string): Promise<StandardPosition[]> {
    const { data, error } = await supabase
      .from('standard_positions')
      .select('*')
      .eq('project_type', projectType);

    if (error) {
      console.error('Error fetching standard positions:', error);
      return [];
    }

    return data || [];
  }

  async saveValidationIssue(issue: ValidationIssue): Promise<void> {
    const { error } = await supabase.from('calculation_validations').insert({
      tender_id: issue.tender_id,
      validation_type: issue.validation_type,
      severity: issue.severity,
      position_code: issue.position_code,
      position_name: issue.position_name,
      issue_description: issue.issue_description,
      expected_value: issue.expected_value,
      actual_value: issue.actual_value,
      suggestion: issue.suggestion,
      resolved: issue.resolved || false,
    });

    if (error) {
      console.error('Error saving validation issue:', error);
      throw error;
    }
  }

  async getValidationIssues(tenderId: string): Promise<ValidationIssue[]> {
    const { data, error } = await supabase
      .from('calculation_validations')
      .select('*')
      .eq('tender_id', tenderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching validation issues:', error);
      return [];
    }

    return data || [];
  }

  async resolveValidationIssue(issueId: string): Promise<void> {
    const { error } = await supabase
      .from('calculation_validations')
      .update({ resolved: true })
      .eq('id', issueId);

    if (error) {
      console.error('Error resolving validation issue:', error);
      throw error;
    }
  }

  matchHistoricalPrice(
    position: LVPosition,
    historicalPrices: HistoricalPrice[]
  ): ValidationIssue | null {
    if (historicalPrices.length === 0) {
      return {
        validation_type: 'price_deviation',
        severity: 'info',
        position_code: position.position_code,
        position_name: position.position_name,
        issue_description: 'Keine historischen Preisdaten verfügbar',
        suggestion: 'Preis manuell überprüfen',
      };
    }

    const avgPrice =
      historicalPrices.reduce((sum, hp) => sum + hp.unit_price, 0) / historicalPrices.length;
    const deviation = ((position.unit_price - avgPrice) / avgPrice) * 100;

    if (Math.abs(deviation) > 20) {
      return {
        validation_type: 'price_deviation',
        severity: Math.abs(deviation) > 50 ? 'error' : 'warning',
        position_code: position.position_code,
        position_name: position.position_name,
        issue_description: `Preis weicht ${deviation.toFixed(1)}% vom historischen Durchschnitt ab`,
        expected_value: `${avgPrice.toFixed(2)} €/${position.unit}`,
        actual_value: `${position.unit_price.toFixed(2)} €/${position.unit}`,
        suggestion:
          deviation > 0
            ? 'Preis könnte zu hoch sein - Wettbewerbsfähigkeit prüfen'
            : 'Preis könnte zu niedrig sein - Kosten ggf. unterschätzt',
      };
    }

    return null;
  }

  detectQuantityAnomaly(
    position: LVPosition,
    standardPosition?: StandardPosition
  ): ValidationIssue | null {
    if (!standardPosition) return null;

    if (
      standardPosition.typical_quantity_min &&
      position.quantity < standardPosition.typical_quantity_min
    ) {
      return {
        validation_type: 'quantity_anomaly',
        severity: 'warning',
        position_code: position.position_code,
        position_name: position.position_name,
        issue_description: 'Menge ungewöhnlich niedrig',
        expected_value: `${standardPosition.typical_quantity_min}-${standardPosition.typical_quantity_max} ${position.unit}`,
        actual_value: `${position.quantity} ${position.unit}`,
        suggestion: 'Menge prüfen - könnte zu gering kalkuliert sein',
      };
    }

    if (
      standardPosition.typical_quantity_max &&
      position.quantity > standardPosition.typical_quantity_max
    ) {
      return {
        validation_type: 'quantity_anomaly',
        severity: 'warning',
        position_code: position.position_code,
        position_name: position.position_name,
        issue_description: 'Menge ungewöhnlich hoch',
        expected_value: `${standardPosition.typical_quantity_min}-${standardPosition.typical_quantity_max} ${position.unit}`,
        actual_value: `${position.quantity} ${position.unit}`,
        suggestion: 'Menge prüfen - könnte zu hoch kalkuliert sein',
      };
    }

    return null;
  }

  detectMissingPositions(
    positions: LVPosition[],
    standardPositions: StandardPosition[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const positionCodes = new Set(positions.map((p) => p.position_code));

    for (const standard of standardPositions) {
      if (standard.is_mandatory && !positionCodes.has(standard.position_code)) {
        issues.push({
          validation_type: 'missing_position',
          severity: 'error',
          position_code: standard.position_code,
          position_name: standard.position_name,
          issue_description: `Pflichtposition fehlt: ${standard.position_name}`,
          suggestion: `Position "${standard.position_name}" (${standard.position_code}) sollte im LV enthalten sein`,
        });
      }
    }

    return issues;
  }

  validateCalculation(position: LVPosition): ValidationIssue | null {
    const expectedTotal = position.quantity * position.unit_price;
    const deviation = Math.abs(expectedTotal - position.total_price);

    if (deviation > 0.01) {
      return {
        validation_type: 'calculation_error',
        severity: 'error',
        position_code: position.position_code,
        position_name: position.position_name,
        issue_description: 'Rechenfehler: GP ≠ EP × Menge',
        expected_value: `${expectedTotal.toFixed(2)} €`,
        actual_value: `${position.total_price.toFixed(2)} €`,
        suggestion: 'Kalkulation korrigieren',
      };
    }

    return null;
  }

  async validatePositions(
    positions: LVPosition[],
    projectType: string,
    region?: string,
    tenderId?: string
  ): Promise<ValidationIssue[]> {
    const allIssues: ValidationIssue[] = [];

    const standardPositions = await this.getStandardPositions(projectType);

    const missingPositionIssues = this.detectMissingPositions(positions, standardPositions);
    allIssues.push(...missingPositionIssues);

    for (const position of positions) {
      const calculationIssue = this.validateCalculation(position);
      if (calculationIssue) {
        allIssues.push(calculationIssue);
      }

      const historicalPrices = await this.getHistoricalPrices(
        position.position_code,
        projectType,
        region
      );
      const priceIssue = this.matchHistoricalPrice(position, historicalPrices);
      if (priceIssue) {
        allIssues.push(priceIssue);
      }

      const standardPosition = standardPositions.find(
        (sp) => sp.position_code === position.position_code
      );
      const quantityIssue = this.detectQuantityAnomaly(position, standardPosition);
      if (quantityIssue) {
        allIssues.push(quantityIssue);
      }
    }

    if (tenderId) {
      for (const issue of allIssues) {
        issue.tender_id = tenderId;
        await this.saveValidationIssue(issue);
      }
    }

    return allIssues;
  }

  async recordHistoricalPrice(
    positionCode: string,
    positionName: string,
    unit: string,
    unitPrice: number,
    projectType: string,
    region?: string,
    tenderId?: string
  ): Promise<void> {
    const { error } = await supabase.from('historical_prices').insert({
      position_code: positionCode,
      position_name: positionName,
      unit,
      unit_price: unitPrice,
      project_type: projectType,
      region,
      tender_id: tenderId,
    });

    if (error) {
      console.error('Error recording historical price:', error);
      throw error;
    }
  }
}

export const priceValidationService = new PriceValidationService();
