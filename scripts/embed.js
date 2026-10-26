import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { openai, supabase } from '../server/config.js';

const file = process.argv[2] || 'data/movies.csv';
const raw = fs.readFileSync(file, 'utf8');
const delimiter = raw.split('\n')[0].includes('\t') ? '\t' : ',';
const rows = parse(raw, { columns: true, delimiter, skip_empty_lines: true, relax_quotes: true, bom: true });

const num = (v, f = parseInt) => { const n = f(v); return Number.isNaN(n) ? null : n; };
const movies = rows.map((r) => ({
  title: r.Series_Title,
  year: num(r.Released_Year),
  certificate: r.Certificate || null,
  runtime: num(r.Runtime),
  genre: r.Genre,
  rating: num(r.IMDB_Rating, parseFloat),
  overview: r.Overview,
}));

console.log(`Embedding ${movies.length} movies...`);
await supabase.from('movies').delete().neq('id', 0); // safe to re-run

const BATCH = 100;
for (let i = 0; i < movies.length; i += BATCH) {
  const batch = movies.slice(i, i + BATCH);
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: batch.map((m) => `${m.title} (${m.year}). Genre: ${m.genre}. ${m.overview}`),
  });
  const { error } = await supabase
    .from('movies')
    .insert(batch.map((m, j) => ({ ...m, embedding: data[j].embedding })));
  if (error) throw error;
  console.log(`Uploaded ${Math.min(i + BATCH, movies.length)} / ${movies.length}`);
}
console.log('Done.');
