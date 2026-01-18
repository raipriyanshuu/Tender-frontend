# Data Gaps and Enhancement Guide

## Current Status Analysis

Based on the actual `run_summaries.ui_json` data vs. the transformed output, here are the **identified gaps** and how to fix them:

---

## Gap Analysis: Raw Data vs. Transformed

### ✅ **Working Correctly**

| Field | Raw Data | Transformed | Status |
|-------|----------|-------------|--------|
| `id` | `"J25-F35-079"` | `"J25-F35-079"` | ✅ OK |
| `title` | `meta.tender_id: "J25-F35-079"` | `"Ausschreibung J25-F35-079"` | ✅ OK |
| `legalRisks` | `risks[].risk_de` (2 items) | Array with 2 items | ✅ OK |
| `submission` | `mandatory_requirements[].requirement_de` (4 items) | Array with 4 items | ✅ OK |
| `processSteps` | `process_steps[]` (5 items) | Array with 5 items | ✅ OK |
| `scopeOfWork` | `executive_summary.scope_de` | Correct text | ✅ OK |
| `mustTotal` | `mandatory_requirements.length` (4) | `4` | ✅ OK (fallback) |
| `canTotal` | `operational_requirements.length` (3) | `3` | ✅ OK (fallback) |

---

### ❌ **Gaps Identified**

#### 1. **Deadline Field** - Wrong Data Type

**Current Issue:**
- **Raw:** `timeline.submission_deadline_de: null`
- **Fallback Used:** `executive_summary.duration_de: "Ausführungsende (voraussichtlich): 28.05.2027; Baubeginn innerhalb von 10 Werktagen..."`
- **Transformed:** Full text string instead of ISO date (`"2027-05-28"`)

**Problem:** Frontend expects ISO date format (`YYYY-MM-DD`), but receives a long text description.

**Solution:** Parse date from `duration_de` text:
```javascript
// Extract date from text like "Ausführungsende (voraussichtlich): 28.05.2027"
function parseDateFromText(text) {
  if (!text) return null;
  // Match German date format: DD.MM.YYYY
  const dateMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}
```

**LLM Should Extract:**
```json
{
  "timeline_milestones": {
    "submission_deadline_de": "2027-05-28"  // ISO format, not text description
  }
}
```

---

#### 2. **Buyer/Organization** - Missing

**Current Issue:**
- **Raw:** `meta.organization: null`
- **Transformed:** `"Unknown"` (hardcoded fallback)

**Problem:** LLM is not extracting the issuing authority/organization from documents.

**Solution:** LLM should extract organization from document headers/titles:
```json
{
  "meta": {
    "organization": "Vermögen und Bau Baden-Württemberg"  // Extract from document
  }
}
```

**Alternative Enhancement:** Look in `executive_summary` or `commercials.other_de` for organization hints.

---

#### 3. **Region/Location** - Missing

**Current Issue:**
- **Raw:** `executive_summary.location_de: null`
- **Transformed:** `"DE"` (hardcoded fallback)

**Problem:** Location should be extracted from documents (e.g., "Rheinberg", "Rheinzabern").

**Solution:** LLM should extract location:
```json
{
  "executive_summary": {
    "location_de": "Rheinberg"  // City/region from document
  }
}
```

**Alternative:** Could parse from `scope_de` or `duration_de` text.

---

#### 4. **Economic Analysis** - All Fields Null ⚠️ **CRITICAL**

**Current Issue:**
```json
{
  "economic_analysis": {
    "potential_margin_de": null,          // ❌ Missing
    "order_value_estimated_de": null,     // ❌ Missing
    "competitive_intensity_de": null,     // ❌ Missing
    "logistics_costs_de": null,           // ❌ Missing
    "contract_risk_de": null,             // ❌ Missing
    "critical_success_factors_de": []     // ❌ Empty
  }
}
```

**Transformed:** All fields show `null` or empty array in UI.

**Problem:** Frontend shows "Nicht verfügbar" for all economic analysis fields. LLM is not extracting this data.

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

**How to Extract:**
- `potential_margin_de`: Analyze pricing structure, rental costs, margin opportunities
- `order_value_estimated_de`: Calculate total project value from scope/quantities
- `competitive_intensity_de`: Assess market competition (Hoch/Mittel/Niedrig)
- `logistics_costs_de`: Evaluate transport/setup complexity (Hoch/Mittel/Niedrig)
- `contract_risk_de`: Assess risk level from penalties/terms (Hoch/Normal/Niedrig)
- `critical_success_factors_de`: Extract key success requirements from mandatory/operational requirements

---

#### 5. **Score/KPIs** - All Null

**Current Issue:**
```json
{
  "kpis": {
    "must_hit_percent": null,
    "must_hit_fraction": null,
    "possible_hit_percent": null,
    "possible_hit_fraction": null,
    "in_total_weighted_percent": null
  }
}
```

**Transformed:** `score: 0` (default fallback)

**Problem:** No scoring calculation. Frontend shows 0% score.

**Solution:** LLM should calculate or extract KPIs:
```json
{
  "kpis": {
    "must_hit_fraction": "4/4",  // Format: "hits/total"
    "possible_hit_fraction": "3/3",
    "in_total_weighted_percent": 91  // Calculated score
  }
}
```

**Note:** Currently using `mandatory_requirements.length` for `mustTotal` fallback, which is fine if KPI is null.

---

#### 6. **Evaluation Criteria** - All Null

**Current Issue:**
```json
{
  "award_logic": {
    "matrix_de": null,
    "price_weight_percent": null,
    "quality_weight_percent": null,
    "other_de": null
  }
}
```

**Transformed:** Empty array `[]`

**Problem:** Frontend shows no evaluation criteria.

**Solution:** LLM should extract award logic:
```json
{
  "award_logic": {
    "matrix_de": "Preis 60%, Qualität 25%, Termine 15%",
    "price_weight_percent": 60,
    "quality_weight_percent": 25,
    "other_de": "Siehe Bewertungsmatrix"
  }
}
```

**Enhancement:** Could use `commercials.other_de` as fallback if award logic is missing.

---

#### 7. **Penalties** - Empty Array (But Data Available)

**Current Issue:**
- **Raw:** `commercials.penalties_de: []` (empty)
- **But Available:** `commercials.other_de: [...]` has security/guarantee info

**Transformed:** Empty array `[]`

**Problem:** Penalties array is empty, but `other_de` contains relevant commercial terms.

**Current Data:**
```json
{
  "commercials": {
    "other_de": [
      "Sicherheit für die Vertragserfüllung ist durch Hinterlegung von Geld oder durch Bürgschaft zu leisten.",
      "Sicherheit für Mängelansprüche basiert auf der Summe der Abschlagszahlungen..."
    ]
  }
}
```

**Solution Options:**
1. **LLM should extract penalties:** Move penalty-related terms from `other_de` to `penalties_de`
2. **Backend enhancement:** Use `other_de` as fallback if `penalties_de` is empty

---

## Enhancement Recommendations

### Priority 1: **Critical** (Affects UI Display)

1. **Economic Analysis** - LLM must extract all 6 fields
   - Without this, entire "Wirtschaftlichkeitsanalyse" card shows "Nicht verfügbar"

2. **Deadline Parsing** - Backend should parse dates from `duration_de` text
   - Frontend expects ISO date, not text description

3. **Organization/Buyer** - LLM must extract from document headers
   - Currently shows "Unknown" for all tenders

---

### Priority 2: **Important** (Affects Accuracy)

4. **Evaluation Criteria** - LLM should extract award logic
   - Could use `commercials.other_de` as temporary fallback

5. **Score/KPIs** - LLM should calculate fractions
   - Currently defaults to 0%, which is misleading

6. **Location/Region** - LLM should extract city/region
   - Currently defaults to "DE" for all tenders

---

### Priority 3: **Nice to Have** (Enhancements)

7. **Penalties Fallback** - Use `commercials.other_de` if `penalties_de` is empty
   - Provides some commercial terms even if penalties aren't explicitly extracted

---

## Backend Code Enhancements Needed

### 1. Add Date Parser Function

```javascript
function parseDateFromText(text) {
  if (!text || typeof text !== 'string') return null;
  
  // Match German date format: DD.MM.YYYY
  const germanDateMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (germanDateMatch) {
    const [, day, month, year] = germanDateMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Match ISO format: YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  
  return null;
}
```

### 2. Enhance Buyer Extraction

```javascript
const buyer = meta.organization 
  || execSummary.location_de  // Could contain organization hint
  || commercials.other_de?.find(t => t.toLowerCase().includes('auftraggeber'))?.split(' ').slice(0, 3).join(' ')
  || 'Unknown';
```

### 3. Use `commercials.other_de` as Penalties Fallback

```javascript
const penalties = Array.isArray(commercials.penalties_de) && commercials.penalties_de.length > 0
  ? commercials.penalties_de.map(p => typeof p === 'string' ? p : (p.item_de || p.penalty_de || p))
  : (commercials.other_de || []).filter(t => 
      t.toLowerCase().includes('sicherheit') || 
      t.toLowerCase().includes('bürgschaft') ||
      t.toLowerCase().includes('schaden')
    ).slice(0, 3); // Limit to top 3
```

### 4. Use `commercials.other_de` as Evaluation Criteria Fallback

```javascript
const evaluationCriteria = [];
if (awardLogic.matrix_de) evaluationCriteria.push(awardLogic.matrix_de);
if (awardLogic.price_weight_percent) evaluationCriteria.push(`Price: ${awardLogic.price_weight_percent}%`);
if (awardLogic.quality_weight_percent) evaluationCriteria.push(`Quality: ${awardLogic.quality_weight_percent}%`);
if (awardLogic.other_de) evaluationCriteria.push(awardLogic.other_de);

// Fallback: Use commercials.other_de if award logic is empty
if (evaluationCriteria.length === 0 && commercials.other_de?.length > 0) {
  evaluationCriteria.push(commercials.other_de[0]); // Use first item as fallback
}
```

---

## LLM Prompt Enhancements Needed

### Add to N8N LLM Prompt:

```
CRITICAL: You MUST extract the following fields in ui_json.economic_analysis:

1. potential_margin_de: Estimated profit margin (e.g., "12-18%", "10-15%")
   - Analyze pricing structure, rental costs, project scope
   - Estimate margin opportunities based on market rates

2. order_value_estimated_de: Total project value (e.g., "€180k-250k", "€50k-80k")
   - Calculate from scope of work, quantities, duration
   - Include all costs: equipment, logistics, maintenance

3. competitive_intensity_de: Market competition level
   - "Hoch" (High) if many competitors expected
   - "Mittel" (Medium) if moderate competition
   - "Niedrig" (Low) if niche/limited competition

4. logistics_costs_de: Transportation/setup complexity
   - "Hoch" if complex logistics (multiple sites, heavy equipment)
   - "Mittel" if standard logistics
   - "Niedrig" if simple logistics (single site, standard transport)

5. contract_risk_de: Risk assessment from penalties/terms
   - "Hoch" if severe penalties, tight deadlines, high liability
   - "Normal" if standard terms
   - "Niedrig" if favorable terms

6. critical_success_factors_de: Array of key success requirements
   - Extract from mandatory_requirements and operational_requirements
   - Focus on: certifications, experience, logistics, timing, quality
   - Example: ["Verfügbarkeit spezieller Baugeräte-Kategorien", "Schnelle Ersatzteilbeschaffung"]

ALSO EXTRACT:
- meta.organization: Issuing authority from document header/title
- executive_summary.location_de: City/region name (e.g., "Rheinberg", "Stuttgart")
- timeline_milestones.submission_deadline_de: ISO date format "YYYY-MM-DD" (not text description)
- award_logic.matrix_de, price_weight_percent, quality_weight_percent: Evaluation criteria
- commercials.penalties_de: Array of penalty clauses (move from other_de if applicable)
```

---

## Summary Table: What's Missing

| Field | Current | Required | Priority | Solution |
|-------|---------|----------|----------|----------|
| `deadline` | Text description | ISO date | P1 | Backend: Parse date from text |
| `buyer` | `"Unknown"` | Organization name | P1 | LLM: Extract from documents |
| `economic_analysis.*` | All `null` | All 6 fields | P1 | LLM: Extract/calculate |
| `evaluationCriteria` | Empty `[]` | Award logic | P2 | LLM: Extract + Backend: Use `other_de` fallback |
| `score` | `0` | KPI percent | P2 | LLM: Calculate fractions |
| `region` | `"DE"` | City name | P2 | LLM: Extract location |
| `penalties` | Empty `[]` | Penalty terms | P3 | Backend: Use `other_de` fallback |

---

## Next Steps

1. **Immediate:** Update backend `transformFlatUIJson()` to parse dates from `duration_de`
2. **Immediate:** Update N8N LLM prompt to extract economic analysis fields
3. **Short-term:** Enhance backend to use `commercials.other_de` as fallbacks
4. **Short-term:** Update LLM to extract organization, location, award logic
5. **Long-term:** Add KPI calculation logic if LLM doesn't provide it
