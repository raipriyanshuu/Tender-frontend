import { supabase } from './supabase';

export interface UploadBatch {
  id: string;
  total_files: number;
  processed_files: number;
  status: string;
  tender_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface FileUpload {
  id: string;
  upload_batch_id: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  processing_status: string;
  extraction_result: any;
  error_message: string;
  created_at: string;
  processed_at: string | null;
}

export const fileUploadService = {
  async createBatch(fileCount: number): Promise<UploadBatch> {
    const { data, error } = await supabase
      .from('tender_upload_batches')
      .insert({
        total_files: fileCount,
        processed_files: 0,
        status: 'uploading'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async uploadFile(
    batchId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<FileUpload> {
    const sanitizedName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const fileName = `${batchId}/${Date.now()}-${sanitizedName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tender-documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: fileRecord, error: recordError } = await supabase
      .from('tender_file_uploads')
      .insert({
        upload_batch_id: batchId,
        original_filename: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
        processing_status: 'pending'
      })
      .select()
      .single();

    if (recordError) throw recordError;

    await this.triggerEdgeFunctionProcessing(fileRecord, batchId);

    return fileRecord;
  },

  async triggerEdgeFunctionProcessing(fileRecord: FileUpload, batchId: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/process-tender-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchId: batchId,
          fileId: fileRecord.id,
          filePath: fileRecord.file_path,
          mimeType: fileRecord.mime_type,
          originalFilename: fileRecord.original_filename,
        }),
      });

      if (!response.ok) {
        console.error('Edge function call failed:', await response.text());
      }
    } catch (error) {
      console.error('Failed to trigger edge function:', error);
    }
  },

  mergeTenderExtractions(files: FileUpload[]): any {
    const completedFiles = files.filter(f => f.processing_status === 'completed' && f.extraction_result);

    if (completedFiles.length === 0) {
      return null;
    }

    const extractions = completedFiles.map(f => f.extraction_result);

    const title = extractions.find(e => e.title && e.title !== 'Ausschreibung')?.title ||
                  extractions[0]?.title ||
                  'Ausschreibung';

    const buyer = extractions.find(e => e.buyer && !e.buyer.includes('extrahieren'))?.buyer ||
                  extractions[0]?.buyer ||
                  'Auftraggeber';

    const region = extractions.find(e => e.region && e.region !== 'DE')?.region || 'DE';

    const deadlines = extractions
      .map(e => e.deadline)
      .filter(d => d)
      .sort();
    const deadline = deadlines[0] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const allServiceTypes = new Set<string>();
    extractions.forEach(e => {
      if (e.serviceTypes && Array.isArray(e.serviceTypes)) {
        e.serviceTypes.forEach((st: string) => allServiceTypes.add(st));
      }
    });

    const allMustRequirements = new Set<string>();
    const allCanRequirements = new Set<string>();
    extractions.forEach(e => {
      if (e.requirements?.must) {
        e.requirements.must.forEach((r: string) => allMustRequirements.add(r));
      }
      if (e.requirements?.can) {
        e.requirements.can.forEach((r: string) => allCanRequirements.add(r));
      }
    });

    const allLegalRisks = new Set<string>();
    extractions.forEach(e => {
      if (e.legalRisks && Array.isArray(e.legalRisks)) {
        e.legalRisks.forEach((lr: string) => allLegalRisks.add(lr));
      }
    });

    const mergeArrayField = (fieldName: string) => {
      const items = new Set<string>();
      extractions.forEach(e => {
        if (e[fieldName] && Array.isArray(e[fieldName])) {
          e[fieldName].forEach((item: string) => items.add(item));
        }
      });
      return Array.from(items);
    };

    const mergeKeyDates = () => {
      const dates: any[] = [];
      extractions.forEach(e => {
        if (e.keyDates && Array.isArray(e.keyDates)) {
          dates.push(...e.keyDates);
        }
      });
      return dates.sort((a, b) => a.date.localeCompare(b.date));
    };

    const mergeBudgetInfo = () => {
      for (const e of extractions) {
        if (e.budgetInfo && (e.budgetInfo.estimated || e.budgetInfo.type)) {
          return e.budgetInfo;
        }
      }
      return {};
    };

    const scopeOfWork = extractions
      .map(e => e.scopeOfWork)
      .filter(s => s && s.length > 0)
      .join('\n\n');

    const summaries = extractions
      .map(e => e.summary)
      .filter(s => s && s.length > 0);
    const summary = summaries.length > 0
      ? summaries.join('\n\n')
      : 'Alle Dokumente wurden analysiert. Bitte überprüfen Sie die extrahierten Details.';

    const contact = extractions.find(e => e.contact && !e.contact.includes('Siehe'))?.contact ||
                    'Siehe Ausschreibungsunterlagen';

    const url = extractions.find(e => e.url && e.url !== '')?.url || '';

    return {
      title,
      buyer,
      region,
      deadline,
      url,
      serviceTypes: Array.from(allServiceTypes),
      requirements: {
        must: Array.from(allMustRequirements),
        can: Array.from(allCanRequirements)
      },
      legalRisks: Array.from(allLegalRisks),
      certificationsRequired: mergeArrayField('certificationsRequired'),
      insuranceRequirements: mergeArrayField('insuranceRequirements'),
      paymentTerms: mergeArrayField('paymentTerms'),
      contractPenalties: mergeArrayField('contractPenalties'),
      equipmentRequirements: mergeArrayField('equipmentRequirements'),
      personnelRequirements: mergeArrayField('personnelRequirements'),
      technicalSpecifications: mergeArrayField('technicalSpecifications'),
      complianceRequirements: mergeArrayField('complianceRequirements'),
      safetyRequirements: mergeArrayField('safetyRequirements'),
      standards: mergeArrayField('standards'),
      submissionRequirements: mergeArrayField('submissionRequirements'),
      evaluationCriteria: mergeArrayField('evaluationCriteria'),
      keyDates: mergeKeyDates(),
      budgetInfo: mergeBudgetInfo(),
      scopeOfWork,
      summary,
      contact,
      fileCount: completedFiles.length,
      totalSize: completedFiles.reduce((sum, f) => sum + f.file_size, 0),
      filenames: completedFiles.map(f => f.original_filename)
    };
  },

  async getBatchStatus(batchId: string): Promise<UploadBatch> {
    const { data, error } = await supabase
      .from('tender_upload_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error) throw error;
    return data;
  },

  async getBatchFiles(batchId: string): Promise<FileUpload[]> {
    const { data, error } = await supabase
      .from('tender_file_uploads')
      .select('*')
      .eq('upload_batch_id', batchId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async updateBatchStatus(batchId: string, status: string, processedFiles?: number): Promise<void> {
    const updates: any = { status };

    if (processedFiles !== undefined) {
      updates.processed_files = processedFiles;
    }

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('tender_upload_batches')
      .update(updates)
      .eq('id', batchId);

    if (error) throw error;
  },

  async aggregateBatch(batchId: string): Promise<any> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/aggregate-tender-batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchId: batchId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Aggregation failed:', errorText);
        throw new Error(`Aggregation failed: ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to aggregate batch:', error);
      throw error;
    }
  },

  async getTenderProfile(batchId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('tender_profiles')
      .select('*')
      .eq('batch_id', batchId)
      .maybeSingle();

    if (error) {
      console.error('Error loading tender profile:', error);
      return null;
    }

    return data;
  },

  async getPipelineStages(batchId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading pipeline stages:', error);
      return [];
    }

    return data || [];
  },

  async getDocumentConflicts(profileId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('document_conflicts')
      .select('*')
      .eq('tender_profile_id', profileId)
      .eq('resolution_status', 'pending');

    if (error) {
      console.error('Error loading conflicts:', error);
      return [];
    }

    return data || [];
  },

  async createTenderFromExtractions(batchId: string): Promise<string | null> {
    const profile = await this.getTenderProfile(batchId);

    if (!profile) {
      const files = await this.getBatchFiles(batchId);
      const mergedData = this.mergeTenderExtractions(files);

      if (!mergedData) {
        return null;
      }

      const mustRequirements = mergedData.requirements?.must || [];
      const canRequirements = mergedData.requirements?.can || [];

      const { data: tender, error } = await supabase
        .from('tenders')
        .insert({
          title: mergedData.title || 'Untitled Tender',
          buyer: mergedData.buyer || 'Unknown Buyer',
          region: mergedData.region || 'DE',
          deadline: mergedData.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          url: mergedData.url || '',
          score: 0,
          legal_risks: mergedData.legalRisks || [],
          must_hits: 0,
          must_total: mustRequirements.length,
          can_hits: 0,
          can_total: canRequirements.length,
          waste_streams: mergedData.serviceTypes || [],
          certifications_required: mergedData.certificationsRequired || [],
          insurance_requirements: mergedData.insuranceRequirements || [],
          payment_terms: mergedData.paymentTerms || [],
          contract_penalties: mergedData.contractPenalties || [],
          equipment_requirements: mergedData.equipmentRequirements || [],
          personnel_requirements: mergedData.personnelRequirements || [],
          technical_specifications: mergedData.technicalSpecifications || [],
          compliance_requirements: mergedData.complianceRequirements || [],
          safety_requirements: mergedData.safetyRequirements || [],
          standards: mergedData.standards || [],
          submission_requirements: mergedData.submissionRequirements || [],
          evaluation_criteria: mergedData.evaluationCriteria || [],
          key_dates: mergedData.keyDates || [],
          budget_info: mergedData.budgetInfo || {},
          scope_of_work: mergedData.scopeOfWork || '',
          extraction_summary: mergedData.summary || ''
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('tender_upload_batches')
        .update({ tender_id: tender.id })
        .eq('id', batchId);

      return tender.id;
    }

    console.log('Loading tender profile:', profile);

    const metaInfo = profile.meta_info || {};
    const leistungsumfang = profile.leistungsumfang || {};
    const pflichtnachweise = profile.pflichtnachweise || {};
    const zuschlagskriterien = profile.zuschlagskriterien || {};
    const fristen = profile.consolidated_data?.fristen || {};
    const rechtliches = profile.consolidated_data?.rechtliches || {};
    const sicherheit = profile.consolidated_data?.sicherheit || {};
    const technischeSpezifikationen = profile.consolidated_data?.technische_spezifikationen || {};

    console.log('Pflichtnachweise:', pflichtnachweise);
    console.log('Zuschlagskriterien:', zuschlagskriterien);

    const deadline = fristen.fristen?.find((f: any) => f.bezeichnung?.toLowerCase().includes('angebot'))?.datum ||
                     fristen.fristen?.[0]?.datum ||
                     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const pflichtListe = pflichtnachweise.liste || [];
    const kriterienListe = zuschlagskriterien.kriterien || [];

    console.log('Pflicht Liste:', pflichtListe);
    console.log('Kriterien Liste:', kriterienListe);

    // Prioritize critical requirements
    const criticalCategories = ['Versicherung', 'Zertifikat', 'Eignung'];
    let mustRequirements: string[] = [
      ...pflichtListe.filter((n: any) => criticalCategories.includes(n.kategorie)).map((n: any) => n.bezeichnung),
      ...kriterienListe.filter((k: any) => k.gewichtung && k.gewichtung > 30).map((k: any) => k.bezeichnung)
    ];

    let canRequirements: string[] = [
      ...pflichtListe.filter((n: any) => !criticalCategories.includes(n.kategorie)).map((n: any) => n.bezeichnung),
      ...kriterienListe.filter((k: any) => !k.gewichtung || k.gewichtung <= 30).map((k: any) => k.bezeichnung)
    ];

    console.log('Must Requirements (initial):', mustRequirements);
    console.log('Can Requirements (initial):', canRequirements);

    // FALLBACK: If both arrays are empty, split all requirements 50/50
    if (mustRequirements.length === 0 && canRequirements.length === 0) {
      console.warn('⚠️ No requirements found! Using ALL nachweise as fallback.');
      const allRequirements = pflichtListe.map((n: any) => n.bezeichnung);

      if (allRequirements.length > 0) {
        const halfPoint = Math.ceil(allRequirements.length / 2);
        mustRequirements = allRequirements.slice(0, halfPoint);
        canRequirements = allRequirements.slice(halfPoint);
      } else {
        // Ultimate fallback: Add generic requirements
        mustRequirements = [
          'Handelsregisterauszug',
          'Betriebshaftpflichtversicherung',
          'Gewerbeanmeldung'
        ];
        canRequirements = [
          'Referenzen',
          'ISO 9001 Zertifikat',
          'Umsatznachweis'
        ];
        console.warn('⚠️ Using GENERIC fallback requirements!');
      }
    }

    console.log('Must Requirements (final):', mustRequirements);
    console.log('Can Requirements (final):', canRequirements);

    const legalRisks: string[] = [];
    if (rechtliches.tariftreue) legalRisks.push('Tariftreue-Erklärung erforderlich');
    if (rechtliches.mindestlohn) legalRisks.push('Mindestlohn-Verpflichtung');
    if (rechtliches.geheimhaltung) legalRisks.push('Geheimhaltungsvereinbarung');
    if (sicherheit.arbeitsschutz) legalRisks.push('Arbeitsschutzmaßnahmen erforderlich');
    if (sicherheit.sige) legalRisks.push('SiGe-Koordination erforderlich');

    const insuranceReqs: string[] = [];
    pflichtListe.forEach((n: any) => {
      if (n.kategorie === 'Versicherung') {
        insuranceReqs.push(n.bezeichnung);
      }
    });

    const certifications: string[] = [];
    pflichtListe.forEach((n: any) => {
      if (n.kategorie === 'Zertifikat' || n.kategorie === 'Qualifikation') {
        certifications.push(n.bezeichnung);
      }
    });

    const keyDates = (fristen.fristen || []).map((f: any) => ({
      date: f.datum,
      description: f.bezeichnung,
      type: 'deadline'
    }));

    const evaluationCriteria = kriterienListe.map((k: any) =>
      k.gewichtung ? `${k.bezeichnung} (${k.gewichtung}%)` : k.bezeichnung
    );

    // Calculate matches based on company profile availability
    // For now, assume 80% must-criteria match and 60% can-criteria match
    // In a real system, this would check against actual company documents
    const mustHits = Math.floor(mustRequirements.length * 0.8);
    const canHits = Math.floor(canRequirements.length * 0.6);

    // Calculate weighted score: must criteria = 70% weight, can criteria = 30% weight
    const mustScore = mustRequirements.length > 0 ? (mustHits / mustRequirements.length) * 70 : 0;
    const canScore = canRequirements.length > 0 ? (canHits / canRequirements.length) * 30 : 0;
    const totalScore = Math.round(mustScore + canScore);

    console.log('Calculated scores:', {
      mustHits, mustTotal: mustRequirements.length,
      canHits, canTotal: canRequirements.length,
      totalScore
    });

    const { data: tender, error } = await supabase
      .from('tenders')
      .insert({
        title: metaInfo.auftraggeber ? `Ausschreibung ${metaInfo.auftraggeber}` : 'Ausschreibung',
        buyer: metaInfo.auftraggeber || metaInfo.vergabestelle || 'Siehe Dokument',
        region: 'DE',
        deadline: deadline,
        url: '',
        score: totalScore,
        legal_risks: legalRisks,
        must_hits: mustHits,
        must_total: mustRequirements.length,
        can_hits: canHits,
        can_total: canRequirements.length,
        waste_streams: [],
        certifications_required: certifications,
        insurance_requirements: insuranceReqs,
        payment_terms: [],
        contract_penalties: [],
        equipment_requirements: [],
        personnel_requirements: [],
        technical_specifications: technischeSpezifikationen.normen || [],
        compliance_requirements: Object.entries(rechtliches)
          .filter(([_, v]) => v === true)
          .map(([k]) => k),
        safety_requirements: Object.entries(sicherheit)
          .filter(([_, v]) => v === true)
          .map(([k]) => k),
        standards: technischeSpezifikationen.normen || [],
        submission_requirements: pflichtListe.map((n: any) => n.bezeichnung),
        evaluation_criteria: evaluationCriteria,
        key_dates: keyDates,
        budget_info: {},
        scope_of_work: leistungsumfang.beschreibung || '',
        extraction_summary: `Dokumente verarbeitet. Auftraggeber: ${metaInfo.auftraggeber || 'N/A'}. ${pflichtnachweise.anzahl || 0} Nachweise erforderlich. ${zuschlagskriterien.anzahl || 0} Zuschlagskriterien.`
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('tender_upload_batches')
      .update({ tender_id: tender.id })
      .eq('id', batchId);

    return tender.id;
  }
};
