const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

let _cardView = localStorage.getItem('cbemovies_cardview') || 'browse';

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

/* ── View Toggle ── */
function toggleCardView(view) {
  _cardView = view;
  localStorage.setItem('cbemovies_cardview', view);
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  tvState.page = 1;
  fetchAndRender();
}

function renderClassicCard(item, tmdbType) {
  const title = escHtml(item.title || '');
  const year = item.year || '';
  const rating = item._rating || (item.rating ? parseFloat(item.rating).toFixed(1) : '0');
  const poster = item._poster || item.poster_url || '';
  const genre = item.genre || '';
  return `
    <div class="movie-card" data-tmdb="${item.tmdb_id}" data-type="${tmdbType}" onclick="openTVDetail(${item.tmdb_id})">
      <div class="card-rating">★ ${rating}</div>
      <span class="card-quality hd">HD</span>
      <img class="movie-card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27450%27 fill=%27%231a1a2e%27%3E%3Crect width=%27300%27 height=%27450%27/%3E%3Ctext x=%2750%%25%27 y=%2750%%25%27 text-anchor=%27middle%27 fill=%27%23a0a0b8%27 font-size=%2716%27%3E${title[0] || '?'}%3C/text%3E%3C/svg%3E'">
      <button class="play-btn" onclick="event.stopPropagation();openTVDetail(${item.tmdb_id})">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="movie-card-overlay">
        <h3>${title}</h3>
        <div class="meta"><span>${year}</span>${genre ? `<span>${escHtml(genre)}</span>` : ''}</div>
      </div>
    </div>
  `;
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
    _loadCardYTAPI(() => {
      if (!wrapper.isConnected) return;
      const ytDiv = document.createElement('div');
      ytDiv.id = 'modal-yt-' + Date.now();
      wrapper.appendChild(ytDiv);
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
    setupCardTrailers();
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
      const player = new YT.Player(ytDiv.id, {
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
    dom.grid.innerHTML = '<div class="search-empty"><h3>No TV shows found</h3><p>Try adjusting your filters.</p></div>';
    return;
  }
  if (_cardView === 'classic') {
    dom.grid.innerHTML = items.map(item => renderClassicCard(item, 'tv')).join('');
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
      <div class="browse-card" data-tmdb="${item.tmdb_id}" data-type="tv" onclick="openTVDetail(${item.tmdb_id})">
        <div class="card-rating">★ ${rating}</div>
        <span class="card-quality hd">HD</span>
        <div class="browse-card-backdrop-wrap">
          <img class="browse-card-backdrop" src="${backdrop}" alt="${title}" loading="lazy" onerror="this.style.display='none'">
          <div class="browse-card-trailer-player"></div>
          <div class="browse-card-trailer-cover-top"></div>
          <div class="browse-card-trailer-cover-bottom"></div>
          <button class="browse-card-trailer-mute-btn">🔇</button>
          <button class="browse-card-trailer-btn" onclick="event.stopPropagation();playTrailer(${item.tmdb_id},'tv')">▶ Trailer</button>
          <button class="play-btn" onclick="event.stopPropagation();openTVDetail(${item.tmdb_id})">
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
  tvState.genres = await API.getTVGenres();
  populateFilters();
  await fetchAndRender();
  dom.preloader.classList.add('hidden');
})();
