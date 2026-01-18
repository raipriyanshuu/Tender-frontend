import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessRequest {
  batchId: string;
  fileId: string;
  filePath: string;
  mimeType: string;
  originalFilename: string;
}

interface Segment {
  content: string;
  page_number?: number;
  sequence_number: number;
  metadata: {
    heading?: string;
    is_heading: boolean;
    line_start: number;
    line_end: number;
  };
}

interface SectionType {
  id: string;
  name: string;
  keywords: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let fileId: string | undefined;
  let batchId: string | undefined;

  try {
    const requestData: ProcessRequest = await req.json();
    batchId = requestData.batchId;
    fileId = requestData.fileId;
    const filePath = requestData.filePath;
    const mimeType = requestData.mimeType;
    const originalFilename = requestData.originalFilename;

    if (!batchId || !fileId || !filePath || !mimeType || !originalFilename) {
      throw new Error('Missing required fields');
    }

    console.log('Processing file:', { fileId, originalFilename, mimeType });

    await updatePipelineStage(supabase, batchId, 'normalization', 'processing');

    await supabase
      .from("tender_file_uploads")
      .update({ processing_status: "processing" })
      .eq("id", fileId);

    // Download file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("tender-documents")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    console.log('File downloaded, size:', fileData.size);

    // Extract text
    let extractedText = "";
    try {
      if (mimeType === "application/pdf") {
        extractedText = await extractPdfText(fileData);
      } else if (mimeType.includes("word") || mimeType.includes("document")) {
        extractedText = await extractWordText(fileData);
      } else if (mimeType.includes("sheet") || mimeType.includes("excel")) {
        extractedText = await extractExcelText(fileData);
      } else if (mimeType === "text/plain") {
        extractedText = await fileData.text();
      } else {
        extractedText = await fileData.text();
      }
    } catch (extractError) {
      console.error("Text extraction error:", extractError);
      extractedText = `[Failed to extract text from ${originalFilename}]`;
    }

    console.log('Text extracted, length:', extractedText.length);

    await updatePipelineStage(supabase, batchId, 'normalization', 'completed');
    await updatePipelineStage(supabase, batchId, 'segmentation', 'processing');

    // PHASE 2: Segmentation
    const segments = segmentDocument(extractedText);
    console.log(`Created ${segments.length} segments`);

    await updatePipelineStage(supabase, batchId, 'segmentation', 'completed');
    await updatePipelineStage(supabase, batchId, 'classification', 'processing');

    // PHASE 3: Classification
    const { data: sectionTypes } = await supabase
      .from('section_types')
      .select('id, name, keywords');

    const classifiedSegments = await classifySegments(segments, sectionTypes || [], batchId, fileId);
    console.log(`Classified ${classifiedSegments.length} segments`);

    // Save segments to database
    const { error: segmentError } = await supabase
      .from('document_segments')
      .insert(classifiedSegments);

    if (segmentError) {
      console.error('Failed to save segments:', segmentError);
    }

    await updatePipelineStage(supabase, batchId, 'classification', 'completed');
    await updatePipelineStage(supabase, batchId, 'extraction', 'processing');

    // PHASE 4: Structured Extraction (legacy for now)
    const structuredData = extractWithRegex(extractedText, originalFilename);

    // Save to file upload record (backward compatibility)
    await supabase
      .from("tender_file_uploads")
      .update({
        processing_status: "completed",
        extraction_result: structuredData,
        processed_at: new Date().toISOString(),
      })
      .eq("id", fileId);

    await updatePipelineStage(supabase, batchId, 'extraction', 'completed');

    // Update batch progress
    await supabase.rpc("increment_batch_progress", {
      batch_id_param: batchId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: structuredData,
        segments_created: classifiedSegments.length
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Processing error:", error);

    if (fileId) {
      try {
        await supabase
          .from("tender_file_uploads")
          .update({
            processing_status: "failed",
            error_message: error.message || "Processing failed",
          })
          .eq("id", fileId);
      } catch (updateError) {
        console.error("Failed to update file status:", updateError);
      }
    }

    if (batchId) {
      try {
        await supabase.rpc("increment_batch_progress", {
          batch_id_param: batchId,
        });
      } catch (batchError) {
        console.error("Failed to update batch:", batchError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

// Helper function to update pipeline stage
async function updatePipelineStage(supabase: any, batchId: string, stageName: string, status: string) {
  const updateData: any = { status };

  if (status === 'processing') {
    updateData.started_at = new Date().toISOString();
  } else if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
    updateData.progress_percent = 100;
  }

  await supabase
    .from('pipeline_stages')
    .update(updateData)
    .eq('batch_id', batchId)
    .eq('stage_name', stageName);
}

// Segmentation: Split document into semantic segments
function segmentDocument(text: string): Segment[] {
  const segments: Segment[] = [];
  const lines = text.split('\n');

  let currentSegment: string[] = [];
  let currentHeading = '';
  let sequenceNumber = 0;
  let lineStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      if (currentSegment.length > 0) {
        segments.push({
          content: currentSegment.join('\n'),
          sequence_number: sequenceNumber++,
          metadata: {
            heading: currentHeading,
            is_heading: false,
            line_start: lineStart,
            line_end: i
          }
        });
        currentSegment = [];
      }
      continue;
    }

    // Detect headings (all caps, short, or numbered)
    const isHeading =
      (line.length < 100 && line === line.toUpperCase() && /[A-ZÄÖÜ]/.test(line)) ||
      /^[0-9]+\.|^[0-9]+\.[0-9]+|^[A-Z]\)|^[IVX]+\./.test(line) ||
      /^(Artikel|Abschnitt|Kapitel|Teil|Anlage|§)\s+[0-9IVX]/.test(line);

    if (isHeading) {
      // Save previous segment if exists
      if (currentSegment.length > 0) {
        segments.push({
          content: currentSegment.join('\n'),
          sequence_number: sequenceNumber++,
          metadata: {
            heading: currentHeading,
            is_heading: false,
            line_start: lineStart,
            line_end: i - 1
          }
        });
        currentSegment = [];
      }

      // Save heading as its own segment
      currentHeading = line;
      segments.push({
        content: line,
        sequence_number: sequenceNumber++,
        metadata: {
          heading: line,
          is_heading: true,
          line_start: i,
          line_end: i
        }
      });
      lineStart = i + 1;
    } else {
      if (currentSegment.length === 0) {
        lineStart = i;
      }
      currentSegment.push(line);

      // Create segment after certain length or semantic break
      if (currentSegment.length > 20 ||
          line.endsWith('.') && currentSegment.join(' ').length > 500) {
        segments.push({
          content: currentSegment.join('\n'),
          sequence_number: sequenceNumber++,
          metadata: {
            heading: currentHeading,
            is_heading: false,
            line_start: lineStart,
            line_end: i
          }
        });
        currentSegment = [];
      }
    }
  }

  // Add remaining segment
  if (currentSegment.length > 0) {
    segments.push({
      content: currentSegment.join('\n'),
      sequence_number: sequenceNumber++,
      metadata: {
        heading: currentHeading,
        is_heading: false,
        line_start: lineStart,
        line_end: lines.length - 1
      }
    });
  }

  return segments;
}

// Classification: Assign section types to segments
async function classifySegments(
  segments: Segment[],
  sectionTypes: SectionType[],
  batchId: string,
  fileId: string
): Promise<any[]> {
  return segments.map(segment => {
    const lowerContent = segment.content.toLowerCase();

    // Rule-based classification
    let bestMatch: { id: string; score: number } | null = null;

    for (const sectionType of sectionTypes) {
      let score = 0;

      for (const keyword of sectionType.keywords) {
        const keywordLower = keyword.toLowerCase();
        if (lowerContent.includes(keywordLower)) {
          score += 1;

          // Bonus for keyword in heading
          if (segment.metadata.is_heading) {
            score += 2;
          }

          // Bonus for keyword at start
          if (lowerContent.startsWith(keywordLower) ||
              lowerContent.startsWith(`${segment.metadata.heading?.toLowerCase()} ${keywordLower}`)) {
            score += 1;
          }
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: sectionType.id, score };
      }
    }

    // Calculate confidence score (0-1)
    const maxPossibleScore = 10;
    const confidence = bestMatch
      ? Math.min(bestMatch.score / maxPossibleScore, 1.0)
      : 0.1;

    // Filter out low-relevance segments (headers, boilerplate)
    const isRelevant =
      segment.content.length > 20 &&
      !/^(seite|page)\s+\d+/i.test(segment.content) &&
      confidence > 0.05;

    return {
      file_upload_id: fileId,
      batch_id: batchId,
      section_type_id: bestMatch?.id || null,
      content: segment.content,
      normalized_content: segment.content.replace(/\s+/g, ' ').trim(),
      sequence_number: segment.sequence_number,
      confidence_score: Math.round(confidence * 100) / 100,
      is_relevant: isRelevant,
      metadata: segment.metadata
    };
  });
}

// Text extraction functions
async function extractPdfText(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  let text = "";
  const decoder = new TextDecoder("utf-8", { fatal: false });

  try {
    const decoded = decoder.decode(uint8Array);
    const streamMatch = decoded.match(/stream([\s\S]*?)endstream/g);

    if (streamMatch) {
      for (const match of streamMatch) {
        const content = match.replace(/stream|endstream/g, "").trim();
        const readable = content.replace(/[^\x20-\x7E\n\r]/g, " ");
        text += readable + "\n";
      }
    }

    const textMatch = decoded.match(/\(([^)]+)\)/g);
    if (textMatch) {
      text += textMatch.map(m => m.replace(/[()]/g, "")).join(" ");
    }
  } catch (e) {
    console.error("PDF extraction error:", e);
  }

  return text.trim() || "[PDF content - text extraction limited]";
}

async function extractWordText(file: Blob): Promise<string> {
  const text = await file.text();
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function extractExcelText(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const text = decoder.decode(arrayBuffer);
  return text.replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim();
}

// Legacy regex extraction (kept for backward compatibility)
function extractWithRegex(text: string, filename: string): any {
  const lowerText = text.toLowerCase();

  // Deadline extraction
  const datePatterns = [
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
    /(\d{4})-(\d{2})-(\d{2})/g,
  ];

  let deadline = "";
  const deadlineKeywords = ["frist", "angebotsfrist", "submission", "einreichung", "bis zum", "spätestens"];

  for (const keyword of deadlineKeywords) {
    const keywordIndex = lowerText.indexOf(keyword);
    if (keywordIndex !== -1) {
      const contextText = text.substring(keywordIndex, keywordIndex + 200);
      for (const pattern of datePatterns) {
        const matches = contextText.match(pattern);
        if (matches && matches.length > 0) {
          const match = matches[0];
          const parts = match.includes("-") ? match.split("-") : match.split(".");
          if (parts.length === 3) {
            deadline = match.includes("-") ? match : `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            break;
          }
        }
      }
      if (deadline) break;
    }
  }

  if (!deadline) {
    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const parts = lastMatch.includes("-") ? lastMatch.split("-") : lastMatch.split(".");
        if (parts.length === 3) {
          deadline = lastMatch.includes("-") ? lastMatch : `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          break;
        }
      }
    }
  }

  if (!deadline) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    deadline = futureDate.toISOString().split("T")[0];
  }

  const regionPatterns = [
    /DE-[A-Z]{2}/g,
    /(Bayern|Baden-Württemberg|Berlin|Brandenburg|Bremen|Hamburg|Hessen|Mecklenburg-Vorpommern|Niedersachsen|Nordrhein-Westfalen|Rheinland-Pfalz|Saarland|Sachsen|Sachsen-Anhalt|Schleswig-Holstein|Thüringen)/gi
  ];

  let region = "DE";
  for (const pattern of regionPatterns) {
    const match = text.match(pattern);
    if (match) {
      region = match[0].startsWith("DE-") ? match[0] : `DE-${match[0].substring(0, 2).toUpperCase()}`;
      break;
    }
  }

  let title = "";
  const titlePatterns = [
    /(?:Titel|Bezeichnung|Projekt|Ausschreibung)[\s:]+([^\n]{10,150})/i,
    /(?:Vergabe|Auftrag)[\s:]+([^\n]{10,150})/i
  ];

  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      title = match[1].trim();
      break;
    }
  }

  if (!title) {
    title = (filename || 'Ausschreibung')
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]/g, " ")
      .replace(/\d+/g, "")
      .trim();
  }

  let buyer = "";
  const buyerPatterns = [
    /(?:Auftraggeber|Vergabestelle)[\s:]+([^\n]{5,100})/i,
    /(?:Auslobende Stelle)[\s:]+([^\n]{5,100})/i
  ];

  for (const pattern of buyerPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      buyer = match[1].trim();
      break;
    }
  }

  let contact = "";
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/(?:\+49|0)[\s]?[\d]{2,4}[\s]?[\d]{3,10}/);

  if (emailMatch) contact += `E-Mail: ${emailMatch[0]}`;
  if (phoneMatch) contact += (contact ? ", " : "") + `Tel: ${phoneMatch[0]}`;

  const serviceTypes: string[] = [];
  const serviceKeywords = [
    "Winterdienst", "Reinigung", "Bauarbeiten", "Transport", "Entsorgung",
    "Wartung", "Instandhaltung", "Lieferung", "Montage", "Installation",
    "Beratung", "Planung", "Prüfung", "Gutachten", "Sanierung", "Reparatur",
    "Grünpflege", "Schneeräumung", "Gebäudereinigung", "Straßenbau"
  ];

  for (const keyword of serviceKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      serviceTypes.push(keyword);
    }
  }

  const summary = `Dokument: ${title || filename}. Frist: ${deadline}. ${serviceTypes.length > 0 ? `Leistungen: ${serviceTypes.slice(0, 3).join(", ")}.` : ""}`;

  return {
    title: title || "Ausschreibung",
    buyer: buyer || "Siehe Dokument",
    region: region,
    deadline: deadline,
    url: "",
    serviceTypes: serviceTypes.length > 0 ? serviceTypes : ["Dienstleistung"],
    summary: summary
  };
}
