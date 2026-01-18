import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { priceValidationService, ValidationIssue, LVPosition } from '@/lib/price-validation-service';

interface PriceValidationProps {
  positions: LVPosition[];
  projectType: string;
  region?: string;
  tenderId?: string;
  onValidationComplete?: (issues: ValidationIssue[]) => void;
}

export const PriceValidation: React.FC<PriceValidationProps> = ({
  positions,
  projectType,
  region,
  tenderId,
  onValidationComplete,
}) => {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);

  const runValidation = async () => {
    setLoading(true);
    try {
      const validationIssues = await priceValidationService.validatePositions(
        positions,
        projectType,
        region,
        tenderId
      );
      setIssues(validationIssues);
      setValidated(true);
      if (onValidationComplete) {
        onValidationComplete(validationIssues);
      }
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (positions.length > 0 && !validated) {
      runValidation();
    }
  }, [positions]);

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getValidationTypeLabel = (type: string) => {
    switch (type) {
      case 'price_deviation':
        return 'Preisabweichung';
      case 'quantity_anomaly':
        return 'Mengen-Anomalie';
      case 'missing_position':
        return 'Fehlende Position';
      case 'calculation_error':
        return 'Rechenfehler';
      default:
        return type;
    }
  };

  const getPriceIcon = (issue: ValidationIssue) => {
    if (issue.validation_type !== 'price_deviation') return null;
    if (!issue.expected_value || !issue.actual_value) return null;

    const expected = parseFloat(issue.expected_value.replace(/[^\d.-]/g, ''));
    const actual = parseFloat(issue.actual_value.replace(/[^\d.-]/g, ''));

    return actual > expected ? (
      <TrendingUp className="h-4 w-4 text-red-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-green-600" />
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kalkulation wird validiert...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"></div>
            <span>Historische Preise werden geprüft, Mengen analysiert und Positionen validiert...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!validated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kalkulation validieren</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={runValidation} className="w-full">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Validierung starten
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (issues.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-green-900">
            <CheckCircle2 className="h-5 w-5" />
            Keine Probleme gefunden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-800">
            Alle Positionen wurden validiert. Keine Abweichungen, Anomalien oder fehlende Pflichtpositionen erkannt.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Validierungsergebnisse</span>
            <div className="flex gap-2">
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {errorCount}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {warningCount}
                </Badge>
              )}
              {infoCount > 0 && (
                <Badge className="bg-blue-100 text-blue-800 gap-1">
                  <Info className="h-3 w-3" />
                  {infoCount}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {issues.map((issue, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-4 ${getSeverityColor(issue.severity)}`}
              >
                <div className="flex items-start gap-3">
                  {getIcon(issue.severity)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getValidationTypeLabel(issue.validation_type)}
                        </Badge>
                        {issue.position_code && (
                          <span className="text-xs font-mono">{issue.position_code}</span>
                        )}
                        {getPriceIcon(issue)}
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-sm">{issue.issue_description}</p>
                      {issue.position_name && (
                        <p className="text-xs mt-1">{issue.position_name}</p>
                      )}
                    </div>

                    {(issue.expected_value || issue.actual_value) && (
                      <div className="grid grid-cols-2 gap-2 text-xs bg-white/50 rounded p-2">
                        {issue.expected_value && (
                          <div>
                            <span className="font-medium">Erwartet:</span>
                            <span className="ml-2">{issue.expected_value}</span>
                          </div>
                        )}
                        {issue.actual_value && (
                          <div>
                            <span className="font-medium">Aktuell:</span>
                            <span className="ml-2">{issue.actual_value}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {issue.suggestion && (
                      <div className="text-xs bg-white/50 rounded p-2">
                        <span className="font-medium">Empfehlung:</span>
                        <span className="ml-2">{issue.suggestion}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={runValidation} className="w-full">
              Validierung erneut ausführen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
