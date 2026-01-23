
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://izpcrgnevzwparsslchd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cGNyZ25ldnp3cGFyc3NsY2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMjAxNTMsImV4cCI6MjA4NDY5NjE1M30.xYtk3mzOjSCYCNv3P5eq5aEmRUFSA_ERa58ABdL5Tpk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
