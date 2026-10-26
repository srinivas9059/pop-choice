# PopChoice

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. `cp .env.example .env` and fill in keys.
3. Put your dataset at `data/movies.csv` (tab or comma separated).
4. `npm install && npm run embed` (one-time, ~1000 embeddings)
5. `npm run server` (port 3001)
6. In another terminal: `cd client && npm install && npm run dev`

Use the Supabase service-role key as SUPABASE_API_KEY (server only, never in the client).
