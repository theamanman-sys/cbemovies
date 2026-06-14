const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

const tvState = {
  page: 1, totalPages: 1, totalResults: 0,
  genres: [],
  filters: { with_genres: '', first_air_date_year: '', sort_by: 'popularity.desc', 'vote_average.gte': '', 'vote_count.gte': '' },
  loading: false, currentItem: null
};

const dom = {};

function initDOM() {
  dom.grid = $('#browse-grid');
  dom.pagination = $('#pagination');
  dom.genre = $('#filter-genre');
  dom.year = $('#filter-year');
  dom.sort = $('#filter-sort');
  dom.rating = $('#filter-rating');
  dom.votes = $('#filter-votes');
  dom.loading = $('#browse-loading');
  dom.count = $('#result-count');
  dom.modal = $('#modal');
  dom.modalOverlay = $('#modal-overlay');
  dom.playerPage = $('#player-page');
  dom.playerFrame = $('#player-frame');
  dom.playerSidebarContent = $('#player-sidebar-content');
  dom.searchOverlay = $('#search-overlay');
  dom.searchInput = $('#search-input');
  dom.searchResults = $('#search-results');
  dom.toast = $('#toast');
  dom.preloader = $('#preloader');
}

function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ── Toast ── */
function showToast(msg, duration = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('active');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('active'), duration);
}

/* ── Player ── */
function openPlayer(item) {
  if (!Auth.currentUser || !Auth.userDoc?.subscribed) {
    showToast('Subscribe to watch', 'success');
    setTimeout(() => window.location.href = 'profile.html', 1500);
    return;
  }
  tvState.currentItem = item;
  const url = API.getPlayerUrl(item);
  dom.playerFrame.src = url;
  dom.playerPage.classList.remove('hidden');
  dom.playerSidebarContent.innerHTML = renderPlayerSidebar(item);
  unlockScroll();
}

function closePlayer() {
  dom.playerPage.classList.add('hidden');
  dom.playerFrame.src = '';
  tvState.currentItem = null;
  lockScroll();
}

function togglePlayerFullscreen() {
  if (!document.fullscreenElement) {
    dom.playerPage.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function togglePlayerSidebar() {
  const sb = dom.playerPage.querySelector('.player-sidebar');
  if (sb) sb.classList.toggle('active');
}

function renderPlayerSidebar(item) {
  return `
    <div style="padding:20px">
      <h2 style="font-size:18px;margin-bottom:8px">${escHtml(item.title)}</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">${escHtml(item._overview || '')}</p>
      <div style="font-size:12px;color:var(--text-secondary)">
        ${item._rating ? `<span>&#11088; ${item._rating}</span>` : ''}
        ${item.year ? `<span style="margin-left:12px">${item.year}</span>` : ''}
      </div>
    </div>
  `;
}

/* ── Search ── */
let searchTimeout;

function openSearch() {
  dom.searchOverlay.classList.add('active');
  dom.searchInput.focus();
  lockScroll();
}

function closeSearch() {
  dom.searchOverlay.classList.remove('active');
  unlockScroll();
}

function onSearchInput() {
  clearTimeout(searchTimeout);
  const q = dom.searchInput.value.trim();
  if (!q) {
    dom.searchResults.innerHTML = '<div class="search-loading"><div class="spinner"></div><p style="color:var(--text-secondary);font-size:14px">Type to search TV shows...</p></div>';
    return;
  }
  searchTimeout = setTimeout(async () => {
    try {
      const results = await API.searchTmdbTV(q);
      if (!results.length) {
        dom.searchResults.innerHTML = '<div class="search-empty"><h3>No results found</h3><p>Try a different search term</p></div>';
        return;
      }
      dom.searchResults.innerHTML = results.map((item, i) => searchCard(item, q, i)).join('');
    } catch {
      dom.searchResults.innerHTML = '<div class="search-empty"><h3>Search failed</h3><p>Check your connection.</p></div>';
    }
  }, 300);
}

function searchCard(item, q, idx) {
  const title = escHtml(item.title || '');
  const year = item.year ? `<span>${escHtml(item.year)}</span>` : '';
  const rating = item._rating || item.rating;
  const stars = rating ? `<span class="card-rating">&#11088; ${rating}</span>` : '';
  const poster = item._poster || item.poster_url || '';
  return `
    <div class="movie-card" data-tmdb="${item.tmdb_id}" data-type="${item.type || 'tv'}" onclick="openTVDetail(${item.tmdb_id})">
      <img class="movie-card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22><rect fill=%22%231a1a2e%22 width=%22300%22 height=%22450%22/><text fill=%22%23666%22 font-size=%2218%22 x=%22150%22 y=%22225%22 text-anchor=%22middle%22>No Image</text></svg>'">
      ${stars}
      <div class="movie-card-overlay">
        <h3>${title}</h3>
        <div class="meta">${year}</div>
      </div>
      <button class="play-btn">&#9654;</button>
    </div>
  `;
}

/* ── Display Helpers ── */
function tDisplayTitle(item) {
  const en = item._tmdbTitle || item.title || 'Untitled';
  return escHtml(en);
}
function tDisplayGenres(item) {
  if (item._genres?.length) return item._genres.join(', ');
  return item.genre || 'General';
}
function tDisplayRating(item) { return item._rating || (item.rating ? parseFloat(item.rating).toFixed(1) : '0'); }
function tDisplayYear(item) { return item._year || item.year || 'N/A'; }
function tDisplayOverview(item) { return item._overview || ''; }

/* ── Modal ── */
async function openTVDetail(tmdbId) {
  dom.modal.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">Loading...</div>';
  dom.modalOverlay.classList.add('active');
  lockScroll();

  try {
    const item = await API.enrichItem({ tmdb_id: tmdbId, type: 'tv' });
    renderTVModal(item);
  } catch {
    dom.modal.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">Failed to load details.</div>';
  }
}

function closeModal() {
  dom.modalOverlay.classList.remove('active');
  unlockScroll();
}

function renderTVModal(item) {
  const trailer = item._trailer;
  const cast = item._cast || [];
  const isTV = true;

  const facts = [
    { label: 'Rating', value: `\u2605 ${tDisplayRating(item)}` },
    { label: 'Year', value: tDisplayYear(item) },
    { label: 'Status', value: item._status || '\u2014' },
    { label: 'Language', value: item._originalLanguage || '\u2014' },
  ];
  if (item._runtime) facts.push({ label: 'Runtime', value: `${Math.floor(item._runtime / 60)}h ${item._runtime % 60}m` });
  if (item._popularity) facts.push({ label: 'Popularity', value: `#${item._popularity}` });
  if (item._contentRating) facts.push({ label: 'Content Rating', value: item._contentRating });
  if (isTV) {
    if (item._seasons) facts.push({ label: 'Seasons', value: String(item._seasons) });
    if (item._episodes) facts.push({ label: 'Episodes', value: String(item._episodes) });
    if (item._networks?.length) facts.push({ label: 'Network', value: item._networks.join(', ') });
    if (item._createdBy?.length) facts.push({ label: 'Created By', value: item._createdBy.join(', ') });
  }
  if (item._productionCompanies?.length) {
    facts.push({ label: 'Production', value: item._productionCompanies.slice(0, 3).map(c => c.name).join(', ') });
  }

  dom.modal.innerHTML = `
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <img class="modal-backdrop" src="${item._poster || item.poster_url || ''}" alt="" onerror="this.style.display='none'">
    <div class="modal-body">
      <div class="detail-title-row">
        <div>
          <h2>${tDisplayTitle(item)}</h2>
          ${item._tagline ? `<div style="font-size:14px;color:var(--text-secondary);font-style:italic;margin-top:2px">"${escHtml(item._tagline)}"</div>` : ''}
        </div>
        ${trailer ? `<button class="trailer-btn" onclick="openTrailer('${trailer.key}')" style="flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          ${escHtml(trailer.name || 'Trailer')}
        </button>` : ''}
      </div>

      <div class="meta" style="margin-bottom:12px;margin-top:8px">
        <span class="rating">\u2605 ${tDisplayRating(item)}</span>
        <span>\u2022</span>
        <span>${escHtml(tDisplayYear(item))}</span>
        <span>\u2022</span>
        <span>${escHtml(tDisplayGenres(item))}</span>
        ${item._runtime ? `<span>\u2022</span><span>${Math.floor(item._runtime / 60)}h ${item._runtime % 60}m</span>` : ''}
        ${item._status ? `<span>\u2022</span><span>${escHtml(item._status)}</span>` : ''}
      </div>

      <p>${escHtml(tDisplayOverview(item))}</p>

      <div class="modal-actions" style="margin-bottom:16px">
        <button class="btn btn-primary" onclick="playFromModal(${item.tmdb_id})">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Play Now
        </button>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>

      <div class="facts-grid">
        ${facts.map(f => `
          <div class="fact-item">
            <div class="fact-label">${escHtml(f.label)}</div>
            <div class="fact-value">${f.html ? f.value : escHtml(f.value)}</div>
          </div>
        `).join('')}
      </div>

      ${cast.length ? `
        <div class="cast-section">
          <h4>Cast (${cast.length})</h4>
          <div class="cast-scroll">
            ${cast.map(c => `
              <div class="cast-card">
                <img src="${c.photo || ''}" alt="${escHtml(c.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27 fill=%27%231a1a2e%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2732%27/%3E%3Ctext x=%2732%27 y=%2732%27 text-anchor=%27middle%27 dy=%27.3em%27 fill=%27%23a0a0b8%27 font-size=%2718%27%3E${escHtml(c.name[0] || '?')}%3C/text%3E%3C/svg%3E'">
                <div class="name">${escHtml(c.name)}</div>
                <div class="role">${escHtml(c.character || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function playFromModal(tmdbId) {
  closeModal();
  const item = { tmdb_id: tmdbId, type: 'tv' };
  openPlayer(item);
}

/* ── Trailer ── */
function openTrailer(key) {
  const existing = document.getElementById('trailer-modal');
  if (existing) {
    existing.classList.add('active');
    const iframe = existing.querySelector('iframe');
    iframe.src = `https://www.youtube.com/embed/${key}?autoplay=1&muted=1&playsinline=1&controls=0&rel=0`;
    return;
  }
  const div = document.createElement('div');
  div.className = 'trailer-modal active';
  div.id = 'trailer-modal';
  div.innerHTML = `<button class="trailer-close" onclick="this.parentElement.classList.remove('active');this.nextElementSibling.src=''">&times;</button><iframe src="https://www.youtube.com/embed/${key}?autoplay=1&muted=1&playsinline=1&controls=0&rel=0" allow="autoplay;fullscreen"></iframe>`;
  document.body.appendChild(div);
}

/* ── Filters ── */
function populateFilters() {
  const currentYear = new Date().getFullYear();

  dom.genre.innerHTML = '<option value="">All Genres</option>' +
    tvState.genres.map(g => `<option value="${g.id}">${escHtml(g.name)}</option>`).join('');

  let yearHtml = '<option value="">All Years</option>';
  for (let y = currentYear; y >= 1900; y--) yearHtml += `<option value="${y}">${y}</option>`;
  dom.year.innerHTML = yearHtml;

  dom.sort.innerHTML = `
    <option value="popularity.desc">Popularity (High-Low)</option>
    <option value="popularity.asc">Popularity (Low-High)</option>
    <option value="vote_average.desc">Rating (High-Low)</option>
    <option value="vote_average.asc">Rating (Low-High)</option>
    <option value="first_air_date.desc">First Air Date (Newest)</option>
    <option value="first_air_date.asc">First Air Date (Oldest)</option>
    <option value="name.asc">Title (A-Z)</option>
  `;

  let ratingHtml = '<option value="">Any Rating</option>';
  for (let r = 0; r <= 9; r++) ratingHtml += `<option value="${r}">${r}+</option>`;
  dom.rating.innerHTML = ratingHtml;

  dom.votes.innerHTML = `
    <option value="">Any Votes</option>
    <option value="10">10+</option>
    <option value="50">50+</option>
    <option value="100">100+</option>
    <option value="500">500+</option>
    <option value="1000">1000+</option>
  `;
}

function readFilters() {
  tvState.filters.with_genres = dom.genre.value;
  tvState.filters.first_air_date_year = dom.year.value;
  tvState.filters.sort_by = dom.sort.value;
  tvState.filters['vote_average.gte'] = dom.rating.value;
  tvState.filters['vote_count.gte'] = dom.votes.value;
}

function applyFilters() {
  readFilters();
  tvState.page = 1;
  fetchAndRender();
}

function resetFilters() {
  dom.genre.value = '';
  dom.year.value = '';
  dom.sort.value = 'popularity.desc';
  dom.rating.value = '';
  dom.votes.value = '';
  applyFilters();
}

/* ── Fetch & Render ── */
async function fetchAndRender() {
  if (tvState.loading) return;
  tvState.loading = true;
  dom.loading.style.display = 'flex';
  dom.grid.innerHTML = '';

  const params = new URLSearchParams();
  params.set('page', tvState.page);
  Object.entries(tvState.filters).forEach(([k, v]) => { if (v) params.set(k, v); });

  try {
    const data = await API.tmdbFetch(`/discover/tv?${params.toString()}`);
    const items = API.resolveTmdbItems(data, 'tv');
    tvState.totalPages = Math.min(data.total_pages || 1, 500);
    tvState.totalResults = data.total_results || 0;
    renderGrid(items);
    renderPagination();
    dom.count.textContent = `${tvState.totalResults.toLocaleString()} TV shows found`;
  } catch {
    dom.grid.innerHTML = '<div class="search-empty"><h3>Failed to load</h3><p>Check your connection and try again.</p></div>';
    dom.pagination.innerHTML = '';
  } finally {
    tvState.loading = false;
    dom.loading.style.display = 'none';
  }
}

function renderGrid(items) {
  if (!items.length) {
    dom.grid.innerHTML = '<div class="search-empty"><h3>No TV shows found</h3><p>Try adjusting your filters.</p></div>';
    return;
  }
  dom.grid.innerHTML = items.map((item) => {
    const title = escHtml(item.title || '');
    const year = item.year ? `<span>${escHtml(item.year)}</span>` : '';
    const rating = item._rating || item.rating;
    const stars = rating ? `<span class="card-rating">&#11088; ${rating}</span>` : '';
    const poster = item._poster || item.poster_url || '';
    return `
      <div class="movie-card" data-tmdb="${item.tmdb_id}" data-type="tv" onclick="openTVDetail(${item.tmdb_id})">
        <img class="movie-card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22><rect fill=%22%231a1a2e%22 width=%22300%22 height=%22450%22/><text fill=%22%23666%22 font-size=%2218%22 x=%22150%22 y=%22225%22 text-anchor=%22middle%22>No Image</text></svg>'">
        ${stars}
        <div class="movie-card-overlay">
          <h3>${title}</h3>
          <div class="meta">${year}</div>
        </div>
        <button class="play-btn">&#9654;</button>
      </div>
    `;
  }).join('');
}

function renderPagination() {
  if (tvState.totalPages <= 1) {
    dom.pagination.innerHTML = '';
    return;
  }
  const total = tvState.totalPages;
  const cur = tvState.page;
  const maxVisible = 10;
  let start = Math.max(1, cur - Math.floor(maxVisible / 2));
  let end = Math.min(total, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

  let html = '';
  html += `<button class="page-btn" onclick="goToPage(${cur - 1})" ${cur <= 1 ? 'disabled' : ''}>&laquo; Prev</button>`;
  if (start > 1) {
    html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (start > 2) html += `<span class="page-info">&hellip;</span>`;
  }
  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn${p === cur ? ' active' : ''}" onclick="goToPage(${p})">${p}</button>`;
  }
  if (end < total) {
    if (end < total - 1) html += `<span class="page-info">&hellip;</span>`;
    html += `<button class="page-btn" onclick="goToPage(${total})">${total}</button>`;
  }
  html += `<button class="page-btn" onclick="goToPage(${cur + 1})" ${cur >= total ? 'disabled' : ''}>Next &raquo;</button>`;
  dom.pagination.innerHTML = html;
}

function goToPage(p) {
  if (p < 1 || p > tvState.totalPages || tvState.loading) return;
  tvState.page = p;
  fetchAndRender();
  dom.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Scroll lock ── */
function lockScroll() {
  document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  document.body.style.overflow = '';
}

/* ── Mobile Nav ── */
function toggleMobileNav() {
  let panel = document.getElementById('mobile-nav-panel');
  if (panel) { closeMobileNav(); return; }
  const overlay = document.createElement('div');
  overlay.id = 'mobile-nav-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:998;background:rgba(0,0,0,0.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:fadeIn .2s ease';
  overlay.addEventListener('click', closeMobileNav);
  document.body.appendChild(overlay);
  panel = document.createElement('div');
  panel.id = 'mobile-nav-panel';
  const navH = document.querySelector('nav')?.offsetHeight || 88;
  panel.style.cssText = `position:fixed;top:${navH}px;left:0;right:0;z-index:999;background:rgba(10,10,15,0.98);backdrop-filter:blur(20px);border-bottom:1px solid var(--glass-border);padding:16px 24px;animation:fadeInUp .2s ease;display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - ${navH}px);overflow-y:auto`;
  panel.innerHTML = `
    <a href="/" style="color:var(--text-primary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">${__('Home')}</a>
    <a href="movies.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">${__('Movies')}</a>
    <a href="tv.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">${__('TV Shows')}</a>
    <a href="youtube.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">\uD83C\uDFAC ${__('CBE Movies')}</a>
    <a href="#" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="openSearch();closeMobileNav();return false">${__('Search')}</a>
  `;
  document.body.appendChild(panel);
  lockScroll();
}
function closeMobileNav() {
  document.getElementById('mobile-nav-panel')?.remove();
  document.getElementById('mobile-nav-overlay')?.remove();
  unlockScroll();
}
window.toggleMobileNav = toggleMobileNav;
window.closeMobileNav = closeMobileNav;

/* ── Keyboard ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!dom.playerPage.classList.contains('hidden')) { closePlayer(); return; }
    if (dom.modalOverlay.classList.contains('active')) { closeModal(); return; }
    if (dom.searchOverlay.classList.contains('active')) { closeSearch(); return; }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openSearch();
  }
});

/* ── Language ── */
function toggleLang() {
  const lang = i18n.current === 'en' ? 'am' : 'en';
  i18n.setLang(lang);
  document.querySelector('.lang-switch').textContent = lang === 'am' ? '\u12A0\u121B' : 'EN';
  const dt = document.querySelector('[data-i18n]');
  if (dt) i18n.apply();
}

/* ── Init ── */
(async function init() {
  initDOM();
  i18n.init();
  document.querySelector('.lang-switch').textContent = i18n.current === 'am' ? '\u12A0\u121B' : 'EN';
  document.addEventListener('click', (e) => {
    if (e.target.closest('.mobile-menu-btn')) toggleMobileNav();
  });
  tvState.genres = await API.getTVGenres();
  populateFilters();
  await fetchAndRender();
  dom.preloader.classList.add('hidden');
})();
