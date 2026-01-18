import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AggregateRequest {
  batchId: string;
}

interface DocumentSegment {
  id: string;
  file_upload_id: string;
  section_type_id: string;
  content: string;
  normalized_content: string;
  confidence_score: number;
  metadata: any;
  section_type?: {
    name: string;
  };
}

interface SectionGroup {
  type: string;
  segments: DocumentSegment[];
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

  try {
    const requestData: AggregateRequest = await req.json();
    const { batchId } = requestData;

    if (!batchId) {
      throw new Error('Missing batchId');
    }

    console.log('Aggregating batch:', batchId);

    await updatePipelineStage(supabase, batchId, 'validation', 'processing');

    // Load all segments for this batch
    const { data: segments, error: segmentError } = await supabase
      .from('document_segments')
      .select('*, section_type:section_types(name)')
      .eq('batch_id', batchId)
      .eq('is_relevant', true)
      .order('file_upload_id', { ascending: true })
      .order('sequence_number', { ascending: true });

    if (segmentError) {
      throw new Error(`Failed to load segments: ${segmentError.message}`);
    }

    console.log(`Loaded ${segments?.length || 0} segments`);

    // Group segments by section type
    const groupedSegments = groupBySection(segments || []);

    // PHASE 1: Extract structured data from each section
    const metaInfo = extractMetaInfo(groupedSegments.meta || []);
    const leistungsumfang = extractLeistungsumfang(groupedSegments.leistungsbeschreibung || []);
    const pflichtnachweise = extractPflichtnachweise([
      ...(groupedSegments.nachweise || []),
      ...(groupedSegments.eignungskriterien || [])
    ]);
    const zuschlagskriterien = extractZuschlagskriterien(groupedSegments.zuschlagskriterien || []);
    const technischeSpezifikationen = extractTechnicalSpecs(groupedSegments.technische_spezifikationen || []);
    const fristen = extractFristen(groupedSegments.fristen || []);
    const rechtliches = extractRechtliches(groupedSegments.rechtliches || []);
    const sicherheit = extractSicherheit(groupedSegments.sicherheit || []);

    // PHASE 2: Detect duplicates
    const duplicates = detectDuplicates(segments || []);
    console.log(`Found ${duplicates.length} potential duplicates`);

    // PHASE 3: Detect conflicts
    const conflicts = detectConflicts(metaInfo, fristen);
    console.log(`Found ${conflicts.length} conflicts`);

    // PHASE 4: Calculate average confidence
    const avgConfidence = segments && segments.length > 0
      ? segments.reduce((sum, seg) => sum + (seg.confidence_score || 0), 0) / segments.length
      : 0;

    // PHASE 5: Validation
    const validationErrors = validateExtractedData({
      meta_info: metaInfo,
      leistungsumfang,
      pflichtnachweise,
      zuschlagskriterien
    });

    const validationStatus = validationErrors.length === 0 ? 'valid' :
                             validationErrors.length < 5 ? 'partial' : 'invalid';

    // Create or update tender profile
    const consolidatedData = {
      meta_info: metaInfo,
      leistungsumfang,
      pflichtnachweise,
      zuschlagskriterien,
      technische_spezifikationen: technischeSpezifikationen,
      fristen,
      rechtliches,
      sicherheit,
      statistics: {
        total_segments: segments?.length || 0,
        segment_types: Object.keys(groupedSegments).length,
        avg_confidence: Math.round(avgConfidence * 100) / 100
      }
    };

    const { data: profile, error: profileError } = await supabase
      .from('tender_profiles')
      .upsert({
        batch_id: batchId,
        consolidated_data: consolidatedData,
        meta_info: metaInfo,
        leistungsumfang,
        pflichtnachweise,
        zuschlagskriterien,
        validation_status: validationStatus,
        validation_errors: validationErrors,
        confidence_avg: Math.round(avgConfidence * 100) / 100,
        processing_completed_at: new Date().toISOString()
      }, {
        onConflict: 'batch_id'
      })
      .select()
      .single();

    if (profileError) {
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    console.log('Created tender profile:', profile.id);

    // Save conflicts
    if (conflicts.length > 0) {
      await supabase
        .from('document_conflicts')
        .insert(conflicts.map(c => ({
          tender_profile_id: profile.id,
          ...c
        })));
    }

    // Save validations
    if (validationErrors.length > 0) {
      await supabase
        .from('extraction_validations')
        .insert(validationErrors.map(v => ({
          tender_profile_id: profile.id,
          ...v
        })));
    }

    await updatePipelineStage(supabase, batchId, 'validation', 'completed');
    await updatePipelineStage(supabase, batchId, 'aggregation', 'processing');
    await updatePipelineStage(supabase, batchId, 'aggregation', 'completed');
    await updatePipelineStage(supabase, batchId, 'completed', 'completed');

    return new Response(
      JSON.stringify({
        success: true,
        profile_id: profile.id,
        validation_status: validationStatus,
        conflicts_count: conflicts.length,
        duplicates_count: duplicates.length,
        validation_errors_count: validationErrors.length,
        data: consolidatedData
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Aggregation error:", error);

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

function groupBySection(segments: DocumentSegment[]): Record<string, DocumentSegment[]> {
  const grouped: Record<string, DocumentSegment[]> = {};

  for (const segment of segments) {
    const sectionName = segment.section_type?.name || 'unknown';
    if (!grouped[sectionName]) {
      grouped[sectionName] = [];
    }
    grouped[sectionName].push(segment);
  }

  return grouped;
}

function extractMetaInfo(segments: DocumentSegment[]): any {
  const info: any = {
    vergabestelle: null,
    auftraggeber: null,
    kontakt: { email: null, telefon: null, ansprechpartner: null },
    vergabenummer: null,
    verfahrensart: null
  };

  const allText = segments.map(s => s.content).join('\n');

  // Extract Vergabestelle/Auftraggeber
  const buyerPatterns = [
    /(?:Auftraggeber|Vergabestelle|Ausschreibende Stelle)[\s:]+([^\n]{5,150})/i,
  ];
  for (const pattern of buyerPatterns) {
    const match = allText.match(pattern);
    if (match && match[1]) {
      info.auftraggeber = match[1].trim();
      info.vergabestelle = match[1].trim();
      break;
    }
  }

  // Extract email
  const emailMatch = allText.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    info.kontakt.email = emailMatch[0];
  }

  // Extract phone
  const phoneMatch = allText.match(/(?:\+49|0)[\s]?[\d]{2,4}[\s]?[\d]{3,10}/);
  if (phoneMatch) {
    info.kontakt.telefon = phoneMatch[0];
  }

  // Extract Vergabenummer
  const vergabeMatch = allText.match(/(?:Vergabenummer|Ausschreibungsnummer|Referenznummer)[\s:]+([A-Z0-9-\/]+)/i);
  if (vergabeMatch) {
    info.vergabenummer = vergabeMatch[1];
  }

  // Extract Verfahrensart
  const verfahrenKeywords = ['offenes Verfahren', 'nicht offenes Verfahren', 'Verhandlungsverfahren', 'wettbewerblicher Dialog'];
  for (const keyword of verfahrenKeywords) {
    if (allText.toLowerCase().includes(keyword.toLowerCase())) {
      info.verfahrensart = keyword;
      break;
    }
  }

  return info;
}

function extractLeistungsumfang(segments: DocumentSegment[]): any {
  return {
    beschreibung: segments.map(s => s.content).join('\n\n'),
    umfang: segments.length > 0 ? 'Siehe Beschreibung' : 'Nicht angegeben',
    leistungsort: extractLocation(segments),
    leistungszeitraum: extractTimeframe(segments)
  };
}

function extractLocation(segments: DocumentSegment[]): string | null {
  const allText = segments.map(s => s.content).join('\n');
  const locationPatterns = [
    /(?:Leistungsort|Ausführungsort)[\s:]+([^\n]{5,100})/i,
    /(?:PLZ|Postleitzahl)[\s:]+({5})/i
  ];

  for (const pattern of locationPatterns) {
    const match = allText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractTimeframe(segments: DocumentSegment[]): string | null {
  const allText = segments.map(s => s.content).join('\n');
  const timeframePatterns = [
    /(?:Leistungszeitraum|Vertragslaufzeit|Ausführungszeitraum)[\s:]+([^\n]{5,100})/i,
  ];

  for (const pattern of timeframePatterns) {
    const match = allText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractPflichtnachweise(segments: DocumentSegment[]): any {
  const nachweise: any[] = [];
  const allText = segments.map(s => s.content).join('\n').toLowerCase();

  // Common required documents
  const requiredDocs = [
    { keyword: 'handelsregister', name: 'Handelsregisterauszug', category: 'Eignung' },
    { keyword: 'gewerbeanmeldung', name: 'Gewerbeanmeldung', category: 'Eignung' },
    { keyword: 'betriebshaftpflicht', name: 'Betriebshaftpflichtversicherung', category: 'Versicherung' },
    { keyword: 'berufshaftpflicht', name: 'Berufshaftpflichtversicherung', category: 'Versicherung' },
    { keyword: 'referenz', name: 'Referenzen', category: 'Qualifikation' },
    { keyword: 'umsatz', name: 'Umsatznachweis', category: 'Wirtschaftlich' },
    { keyword: 'zertifikat', name: 'Zertifikate', category: 'Qualifikation' },
    { keyword: 'entsorgungsfachbetrieb', name: 'Entsorgungsfachbetrieb-Zertifikat', category: 'Zertifikat' },
    { keyword: 'iso 9001', name: 'ISO 9001 Zertifikat', category: 'Zertifikat' },
    { keyword: 'iso 14001', name: 'ISO 14001 Zertifikat', category: 'Zertifikat' },
    { keyword: 'präqualifizierung', name: 'Präqualifizierung', category: 'Eignung' },
    { keyword: 'eigenerklärung', name: 'Eigenerklärungen', category: 'Rechtsform' },
    { keyword: 'tariftreue', name: 'Tariftreue-Erklärung', category: 'Rechtsform' },
    { keyword: 'mindestlohn', name: 'Mindestlohn-Erklärung', category: 'Rechtsform' }
  ];

  for (const doc of requiredDocs) {
    if (allText.includes(doc.keyword)) {
      nachweise.push({
        bezeichnung: doc.name,
        kategorie: doc.category,
        pflicht: true,
        hinweise: `Wird in den Unterlagen erwähnt`
      });
    }
  }

  return {
    liste: nachweise,
    anzahl: nachweise.length,
    kategorien: [...new Set(nachweise.map(n => n.kategorie))]
  };
}

function extractZuschlagskriterien(segments: DocumentSegment[]): any {
  const kriterien: any[] = [];
  const allText = segments.map(s => s.content).join('\n');

  // Try to extract weighted criteria
  const weightPatterns = [
    /([^:\n]{10,80})[\s:]+(\d{1,3})\s*%/g,
    /(\d{1,3})\s*%[\s:-]+([^:\n]{10,80})/g
  ];

  for (const pattern of weightPatterns) {
    let match;
    while ((match = pattern.exec(allText)) !== null) {
      kriterien.push({
        bezeichnung: (match[1] || match[2]).trim(),
        gewichtung: parseInt(match[2] || match[1]),
        beschreibung: null
      });
    }
  }

  // Fallback: common criteria
  if (kriterien.length === 0) {
    const commonCriteria = [
      { keyword: 'preis', name: 'Preis', default_weight: 60 },
      { keyword: 'qualität', name: 'Qualität', default_weight: 40 },
      { keyword: 'referenz', name: 'Referenzen', default_weight: 10 },
      { keyword: 'umwelt', name: 'Umweltaspekte', default_weight: 10 }
    ];

    for (const criterion of commonCriteria) {
      if (allText.toLowerCase().includes(criterion.keyword)) {
        kriterien.push({
          bezeichnung: criterion.name,
          gewichtung: null,
          beschreibung: `Wird erwähnt in Zuschlagskriterien`
        });
      }
    }
  }

  return {
    kriterien,
    anzahl: kriterien.length,
    gewichtung_gesamt: kriterien.reduce((sum, k) => sum + (k.gewichtung || 0), 0)
  };
}

function extractTechnicalSpecs(segments: DocumentSegment[]): any {
  return {
    spezifikationen: segments.map(s => s.content).join('\n\n'),
    normen: extractNorms(segments)
  };
}

function extractNorms(segments: DocumentSegment[]): string[] {
  const allText = segments.map(s => s.content).join('\n');
  const norms: string[] = [];

  const normPatterns = [
    /DIN\s+[A-Z]*\s*\d+(-\d+)?/gi,
    /EN\s+\d+(-\d+)?/gi,
    /ISO\s+\d+(-\d+)?/gi,
    /VOB\/[ABC]/gi
  ];

  for (const pattern of normPatterns) {
    const matches = allText.match(pattern);
    if (matches) {
      norms.push(...matches);
    }
  }

  return [...new Set(norms)];
}

function extractFristen(segments: DocumentSegment[]): any {
  const fristen: any[] = [];
  const allText = segments.map(s => s.content).join('\n');

  const datePatterns = [
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
    /(\d{4})-(\d{2})-(\d{2})/g,
  ];

  const fristKeywords = [
    'Angebotsfrist',
    'Teilnahmefrist',
    'Bindefrist',
    'Rückfragefrist'
  ];

  for (const keyword of fristKeywords) {
    const keywordIndex = allText.indexOf(keyword);
    if (keywordIndex !== -1) {
      const contextText = allText.substring(keywordIndex, keywordIndex + 200);

      for (const pattern of datePatterns) {
        const matches = contextText.match(pattern);
        if (matches && matches.length > 0) {
          const dateStr = matches[0];
          fristen.push({
            bezeichnung: keyword,
            datum: dateStr,
            kontext: contextText.substring(0, 100)
          });
          break;
        }
      }
    }
  }

  return {
    fristen,
    anzahl: fristen.length
  };
}

function extractRechtliches(segments: DocumentSegment[]): any {
  const allText = segments.map(s => s.content).join('\n').toLowerCase();

  return {
    tariftreue: allText.includes('tariftreue'),
    mindestlohn: allText.includes('mindestlohn'),
    datenschutz: allText.includes('datenschutz') || allText.includes('dsgvo'),
    compliance: allText.includes('compliance'),
    geheimhaltung: allText.includes('geheimhaltung') || allText.includes('vertraulichkeit')
  };
}

function extractSicherheit(segments: DocumentSegment[]): any {
  const allText = segments.map(s => s.content).join('\n').toLowerCase();

  return {
    arbeitsschutz: allText.includes('arbeitsschutz'),
    sige: allText.includes('sige') || allText.includes('sicherheitskoordinator'),
    dguv: allText.includes('dguv'),
    unfallverhütung: allText.includes('unfallverhütung')
  };
}

function detectDuplicates(segments: DocumentSegment[]): any[] {
  const duplicates: any[] = [];
  const seen: Map<string, DocumentSegment> = new Map();

  for (const segment of segments) {
    const normalized = segment.normalized_content.toLowerCase().trim();

    // Skip very short segments
    if (normalized.length < 50) continue;

    if (seen.has(normalized)) {
      const original = seen.get(normalized)!;
      duplicates.push({
        field_name: 'content_duplicate',
        conflict_type: 'duplicate',
        source_segments: [original.id, segment.id],
        conflicting_values: [
          { file_id: original.file_upload_id, content: original.content.substring(0, 100) },
          { file_id: segment.file_upload_id, content: segment.content.substring(0, 100) }
        ],
        resolution_status: 'ignored'
      });
    } else {
      seen.set(normalized, segment);
    }
  }

  return duplicates;
}

function detectConflicts(metaInfo: any, fristen: any): any[] {
  const conflicts: any[] = [];

  // Check for multiple deadlines
  if (fristen.fristen && fristen.fristen.length > 1) {
    const uniqueDates = [...new Set(fristen.fristen.map((f: any) => f.datum))];
    if (uniqueDates.length > 1) {
      conflicts.push({
        field_name: 'deadline',
        conflict_type: 'contradiction',
        source_segments: [],
        conflicting_values: uniqueDates,
        resolution_status: 'pending',
        resolution_note: 'Mehrere unterschiedliche Fristen gefunden'
      });
    }
  }

  return conflicts;
}

function validateExtractedData(data: any): any[] {
  const errors: any[] = [];

  // Validate meta_info
  if (!data.meta_info?.auftraggeber) {
    errors.push({
      field_path: 'meta_info.auftraggeber',
      field_type: 'string',
      is_required: true,
      is_valid: false,
      validation_rule: 'required',
      error_message: 'Auftraggeber nicht gefunden'
    });
  }

  if (!data.meta_info?.kontakt?.email && !data.meta_info?.kontakt?.telefon) {
    errors.push({
      field_path: 'meta_info.kontakt',
      field_type: 'object',
      is_required: true,
      is_valid: false,
      validation_rule: 'required',
      error_message: 'Keine Kontaktinformationen gefunden'
    });
  }

  // Validate leistungsumfang
  if (!data.leistungsumfang?.beschreibung || data.leistungsumfang.beschreibung.length < 50) {
    errors.push({
      field_path: 'leistungsumfang.beschreibung',
      field_type: 'string',
      is_required: true,
      is_valid: false,
      validation_rule: 'min_length',
      error_message: 'Leistungsbeschreibung zu kurz oder nicht vorhanden'
    });
  }

  // Validate pflichtnachweise
  if (!data.pflichtnachweise?.liste || data.pflichtnachweise.liste.length === 0) {
    errors.push({
      field_path: 'pflichtnachweise.liste',
      field_type: 'array',
      is_required: false,
      is_valid: false,
      validation_rule: 'not_empty',
      error_message: 'Keine Pflichtnachweise identifiziert'
    });
  }

  return errors;
}
