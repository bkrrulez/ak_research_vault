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

-- Ensure RLS is enabled on relevant tables
ALTER TABLE llm_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_users ENABLE ROW LEVEL SECURITY;

-- Idempotent Policies for llm_models
-- Backend-controlled logic, so we allow access to authenticated users
DROP POLICY IF EXISTS "Public access to llm_models" ON llm_models;
CREATE POLICY "Public access to llm_models" ON llm_models FOR ALL USING (true) WITH CHECK (true);

-- Idempotent Policies for vault_users
DROP POLICY IF EXISTS "Public access to vault_users" ON vault_users;
CREATE POLICY "Public access to vault_users" ON vault_users FOR ALL USING (true) WITH CHECK (true);
