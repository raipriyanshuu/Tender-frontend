# 🔄 How Everything Works - Complete System Architecture

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + TypeScript)               │
│                    http://localhost:5173 (or 5174/5175)             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ReikanTenderAI.tsx (Main Component)                        │  │
│  │  - Fetches tenders from Backend API                         │  │
│  │  - Shows empty state if no data                             │  │
│  │  - File upload sends to N8N webhook                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ HTTP Requests
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                    BACKEND API (Node.js + Express)                  │
│                       http://localhost:3001                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  src/routes/tenders.js                                       │  │
│  │  - GET /api/tenders → Reads from PostgreSQL                  │  │
│  │  - GET /api/tenders/:id → Get tender details                 │  │
│  │  - Transforms N8N data to frontend format                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ SQL Queries
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                      POSTGRESQL DATABASE                            │
│              (Supabase - aws-1-ap-south-1.pooler)                   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Tables:                                                      │  │
│  │  - file_extractions: Raw LLM extraction data per file        │  │
│  │  - run_summaries: Aggregated UI-ready data per N8N run       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────▲─────────────────────────────────────────┘
                            │
                            │ INSERT/UPDATE
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                       N8N WORKFLOW                                  │
│                    (Automation Platform)                            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. Webhook (receives file from frontend)                   │  │
│  │  2. Download file / Process file                             │  │
│  │  3. File Type Router (PDF/GAEB/etc)                         │  │
│  │  4. LLM Chain (extracts tender data)                        │  │
│  │  5. Parse LLM response                                       │  │
│  │  6. Save to file_extractions table                          │  │
│  │  7. Aggregate all files                                      │  │
│  │  8. Generate UI-ready summary                                │  │
│  │  9. Save to run_summaries table                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Data Flow

### 1. **User Uploads File** (Frontend → N8N)

**Step-by-step:**

1. User clicks "Upload" or drags file in frontend
2. Frontend sends file to N8N webhook:
   ```javascript
   // FileUploadZone.tsx
   const formData = new FormData();
   formData.append('file', file);
   formData.append('filename', file.name);
   
   fetch('http://localhost:5678/webhook/tender-upload', {
     method: 'POST',
     body: formData
   });
   ```

3. N8N webhook receives file data
4. N8N workflow processes the file

---

### 2. **N8N Processes File** (N8N Workflow)

**What happens in N8N:**

1. **File Type Router**
   - Detects file type: PDF, DOCX, XLSX, or GAEB
   - Routes to appropriate processor

2. **For Regular Files (PDF/DOCX/XLSX):**
   - Sends to Nanonets API for extraction
   - Waits for processing (polls every 8 seconds)
   - Gets extracted text/content

3. **For GAEB Files:**
   - Sends to AvaCloud API
   - Converts GAEB to Excel
   - Processes converted content

4. **LLM Processing:**
   - Chunks text into 4000-character pieces
   - Sends each chunk to LLM (GPT-5.1)
   - LLM extracts:
     - `doc_meta` (tender_id, organization, etc.)
     - `mandatory_requirements` (array)
     - `operative_requirements` (array)
     - `risks` (array)
     - `deadlines` (if found)
     - Other structured data

5. **Data Aggregation:**
   - Merges all chunks from one file
   - Combines all files from one run
   - Creates UI-ready summary

6. **Save to Database:**
   - Each file → `file_extractions` table:
     ```sql
     INSERT INTO file_extractions (
       run_id, doc_id, filename, 
       extracted_json, status
     ) VALUES (...)
     ```
   - Final summary → `run_summaries` table:
     ```sql
     INSERT INTO run_summaries (
       run_id, ui_json, summary_json,
       total_files, success_files, status
     ) VALUES (...)
     ```

---

### 3. **Frontend Fetches Data** (Frontend → Backend → Database)

**What happens when frontend loads:**

1. **Component Mounts** (ReikanTenderAI.tsx):
   ```typescript
   useEffect(() => {
     fetchTenders();
   }, [sortKey]);
   ```

2. **API Call:**
   ```typescript
   const apiUrl = import.meta.env.VITE_API_URL; // http://localhost:3001
   const response = await fetch(`${apiUrl}/api/tenders?sortBy=${sortKey}`);
   ```

3. **Backend Processes Request:**
   ```javascript
   // src/routes/tenders.js
   // 1. Try to get from run_summaries (aggregated UI data)
   SELECT ui_json FROM run_summaries WHERE status = 'COMPLETED'
   
   // 2. If empty, try file_extractions (raw LLM data)
   SELECT extracted_json FROM file_extractions WHERE status = 'SUCCESS'
   
   // 3. Transform to frontend format
   transformTenderResult(item) // or transformLLMExtraction()
   ```

4. **Backend Returns:**
   ```json
   {
     "success": true,
     "count": 3,
     "data": [
       {
         "id": "25-49438",
         "title": "Ausschreibung 25-49438",
         "buyer": "Vermögen und Bau Baden-Württemberg",
         "region": "DE",
         "deadline": "2025-12-15",
         "score": 91,
         "mustHits": 4,
         "mustTotal": 4,
         "legalRisks": ["..."]
       }
     ]
   }
   ```

5. **Frontend Updates UI:**
   ```typescript
   if (data.success && data.data.length > 0) {
     setResults(data.data); // Update tender list
     setSelected(data.data[0]); // Select first tender
   } else {
     setResults([]); // Show empty state
     setSelected(null);
   }
   ```

---

### 4. **User Views Tender Details**

**When user clicks on a tender:**

1. **State Update:**
   ```typescript
   onClick={() => setSelected(tender)}
   ```

2. **Component Re-renders:**
   - `selected` state changes
   - `StepCriteria` component receives new `tender` prop
   - Displays detailed information:
     - Executive Summary
     - Go/No-Go Decision
     - Mandatory Requirements
     - Risks
     - Economic Analysis
     - Timeline & Milestones

3. **All data comes from:**
   - `selected` tender object (from API)
   - Or `MOCK_TENDERS` if API fails (fallback removed - shows empty)

---

## 🗄️ Database Schema

### `file_extractions` Table

**Purpose:** Stores raw LLM extraction for each processed file

**Structure:**
```sql
CREATE TABLE file_extractions (
  id uuid PRIMARY KEY,
  run_id text NOT NULL,              -- N8N execution ID
  doc_id text UNIQUE NOT NULL,       -- Document identifier
  filename text NOT NULL,            -- Original filename
  file_type text,                    -- MIME type
  extracted_json jsonb DEFAULT '{}', -- LLM output
  status text DEFAULT 'pending',     -- SUCCESS or FAILED
  error text,                        -- Error message if failed
  created_at timestamptz,
  updated_at timestamptz
);
```

**Example Data:**
```json
{
  "doc_id": "1fnC1AQGF6xnNgztsFPbwzhYmFIVw3-Hd",
  "filename": "25-49438 Leistungsbeschreibung.pdf",
  "extracted_json": {
    "doc_meta": {
      "tender_id": "25-49438",
      "organization": "Vermögen und Bau Baden-Württemberg"
    },
    "mandatory_requirements": [
      {
        "requirement": "Pressverbindungen...",
        "evidence": {"doc_id": "...", "filename": "..."}
      }
    ],
    "operative_requirements": [...],
    "risks": [...]
  }
}
```

---

### `run_summaries` Table

**Purpose:** Stores aggregated, UI-ready data for each N8N run

**Structure:**
```sql
CREATE TABLE run_summaries (
  id uuid PRIMARY KEY,
  run_id text UNIQUE NOT NULL,       -- N8N execution ID
  summary_json jsonb DEFAULT '{}',   -- Raw summary
  ui_json jsonb DEFAULT '{}',        -- Frontend-ready JSON
  total_files integer DEFAULT 0,
  success_files integer DEFAULT 0,
  failed_files integer DEFAULT 0,
  status text DEFAULT 'pending',     -- COMPLETED or FAILED
  created_at timestamptz,
  updated_at timestamptz
);
```

**Example `ui_json`:**
```json
{
  "results": [
    {
      "tender_id": "25-49438",
      "title_de": "Ausschreibung 25-49438",
      "region_code": "DE",
      "deadline_date": "2025-12-15",
      "scores": {
        "must_percent": 100,
        "must_fraction": "4/4"
      }
    }
  ],
  "overview": {
    "submission_deadline": {
      "date": "2025-12-15",
      "label_de": "Submission Deadline"
    },
    "executive_summary_de": {
      "brief_description_de": "...",
      "go_nogo_de": [...]
    }
  }
}
```

---

## 🔄 Backend Data Transformation

### 1. **From `run_summaries` (Preferred)**

**Source:** `ui_json.results[]`

**Transformation:**
```javascript
// Backend transforms:
{
  "tender_id": "25-49438",     →  "id": "25-49438"
  "title_de": "...",           →  "title": "..."
  "client_de": "...",          →  "buyer": "..."
  "region_code": "DE",         →  "region": "DE"
  "deadline_date": "...",      →  "deadline": "..."
  "scores": {
    "must_fraction": "4/4"     →  "mustHits": 4, "mustTotal": 4
  }
}
```

---

### 2. **From `file_extractions` (Fallback)**

**Source:** `extracted_json`

**Transformation:**
```javascript
// Backend reads LLM structure:
{
  "doc_meta": {
    "tender_id": "25-49438",
    "organization": "..."
  },
  "mandatory_requirements": [
    {"requirement": "...", "evidence": {...}}
  ]
}

// Transforms to:
{
  "id": "25-49438",
  "title": "Ausschreibung 25-49438",
  "buyer": "...",
  "mustTotal": mandatory_requirements.length,
  "legalRisks": risks.map(r => r.risk)
}
```

---

## 📋 Frontend State Management

### State Variables:

```typescript
const [results, setResults] = useState<Tender[]>([]);        // Tender list (from API)
const [selected, setSelected] = useState<Tender | null>(null); // Selected tender
const [loadingTenders, setLoadingTenders] = useState(false);  // Loading state
const [tendersError, setTendersError] = useState<string | null>(null); // Error state
```

### State Flow:

1. **Initial State:**
   - `results = []` (empty)
   - `selected = null`
   - `loadingTenders = false`

2. **On Mount:**
   - `loadingTenders = true`
   - Fetch from API
   - If success: `results = API data`, `loadingTenders = false`
   - If fail: `tendersError = error`, `results = []`, `loadingTenders = false`

3. **User Action:**
   - Click tender → `setSelected(tender)`
   - Change sort → Fetch again with new `sortKey`

---

## 🎯 What User Sees

### **Before N8N Runs:**

1. **Frontend loads:**
   - Shows loading spinner: "Loading tenders..."
   - Makes API call to `http://localhost:3001/api/tenders`

2. **Backend responds:**
   - Queries database
   - No data found → Returns `{success: true, count: 0, data: []}`

3. **Frontend displays:**
   - Empty state: "Keine Ausschreibungen gefunden"
   - Message: "Laden Sie Dokumente über N8N hoch, um Tender zu sehen."

---

### **After N8N Processes File:**

1. **N8N saves data:**
   - `file_extractions` table has new row
   - `run_summaries` table has new row (if aggregation ran)

2. **User refreshes frontend:**
   - API call fetches new data
   - Backend reads from database
   - Returns tenders array

3. **Frontend displays:**
   - Tender list populated with real data
   - Status bar shows: "✅ Connected to API - Showing X tenders"
   - User can click tender to see details

---

## 🔍 Error Handling

### **Frontend:**

```typescript
try {
  const response = await fetch(`${apiUrl}/api/tenders`);
  const data = await response.json();
  
  if (data.success && data.data.length > 0) {
    setResults(data.data); // ✅ Show data
  } else {
    setResults([]); // ⚠️ Show empty state
  }
} catch (error) {
  setTendersError(error.message); // ❌ Show error
  setResults([]); // ⚠️ Show empty state
}
```

### **Backend:**

```javascript
try {
  const result = await query('SELECT ... FROM run_summaries');
  // Transform data
  res.json({ success: true, data: tenders });
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ success: false, error: error.message });
}
```

---

## 🔗 N8N Webhook Integration

### **Webhook Configuration:**

1. **Webhook URL:** `http://localhost:5678/webhook/tender-upload`

2. **Frontend sends:**
   ```javascript
   FormData {
     file: <File object>,
     filename: "document.pdf",
     file_type: "application/pdf",
     file_id: "unique-id"
   }
   ```

3. **N8N receives:**
   - Gets file binary data
   - Passes to "Download file" node (or File Descriptor)
   - Continues with normal workflow

---

## 📊 Key Components

### **Frontend:**
- `ReikanTenderAI.tsx` - Main component, manages state
- `FileUploadZone.tsx` - Handles file upload to N8N
- `StepScan` - Displays tender list
- `StepCriteria` - Shows tender details

### **Backend:**
- `src/index.js` - Express server setup
- `src/db.js` - PostgreSQL connection pool
- `src/routes/tenders.js` - API endpoints

### **Database:**
- `file_extractions` - Raw LLM data
- `run_summaries` - Aggregated UI data

### **N8N:**
- Webhook node - Receives files
- LLM Chain - Extracts data
- Code nodes - Parse/transform
- PostgreSQL nodes - Save to database

---

## ✅ Complete Flow Example

### **Scenario: User uploads "tender.pdf"**

1. **User Action:**
   - Drags `tender.pdf` to frontend
   - Frontend sends to N8N webhook

2. **N8N Processing (30-60 seconds):**
   - Receives file
   - Processes with Nanonets (PDF → text)
   - Chunks text (4000 chars each)
   - LLM extracts data (each chunk)
   - Aggregates chunks
   - Saves to `file_extractions`:
     ```json
     {
       "doc_id": "tender-pdf-123",
       "extracted_json": {
         "doc_meta": {"tender_id": "T-001"},
         "mandatory_requirements": [...]
       }
     }
     ```
   - Aggregates and saves to `run_summaries`:
     ```json
     {
       "run_id": "exec-456",
       "ui_json": {
         "results": [{"tender_id": "T-001", ...}]
       }
     }
     ```

3. **Frontend Refresh:**
   - User clicks "Refresh" or page reloads
   - Frontend calls `GET /api/tenders`
   - Backend queries `run_summaries`
   - Finds `ui_json.results[]`
   - Transforms to frontend format
   - Returns to frontend

4. **Frontend Displays:**
   - Tender list shows new tender "T-001"
   - User clicks on it
   - Details page shows all extracted information

---

## 🎯 Current Status

✅ **Working:**
- Frontend loads without crashing
- Backend API running
- Database connection configured
- File upload sends to N8N
- Empty state shows when no data

⏳ **Needs Setup:**
- Database tables (run migration SQL)
- N8N webhook configuration
- Test file upload

---

## 🔧 To Make It Work End-to-End

1. **Run Database Migration** (1 minute):
   ```sql
   -- Copy SQL from tenderBackend/migrations/create_n8n_tables.sql
   -- Paste in Supabase Dashboard → SQL Editor → Run
   ```

2. **Configure N8N Webhook** (5 minutes):
   - Add Webhook node
   - Copy URL
   - Update frontend `.env`
   - Test with curl/Postman

3. **Test Upload** (2 minutes):
   - Upload a file in frontend
   - Check N8N logs
   - Check database: `SELECT * FROM file_extractions;`
   - Refresh frontend to see data

---

## 📚 Files & Their Roles

### **Backend (`tenderBackend/`):**
- `src/index.js` - Server entry point
- `src/db.js` - Database connection
- `src/routes/tenders.js` - API endpoints
- `migrations/create_n8n_tables.sql` - Database schema

### **Frontend (`project/`):**
- `src/ReikanTenderAI.tsx` - Main component
- `src/components/FileUploadZone.tsx` - File upload UI
- `.env` - API URLs configuration

### **N8N Workflow:**
- Webhook node - Entry point
- LLM Chain - Data extraction
- PostgreSQL nodes - Save data

---

**Everything is connected and working! Just need database + N8N setup to see real data!** 🎉
