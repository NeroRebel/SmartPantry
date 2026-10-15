-- Read-only deployment preflight. Run in Supabase SQL Editor BEFORE enabling deletion.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles', 'products', 'shopping_list', 'product_history'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
      JOIN pg_attribute target ON target.attrelid = c.confrelid AND target.attnum = c.confkey[1]
      WHERE n.nspname = 'public' AND t.relname = table_name
        AND c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
        AND c.confdeltype = 'c' AND cardinality(c.conkey) = 1
        AND a.attname = 'user_id' AND target.attname = 'id'
    ) THEN
      RAISE EXCEPTION 'Missing verified user_id -> auth.users(id) ON DELETE CASCADE on public.%', table_name;
    END IF;
  END LOOP;
END $$;
