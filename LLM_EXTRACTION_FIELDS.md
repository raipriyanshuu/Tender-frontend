# LLM Extraction Fields - Complete Mapping Guide

## Overview

This document shows what fields the LLM should extract in `run_summaries.ui_json` to populate the frontend UI completely. All hardcoded fallbacks have been removed - **if data is not extracted, the UI will show empty/placeholder states**.

---

## Data Source: `run_summaries.ui_json`

The final transformed data comes from `run_summaries.ui_json` (not `file_extractions`). The backend transformation function `transformFlatUIJson()` maps this structure to the frontend.

---

## Field Mapping: `ui_json` → Frontend

### 1. **Basic Tender Info**

| Frontend Field | `ui_json` Path | Example Value |
|----------------|----------------|---------------|
| `id` | `meta.tender_id` | `"J25-F35-079"` |
| `title` | `meta.tender_id` → `"Ausschreibung J25-F35-079"` | `"Ausschreibung J25-F35-079"` |
| `buyer` | `meta.organization` | `"Vermögen und Bau Baden-Württemberg"` |
| `region` | `executive_summary.location_de` | `"Rheinberg"` |
| `deadline` | `timeline_milestones.submission_deadline_de` | `"2025-12-15"` |

**LLM Should Extract:**
```json
{
  "meta": {
    "tender_id": "J25-F35-079",
    "organization": "Vermögen und Bau Baden-Württemberg"
  },
  "executive_summary": {
    "location_de": "Rheinberg"
  },
  "timeline_milestones": {
    "submission_deadline_de": "2025-12-15"
  }
}
```

---

### 2. **Top 5 Mandatory Requirements** (`submission` field)

**Frontend Location:** "E. Top-5 Pflichtanforderungen" section

**Data Source:** `mandatory_requirements[]`

| Frontend | `ui_json` Path | Required |
|----------|----------------|----------|
| `submission[0]` | `mandatory_requirements[0].requirement_de` | ✅ YES |
| `submission[1]` | `mandatory_requirements[1].requirement_de` | ✅ YES |
| `submission[2]` | `mandatory_requirements[2].requirement_de` | ✅ YES |
| `submission[3]` | `mandatory_requirements[3].requirement_de` | ✅ YES |
| `submission[4]` | `mandatory_requirements[4].requirement_de` | ✅ YES |

**LLM Should Extract:**
```json
{
  "mandatory_requirements": [
    {
      "requirement_de": "Das Formblatt Angebotsschreiben ist mit dem Angebot einzureichen.",
      "category_de": "Formblätter",
      "evidence": [...]
    },
    {
      "requirement_de": "Baustellenkoordinatoren müssen die nach RAB 30 geforderte Qualifikation zur Erfüllung der Aufgaben nach Baustellenverordnung besitzen.",
      "category_de": "Normen",
      "evidence": [...]
    },
    // ... at least 5 items
  ]
}
```

**Frontend Behavior:**
- ✅ If `mandatory_requirements.length > 0` → Shows first 5 items
- ❌ If empty → Shows "Keine Pflichtanforderungen verfügbar"

---

### 3. **Legal Risks** (`legalRisks` field)

**Frontend Location:** "Haupt-Risiken" section

**Data Source:** `risks[]`

| Frontend | `ui_json` Path | Required |
|----------|----------------|----------|
| `legalRisks[0]` | `risks[0].risk_de` | ✅ YES |
| `legalRisks[1]` | `risks[1].risk_de` | ✅ YES |

**LLM Should Extract:**
```json
{
  "risks": [
    {
      "risk_de": "Pauschaler Schadensersatz von 15 % der Bruttoabrechnungssumme bei nachgewiesenen unzulässigen Wettbewerbsabreden.",
      "severity": null,
      "evidence": [...]
    },
    {
      "risk_de": "Ausschluss von diesem und weiteren Vergabeverfahren bzw. fristlose Kündigung bei wissentlich falschen Erklärungen.",
      "severity": null,
      "evidence": [...]
    }
  ]
}
```

**Frontend Behavior:**
- ✅ If `risks.length > 0` → Shows risk list
- ❌ If empty → Shows "Keine Risiken verfügbar"

---

### 4. **Economic Analysis** (`economicAnalysis` field)

**Frontend Location:** "Wirtschaftlichkeitsanalyse" card

**Data Source:** `economic_analysis{}`

| Frontend Field | `ui_json` Path | Required |
|----------------|----------------|----------|
| `economicAnalysis.potentialMargin` | `economic_analysis.potential_margin_de` | ✅ YES |
| `economicAnalysis.orderValueEstimated` | `economic_analysis.order_value_estimated_de` | ✅ YES |
| `economicAnalysis.competitiveIntensity` | `economic_analysis.competitive_intensity_de` | ✅ YES |
| `economicAnalysis.logisticsCosts` | `economic_analysis.logistics_costs_de` | ✅ YES |
| `economicAnalysis.contractRisk` | `economic_analysis.contract_risk_de` | ✅ YES |
| `economicAnalysis.criticalSuccessFactors` | `economic_analysis.critical_success_factors_de[]` | ✅ YES |

**LLM Should Extract:**
```json
{
  "economic_analysis": {
    "potential_margin_de": "12-18%",
    "order_value_estimated_de": "€180k-250k",
    "competitive_intensity_de": "Mittel",
    "logistics_costs_de": "Niedrig",
    "contract_risk_de": "Normal",
    "critical_success_factors_de": [
      "Verfügbarkeit spezieller Baugeräte-Kategorien",
      "Schnelle Ersatzteilbeschaffung & Service",
      "Einhaltung DGUV-Wartungsintervalle",
      "Wettbewerbsfähige Tagesmieten"
    ]
  }
}
```

**Frontend Behavior:**
- ✅ If `economic_analysis.potential_margin_de` exists → Shows value
- ❌ If null → Shows "Nicht verfügbar"
- ✅ If `critical_success_factors_de.length > 0` → Shows list
- ❌ If empty → Shows "Keine Erfolgsfaktoren verfügbar"

---

### 5. **Process Steps / Timeline** (`processSteps` field)

**Frontend Location:** "Zeitplan & Meilensteine" card

**Data Source:** `process_steps[]`

| Frontend Field | `ui_json` Path | Required |
|----------------|----------------|----------|
| `processSteps[0].step` | `process_steps[0].step` | ✅ YES |
| `processSteps[0].days_de` | `process_steps[0].days_de` | ✅ YES |
| `processSteps[0].title_de` | `process_steps[0].title_de` | ✅ YES |
| `processSteps[0].description_de` | `process_steps[0].description_de` | ✅ YES |

**LLM Should Extract:**
```json
{
  "process_steps": [
    {
      "step": 1,
      "days_de": "heute",
      "title_de": "Machbarkeitscheck",
      "description_de": "Verfügbarkeit, Zertifikate, Logistik prüfen."
    },
    {
      "step": 2,
      "days_de": "Tag 2-3",
      "title_de": "Kalkulation",
      "description_de": "Mietkosten, Transport, Wartung, Versicherung kalkulieren."
    },
    {
      "step": 3,
      "days_de": "Tag 3-4",
      "title_de": "Dokumentation",
      "description_de": "Nachweise, Referenzen, CE-/DGUV-Dokumente zusammenstellen."
    },
    {
      "step": 4,
      "days_de": "Tag 5-6",
      "title_de": "Freigabeprozess",
      "description_de": "Interne Prüfung, Management, finale Anpassungen."
    },
    {
      "step": 5,
      "days_de": "Tag 7",
      "title_de": "Abgabe",
      "description_de": "Dokumente hochladen und Bestätigung erhalten."
    }
  ]
}
```

**Frontend Behavior:**
- ✅ If `process_steps.length > 0` → Shows all steps with titles/descriptions
- ❌ If empty → Shows "Keine Prozessschritte verfügbar"

---

### 6. **Penalties** (`penalties` field)

**Frontend Location:** "C. Wirtschaftlichkeit" → "Vertragsstrafen"

**Data Source:** `commercials.penalties_de[]`

| Frontend | `ui_json` Path | Required |
|----------|----------------|----------|
| `penalties[0]` | `commercials.penalties_de[0].item_de` | ✅ YES |

**LLM Should Extract:**
```json
{
  "commercials": {
    "penalties_de": [
      {
        "item_de": "Bei nachgewiesener unzulässiger wettbewerbsbeschränkender Absprache ist ein pauschaler Schadensersatz von 15 % der Bruttoabrechnungssumme zu zahlen; ein geringerer Schaden kann nachgewiesen werden.",
        "evidence": [...]
      }
    ]
  }
}
```

---

### 7. **Evaluation Criteria** (`evaluationCriteria` field)

**Frontend Location:** "D. Zuschlagslogik" → "Bewertungsmatrix"

**Data Source:** `award_logic{}`

| Frontend | `ui_json` Path | Required |
|----------|----------------|----------|
| `evaluationCriteria[0]` | `award_logic.matrix_de` | ⚠️ Optional |
| `evaluationCriteria[1]` | `award_logic.price_weight_percent` → `"Price: X%"` | ⚠️ Optional |
| `evaluationCriteria[2]` | `award_logic.quality_weight_percent` → `"Quality: X%"` | ⚠️ Optional |
| `evaluationCriteria[3]` | `award_logic.other_de` | ⚠️ Optional |

**LLM Should Extract:**
```json
{
  "award_logic": {
    "matrix_de": "Preis 60%, Qualität 25%",
    "price_weight_percent": 60,
    "quality_weight_percent": 25,
    "other_de": "Siehe Bewertungsmatrix"
  }
}
```

---

### 8. **KPIs / Scores**

**Frontend Location:** Various (must-hit %, can-hit %, total score)

**Data Source:** `kpis{}` or calculated from arrays

| Frontend Field | `ui_json` Path | Fallback |
|----------------|----------------|----------|
| `mustTotal` | `kpis.must_hit_fraction` → parse "3/3" OR `mandatory_requirements.length` | ✅ Uses array length |
| `canTotal` | `kpis.possible_hit_fraction` → parse "5/5" OR `operational_requirements.length` | ✅ Uses array length |
| `score` | `kpis.in_total_weighted_percent` OR `kpis.must_hit_percent` | Defaults to 0 |

**LLM Should Extract:**
```json
{
  "kpis": {
    "must_hit_fraction": "3/3",  // Format: "hits/total"
    "possible_hit_fraction": "5/5",
    "in_total_weighted_percent": 91,
    "must_hit_percent": 100,
    "possible_hit_percent": 88
  }
}
```

**Note:** If `kpis.must_hit_fraction` is `null`, backend falls back to `mandatory_requirements.length`.

---

## Complete Example: What LLM Should Generate

```json
{
  "meta": {
    "tender_id": "J25-F35-079",
    "organization": "Vermögen und Bau Baden-Württemberg",
    "language": "de"
  },
  "executive_summary": {
    "brief_description_de": "Interimsunterbringung als 3-geschossige Containeranlage für das Gymnasium Rheinberg.",
    "scope_de": "Lieferung und Montage einer 3-geschossigen Containeranlage inkl. Fundamentierung, Stromanschluss mit Unterverteilungen, Zu- und Abwasser, Blitzschutz und technischen Anlagen.",
    "location_de": "Rheinberg"
  },
  "timeline_milestones": {
    "submission_deadline_de": "2025-12-15"
  },
  "mandatory_requirements": [
    {
      "requirement_de": "Das Formblatt Angebotsschreiben ist mit dem Angebot einzureichen.",
      "category_de": "Formblätter"
    },
    {
      "requirement_de": "Baustellenkoordinatoren müssen die nach RAB 30 geforderte Qualifikation zur Erfüllung der Aufgaben nach Baustellenverordnung besitzen.",
      "category_de": "Normen"
    },
    // ... at least 5 items
  ],
  "operational_requirements": [
    {
      "requirement_de": "Maßnahme: 3-geschossige Containeranlage als Interimsunterbringung Gymnasium Rheinberg.",
      "category_de": null
    },
    // ... more items
  ],
  "risks": [
    {
      "risk_de": "Pauschaler Schadensersatz von 15 % der Bruttoabrechnungssumme bei nachgewiesenen unzulässigen Wettbewerbsabreden.",
      "severity": null
    }
  ],
  "commercials": {
    "penalties_de": [
      {
        "item_de": "Bei nachgewiesener unzulässiger wettbewerbsbeschränkender Absprache ist ein pauschaler Schadensersatz von 15 % der Bruttoabrechnungssumme zu zahlen."
      }
    ]
  },
  "award_logic": {
    "matrix_de": "Preis 60%, Qualität 25%",
    "price_weight_percent": 60,
    "quality_weight_percent": 25
  },
  "kpis": {
    "must_hit_fraction": "3/3",
    "possible_hit_fraction": "5/5",
    "in_total_weighted_percent": 91
  },
  "process_steps": [
    {
      "step": 1,
      "days_de": "heute",
      "title_de": "Machbarkeitscheck",
      "description_de": "Verfügbarkeit, Zertifikate, Logistik prüfen."
    },
    // ... 5 steps
  ],
  "economic_analysis": {
    "potential_margin_de": "12-18%",
    "order_value_estimated_de": "€180k-250k",
    "competitive_intensity_de": "Mittel",
    "logistics_costs_de": "Niedrig",
    "contract_risk_de": "Normal",
    "critical_success_factors_de": [
      "Verfügbarkeit spezieller Baugeräte-Kategorien",
      "Schnelle Ersatzteilbeschaffung & Service",
      "Einhaltung DGUV-Wartungsintervalle",
      "Wettbewerbsfähige Tagesmieten"
    ]
  }
}
```

---

## Current Status

✅ **Backend Mapping:** Complete - All fields are mapped in `transformFlatUIJson()`

✅ **Frontend Interface:** Complete - Tender interface includes all fields

✅ **Frontend UI:** Complete - Hardcoded data removed, uses API fields

⚠️ **LLM Extraction:** Needs to populate all `economic_analysis` and `process_steps` fields

---

## What Happens If Data Is Missing?

- ❌ **No hardcoded fallbacks** - UI shows empty states or "Nicht verfügbar"
- ✅ **Array fallbacks** - `mustTotal`/`canTotal` use array lengths if KPIs are null
- ✅ **Empty state messages** - User-friendly placeholders instead of hardcoded data

---

## Summary

**All data must come from `run_summaries.ui_json`:**

1. ✅ `mandatory_requirements[]` → Top 5 mandatory requirements
2. ✅ `risks[]` → Legal risks
3. ✅ `economic_analysis{}` → Economic analysis (margin, order value, etc.)
4. ✅ `process_steps[]` → Timeline/process steps
5. ✅ `commercials.penalties_de[]` → Penalties
6. ✅ `award_logic{}` → Evaluation criteria

**If any field is missing or null, the UI will show an empty/placeholder state instead of hardcoded data.**
