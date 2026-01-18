import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create a dummy Supabase client if credentials are missing
// This allows the app to load, but Supabase operations will fail gracefully
const createDummyClient = () => {
  const dummyQuery = {
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: new Error('Supabase not configured') }),
    update: () => ({ data: null, error: new Error('Supabase not configured') }),
    delete: () => ({ data: null, error: new Error('Supabase not configured') }),
    eq: () => dummyQuery,
    single: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    order: () => dummyQuery,
  };
  
  return {
    from: () => dummyQuery,
    storage: {
      from: () => ({
        upload: () => Promise.reject(new Error('Supabase not configured')),
      }),
    },
  } as any;
};

let supabase: ReturnType<typeof createClient<Database>>;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.warn('Failed to initialize Supabase client:', error);
    supabase = createDummyClient() as any;
  }
} else {
  console.warn('⚠️ Supabase environment variables not set. File upload and submission features will be disabled.');
  console.warn('   To enable: Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env file');
  supabase = createDummyClient() as any;
}

export { supabase };
