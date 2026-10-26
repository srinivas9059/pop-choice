import express from 'express';
import { openai, supabase } from './config.js';

const app = express();
app.use(express.json());

const average = (vs) => vs[0].map((_, i) => vs.reduce((s, v) => s + v[i], 0) / vs.length);

async function getPoster(title, year) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  const bearer = key.length > 40;
  const url = new URL('https://api.themoviedb.org/3/search/movie');
  url.searchParams.set('query', title);
  if (year) url.searchParams.set('year', year);
  if (!bearer) url.searchParams.set('api_key', key);
  try {
    const res = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${key}` } : {} });
    const path = (await res.json()).results?.[0]?.poster_path;
    return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
  } catch {
    return null;
  }
}

app.post('/api/recommend', async (req, res) => {
  try {
    const { people, minutes } = req.body;
    if (!Array.isArray(people) || !people.length || !(minutes > 0)) {
      return res.status(400).json({ error: 'Send people[] and minutes.' });
    }

    // 1. Embed each person, average into one group vector
    const texts = people.map(
      (p) => `Favorite movie and why: ${p.favorite}. Wants a ${p.era} movie. Mood: ${p.mood}. Would be stranded with: ${p.islandPerson}.`
    );
    const { data: emb } = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts });
    const groupVector = average(emb.map((e) => e.embedding));

    // 2. Nearest movies that fit the time limit
    const { data: candidates, error } = await supabase.rpc('match_movies', {
      query_embedding: groupVector,
      match_count: 15,
      max_runtime: Math.round(minutes),
    });
    if (error) throw error;
    if (!candidates.length) return res.json({ movies: [] });

    // 3. Let the model rank 5 for the whole group and explain why
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You pick movies for a group movie night. From the candidates only, choose up to 5 that best fit everyone, best first. Respect "new" vs "classic" preferences where possible. For each, write a friendly 1-2 sentence reason why this group will enjoy it. Reply as JSON: {"picks":[{"id":number,"reason":string}]}',
        },
        {
          role: 'user',
          content: `Group:\n${texts.map((t, i) => `Person ${i + 1}: ${t}`).join('\n')}\n\nCandidates:\n${candidates
            .map((c) => `id ${c.id}: ${c.title} (${c.year}), ${c.genre}, IMDB ${c.rating}. ${c.overview}`)
            .join('\n')}`,
        },
      ],
    });

    let picks = [];
    try { picks = JSON.parse(chat.choices[0].message.content).picks ?? []; } catch {}
    const byId = new Map(candidates.map((c) => [c.id, c]));
    let ranked = picks.filter((p) => byId.has(p.id)).map((p) => ({ ...byId.get(p.id), reason: p.reason }));
    if (!ranked.length) ranked = candidates.slice(0, 5).map((c) => ({ ...c, reason: c.overview }));

    const movies = await Promise.all(
      ranked.slice(0, 5).map(async (m) => ({
        title: m.title,
        year: m.year,
        reason: m.reason,
        poster: await getPoster(m.title, m.year),
      }))
    );
    res.json({ movies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not get recommendations. Check the server logs.' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`PopChoice API on http://localhost:${port}`));
