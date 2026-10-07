-- Supabase SQL Schema for Content & Marketing Studio

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  design_type TEXT NOT NULL DEFAULT 'idCard',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies (Allow read/write for all users or authenticated users)
CREATE POLICY "Allow anon read/write for demo" ON public.projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Enable Realtime (Optional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
