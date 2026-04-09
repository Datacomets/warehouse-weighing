#!/bin/bash
# Generate Supabase types from the remote project.
# Requires: npx supabase login (once) + project ref
# Usage: bash scripts/gen-types.sh

PROJECT_REF="${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF env var}"

npx supabase gen types typescript \
  --project-id "$PROJECT_REF" \
  --schema public \
  > src/lib/database.types.ts

echo "Types written to src/lib/database.types.ts"
echo "Update src/lib/types.ts: export type { Database } from './database.types';"
