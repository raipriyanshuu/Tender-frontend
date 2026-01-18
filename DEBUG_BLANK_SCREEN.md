# 🔍 Debugging Blank Screen

## Quick Checklist

### 1. Check Browser Console (F12)
Open DevTools → Console tab and look for:
- ❌ Red errors (especially about Supabase)
- ⚠️ Yellow warnings
- 📝 Any error messages

### 2. Check Network Tab (F12)
Open DevTools → Network tab:
- Refresh page (F5)
- Look for failed requests (red)
- Check if `main.tsx` or `ReikanTenderAI.tsx` failed to load

### 3. Check Frontend Server
- Is Vite running? Look for terminal output
- What port is it on? (usually 5173, 5174, or 5175)
- Open that exact URL in browser

### 4. Check .env Files

**Frontend .env** (in `project/` folder):
```env
VITE_API_URL=http://localhost:3001
```

**Backend .env** (in `tenderBackend/` folder):
```env
DATABASE_URL=postgresql://...
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### 5. Restart Everything

**Stop all servers:**
```bash
# Kill all node processes
Get-Process node | Stop-Process -Force
```

**Start backend:**
```bash
cd tenderBackend
npm run dev
```

**Start frontend:**
```bash
cd project
npm run dev
```

### 6. Common Issues

#### Issue: "Cannot find module"
- Run `npm install` in both folders

#### Issue: "Supabase error"
- Already fixed! Should show warning, not crash

#### Issue: "CORS error"
- Check backend CORS_ORIGIN matches frontend port
- Restart backend after changing .env

#### Issue: "Blank white screen"
- Check browser console for React errors
- Check if `main.tsx` is loading
- Check if `App.tsx` is loading

---

## What to Share for Help

If still blank, share:
1. Browser console errors (F12 → Console)
2. Network tab errors (F12 → Network)
3. Frontend terminal output
4. Backend terminal output
