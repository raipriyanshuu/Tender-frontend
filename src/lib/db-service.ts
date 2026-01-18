import { supabase } from './supabase';
import type { Database } from './database.types';

type Tender = Database['public']['Tables']['tenders']['Row'];
type TenderInsert = Database['public']['Tables']['tenders']['Insert'];
type CompanyProfile = Database['public']['Tables']['company_profiles']['Row'];
type CompanyProfileInsert = Database['public']['Tables']['company_profiles']['Insert'];
type TenderSubmission = Database['public']['Tables']['tender_submissions']['Row'];
type TenderSubmissionInsert = Database['public']['Tables']['tender_submissions']['Insert'];
type Document = Database['public']['Tables']['documents']['Row'];
type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
type QAResponse = Database['public']['Tables']['qa_responses']['Row'];
type QAResponseInsert = Database['public']['Tables']['qa_responses']['Insert'];
type PricingData = Database['public']['Tables']['pricing_data']['Row'];
type PricingDataInsert = Database['public']['Tables']['pricing_data']['Insert'];

export const dbService = {
  supabase,
  async getAllTenders(): Promise<Tender[]> {
    const { data, error } = await supabase
      .from('tenders')
      .select('*')
      .order('deadline', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createTender(tender: TenderInsert): Promise<Tender> {
    const { data, error } = await supabase
      .from('tenders')
      .insert(tender)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTender(id: string, updates: Partial<TenderInsert>): Promise<Tender> {
    const { data, error } = await supabase
      .from('tenders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getOrCreateProfile(profileData: CompanyProfileInsert): Promise<CompanyProfile> {
    const { data: existing, error: searchError } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('name', profileData.name)
      .maybeSingle();

    if (searchError) throw searchError;
    if (existing) return existing;

    const { data, error } = await supabase
      .from('company_profiles')
      .insert(profileData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProfile(id: string, updates: Partial<CompanyProfileInsert>): Promise<CompanyProfile> {
    const { data, error } = await supabase
      .from('company_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createSubmission(submission: TenderSubmissionInsert): Promise<TenderSubmission> {
    const { data, error } = await supabase
      .from('tender_submissions')
      .insert(submission)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSubmission(id: string, updates: Partial<TenderSubmissionInsert>): Promise<TenderSubmission> {
    const { data, error } = await supabase
      .from('tender_submissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getSubmissionById(id: string): Promise<TenderSubmission | null> {
    const { data, error } = await supabase
      .from('tender_submissions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async saveDocuments(submissionId: string, documents: Array<{ name: string; status: string; notes?: string }>): Promise<Document[]> {
    const { data: existing } = await supabase
      .from('documents')
      .select('*')
      .eq('submission_id', submissionId);

    if (existing && existing.length > 0) {
      await supabase
        .from('documents')
        .delete()
        .eq('submission_id', submissionId);
    }

    const docs: DocumentInsert[] = documents.map(doc => ({
      submission_id: submissionId,
      name: doc.name,
      status: doc.status,
      notes: doc.notes || ''
    }));

    const { data, error } = await supabase
      .from('documents')
      .insert(docs)
      .select();

    if (error) throw error;
    return data;
  },

  async getDocumentsBySubmission(submissionId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('submission_id', submissionId);

    if (error) throw error;
    return data || [];
  },

  async saveQAResponses(submissionId: string, responses: Array<{ questionId: string; questionLabel: string; answer: string }>): Promise<QAResponse[]> {
    const { data: existing } = await supabase
      .from('qa_responses')
      .select('*')
      .eq('submission_id', submissionId);

    if (existing && existing.length > 0) {
      await supabase
        .from('qa_responses')
        .delete()
        .eq('submission_id', submissionId);
    }

    const qas: QAResponseInsert[] = responses.map(r => ({
      submission_id: submissionId,
      question_id: r.questionId,
      question_label: r.questionLabel,
      answer: r.answer
    }));

    const { data, error } = await supabase
      .from('qa_responses')
      .insert(qas)
      .select();

    if (error) throw error;
    return data;
  },

  async getQAResponsesBySubmission(submissionId: string): Promise<QAResponse[]> {
    const { data, error } = await supabase
      .from('qa_responses')
      .select('*')
      .eq('submission_id', submissionId);

    if (error) throw error;
    return data || [];
  },

  async savePricing(submissionId: string, pricing: Omit<PricingDataInsert, 'submission_id'>): Promise<PricingData> {
    const { data: existing } = await supabase
      .from('pricing_data')
      .select('*')
      .eq('submission_id', submissionId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('pricing_data')
        .update(pricing)
        .eq('submission_id', submissionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('pricing_data')
      .insert({ ...pricing, submission_id: submissionId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getPricingBySubmission(submissionId: string): Promise<PricingData | null> {
    const { data, error } = await supabase
      .from('pricing_data')
      .select('*')
      .eq('submission_id', submissionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getSubmissionWithDetails(submissionId: string) {
    const [submission, documents, qaResponses, pricing] = await Promise.all([
      this.getSubmissionById(submissionId),
      this.getDocumentsBySubmission(submissionId),
      this.getQAResponsesBySubmission(submissionId),
      this.getPricingBySubmission(submissionId)
    ]);

    return {
      submission,
      documents,
      qaResponses,
      pricing
    };
  }
};
