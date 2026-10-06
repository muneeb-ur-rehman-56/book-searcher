const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OL = 'https://openlibrary.org';
const cache = new Map(); // 10-minute in-memory cache

async function getJSON(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < 600000) return hit.d;
  const r = await fetch(url, { headers: { 'User-Agent': 'Shelfwise class project (learning)' } });
  if (!r.ok) throw new Error(`Open Library responded with ${r.status}`);
  const d = await r.json();
  cache.set(url, { d, t: Date.now() });
  return d;
}
const route = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (e) { res.status(502).json({ error: 'Could not reach the book service. ' + e.message }); }
};

// One common book shape for every endpoint
const fromSearch = (d) => ({
  id: (d.key || '').replace('/works/', ''),
  title: d.title,
  authors: d.author_name || [],
  year: d.first_publish_year || null,
  cover: d.cover_i || null,
  rating: d.ratings_average || null,
  languages: d.language || [],
  subjects: (d.subject || []).slice(0, 6),
});
const fromSubject = (d) => ({
  id: (d.key || '').replace('/works/', ''),
  title: d.title,
  authors: (d.authors || []).map((a) => a.name),
  year: d.first_publish_year || null,
  cover: d.cover_id || null,
  rating: null,
  languages: [],
  subjects: (d.subject || []).slice(0, 6),
});

const FIELDS = 'key,title,author_name,first_publish_year,cover_i,language,ratings_average,subject';

// Search: q + type (all|title|author|subject) + lang (3-letter code) + sort (relevance|new|rating)
app.get('/api/search', route(async (req) => {
  const { q = '', type = 'all', lang = '', sort = '', page = 1 } = req.query;
  const p = new URLSearchParams({ fields: FIELDS + ',number_of_pages_median', limit: 24, page });
  const text = q.trim();
  if (text) p.set(['title', 'author', 'subject'].includes(type) ? type : 'q', text);
  if (lang) { if (text) p.set('language', lang); else p.set('q', `language:${lang}`); }
  if (!text && !lang) p.set('q', '*');
  if (sort === 'new' || sort === 'rating') p.set('sort', sort);
  const d = await getJSON(`${OL}/search.json?${p}`);
  return { total: d.numFound, books: d.docs.map(fromSearch) };
}));

// Trending books (daily / weekly / monthly)
app.get('/api/trending', route(async (req) => {
  const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'weekly';
  const d = await getJSON(`${OL}/trending/${period}.json?limit=24`);
  return { total: d.works.length, books: d.works.map(fromSearch) };
}));

// Recently published books that many people have catalogued
app.get('/api/recent', route(async () => {
  const y = new Date().getFullYear();
  const p = new URLSearchParams({ q: `first_publish_year:[${y - 1} TO ${y}] AND edition_count:[2 TO *]`, sort: 'new', limit: 24, fields: FIELDS });
  const d = await getJSON(`${OL}/search.json?${p}`);
  return { total: d.numFound, books: d.docs.map(fromSearch) };
}));

// Books by category (subject)
app.get('/api/subject/:name', route(async (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const name = encodeURIComponent(req.params.name.toLowerCase().replace(/\s+/g, '_'));
  const d = await getJSON(`${OL}/subjects/${name}.json?limit=24&offset=${(page - 1) * 24}`);
  return { total: d.work_count, books: d.works.map(fromSubject) };
}));

// Details for one book: description, subjects and community rating
app.get('/api/work/:id', route(async (req) => {
  const id = req.params.id.replace(/[^A-Za-z0-9]/g, '');
  const [w, r] = await Promise.all([
    getJSON(`${OL}/works/${id}.json`),
    getJSON(`${OL}/works/${id}/ratings.json`).catch(() => null),
  ]);
  const desc = typeof w.description === 'string' ? w.description : w.description?.value || '';
  return {
    id, title: w.title, description: desc.split('\r\n---')[0].split('\n---')[0].trim(),
    subjects: (w.subjects || []).slice(0, 10),
    firstPublished: w.first_publish_date || null,
    rating: r?.summary?.average || null, ratingCount: r?.summary?.count || 0,
  };
}));

app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log(`Shelfwise is running at http://localhost:${PORT}`));
