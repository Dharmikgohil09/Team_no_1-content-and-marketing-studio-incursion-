// Database table definitions for Supabase
export interface SupabaseProject {
  id: string;
  title: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export interface SupabaseAsset {
  id: string;
  name: string;
  url: string;
  type: string;
  created_at: string;
}
