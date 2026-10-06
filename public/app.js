const $ = (s) => document.querySelector(s);
const COVER = (id, size = 'M') => `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;

const LANGS = [
  ['eng', 'English'], ['urd', 'Urdu'], ['hin', 'Hindi'], ['pan', 'Punjabi'], ['ara', 'Arabic'], ['per', 'Persian'],
  ['ben', 'Bengali'], ['tur', 'Turkish'], ['spa', 'Spanish'], ['fre', 'French'], ['ger', 'German'], ['ita', 'Italian'],
  ['por', 'Portuguese'], ['rus', 'Russian'], ['chi', 'Chinese'], ['jpn', 'Japanese'],
];
const LANG_NAME = Object.fromEntries(LANGS);
const SHELVES = [
  ['fiction', 'Fiction'], ['science_fiction', 'Science fiction'], ['fantasy', 'Fantasy'], ['romance', 'Romance'],
  ['mystery_and_detective_stories', 'Mystery'], ['history', 'History'], ['biography', 'Biography'],
  ['science', 'Science'], ['programming', 'Programming'], ['philosophy', 'Philosophy'], ['poetry', 'Poetry'],
];

const state = { mode: 'home', q: '', type: 'all', lang: '', sort: '', subject: '', page: 1, total: 0, items: [] };
const books = new Map(); // id -> book, used by the details popup

async function api(path, params = {}) {
  const r = await fetch('/api' + path + '?' + new URLSearchParams(params));
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
  return d;
}
function showError(msg) {
  const box = $('#error');
  box.classList.toggle('hidden', !msg);
  if (msg) box.querySelector('p').textContent = msg;
}
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const skeletons = (n, cls = '') => Array.from({ length: n }, () => `<div class="skeleton aspect-[2/3] ${cls}"></div>`).join('');
const rowSkeleton = () => skeletons(8, 'flex-none w-[140px] md:w-[160px]');

function card(b) {
  books.set(b.id, b);
  const by = b.authors.length ? b.authors.slice(0, 2).join(', ') : 'Unknown author';
  const cover = b.cover
    ? `<img loading="lazy" src="${COVER(b.cover)}" alt="Cover of ${esc(b.title)}">`
    : `<div class="nocover"><b>${esc(b.title)}</b><span>${esc(by)}</span></div>`;
  const stars = b.rating ? `<span class="stars">&#9733; ${b.rating.toFixed(1)}</span>` : '';
  return `<button class="book" data-id="${esc(b.id)}" aria-label="${esc(b.title)} by ${esc(by)}">
    <div class="cover">${cover}${stars}</div><h3>${esc(b.title)}</h3><p>${esc(by)}${b.year ? ' | ' + b.year : ''}</p></button>`;
}
const cards = (list, empty) => (list.length ? list.map(card).join('') : `<p class="text-mist text-sm py-6">${empty}</p>`);

/* ---------- Home sections ---------- */
async function loadTrending(period = 'weekly') {
  $('#trendingRow').innerHTML = rowSkeleton();
  try { $('#trendingRow').innerHTML = cards((await api('/trending', { period })).books, 'Nothing is trending right now.'); }
  catch (e) { $('#trendingRow').innerHTML = ''; showError(e.message); }
}
async function loadRecent() {
  $('#recentRow').innerHTML = rowSkeleton();
  try { $('#recentRow').innerHTML = cards((await api('/recent')).books, 'No recent releases found.'); }
  catch (e) { $('#recentRow').innerHTML = ''; }
}
function buildLanguages() {
  $('#langTiles').innerHTML = LANGS.map(([code, name]) => `<button class="tile" data-lang="${code}"><b>${name}</b><span>Browse books</span></button>`).join('');
  $('#lang').innerHTML = '<option value="">All languages</option>' + LANGS.map(([c, n]) => `<option value="${c}">${n}</option>`).join('');
}
function buildShelves() {
  $('#shelves').innerHTML = SHELVES.map(([slug, name]) => `
    <section data-subject="${slug}">
      <div class="flex items-center justify-between gap-3 mb-4">
        <h2 class="font-display font-bold text-2xl">${esc(name)}</h2>
        <button class="btn-ghost" data-seeall="${slug}" data-name="${esc(name)}">See all</button>
      </div>
      <div class="row" data-row>${rowSkeleton()}</div>
    </section>`).join('');
  const io = new IntersectionObserver((entries) => entries.forEach(async (e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const row = e.target.querySelector('[data-row]');
    try { row.innerHTML = cards((await api('/subject/' + e.target.dataset.subject)).books, 'No books found on this shelf.'); }
    catch (err) { row.innerHTML = ''; showError(err.message); }
  }), { rootMargin: '300px' });
  document.querySelectorAll('#shelves section').forEach((s) => io.observe(s));
}

/* ---------- Results grid ---------- */
function setMode(mode) {
  state.mode = mode;
  $('#home').classList.toggle('hidden', mode !== 'home');
  $('#results').classList.toggle('hidden', mode === 'home');
  if (mode !== 'home') $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function loadGrid(reset) {
  showError('');
  if (reset) { state.page = 1; state.items = []; $('#grid').innerHTML = skeletons(12); $('#empty').classList.add('hidden'); $('#resultsCount').textContent = ''; }
  $('#loadMore').classList.add('hidden');
  try {
    const d = state.mode === 'subject'
      ? await api('/subject/' + state.subject, { page: state.page })
      : await api('/search', { q: state.q, type: state.type, lang: state.lang, sort: state.sort, page: state.page });
    state.total = d.total;
    state.items = state.items.concat(d.books);
    $('#grid').innerHTML = state.items.map(card).join('');
    $('#resultsCount').textContent = `${d.total.toLocaleString()} books found`;
    $('#empty').classList.toggle('hidden', state.items.length > 0);
    $('#loadMore').classList.toggle('hidden', state.items.length === 0 || state.items.length >= d.total || d.books.length === 0);
  } catch (e) { $('#grid').innerHTML = ''; showError(e.message); }
}
function startSearch() {
  state.q = $('#q').value.trim();
  state.lang = $('#lang').value;
  state.mode = 'search';
  const langName = LANG_NAME[state.lang];
  $('#resultsTitle').textContent = state.q
    ? `Results for "${state.q}"${langName ? ' in ' + langName : ''}`
    : `${langName || 'All'} books`;
  $('#sort').disabled = false;
  $('#sort').value = state.sort;
  setMode('search');
  loadGrid(true);
}
function browseLanguage(code) {
  $('#q').value = '';
  $('#lang').value = code;
  startSearch();
}
function browseSubject(slug, name) {
  state.subject = slug;
  $('#resultsTitle').textContent = name + ' books';
  $('#sort').disabled = true;
  setMode('subject');
  loadGrid(true);
}

/* ---------- Details popup ---------- */
async function openModal(id) {
  const b = books.get(id) || { id, title: '', authors: [], subjects: [] };
  $('#modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const by = b.authors.length ? b.authors.join(', ') : 'Unknown author';
  const langs = (b.languages || []).map((c) => LANG_NAME[c]).filter(Boolean).slice(0, 6);
  const cover = b.cover
    ? `<img class="w-36 md:w-48 rounded-lg border border-line shrink-0 self-start" src="${COVER(b.cover, 'L')}" alt="Cover of ${esc(b.title)}">` : '';
  $('#modalBody').innerHTML = `<div class="p-5 md:p-8 flex gap-5 md:gap-8">${cover}
    <div class="min-w-0 flex-1">
      <h2 class="font-display font-bold text-2xl md:text-3xl pr-8">${esc(b.title)}</h2>
      <p class="text-mist mt-1">by ${esc(by)}</p>
      <p class="mt-3 text-sm text-mist">${b.year ? 'First published ' + b.year : ''}${langs.length ? (b.year ? ' | ' : '') + esc(langs.join(', ')) : ''}</p>
      <div id="more" class="mt-4 text-sm text-mist">Loading details...</div>
    </div></div>`;
  try {
    const w = await api('/work/' + id);
    const rating = w.rating ? `<p class="text-amber font-bold">&#9733; ${w.rating.toFixed(1)} <span class="text-mist font-normal">from ${w.ratingCount.toLocaleString()} readers</span></p>` : '';
    const subs = w.subjects.map((s) => `<span class="tag">${esc(s)}</span>`).join(' ');
    $('#more').innerHTML = `${rating}
      <p class="desc mt-3 text-paper leading-relaxed max-w-prose">${esc(w.description) || 'No description is available for this book yet.'}</p>
      ${subs ? `<div class="mt-4 flex flex-wrap gap-2">${subs}</div>` : ''}
      <div class="mt-6 flex flex-wrap gap-3">
        <a class="btn-main" href="https://openlibrary.org/works/${esc(id)}" target="_blank" rel="noopener">Read or borrow</a>
        <a class="btn-ghost" href="https://www.google.com/search?q=${encodeURIComponent(w.title + ' ' + (b.authors[0] || '') + ' book')}" target="_blank" rel="noopener">Find online</a>
      </div>`;
  } catch (e) { $('#more').textContent = e.message; }
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modalBody').innerHTML = '';
  document.body.style.overflow = '';
}

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const book = e.target.closest('.book');
  if (book) return openModal(book.dataset.id);
  const tile = e.target.closest('[data-lang]');
  if (tile) return browseLanguage(tile.dataset.lang);
  const all = e.target.closest('[data-seeall]');
  if (all) return browseSubject(all.dataset.seeall, all.dataset.name);
});
$('#typeChips').addEventListener('click', (e) => {
  const c = e.target.closest('.chip'); if (!c) return;
  state.type = c.dataset.type;
  document.querySelectorAll('#typeChips .chip').forEach((x) => x.setAttribute('aria-pressed', x === c));
});
$('#periodChips').addEventListener('click', (e) => {
  const c = e.target.closest('.chip'); if (!c) return;
  document.querySelectorAll('#periodChips .chip').forEach((x) => x.setAttribute('aria-pressed', x === c));
  loadTrending(c.dataset.period);
});
$('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); state.sort = ''; if ($('#q').value.trim() || $('#lang').value) startSearch(); });
$('#sort').onchange = (e) => { state.sort = e.target.value; loadGrid(true); };
$('#loadMore').onclick = () => { state.page++; loadGrid(false); };
function goHome() { showError(''); setMode('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
$('#backHome').onclick = goHome;
$('#logo').onclick = (e) => { e.preventDefault(); goHome(); };
$('#closeModal').onclick = closeModal;
$('#modal').addEventListener('click', (e) => { if (!$('#modalBox').contains(e.target)) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

buildLanguages();
buildShelves();
loadTrending();
loadRecent();
