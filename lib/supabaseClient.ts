import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qnjoldrxdtnbzjlbtphu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuam9sZHJ4ZHRuYnpqbGJ0cGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDMwMDEsImV4cCI6MjA3OTk3OTAwMX0.-2XPSO6lgMrz5Zmf_iJYQ1aITj2ViBSE31kSBGiuH-I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);