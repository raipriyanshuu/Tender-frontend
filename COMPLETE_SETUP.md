# 🎯 Complete Setup Guide

## ✅ What's Done

1. **Backend API** - Running on port 3001
2. **Frontend Integration** - Fetches from API, shows empty state if no data
3. **File Upload** - Sends to N8N webhook (no Supabase needed)
4. **Database Support** - Reads from `file_extractions` and `run_summaries`

---

## 🚀 Quick Start (3 Steps)

### Step 1: Run Database Migration

**In Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Click **"SQL Editor"** → **"New query"**
3. Copy SQL from: `tenderBackend/migrations/create_n8n_tables.sql`
4. Paste and click **"Run"**

### Step 2: Configure N8N Webhook

**In N8N:**
1. Open workflow: "Tender – File Ingestion dup"
2. Add **Webhook** node at start
3. Set: Method=`POST`, Path=`tender-upload`
4. Copy webhook URL
5. Remove Google Drive node
6. Connect: `Webhook → Download file → rest`

**Update frontend `.env`:**
```env
VITE_N8N_WEBHOOK_URL=http://localhost:5678/webhook/tender-upload
```
(Replace with your actual N8N webhook URL)

### Step 3: Start Everything

**Backend:**
```bash
cd tenderBackend
npm run dev
```

**Frontend:**
```bash
cd project
npm run dev
```

**Open:** http://localhost:5173 (or whatever port Vite shows)

---

## 📊 How It Works

```
User uploads file
    ↓
Frontend sends to N8N webhook
    ↓
N8N processes with LLM
    ↓
N8N saves to PostgreSQL
    ↓
Backend API reads from database
    ↓
Frontend displays data
```

---

## 🔍 Troubleshooting Blank Screen

### Check 1: Is Frontend Running?
Look at terminal - should see:
```
VITE v5.4.8  ready
➜  Local:   http://localhost:5173/
```

### Check 2: Browser Console (F12)
Look for errors:
- ❌ Red errors = Problem
- ⚠️ Yellow warnings = Usually OK
- ✅ No errors = Good!

### Check 3: Network Tab (F12)
- Refresh page
- Look for failed requests (red)
- Check if `/api/tenders` is being called

### Check 4: Backend Running?
```bash
curl http://localhost:3001/api/tenders/health
```
Should return JSON (even if database error)

---

## 📝 Files Updated

### Frontend:
- ✅ `src/ReikanTenderAI.tsx` - API integration, empty state
- ✅ `src/components/FileUploadZone.tsx` - N8N webhook upload
- ✅ `src/lib/supabase.ts` - Optional (won't crash)
- ✅ `.env` - API URL and N8N webhook URL

### Backend:
- ✅ `src/routes/tenders.js` - Reads from database
- ✅ `src/db.js` - Database connection
- ✅ `.env` - Database connection string

---

## 🎯 What You'll See

### Before N8N Processes Files:
- Empty tender list
- Message: "Keine Ausschreibungen gefunden"
- Upload button works

### After N8N Processes Files:
- Tender list populated
- Real data from database
- All details visible

---

## 🔗 N8N Webhook Configuration

See: `N8N_WEBHOOK_SETUP.md` for detailed instructions

**Quick version:**
1. Add Webhook node
2. Copy URL
3. Update frontend `.env`
4. Test upload

---

## ✅ Success Checklist

- [ ] Database tables created (run migration)
- [ ] Backend running (port 3001)
- [ ] Frontend running (check terminal for port)
- [ ] N8N webhook configured
- [ ] Frontend `.env` has webhook URL
- [ ] Can upload file from frontend
- [ ] Data appears in frontend after processing

---

## 🆘 Still Having Issues?

1. **Blank screen?**
   - Check browser console (F12)
   - Share error message

2. **Upload not working?**
   - Check N8N webhook URL
   - Check N8N workflow is active
   - Check browser Network tab

3. **No data showing?**
   - Check database has data: `SELECT * FROM file_extractions;`
   - Check backend logs
   - Check frontend console for API errors

---

**Everything is ready! Just configure N8N webhook and you're done!** 🎉
