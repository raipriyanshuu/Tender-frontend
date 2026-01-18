# Current Gaps Analysis - Based on Frontend UI

## ✅ **What's Working**

| Field | Status | Notes |
|-------|--------|-------|
| `deadline` | ✅ **FIXED** | Now correctly parsed to `"2027-05-28"` (was text before) |
| `penalties` | ✅ **FIXED** | Now using fallback from `commercials.other_de` (2 items) |
| `submission` | ✅ **Working** | Shows 4 mandatory requirements correctly |
| `legalRisks` | ✅ **Working** | Shows 2 risks correctly |
| `processSteps` | ✅ **Working** | Shows 5 steps with titles/descriptions |
| `mustTotal` | ✅ **Working** | Shows `4` (from array length) |
| `canTotal` | ✅ **Working** | Shows `3` (from array length) |
| `scopeOfWork` | ✅ **Working** | Shows correct text |

---

## ❌ **Gaps Identified** (Priority Order)

### **Priority 1: Critical** (Affects UI Display)

#### 1. **Economic Analysis - All Fields Null** ⚠️ **CRITICAL**

**Current State:**
```json
{
  "economicAnalysis": {
    "potentialMargin": null,        // UI shows "Not available"
    "orderValueEstimated": null,    // UI shows "Not available"
    "competitiveIntensity": null,   // UI shows fallback "Mittel" (from score)
    "logisticsCosts": null,         // UI shows fallback "Low/Niedrig" (from routeScore)
    "contractRisk": null,           // UI shows fallback "Normal" (from legalRisks.length)
    "criticalSuccessFactors": []    // UI shows "Keine Erfolgsfaktoren verfügbar"
  }
}
```

**Frontend Behavior:**
- `potentialMargin` & `orderValueEstimated`: Show "Nicht verfügbar" (No fallback) ✅ **OK**
- `competitiveIntensity`: Shows fallback `(tender.score > 85 ? 'Hoch' : 'Mittel')` → **"Mittel"** ❌ **Misleading**
- `logisticsCosts`: Shows fallback `(routeScore > 75 ? 'Niedrig' : routeScore > 50 ? 'Mittel' : 'Hoch')` → **"Niedrig"** ❌ **Misleading**
- `contractRisk`: Shows fallback `(tender.legalRisks.length > 3 ? 'Erhöht' : 'Normal')` → **"Normal"** ❌ **Misleading**

**Impact:** 
- Frontend is showing **calculated fallbacks** instead of actual LLM-extracted data
- This makes the data appear populated when it's actually missing
- Users might make decisions based on inaccurate fallback values

**Solution:**
- **LLM MUST extract** all 6 economic analysis fields from documents
- **OR** Remove fallback logic from frontend (show "Nicht verfügbar" instead)

---

#### 2. **KPIs/Score - All Zero** ⚠️ **CRITICAL**

**Current State:**
```json
{
  "score": 0,          // UI shows "In total 0%"
  "mustHits": 0,       // UI shows "Must 0% (0/4)"
  "canHits": 0,        // UI shows "Can 0% (0/3)"
  "mustTotal": 4,      // ✅ Correct (from array length)
  "canTotal": 3        // ✅ Correct (from array length)
}
```

**Problem:** 
- `mustHits` and `canHits` are 0, so frontend shows "0% (0/4)" and "0% (0/3)"
- This indicates **no requirements are met**, which is misleading
- `score` is 0, showing "In total 0%" which makes tender look unattractive

**Root Cause:**
- `kpis.must_hit_fraction` is `null` in raw data
- `kpis.possible_hit_fraction` is `null` in raw data
- `kpis.in_total_weighted_percent` is `null` in raw data

**Solution:**
- **LLM must extract/calculate** KPI fractions:
  - `must_hit_fraction`: `"4/4"` (or calculated from matching requirements)
  - `possible_hit_fraction`: `"3/3"` (or calculated)
  - `in_total_weighted_percent`: `85` (weighted score)
- **OR** Backend could calculate from requirements (but needs business logic)

---

#### 3. **Buyer/Organization - "Unknown"** ⚠️ **HIGH**

**Current State:**
```json
{
  "buyer": "Unknown"  // UI shows "Unknown is seeking tender..."
}
```

**Problem:**
- Frontend shows "**Unknown is seeking tender J25-F35-079**"
- This looks unprofessional and incomplete

**Root Cause:**
- `meta.organization` is `null` in raw data
- Backend fallback couldn't extract from `commercials.other_de`

**Solution:**
- **LLM MUST extract** `meta.organization` from document headers/titles
- Typically found in document first page, tender title, or issuing authority section

---

### **Priority 2: Important** (Affects Accuracy)

#### 4. **Evaluation Criteria - Empty** ⚠️ **MEDIUM**

**Current State:**
```json
{
  "evaluationCriteria": []  // UI shows empty/not displayed
}
```

**Problem:**
- "D. Zuschlagslogik" section likely empty or incomplete
- Users don't see award logic/weighting information

**Root Cause:**
- `award_logic.matrix_de` is `null`
- `award_logic.price_weight_percent` is `null`
- `award_logic.quality_weight_percent` is `null`
- `award_logic.other_de` is `null`
- Backend fallback didn't find evaluation-related terms in `commercials.other_de`

**Solution:**
- **LLM MUST extract** award logic from documents (usually in evaluation section)
- **OR** Enhance backend fallback to search `commercials.other_de` more thoroughly

---

#### 5. **Region - "DE" (Hardcoded)** ⚠️ **MEDIUM**

**Current State:**
```json
{
  "region": "DE"  // UI shows "Location: DE"
}
```

**Problem:**
- Shows generic "DE" instead of actual location (e.g., "Rheinberg", "Stuttgart")

**Root Cause:**
- `executive_summary.location_de` is `null` in raw data

**Solution:**
- **LLM MUST extract** `executive_summary.location_de` from documents
- Usually found in project description, address, or scope section

---

### **Priority 3: Minor** (Enhancements)

#### 6. **Missing Evidence - Empty but UI Shows Data**

**Current State:**
```json
{
  "missingEvidence": []  // Empty array
}
```

**Observation:**
- UI "Missing evidence & documents" section shows the same items as "Top 5 mandatory requirements"
- This might be intentional (using `submission` field as fallback), or UI bug

**Status:** 
- ✅ **No issue** - UI is using `submission` field, which is correct
- `missingEvidence` can remain empty if LLM doesn't extract missing documents separately

---

## Summary: Action Items

### **Immediate (P1):**

1. ✅ **LLM: Extract Economic Analysis** - All 6 fields must be extracted
   - `potential_margin_de`: `"12-18%"` or similar
   - `order_value_estimated_de`: `"€180k-250k"` or similar
   - `competitive_intensity_de`: `"Mittel"` / `"Hoch"` / `"Niedrig"`
   - `logistics_costs_de`: `"Niedrig"` / `"Mittel"` / `"Hoch"`
   - `contract_risk_de`: `"Normal"` / `"Erhöht"` / `"Niedrig"`
   - `critical_success_factors_de[]`: Array of factors

2. ✅ **LLM: Extract KPIs** - Calculate/extract fractions
   - `must_hit_fraction`: `"4/4"` (format: "hits/total")
   - `possible_hit_fraction`: `"3/3"`
   - `in_total_weighted_percent`: `85` (0-100)

3. ✅ **LLM: Extract Organization** - From document headers
   - `meta.organization`: `"Vermögen und Bau Baden-Württemberg"` or similar

---

### **Short-term (P2):**

4. ✅ **LLM: Extract Evaluation Criteria** - From award logic section
   - `award_logic.matrix_de`: Description of evaluation matrix
   - `award_logic.price_weight_percent`: Numeric weight (0-100)
   - `award_logic.quality_weight_percent`: Numeric weight (0-100)

5. ✅ **LLM: Extract Location** - From project description
   - `executive_summary.location_de`: `"Rheinberg"` or similar

---

### **Optional (P3):**

6. ⚠️ **Frontend: Remove Fallbacks** - Show "Nicht verfügbar" instead of calculated fallbacks
   - This prevents misleading data
   - OR keep fallbacks but make them visually distinct (e.g., greyed out, with "Estimated" label)

---

## Frontend Fallback Logic Review

**Current Fallbacks (Potentially Misleading):**

```typescript
// competitiveIntensity
tender.economicAnalysis?.competitiveIntensity || (tender.score > 85 ? 'Hoch' : 'Mittel')
// Shows "Mittel" when score is 0 → Incorrect assumption

// logisticsCosts  
tender.economicAnalysis?.logisticsCosts || (routeScore > 75 ? 'Niedrig' : routeScore > 50 ? 'Mittel' : 'Hoch')
// Uses routeScore (calculated from region/distance) → Might be accurate but should be LLM-extracted

// contractRisk
tender.economicAnalysis?.contractRisk || (tender.legalRisks.length > 3 ? 'Erhöht' : 'Normal')
// Shows "Normal" when 2 risks → Might be accurate but should be LLM-extracted
```

**Recommendation:**
- **Keep fallbacks** but add visual indicator (e.g., grey text, "Estimated:" prefix)
- **OR** Remove fallbacks entirely and show "Nicht verfügbar" for all null fields
- **Better:** Wait for LLM extraction to populate real data

---

## Data Quality Score

**Current Score: 7/10**

- ✅ Working: 8 fields (deadline, penalties, submission, legalRisks, processSteps, totals, scopeOfWork)
- ❌ Missing: 6 fields (economic analysis - all 6)
- ⚠️ Using Fallbacks: 3 fields (competitiveIntensity, logisticsCosts, contractRisk)
- ❌ Zero Values: 3 fields (score, mustHits, canHits)
- ❌ Hardcoded: 2 fields (buyer: "Unknown", region: "DE")

**Expected Score After LLM Extraction: 10/10** ✅
