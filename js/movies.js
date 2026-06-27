const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

let _cardView = localStorage.getItem('cbemovies_cardview') || 'browse';

const mState = {
  page: 1, totalPages: 1, totalResults: 0,
  genres: [],
  filters: { with_genres: '', primary_release_year: '', sort_by: 'popularity.desc', 'vote_average.gte': '', 'vote_count.gte': '' },
  loading: false, currentItem: null, playerSimilarItems: null
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

function showToast(msg, duration = 3000) {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.classList.add('active');
  clearTimeout(dom.toast._timer);
  dom.toast._timer = setTimeout(() => dom.toast.classList.remove('active'), duration);
}

/* ── Player ── */
let _playerSources = [];
let _playerSourceIndex = 0;
let _currentPlayerUrl = '';
let _expectedIframeNav = false;
let _sourceFallbackTimer = null;

function startSourceFallbackTimer() {
  clearSourceFallbackTimer();
  _sourceFallbackTimer = setTimeout(() => {
    _sourceFallbackTimer = null;
    if (!dom.playerPage || dom.playerPage.classList.contains('hidden')) return;
    if (_playerSourceIndex + 1 < _playerSources.length) {
      _playerSourceIndex++;
      _currentPlayerUrl = _playerSources[_playerSourceIndex];
      _expectedIframeNav = true;
      dom.playerFrame.src = _currentPlayerUrl;
      startSourceFallbackTimer();
    } else {
      showToast('All player sources failed', true);
    }
  }, 15000);
}

function clearSourceFallbackTimer() {
  if (_sourceFallbackTimer) {
    clearTimeout(_sourceFallbackTimer);
    _sourceFallbackTimer = null;
  }
}

if (dom.playerFrame) {
  dom.playerFrame.addEventListener('load', () => {
    if (_expectedIframeNav) { _expectedIframeNav = false; return; }
    if (!_currentPlayerUrl) return;
    _expectedIframeNav = true;
    dom.playerFrame.src = _currentPlayerUrl;
  });
}

function listenPlayerProgress() {
  if (dom.playerPage._messageHandler) {
    window.removeEventListener('message', dom.playerPage._messageHandler);
  }
  const handler = (event) => {
    if (!dom.playerPage || dom.playerPage.classList.contains('hidden')) return;
    if (!_currentPlayerUrl) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'cbemovies-progress' || data.type === 'timeupdate') {
      clearSourceFallbackTimer();
    }
  };
  dom.playerPage._messageHandler = handler;
  window.addEventListener('message', handler);
}

async function openPlayer(item) {
  if (!Auth.currentUser || !Auth.canAccessContent(Auth.userDoc)) {
    showToast('Subscribe to watch', 'success');
    setTimeout(() => window.location.href = 'profile.html#subscription', 1500);
    return;
  }
  mState.currentItem = item;
  mState.playerSimilarItems = null;
  _playerSources = API.getPlayerUrls(item);
  _playerSourceIndex = 0;
  _currentPlayerUrl = _playerSources[_playerSourceIndex];
  dom.playerFrame.src = '';
  clearSourceFallbackTimer();
  setTimeout(() => {
    _expectedIframeNav = true;
    dom.playerFrame.src = _currentPlayerUrl;
    startSourceFallbackTimer();
  }, 50);
  dom.playerPage.classList.remove('hidden');
  dom.playerSidebarContent.innerHTML = renderPlayerSidebar(item);
  unlockScroll();
  listenPlayerProgress();
  try {
    const enriched = await API.enrichItem({ tmdb_id: item.tmdb_id, type: item.type || 'movie' });
    Object.assign(item, enriched);
    const similar = await loadPlayerSimilar(item);
    mState.playerSimilarItems = similar;
    if (mState.currentItem?._id === item._id || mState.currentItem?.tmdb_id === item.tmdb_id) {
      dom.playerSidebarContent.innerHTML = renderPlayerSidebar(item);
    }
  } catch {}
}

function closePlayer() {
  clearSourceFallbackTimer();
  _playerSources = [];
  _playerSourceIndex = 0;
  dom.playerFrame.src = '';
  _currentPlayerUrl = '';
  _expectedIframeNav = false;
  mState.currentItem = null;
  if (dom.playerPage._messageHandler) {
    window.removeEventListener('message', dom.playerPage._messageHandler);
    dom.playerPage._messageHandler = null;
  }
  dom.playerPage.classList.add('hidden');
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

async function loadPlayerSimilar(item) {
  if (!item?.tmdb_id) return [];
  try {
    const isTV = item.type === 'tv';
    const items = isTV ? await API.getSimilarTV(item.tmdb_id) : await API.getSimilarMovies(item.tmdb_id);
    return (items || []).slice(0, 10);
  } catch { return []; }
}

function renderPlayerSidebar(item) {
  const title = mDisplayTitle(item);
  const poster = item._poster || item.poster_url || '';
  const rating = mDisplayRating(item);
  const year = mDisplayYear(item);
  const genres = mDisplayGenres(item);
  const overview = mDisplayOverview(item);
  const cast = item._cast || [];
  const trailer = item._trailer;
  const isTV = item.type === 'tv';
  const similar = mState.playerSimilarItems || [];

  return `
    <div class="ps-header">
      ${poster ? `<img class="ps-poster" src="${poster}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
      <div>
        <h3>${title}</h3>
        <div class="meta">${year} · ${escHtml(genres)} · ★ ${rating}${isTV ? ' · S' + (item._season || 1) + ' E' + (item._episode || 1) : ''}</div>
      </div>
    </div>
    ${overview ? `<p class="ps-overview">${escHtml(overview)}</p>` : ''}
    ${trailer ? `<button class="btn btn-outline ps-trailer-btn" onclick="playTrailer(${item.tmdb_id},'${item.type || 'movie'}')">▶ Trailer</button>` : ''}
    ${cast.length ? `
      <div class="ps-section">
        <h4>Cast (${cast.length})</h4>
        <div class="cast-scroll">
          ${cast.slice(0, 8).map(c => `
            <div class="cast-card">
              <img src="${c.photo || ''}" alt="${escHtml(c.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27 fill=%27%231a1a2e%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2732%27/%3E%3Ctext x=%2732%27 y=%2732%27 text-anchor=%27middle%27 dy=%27.3em%27 fill=%27%23a0a0b8%27 font-size=%2718%27%3E${escHtml(c.name[0] || '?')}%3C/text%3E%3C/svg%3E'">
              <div class="name">${escHtml(c.name)}</div>
              <div class="role">${escHtml(c.character || '')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    ${similar.length ? `
      <div class="ps-section">
        <h4>Similar Titles</h4>
        <div class="ps-similar-scroll">
          ${similar.map(s => `
            <div class="ps-similar-card" onclick="openPlayer({tmdb_id:${s.tmdb_id},type:'${s.type || 'movie'}'})">
              <img src="${s.poster_url || ''}" alt="${escHtml(s.title || '')}" loading="lazy" onerror="this.parentElement.style.display='none'">
              <span>${escHtml(s.title || '')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
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
    dom.searchResults.innerHTML = '<div class="search-loading"><div class="spinner"></div><p style="color:var(--text-secondary);font-size:14px">Type to search movies...</p></div>';
    return;
  }
  searchTimeout = setTimeout(async () => {
    try {
      const results = await API.searchTmdbMovie(q);
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
    <div class="movie-card" data-tmdb="${item.tmdb_id}" data-type="${item.type || 'movie'}" onclick="openMovieDetail(${item.tmdb_id})">
      <img class="movie-card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22><rect fill=%22%231a1a2e%22 width=%22300%22 height=%22450%22/><text fill=%22%23666%22 font-size=%2218%22 x=%22150%22 y=%22225%22 text-anchor=%22middle%22>No Image</text></svg>'">
      ${stars}
      <div class="movie-card-overlay">
        <h3>${highlight(title, q)}</h3>
        <div class="meta">${year}</div>
      </div>
      <button class="play-btn">&#9654;</button>
    </div>
  `;
}

function highlight(text, q) {
  if (!q || !text) return escHtml(text);
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return escHtml(text);
  return escHtml(text.slice(0, idx)) + '<strong style="color:var(--accent)">' + escHtml(text.slice(idx, idx + q.length)) + '</strong>' + escHtml(text.slice(idx + q.length));
}

/* ── Display Helpers ── */
function mDisplayTitle(item) {
  const en = item._tmdbTitle || item.title || 'Untitled';
  return escHtml(en);
}
function mDisplayGenres(item) {
  if (item._genres?.length) return item._genres.join(', ');
  return item.genre || 'General';
}
function mDisplayRating(item) { return item._rating || (item.rating ? parseFloat(item.rating).toFixed(1) : '0'); }
function mDisplayYear(item) { return item._year || item.year || 'N/A'; }
function mDisplayOverview(item) {
  return item._overview || '';
}

/* ── Modal ── */
async function openMovieDetail(tmdbId) {
  dom.modal.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">Loading...</div>';
  dom.modalOverlay.classList.add('active');
  lockScroll();

  try {
    const item = await API.enrichItem({ tmdb_id: tmdbId, type: 'movie' });
    renderMovieModal(item);
    setupModalTrailer(item);
  } catch {
    dom.modal.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">Failed to load details.</div>';
  }
}

function closeModal() {
  destroyModalTrailer();
  dom.modalOverlay.classList.remove('active');
  unlockScroll();
}

function renderMovieModal(item) {
  const trailer = item._trailer;
  const director = item._director;
  const cast = item._cast || [];

  const facts = [
    { label: 'Rating', value: `\u2605 ${mDisplayRating(item)}` },
    { label: 'Year', value: mDisplayYear(item) },
    { label: 'Status', value: item._status || '\u2014' },
    { label: 'Language', value: item._originalLanguage || '\u2014' },
  ];
  if (item._runtime) facts.push({ label: 'Runtime', value: `${Math.floor(item._runtime / 60)}h ${item._runtime % 60}m` });
  if (director) facts.push({ label: 'Director', value: director });
  if (item._popularity) facts.push({ label: 'Popularity', value: `#${item._popularity}` });
  if (item._budget > 0) facts.push({ label: 'Budget', value: `$${(item._budget / 1e6).toFixed(0)}M` });
  if (item._revenue > 0) facts.push({ label: 'Revenue', value: `$${(item._revenue / 1e6).toFixed(0)}M` });
  if (item._productionCompanies?.length) {
    facts.push({ label: 'Production', value: item._productionCompanies.slice(0, 3).map(c => c.name).join(', ') });
  }

  dom.modal.innerHTML = `
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <img class="modal-backdrop" src="${item._poster || item.poster_url || ''}" alt="" onerror="this.style.display='none'">
    <div class="modal-body">
      <div class="detail-title-row">
        <div>
          <h2>${mDisplayTitle(item)}</h2>
          ${item._tagline ? `<div style="font-size:14px;color:var(--text-secondary);font-style:italic;margin-top:2px">"${escHtml(item._tagline)}"</div>` : ''}
        </div>
        ${trailer ? `<button class="trailer-btn" onclick="openTrailer('${trailer.key}')" style="flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          ${escHtml(trailer.name || 'Trailer')}
        </button>` : ''}
      </div>

      <div class="meta" style="margin-bottom:12px;margin-top:8px">
        <span class="rating">\u2605 ${mDisplayRating(item)}</span>
        <span>\u2022</span>
        <span>${escHtml(mDisplayYear(item))}</span>
        <span>\u2022</span>
        <span>${escHtml(mDisplayGenres(item))}</span>
        ${item._runtime ? `<span>\u2022</span><span>${Math.floor(item._runtime / 60)}h ${item._runtime % 60}m</span>` : ''}
        ${director ? `<span>\u2022</span><span>${escHtml(director)}</span>` : ''}
        ${item._status ? `<span>\u2022</span><span>${escHtml(item._status)}</span>` : ''}
      </div>

      <p>${escHtml(mDisplayOverview(item))}</p>

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

function playFromModal(tmdbId, type) {
  closeModal();
  const item = { tmdb_id: tmdbId, type: type || 'movie' };
  openPlayer(item);
}

function openTVDetail(tmdbId) {
  openPlayer({ tmdb_id: tmdbId, type: 'tv' });
}

/* ── Modal Trailer Autoplay ── */
let _modalYTPlayer = null;

function setupModalTrailer(item) {
  const trailer = item._trailer;
  if (!trailer) return;
  const backdrop = dom.modal.querySelector('.modal-backdrop');
  if (!backdrop) return;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;flex:none;width:100%;aspect-ratio:16/9;z-index:5;overflow:hidden;display:none';
  wrapper.dataset.modalTrailer = '';
  backdrop.parentNode.insertBefore(wrapper, backdrop.nextSibling);
  setTimeout(() => {
    if (!dom.modalOverlay.classList.contains('active')) return;
    backdrop.style.display = 'none';
    wrapper.style.display = 'block';
    wrapper.insertAdjacentHTML('beforeend',
      '<div class="modal-trailer-cover-top"></div>' +
      '<div class="modal-trailer-cover-bottom"></div>' +
      '<button class="browse-card-trailer-mute-btn" style="display:none">🔇</button>'
    );
    _loadCardYTAPI(() => {
      if (!wrapper.isConnected) return;
      const ytDiv = document.createElement('div');
      ytDiv.id = 'modal-yt-' + Date.now();
      wrapper.appendChild(ytDiv);
      try {
        _modalYTPlayer = new YT.Player(ytDiv.id, {
          height: '100%', width: '100%',
          videoId: trailer.key,
          playerVars: {
            autoplay: 1, mute: 1, playsinline: 1,
            controls: 0, rel: 0, modestbranding: 1,
            iv_load_policy: 3, loop: 1, playlist: trailer.key
          },
          events: {
            onReady: (e) => {
              e.target.mute();
              e.target.playVideo();
            }
          }
        });
        const muteBtn = wrapper.querySelector('.browse-card-trailer-mute-btn');
        if (muteBtn) {
          muteBtn.style.display = 'flex';
          muteBtn.dataset.muted = '1';
          muteBtn.onclick = (e) => {
            e.stopPropagation();
            if (!_modalYTPlayer) return;
            if (muteBtn.dataset.muted === '1') {
              _modalYTPlayer.unMute();
              muteBtn.dataset.muted = '0';
              muteBtn.textContent = '🔊';
            } else {
              _modalYTPlayer.mute();
              muteBtn.dataset.muted = '1';
              muteBtn.textContent = '🔇';
            }
          };
        }
      } catch {}
    });
  }, 1000);
}

function destroyModalTrailer() {
  const wrapper = dom.modal?.querySelector('[data-modal-trailer]');
  if (wrapper) wrapper.remove();
  if (_modalYTPlayer) {
    try { _modalYTPlayer.destroy(); } catch {}
    _modalYTPlayer = null;
  }
  const backdrop = dom.modal?.querySelector('.modal-backdrop');
  if (backdrop) backdrop.style.display = '';
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
    mState.genres.map(g => `<option value="${g.id}">${escHtml(g.name)}</option>`).join('');

  let yearHtml = '<option value="">All Years</option>';
  for (let y = currentYear; y >= 1900; y--) yearHtml += `<option value="${y}">${y}</option>`;
  dom.year.innerHTML = yearHtml;

  dom.sort.innerHTML = `
    <option value="popularity.desc">Popularity (High-Low)</option>
    <option value="popularity.asc">Popularity (Low-High)</option>
    <option value="vote_average.desc">Rating (High-Low)</option>
    <option value="vote_average.asc">Rating (Low-High)</option>
    <option value="primary_release_date.desc">Release Date (Newest)</option>
    <option value="primary_release_date.asc">Release Date (Oldest)</option>
    <option value="original_title.asc">Title (A-Z)</option>
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
  mState.filters.with_genres = dom.genre.value;
  mState.filters.primary_release_year = dom.year.value;
  mState.filters.sort_by = dom.sort.value;
  mState.filters['vote_average.gte'] = dom.rating.value;
  mState.filters['vote_count.gte'] = dom.votes.value;
}

function applyFilters() {
  readFilters();
  mState.page = 1;
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
  if (mState.loading) return;
  mState.loading = true;
  dom.loading.style.display = 'flex';
  dom.grid.innerHTML = '';

  const params = new URLSearchParams();
  params.set('page', mState.page);
  Object.entries(mState.filters).forEach(([k, v]) => { if (v) params.set(k, v); });

  try {
    const data = await API.tmdbFetch(`/discover/movie?${params.toString()}`);
    const items = API.resolveTmdbItems(data, 'movie');
    mState.totalPages = Math.min(data.total_pages || 1, 500);
    mState.totalResults = data.total_results || 0;
    renderGrid(items);
    setupCardTrailers();
    renderPagination();
    dom.count.textContent = `${mState.totalResults.toLocaleString()} movies found`;
  } catch {
    dom.grid.innerHTML = '<div class="search-empty"><h3>Failed to load</h3><p>Check your connection and try again.</p></div>';
    dom.pagination.innerHTML = '';
  } finally {
    mState.loading = false;
    dom.loading.style.display = 'none';
  }
}

async function playTrailer(tmdbId, type) {
  try {
    const data = await API.tmdbFetch(`/${type}/${tmdbId}/videos`);
    const videos = data.results || [];
    const trailer = videos.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || videos.find(v => v.site === 'YouTube');
    if (trailer) {
      openTrailer(trailer.key);
    } else {
      alert('No trailer available');
    }
  } catch {
    alert('Failed to load trailer');
  }
}
window.playTrailer = playTrailer;

/* ── View Toggle ── */
function toggleCardView(view) {
  _cardView = view;
  localStorage.setItem('cbemovies_cardview', view);
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  mState.page = 1;
  fetchAndRender();
}

function renderClassicCard(item, tmdbType) {
  const title = escHtml(item.title || '');
  const year = item.year || '';
  const rating = item._rating || (item.rating ? parseFloat(item.rating).toFixed(1) : '0');
  const poster = item._poster || item.poster_url || '';
  const genre = item.genre || '';
  return `
    <div class="movie-card" data-tmdb="${item.tmdb_id}" data-type="${tmdbType}" onclick="${tmdbType === 'movie' ? 'openMovieDetail' : 'openTVDetail'}(${item.tmdb_id})">
      <div class="card-rating">★ ${rating}</div>
      <span class="card-quality hd">HD</span>
      <img class="movie-card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27450%27 fill=%27%231a1a2e%27%3E%3Crect width=%27300%27 height=%27450%27/%3E%3Ctext x=%2750%%25%27 y=%2750%%25%27 text-anchor=%27middle%27 fill=%27%23a0a0b8%27 font-size=%2716%27%3E${title[0] || '?'}%3C/text%3E%3C/svg%3E'">
      <button class="play-btn" onclick="event.stopPropagation();${tmdbType === 'movie' ? 'openMovieDetail' : 'openTVDetail'}(${item.tmdb_id})">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="movie-card-overlay">
        <h3>${title}</h3>
        <div class="meta"><span>${year}</span>${genre ? `<span>${escHtml(genre)}</span>` : ''}</div>
      </div>
    </div>
  `;
}

/* ── Card Trailer Autoplay on Hover ── */
let _cardYTReady = false;
let _cardYTLoading = false;
const _cardPlayers = new Map();

function _loadCardYTAPI(cb) {
  if (_cardYTReady) { if (cb) cb(); return; }
  if (_cardYTLoading) { setTimeout(() => _loadCardYTAPI(cb), 200); return; }
  _cardYTLoading = true;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onload = () => { _cardYTReady = true; _cardYTLoading = false; if (cb) cb(); };
  tag.onerror = () => { _cardYTLoading = false; setTimeout(() => _loadCardYTAPI(cb), 1000); };
  document.head.appendChild(tag);
}
window.onYouTubeIframeAPIReady = () => {
  _cardYTReady = true;
  _cardYTLoading = false;
};

function _initCardTrailer(card) {
  if (_cardPlayers.has(card)) return;
  const tmdbId = card.dataset.tmdb;
  const type = card.dataset.type;
  const wrap = card.querySelector('.browse-card-backdrop-wrap');
  const playerDiv = wrap.querySelector('.browse-card-trailer-player');
  if (!playerDiv) return;
  API.tmdbFetch(`/${type}/${tmdbId}/videos`).then(data => {
    const videos = data.results || [];
    const trailer = videos.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || videos.find(v => v.site === 'YouTube');
    if (!trailer) return;
    _loadCardYTAPI(() => {
      if (!playerDiv.isConnected) return;
      const ytDiv = document.createElement('div');
      ytDiv.id = 'card-yt-' + tmdbId;
      playerDiv.appendChild(ytDiv);
      playerDiv.style.display = 'block';
      const backdrop = wrap.querySelector('.browse-card-backdrop');
      if (backdrop) backdrop.style.opacity = '0';
      let player;
      try {
        player = new YT.Player(ytDiv.id, {
          height: '100%', width: '100%',
          videoId: trailer.key,
          playerVars: {
            autoplay: 1, mute: 1, playsinline: 1,
            controls: 0, rel: 0, modestbranding: 1,
            iv_load_policy: 3, loop: 1, playlist: trailer.key
          },
          events: {
            onReady: (e) => {
              e.target.mute();
              e.target.playVideo();
            }
          }
        });
      } catch {}
      if (!player) return;
      const topCover = wrap.querySelector('.browse-card-trailer-cover-top');
      const bottomCover = wrap.querySelector('.browse-card-trailer-cover-bottom');
      if (topCover) topCover.style.display = 'block';
      if (bottomCover) bottomCover.style.display = 'block';
      _cardPlayers.set(card, { player, playerDiv, backdrop, wrap, key: trailer.key, topCover, bottomCover });
      const muteBtn = wrap.querySelector('.browse-card-trailer-mute-btn');
      if (muteBtn) {
        muteBtn.style.display = 'flex';
        muteBtn.dataset.muted = '1';
        muteBtn.onclick = (e) => {
          e.stopPropagation();
          if (muteBtn.dataset.muted === '1') {
            player.unMute();
            muteBtn.dataset.muted = '0';
            muteBtn.textContent = '🔊';
          } else {
            player.mute();
            muteBtn.dataset.muted = '1';
            muteBtn.textContent = '🔇';
          }
        };
      }
    });
  }).catch(() => {});
}

function _destroyCardPlayer(card) {
  const entry = _cardPlayers.get(card);
  if (!entry) return;
  if (entry.player && entry.player.destroy) entry.player.destroy();
  if (entry.backdrop) entry.backdrop.style.opacity = '1';
  if (entry.playerDiv) {
    entry.playerDiv.innerHTML = '';
    entry.playerDiv.style.display = 'none';
  }
  if (entry.topCover) entry.topCover.style.display = 'none';
  if (entry.bottomCover) entry.bottomCover.style.display = 'none';
  const muteBtn = entry.wrap?.querySelector('.browse-card-trailer-mute-btn');
  if (muteBtn) muteBtn.style.display = 'none';
  _cardPlayers.delete(card);
}

function setupCardTrailers() {
  dom.grid.querySelectorAll('.browse-card').forEach(card => {
    const wrap = card.querySelector('.browse-card-backdrop-wrap');
    if (!wrap || wrap._trailerListeners) return;
    wrap._trailerListeners = true;
    let leaveTimer;
    wrap.addEventListener('mouseenter', () => {
      clearTimeout(leaveTimer);
      _initCardTrailer(card);
    });
    wrap.addEventListener('mouseleave', () => {
      leaveTimer = setTimeout(() => _destroyCardPlayer(card), 500);
    });
  });
}

function renderGrid(items) {
  _cardPlayers.forEach((entry, card) => {
    if (entry.player && entry.player.destroy) entry.player.destroy();
  });
  _cardPlayers.clear();
  if (!items.length) {
    dom.grid.innerHTML = '<div class="search-empty"><h3>No movies found</h3><p>Try adjusting your filters.</p></div>';
    return;
  }
  if (_cardView === 'classic') {
    dom.grid.innerHTML = items.map(item => renderClassicCard(item, 'movie')).join('');
    return;
  }
  dom.grid.innerHTML = items.map((item) => {
    const title = escHtml(item.title || '');
    const year = item.year || '';
    const rating = item._rating || (item.rating ? parseFloat(item.rating).toFixed(1) : '0');
    const poster = item._poster || item.poster_url || '';
    const backdrop = item._backdrop || poster;
    const genre = item.genre || '';
    const overview = escHtml(item._overview || '');
    return `
      <div class="browse-card" data-tmdb="${item.tmdb_id}" data-type="movie" onclick="openMovieDetail(${item.tmdb_id})">
        <div class="card-rating">★ ${rating}</div>
        <span class="card-quality hd">HD</span>
        <div class="browse-card-backdrop-wrap">
          <img class="browse-card-backdrop" src="${backdrop}" alt="${title}" loading="lazy" onerror="this.style.display='none'">
          <div class="browse-card-trailer-player"></div>
          <div class="browse-card-trailer-cover-top"></div>
          <div class="browse-card-trailer-cover-bottom"></div>
          <button class="browse-card-trailer-mute-btn">🔇</button>
          <button class="browse-card-trailer-btn" onclick="event.stopPropagation();playTrailer(${item.tmdb_id},'movie')">▶ Trailer</button>
          <button class="play-btn" onclick="event.stopPropagation();openMovieDetail(${item.tmdb_id})">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <div class="browse-card-body">
          <img class="browse-card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.style.display='none'">
          <div class="browse-card-info">
            <h3>${title}</h3>
            <div class="meta"><span>${year}</span>${genre ? `<span>${escHtml(genre)}</span>` : ''}</div>
            <div class="overview">${overview}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderPagination() {
  if (mState.totalPages <= 1) {
    dom.pagination.innerHTML = '';
    return;
  }
  const total = mState.totalPages;
  const cur = mState.page;
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
  if (p < 1 || p > mState.totalPages || mState.loading) return;
  mState.page = p;
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
  panel.style.cssText = `position:fixed;top:${navH}px;left:0;right:0;z-index:999;background:rgba(10,10,15,0.98);backdrop-filter:blur(20px);border-bottom:1px solid var(--glass-border);padding:16px 24px;animation:fadeInUp .2s ease;display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - ${navH}px);overflow-y:auto;overscroll-behavior:contain`;
  const userLinks = Auth.currentUser && Auth.userDoc ? `
    <hr style="border-color:var(--glass-border);margin:4px 0">
    <a href="profile.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">👤 ${__('Dashboard')}</a>
    <a href="profile.html#settings" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">⚙️ ${__('Settings')}</a>
    <button style="color:#ff4444;font-size:16px;font-weight:500;background:none;border:none;padding:12px 0;cursor:pointer;font-family:inherit;text-align:left" onclick="Auth.logout();window.location.href='index.html'">🚪 ${__('Sign Out')}</button>
  ` : `
    <hr style="border-color:var(--glass-border);margin:4px 0">
    <a href="login.html" style="color:var(--accent);font-size:16px;font-weight:600;text-decoration:none;padding:12px 0">🔑 ${__('Sign In')}</a>
  `;
  panel.innerHTML = `
    <a href="home.html" style="color:var(--text-primary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">${__('Home')}</a>
    <a href="movies.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">${__('Movies')}</a>
    <a href="tv.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">${__('TV Shows')}</a>
    <a href="youtube.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">\uD83C\uDFAC ${__('CBE Movies')}</a>
    <a href="#" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="openSearch();closeMobileNav();return false">${__('Search')}</a>
    ${userLinks}
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
    const viewBtn = e.target.closest('.view-toggle-btn');
    if (viewBtn) toggleCardView(viewBtn.dataset.view);
  });
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === _cardView);
  });
  mState.genres = await API.getMovieGenres();
  populateFilters();
  await fetchAndRender();
  dom.preloader.classList.add('hidden');
})();
