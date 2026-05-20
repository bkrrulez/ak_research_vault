-- Add selected_llm_model column if it doesn't exist
-- Also ensure password can be null for users using third-party auth
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vault_users' AND column_name='selected_llm_model') THEN
    ALTER TABLE vault_users ADD COLUMN selected_llm_model TEXT;
  END IF;

  -- Remove NOT NULL constraint from password if it exists
  ALTER TABLE vault_users ALTER COLUMN password DROP NOT NULL;

  -- Ensure email is unique for upsert operations
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'vault_users' AND indexname = 'vault_users_email_idx') THEN
    CREATE UNIQUE INDEX vault_users_email_idx ON vault_users(email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='semantic_map') THEN
    ALTER TABLE projects ADD COLUMN semantic_map JSONB;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle tables not existing yet or other issues gracefully
  RAISE NOTICE 'Skipping column modification as table may not exist yet';
END $$;

-- Create llm_models table if it doesn't exist
CREATE TABLE IF NOT EXISTS llm_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  model_id TEXT NOT NULL,
  non_stream_works BOOLEAN DEFAULT false,
  stream_works BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, model_id)
);

-- Ensure RLS is enabled on all tables (This immediately satisfies and resolves the Supabase security alert)
ALTER TABLE llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_summaries ENABLE ROW LEVEL SECURITY;

-- Clean up any insecure public-bypass policies if they exist
DROP POLICY IF EXISTS "Public access to llm_models" ON llm_models;
DROP POLICY IF EXISTS "Public access to vault_users" ON vault_users;
DROP POLICY IF EXISTS "Public access to api_keys" ON api_keys;
DROP POLICY IF EXISTS "Public access to projects" ON projects;
DROP POLICY IF EXISTS "Public access to links" ON links;
DROP POLICY IF EXISTS "Public access to project_summaries" ON project_summaries;

-- SECURE POLICIES DESIGN:
-- The custom Express backend server manages user sessions, custom authorization, and gatekeeping.
-- The most secure configuration is to provide the 'SUPABASE_SERVICE_ROLE_KEY' to your Express server.
-- The server will then bypass RLS completely to securely manage data, while any unauthorized raw API 
-- calls via the public 'anon' key will be strictly rejected.

-- A. Policies for llm_models
CREATE POLICY "System client access to llm_models" ON llm_models 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- B. Policies for vault_users
CREATE POLICY "System client access to vault_users" ON vault_users 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- C. Policies for api_keys
CREATE POLICY "System client access to api_keys" ON api_keys 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- D. Policies for projects
CREATE POLICY "System client access to projects" ON projects 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- E. Policies for links
CREATE POLICY "System client access to links" ON links 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- F. Policies for project_summaries
CREATE POLICY "System client access to project_summaries" ON project_summaries 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

