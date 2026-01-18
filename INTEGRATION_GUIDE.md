# Frontend-Backend Integration Guide

## ✅ What Was Changed in Frontend

### 1. State Management (Line 313, 342-343)
```typescript
// OLD: Static data only
const [results] = useState<Tender[]>(MOCK_TENDERS);

// NEW: Dynamic data with state management
const [results, setResults] = useState<Tender[]>(MOCK_TENDERS);  // Can update!
const [loadingTenders, setLoadingTenders] = useState<boolean>(false);
const [tendersError, setTendersError] = useState<string | null>(null);
```

### 2. API Integration (Lines 345-376)
Added `useEffect` hook that:
- Fetches from `http://localhost:3001/api/tenders`
- Runs on component mount and when `sortKey` changes
- Updates `results` state with API data
- Falls back to `MOCK_TENDERS` if API fails

```typescript
useEffect(() => {
  const fetchTenders = async () => {
    setLoadingTenders(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/tenders?sortBy=${sortKey}`);
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        setResults(data.data);  // ✅ Updates UI with real data!
      }
    } catch (error) {
      console.error('Error fetching tenders:', error);
      // Falls back to MOCK_TENDERS
    }
  };
  fetchTenders();
}, [sortKey]);
```

### 3. Environment Configuration
Created `.env` file:
```
VITE_API_URL=http://localhost:3001
```

---

## 🔗 N8N Webhook Configuration

### Current State
Your N8N workflow uses **Google Drive** as input. You need to replace it with a **Webhook**.

### Step-by-Step N8N Setup

#### 1. Open Your N8N Workflow
- Go to your N8N instance
- Open the "Tender – File Ingestion dup" workflow

#### 2. Add Webhook Node
1. Click **"+"** to add new node
2. Search for **"Webhook"**
3. Select **"Webhook"** trigger node
4. Configure:
   - **HTTP Method:** POST
   - **Path:** `tender-upload` (or any name you want)
   - **Response Mode:** "When last node finishes"
   - **Response Data:** "First Entry JSON"

5. Copy the webhook URL (something like):
   ```
   https://your-n8n-instance.com/webhook/tender-upload
   ```

#### 3. Remove/Disable Google Drive Nodes
- Find "Search files and folders1" node
- Click node → Delete (or disable it)
- Find "Download file" node - **KEEP THIS**

#### 4. Connect Webhook to Pipeline
```
Webhook → Download file → File Descriptor → ...rest of pipeline
```

The webhook will receive file data from frontend and pass it to the existing pipeline.

#### 5. Test Webhook
Use curl or Postman:
```bash
curl -X POST https://your-n8n-instance.com/webhook/tender-upload \
  -H "Content-Type: application/json" \
  -d '{"file_url": "test"}'
```

---

## 🧪 How to Test - Complete Guide

### Test 1: Backend API Health Check

```bash
# Test if backend is running
curl http://localhost:3001/api/tenders/health
```

**Expected Response (if database is set up):**
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected"
}
```

**Current Response (database not set up):**
```json
{
  "success": false,
  "error": "Circuit breaker open"
}
```
↑ This is why we need the database migration!

---

### Test 2: Frontend Console Check

1. Open frontend: http://localhost:5173
2. Open browser DevTools: Press **F12**
3. Go to **Console** tab
4. Look for these messages:

**If Backend Working:**
```
✅ Fetched tenders successfully
```

**If Backend Down:**
```
❌ Error fetching tenders: Failed to fetch
No tenders from API, using mock data
```

**If Database Empty:**
```
⚠️ No tenders from API, using mock data
```

---

### Test 3: Network Tab Check

1. Open DevTools → **Network** tab
2. Refresh page (F5)
3. Look for request to `/api/tenders`
4. Click on it to see:
   - **Status:** 200 (success) or 500 (error)
   - **Response:** JSON data

---

### Test 4: Database Tables Check

**Option A: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Click **"Table Editor"**
3. Check if you see:
   - ✅ `file_extractions`
   - ✅ `run_summaries`

**Option B: SQL Editor**
```sql
SELECT * FROM run_summaries LIMIT 5;
SELECT * FROM file_extractions LIMIT 5;
```

If tables don't exist → Run the migration SQL!

---

### Test 5: End-to-End Test (After N8N Webhook Setup)

#### Step 1: Upload a Tender Document
1. In N8N, trigger webhook with a test file
2. Workflow processes file
3. Data saves to `file_extractions` and `run_summaries`

#### Step 2: Check Database
```sql
SELECT run_id, status, total_files 
FROM run_summaries 
ORDER BY created_at DESC 
LIMIT 1;
```

#### Step 3: Check Frontend
1. Refresh frontend page
2. Should see new tender in the list!
3. Check browser console for "Fetched X tenders"

---

## 🚦 Current Status Checklist

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Frontend Code | ✅ Done | None |
| Backend API | ✅ Running | None |
| Database Tables | ❌ Missing | **Run migration SQL** |
| N8N Webhook | ❌ Not configured | **Add webhook node** |
| Frontend .env | ✅ Created | None |
| Backend .env | ✅ Created | None |

---

## 🎯 What You'll See When Everything Works

### Before (Current - Static Data)
- Frontend shows **3 mock tenders**
- Always the same data
- From `MOCK_TENDERS` constant

### After (Dynamic Data)
- Frontend shows **real tenders from database**
- Updates when new files processed
- Data comes from N8N workflow

---

## 📝 Quick Start Testing

### Right Now (Without Database):
1. Open http://localhost:5173
2. See mock data ✓ (this is correct fallback behavior!)
3. Open console, see error message about API

### After Database Migration:
1. Run SQL in Supabase Dashboard
2. Restart backend: `npm run dev`
3. Refresh frontend
4. Console shows "No tenders from API" (database empty)
5. Still shows mock data (correct!)

### After N8N Processes Files:
1. N8N saves data to database
2. Refresh frontend
3. Console shows "Fetched X tenders successfully"
4. Shows real data from database! 🎉

---

## 🐛 Troubleshooting

### "Still seeing mock data"
- ✓ This is correct if database is empty!
- Upload files via N8N to populate database

### "Error fetching tenders"
- Check backend is running: http://localhost:3001
- Check browser console for error details
- Check CORS settings in backend .env

### "Database connection failed"
- Check DATABASE_URL in backend .env
- Check password is URL-encoded
- Check Supabase project is active

---

## 📞 Next Steps

1. **Run database migration** (copy SQL to Supabase Dashboard)
2. **Configure N8N webhook** (replace Google Drive)
3. **Test upload** (send file to N8N webhook)
4. **Verify frontend** (should show new data)

That's it! The integration is already done - just need database and N8N setup.
