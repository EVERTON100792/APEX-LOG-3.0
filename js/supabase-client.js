// Assuming <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> is in index.html
const createClient = window.supabase && window.supabase.createClient;

if (!createClient) {
    console.error('Supabase Global not found! Ensure the CDN script is loaded in index.html');
}

const SUPABASE_URL = 'https://izpcrgnevzwparsslchd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cGNyZ25ldnp3cGFyc3NsY2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMjAxNTMsImV4cCI6MjA4NDY5NjE1M30.xYtk3mzOjSCYCNv3P5eq5aEmRUFSA_ERa58ABdL5Tpk';

export const supabase = createClient ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: sessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
}) : null;

// EXPOSE TO GLOBAL SCOPE FOR NON-MODULE SCRIPTS (like freight_logic.js)
if (supabase) {
    window.supabaseClient = supabase;
}

