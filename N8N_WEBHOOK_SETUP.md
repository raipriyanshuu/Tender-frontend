# 🔗 N8N Webhook Configuration Guide

## Step-by-Step: Replace Google Drive with Webhook

### 1. Open Your N8N Workflow

1. Go to your N8N instance
2. Open workflow: **"Tender – File Ingestion dup"**

### 2. Add Webhook Node

1. Click **"+"** button to add a new node
2. Search for **"Webhook"**
3. Select **"Webhook"** node
4. Configure it:

   **Settings:**
   - **HTTP Method:** `POST`
   - **Path:** `tender-upload` (or any name you want)
   - **Response Mode:** "When Last Node Finishes"
   - **Response Data:** "First Entry JSON"
   - **Response Code:** `200`

5. **Copy the Webhook URL** - it will look like:
   ```
   https://your-n8n-instance.com/webhook/tender-upload
   ```
   or
   ```
   http://localhost:5678/webhook/tender-upload
   ```
   (if running locally)

### 3. Remove/Disable Google Drive Nodes

1. Find **"Search files and folders1"** node
2. Click on it → **Delete** (or disable it)
3. Keep **"Download file"** node - we'll connect webhook to it

### 4. Connect Webhook to Pipeline

**Current flow:**
```
Google Drive → Download file → File Descriptor → ...
```

**New flow:**
```
Webhook → Download file → File Descriptor → ... (rest stays same)
```

**Steps:**
1. Click on **Webhook** node output
2. Drag connection to **"Download file"** node
3. Remove connection from Google Drive (if still connected)

### 5. Configure Download File Node

The **"Download file"** node expects:
- `id` - File ID
- `name` - Filename
- `mimeType` - File type

**Update the node to accept webhook data:**

In **"Download file"** node:
- **Operation:** Keep as "download"
- **File ID:** Change to `={{$json.file_id}}` or `={{$json.id}}`
- The webhook will send file data, so adjust accordingly

**OR** - Better approach: Skip "Download file" and use webhook data directly:

1. **Delete "Download file"** node
2. Connect **Webhook** directly to **"File Descriptor"**
3. Update **"File Descriptor"** to use webhook data:
   - `file_id`: `={{$json.file_id}}`
   - `file_name`: `={{$json.filename}}`
   - `mimeType`: `={{$json.mimeType}}`
   - `binary_key`: `="data"` (if webhook sends binary)

### 6. Webhook Expected Format

Your frontend should send to webhook:

```json
{
  "file_id": "unique-file-id",
  "filename": "tender-document.pdf",
  "mimeType": "application/pdf",
  "data": "<base64-encoded-file-data>"
}
```

OR if using multipart/form-data:

```
file: <binary file data>
filename: "tender-document.pdf"
file_type: "application/pdf"
```

### 7. Test Webhook

**Using curl:**
```bash
curl -X POST https://your-n8n-instance.com/webhook/tender-upload \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "test-123",
    "filename": "test.pdf",
    "mimeType": "application/pdf"
  }'
```

**Using Postman:**
1. Method: POST
2. URL: Your webhook URL
3. Body: JSON with test data
4. Send

### 8. Update Frontend to Call Webhook

In your frontend file upload component, add:

```typescript
const handleFileUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', file.name);
  formData.append('file_type', file.type);

  const response = await fetch('YOUR_N8N_WEBHOOK_URL', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  console.log('Upload result:', result);
};
```

---

## 📋 Quick Checklist

- [ ] Webhook node added to N8N workflow
- [ ] Webhook URL copied
- [ ] Google Drive node removed/disabled
- [ ] Webhook connected to "Download file" or "File Descriptor"
- [ ] Webhook tested with curl/Postman
- [ ] Frontend updated to call webhook
- [ ] File upload tested end-to-end

---

## 🔧 Troubleshooting

### Webhook not receiving data
- Check webhook URL is correct
- Check N8N workflow is active
- Check webhook node is enabled
- Check CORS if calling from browser

### File not processing
- Check "Download file" node configuration
- Check file data format matches expected
- Check N8N workflow logs

### Frontend can't call webhook
- Check CORS settings in N8N
- Check webhook URL is accessible
- Check network tab in browser DevTools

---

## 🎯 Next Steps After Setup

1. **Test webhook** with a sample file
2. **Verify data saves** to `file_extractions` table
3. **Check frontend** shows new tender data
4. **Monitor N8N logs** for any errors
