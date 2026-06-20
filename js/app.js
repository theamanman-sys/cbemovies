const state = {
  movies: [],
  tvShows: [],
  allContent: [],
  itemMap: {},
  nextId: 0,
  loading: false,
  currentItem: null,
  enriched: false,
  heroItems: [],
  heroIndex: 0,
  heroTimer: null,
  featuredItems: [],
  heroPaused: false,
  searchTab: 'all',
  currentSeason: 1,
  currentEpisode: 1,
  tvEpisodes: [],
  tvSeasons: [],
  tvLoadingSeason: false,
  playerSimilarItems: null,
  autoPlayNext: true,
  autoPlayTimer: null,
  autoPlayDone: false,
  playerStartTime: 0,
  watchTimerId: null,
  _autoNextFallback: null,
};

const $ = (s, ctx = document) => ctx.querySelector(s);

const dom = {
  hero: $('#hero'),
  heroParallax: $('#hero-parallax'),
  heroContent: $('#hero-content'),
  heroPreview: $('#hero-preview'),
  heroDots: $('#hero-dots'),
  heroTimer: $('#hero-timer'),
  nav: $('#nav'),
  trendingTrack: $('#trending-track'),
  trendingTVTrack: $('#trending-tv-track'),
  nowPlayingTrack: $('#nowplaying-track'),
  latestTrack: $('#latest-track'),
  popularTrack: $('#popular-track'),
  ethiopianTrack: $('#ethiopian-track'),
  featuredGrid: $('#featured-grid'),
  modalOverlay: $('#modal-overlay'),
  modal: $('#modal'),
  searchOverlay: $('#search-overlay'),
  searchInput: $('#search-input'),
  searchResults: $('#search-results'),
  searchTabs: $('#search-tabs'),
  searchSuggestions: $('#search-suggestions'),
  searchDropdown: $('#search-dropdown'),
  playerPage: $('#player-page'),
  playerFrame: $('#player-frame'),
  playerVideo: document.getElementById('player-video'),

  playerSidebarContent: $('#player-sidebar-content'),
  toast: $('#toast'),
  preloader: $('#preloader'),
  trailerModal: $('#trailer-modal'),
  trailerFrame: $('#trailer-frame')
};
window.dom = dom;

function indexItems(items) {
  return items.map(item => {
    if (!item._id) {
      item._id = ++state.nextId;
      state.itemMap[item._id] = item;
    }
    return item;
  });
}

let toastTimer;
function showToast(msg, isError = false) {
  clearTimeout(toastTimer);
  dom.toast.textContent = msg;
  dom.toast.className = 'toast' + (isError ? ' error' : '');
  requestAnimationFrame(() => dom.toast.classList.add('active'));
  toastTimer = setTimeout(() => dom.toast.classList.remove('active'), 3500);
}

/* ── Display Helpers ── */
function posterUrl(item) { return item._poster || item.poster_url || ''; }
function backdropUrl(item) { return item._backdrop || item.poster_url || ''; }
function displayTitle(item) {
  const en = item._tmdbTitle || item.title || __('Untitled');
  if (i18n.current === 'am' && item._amTitle) {
    return `${escHtml(item._amTitle)} <span style="font-size:0.7em;opacity:0.6">(${escHtml(en)})</span>`;
  }
  return escHtml(en);
}
function displayTitleText(item) {
  if (i18n.current === 'am' && item._amTitle) return item._amTitle;
  return item._tmdbTitle || item.title || __('Untitled');
}
function displayEpisodeTitle(ep) {
  const en = ep.name || `${__('Episode')} ${ep.episode_number}`;
  if (i18n.current === 'am' && ep._amName) {
    return `${escHtml(ep._amName)} <span style="font-size:0.7em;opacity:0.6">(${escHtml(en)})</span>`;
  }
  return escHtml(en);
}
function displayEpisodeTitleText(ep) {
  if (i18n.current === 'am' && ep._amName) return ep._amName;
  return ep.name || `${__('Episode')} ${ep.episode_number}`;
}
function displayEpisodeOverview(ep) {
  if (!ep.overview && !ep._amOverview) return '';
  if (i18n.current === 'am' && ep._amOverview) return escHtml(ep._amOverview);
  return escHtml(ep.overview);
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(i18n.current === 'am' ? 'am-ET' : 'en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function displayRating(item) { return item._rating || parseFloat(item.rating || 0).toFixed(1); }
function displayQuality(item) {
  const r = parseFloat(item.rating || item._rating || 0);
  if (r >= 7) return 'HD';
  if (r >= 5) return 'SD';
  return 'CAM';
}
function displayGenres(item) {
  if (item._genres?.length) return item._genres.join(', ');
  return item.genre || __('General');
}
function displayYear(item) { return item._year || item.year || __('N/A'); }
function displayOverview(item) {
  const am = i18n.current === 'am' && item._amOverview;
  return am || item._overview || `${__('Watch')} "${displayTitleText(item)}" ${__('in high definition.')}`;
}

/* ── Hero Carousel ── */
function renderHero(item) {
  if (!item) return;
  const bd = backdropUrl(item);
  dom.heroParallax.style.backgroundImage = bd ? `url(${bd})` : 'none';
  dom.heroParallax.style.backgroundColor = bd ? 'transparent' : '#1a1a2e';

  dom.heroContent.innerHTML = `
    <div class="hero-badge hero-fade">${escHtml(displayGenres(item).split(',')[0] || __('Trending'))}</div>
    <h1 class="hero-title hero-fade">${displayTitle(item)}</h1>
    <div class="hero-meta hero-fade">
      <span class="rating">★ ${displayRating(item)}</span>
      <span class="dot"></span>
      <span class="year">${escHtml(displayYear(item))}</span>
      <span class="dot"></span>
      <span class="genre">${escHtml(displayGenres(item))}</span>
    </div>
    <p class="hero-desc hero-fade">${escHtml(displayOverview(item))}</p>
    <div class="hero-actions hero-fade">
      <button class="btn btn-primary" data-id="${item._id}" data-action="play">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        ${__('Play Now')}
      </button>
      <button class="btn btn-secondary" data-id="${item._id}" data-action="detail">${__('More Info')}</button>
    </div>
  `;
}

function renderHeroDots() {
  const isMobile = window.innerWidth <= 768;
  const total = state.heroItems.length;
  const windowSize = 5;
  if (!isMobile || total <= windowSize) {
    dom.heroDots.innerHTML = state.heroItems.map((_, i) =>
      `<button class="hero-dot ${i === state.heroIndex ? 'active' : ''}" data-hero-index="${i}"></button>`
    ).join('');
    return;
  }
  const half = Math.floor(windowSize / 2);
  let start = state.heroIndex - half;
  let end = start + windowSize;
  if (start < 0) { start = 0; end = windowSize; }
  if (end > total) { end = total; start = total - windowSize; }
  dom.heroDots.innerHTML = Array.from({ length: end - start }, (_, i) => {
    const idx = start + i;
    return `<button class="hero-dot ${idx === state.heroIndex ? 'active' : ''}" data-hero-index="${idx}"></button>`;
  }).join('');
}

function goToHero(index) {
  if (index === state.heroIndex || !state.heroItems.length) return;
  state.heroIndex = index;
  const item = state.heroItems[index];
  if (!item) return;
  renderHero(item);
  renderHeroDots();
  dom.heroPreview.innerHTML = '';
  resetHeroTimer();
}

function nextHero() {
  if (!state.heroItems.length) return;
  state.heroIndex = (state.heroIndex + 1) % state.heroItems.length;
  const item = state.heroItems[state.heroIndex];
  if (item) { renderHero(item); renderHeroDots(); }
  resetHeroTimer();
}

function prevHero() {
  if (!state.heroItems.length) return;
  state.heroIndex = (state.heroIndex - 1 + state.heroItems.length) % state.heroItems.length;
  const item = state.heroItems[state.heroIndex];
  if (item) { renderHero(item); renderHeroDots(); }
  resetHeroTimer();
}

function resetHeroTimer() {
  if (state.heroTimer) clearInterval(state.heroTimer);
  dom.heroTimer.style.width = '100%';
  dom.heroTimer.style.transition = 'none';
  requestAnimationFrame(() => {
    dom.heroTimer.style.transition = 'width 6s linear';
    dom.heroTimer.style.width = '0%';
  });
  state.heroTimer = setInterval(() => { if (!state.heroPaused) nextHero(); }, 6000);
}

function setupHeroCarousel() {
  dom.hero.addEventListener('mouseenter', () => { state.heroPaused = true; dom.heroTimer.style.animationPlayState = 'paused'; });
  dom.hero.addEventListener('mouseleave', () => { state.heroPaused = false; });

  dom.heroDots.addEventListener('click', (e) => {
    const dot = e.target.closest('.hero-dot');
    if (dot) goToHero(parseInt(dot.dataset.heroIndex));
  });

  // Swipe + tap zones
  let touchStartX = 0, swiped = false;
  dom.hero.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    swiped = false;
    state.heroPaused = true;
  }, { passive: true });
  dom.hero.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) > 50) {
      swiped = true;
      dx > 0 ? prevHero() : nextHero();
    }
    state.heroPaused = false;
  }, { passive: true });

  // Tap left/right third of hero to navigate (desktop + mobile fallback)
  dom.hero.addEventListener('click', (e) => {
    if (swiped) { swiped = false; return; }
    if (e.target.closest('.hero-arrow, .hero-dot, .btn, .hero-preview-card')) return;
    const rect = dom.hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) prevHero();
    else if (x > rect.width - third) nextHero();
  });
}

/* ── Parallax ── */
function initParallax() {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrolled = window.pageYOffset;
        const heroH = dom.hero.offsetHeight;
        if (scrolled < heroH) {
          dom.heroParallax.style.transform = `translateY(${scrolled * 0.4}px)`;
        }
        dom.nav.classList.toggle('scrolled', scrolled > 60);
        ticking = false;
      });
      ticking = true;
    }
  });
}

/* ── Preview Cards ── */
function renderHeroPreview(items) {
  dom.heroPreview.innerHTML = items.slice(0, 5).map(item => `
    <div class="hero-preview-card" data-id="${item._id}" data-action="detail">
      <img src="${posterUrl(item)}" alt="${escHtml(displayTitleText(item))}" loading="lazy" onerror="this.parentElement.style.display='none'">
    </div>
  `).join('');
}

/* ── Movie Cards ── */
function renderMovieCards(items, container, { numbered = false } = {}) {
  container.innerHTML = items.map(item => `
    <div class="movie-card" data-id="${item._id}" data-action="detail">
      <div class="card-rating">★ ${displayRating(item)}</div>
      <span class="card-quality ${displayQuality(item).toLowerCase()}">${displayQuality(item)}</span>
      ${numbered ? `<div class="card-number">${String(items.indexOf(item) + 1).padStart(2, '0')}</div>` : ''}
      <img class="movie-card-poster" src="${posterUrl(item)}" alt="${escHtml(displayTitleText(item))}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27450%27 fill=%27%231a1a2e%27%3E%3Crect width=%27300%27 height=%27450%27/%3E%3Ctext x=%2750%%25%27 y=%2750%%25%27 text-anchor=%27middle%27 fill=%27%23a0a0b8%27 font-size=%2716%27%3E${escHtml(displayTitleText(item)[0] || '?')}%3C/text%3E%3C/svg%3E'">
      <button class="play-btn" data-id="${item._id}" data-action="play">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="movie-card-overlay">
        <h3>${displayTitle(item)}</h3>
        <div class="meta"><span>${displayYear(item)}</span><span>${escHtml(displayGenres(item).split(',')[0])}</span></div>
      </div>
    </div>
  `).join('');
}

/* ── Featured ── */
function renderFeatured(items) {
  if (!items.length) return;
  const main = items[0];
  const side = items.slice(1, 3);
  dom.featuredGrid.innerHTML = `
    <div class="featured-item featured-main" data-id="${main._id}" data-action="detail">
      <img src="${posterUrl(main)}" alt="${escHtml(displayTitleText(main))}" loading="lazy">
      <div class="featured-info"><h3>${displayTitle(main)}</h3><p>${escHtml(displayGenres(main))} · ${displayYear(main)} ★ ${displayRating(main)}</p></div>
    </div>
    ${side.map(item => `
      <div class="featured-item" data-id="${item._id}" data-action="detail">
        <img src="${posterUrl(item)}" alt="${escHtml(displayTitleText(item))}" loading="lazy">
        <div class="featured-info"><h3>${displayTitle(item)}</h3><p>${escHtml(displayGenres(item))} · ★ ${displayRating(item)}</p></div>
      </div>
    `).join('')}
  `;
}

/* ── Detail Modal ── */
let _scrollPos = 0;
function lockScroll() {
  _scrollPos = window.pageYOffset;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${_scrollPos}px`;
  document.body.style.width = '100%';
}
function unlockScroll() {
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, _scrollPos);
}

function showDetail(item) {
  state.currentItem = item;
  state.currentSeason = 1;
  state.currentEpisode = 1;
  state.tvEpisodes = [];
  state.tvSeasons = [];
  if (state.autoPlayTimer) { clearTimeout(state.autoPlayTimer); state.autoPlayTimer = null; }
  state.autoPlayDone = false;
  rerenderModal(item);
  dom.modalOverlay.classList.add('active');
  lockScroll();
  setupModalAutoplay(item);

  if (!item._cast && item.tmdb_id && !item._enriching) {
    item._enriching = true;
    API.enrichItem(item).then(enriched => {
      if (enriched && state.currentItem?._id === item._id) {
        Object.assign(item, enriched);
        rerenderModal(item);
        if (item.type === 'tv' && item._seasons) {
          state.tvSeasons = Array.from({ length: item._seasons }, (_, i) => i + 1);
          rerenderModal(item);
        }
        if (!state.autoPlayDone && item._trailer) tryAutoPlayTrailer(item);
        if (i18n.current === 'am' && item.tmdb_id) {
          Translator.translateItem(item).then(() => {
            if (state.currentItem?._id === item._id) rerenderModal(item);
          });
        }
      }
    }).catch(() => {});
  }

  if (item.type === 'tv' && item.tmdb_id) loadTVSeason(item);

  if (i18n.current === 'am' && item.tmdb_id) {
    Translator.translateItem(item).then(() => {
      if (state.currentItem?._id === item._id) rerenderModal(item);
    });
  }
}

function setupModalAutoplay(item) {
  const backdrop = dom.modal.querySelector('.modal-backdrop');
  if (!backdrop) return;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;flex:none;width:100%;aspect-ratio:16/9;z-index:5;overflow:hidden;opacity:0';
  wrapper.dataset.trailerWrapper = '';
  backdrop.parentNode.insertBefore(wrapper, backdrop.nextSibling);
  backdrop.style.display = 'none';
  state._trailerDiv = wrapper;
  state.autoPlayTimer = setTimeout(() => {
    if (state.autoPlayDone || !dom.modalOverlay.classList.contains('active')) return;
    if (!item._trailer) return;
    wrapper.style.opacity = '1';
    tryAutoPlayTrailer(item);
  }, 2000);
}

let _ytReady = typeof YT !== 'undefined' && typeof YT.Player !== 'undefined';
let _ytLoading = false;

function tryAutoPlayTrailer(item) {
  if (state.autoPlayDone || !item?._trailer || !dom.modalOverlay.classList.contains('active')) return;
  let div = state._trailerDiv;
  if (!div) {
    const backdrop = dom.modal.querySelector('.modal-backdrop');
    if (!backdrop) return;
    div = document.createElement('div');
    div.style.cssText = 'position:relative;flex:none;width:100%;aspect-ratio:16/9;z-index:5;overflow:hidden;opacity:0';
    div.dataset.trailerWrapper = '';
    backdrop.parentNode.insertBefore(div, backdrop.nextSibling);
    backdrop.style.display = 'none';
    state._trailerDiv = div;
  }
  if (div.hasAttribute('data-yt-ready')) return;
  state.autoPlayDone = true;
  div.setAttribute('data-yt-ready', '');
  div.insertAdjacentHTML('beforeend', `
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:56px;background:var(--bg-secondary);z-index:2"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(to top,#12121a,#08080c);z-index:2"></div>
    <button class="trailer-mute-btn" data-muted="1" style="position:absolute;bottom:8px;right:8px;z-index:3;width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,148,202,0.25);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;transition:background .2s" title="Unmute">🔇</button>
  `);
  div.style.opacity = '1';
  if (!_ytReady) {
    loadYTAPI(() => createYTPlayer(div, item._trailer.key));
  } else {
    createYTPlayer(div, item._trailer.key);
  }
}
function loadYTAPI(cb) {
  if (_ytReady) { if (cb) cb(); return; }
  if (_ytLoading) { setTimeout(() => loadYTAPI(cb), 200); return; }
  _ytLoading = true;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onload = () => {
    _ytReady = true;
    _ytLoading = false;
    if (cb) cb();
  };
  tag.onerror = () => { _ytLoading = false; setTimeout(() => loadYTAPI(cb), 1000); };
  const first = document.getElementsByTagName('script')[0];
  first.parentNode.insertBefore(tag, first);
}
window.onYouTubeIframeAPIReady = () => {
  _ytReady = true;
  _ytLoading = false;
};
function createYTPlayer(div, key) {
  if (!_ytReady) { setTimeout(() => createYTPlayer(div, key), 200); return; }
  if (!div.isConnected) return;
  if (div._ytPlayer) return;
  const playerDiv = document.createElement('div');
  playerDiv.id = 'yt-trailer-' + Date.now();
  div.insertBefore(playerDiv, div.firstChild);
  const btn = div.querySelector('.trailer-mute-btn');
  div._ytPlayer = new YT.Player(playerDiv.id, {
    height: '100%', width: '100%',
    videoId: key,
    playerVars: {
      autoplay: 1, mute: 1, playsinline: 1,
      controls: 0, rel: 0, modestbranding: 1,
      iv_load_policy: 3, cc_load_policy: 0,
      loop: 1, playlist: key, hl: 'en'
    },
    events: {
      onReady: (e) => {
        e.target.mute();
        e.target.playVideo();
      }
    }
  });
  if (btn) {
    btn.onmouseover = () => { btn.style.background = 'rgba(255,148,202,0.5)'; };
    btn.onmouseout = () => { btn.style.background = 'rgba(255,148,202,0.25)'; };
    btn.onclick = (e) => {
      e.stopPropagation();
      const p = div._ytPlayer;
      if (!p) return;
      if (btn.dataset.muted === '1') {
        p.unMute();
        btn.dataset.muted = '0';
        btn.textContent = '🔊';
        btn.title = 'Mute';
      } else {
        p.mute();
        btn.dataset.muted = '1';
        btn.textContent = '🔇';
        btn.title = 'Unmute';
      }
    };
  }
}
function rerenderModal(item) {
  const trailerEl = dom.modal.querySelector('[data-trailer-wrapper]');
  if (trailerEl) dom.modalOverlay.appendChild(trailerEl);
  renderModalContent(item);
  if (trailerEl) {
    const backdrop = dom.modal.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.parentNode.insertBefore(trailerEl, backdrop.nextSibling);
      backdrop.style.display = 'none';
    }
  }
}

/* ── Person / Celebrity Detail ── */
async function showPersonDetail(personId) {
  const person = await API.fetchPersonDetails(personId);
  if (!person) return showToast(__('Could not load person details'), true);
  renderPersonModal(person);
  dom.modalOverlay.classList.add('active');
  lockScroll();
}

function renderPersonModal(person) {
  const credits = person.combined_credits || {};
  const allCredits = [...(credits.cast || []), ...(credits.crew || [])];
  const uniqueCredits = [];
  const seen = new Set();
  allCredits.forEach(c => {
    const key = c.id + '-' + (c.media_type || 'movie');
    if (!seen.has(key)) { seen.add(key); uniqueCredits.push(c); }
  });
  uniqueCredits.sort((a, b) => (b.release_date || b.first_air_date || '').split('-')[0] - (a.release_date || a.first_air_date || '').split('-')[0]);

  const photo = person.profile_path ? API.imgUrl(person.profile_path, 'h632') : '';
  const birth = person.birthday ? `${person.birthday}${person.place_of_birth ? ` · ${person.place_of_birth}` : ''}` : '';
  const death = person.deathday ? `· ${person.deathday}` : '';

  dom.modal.innerHTML = `
    <button class="modal-close" data-action="close-modal">✕</button>
    <div class="modal-body person-modal">
      <div class="person-header">
        ${photo ? `<img src="${photo}" alt="${escHtml(person.name)}" class="person-photo">` : ''}
        <div>
          <h2>${escHtml(person.name)}</h2>
          ${person.known_for_department ? `<div class="person-dept">${escHtml(person.known_for_department)}</div>` : ''}
          ${birth ? `<div class="person-life">${escHtml(birth)} ${death ? escHtml(death) : ''}</div>` : ''}
          ${person.homepage ? `<a href="${person.homepage}" target="_blank" rel="noopener" class="person-homepage">${__('Website')}</a>` : ''}
        </div>
      </div>
      ${person.biography ? `<div class="person-bio">${escHtml(person.biography)}</div>` : `<div class="person-placeholder">${__('No biography available.')}</div>`}
      <div class="ps-section">
        <h4>${__('Filmography')} (${uniqueCredits.length})</h4>
        <div class="person-credits">
          ${uniqueCredits.slice(0, 50).map(c => {
            const year = (c.release_date || c.first_air_date || '').split('-')[0] || '—';
            const title = c.title || c.name || 'Untitled';
            const role = c.character || c.job || '';
            const poster = c.poster_path ? API.imgUrl(c.poster_path, 'w92') : '';
            return `
              <div class="person-credit" data-tmdb-id="${c.id}" data-media-type="${c.media_type || (c.first_air_date ? 'tv' : 'movie')}">
                ${poster ? `<img src="${poster}" alt="" loading="lazy">` : '<div class="credit-placeholder"></div>'}
                <div>
                  <div class="credit-title">${year} · ${escHtml(title)}</div>
                  ${role ? `<div class="credit-role">${escHtml(role)}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

async function showCompanyMovies(companyId, companyName) {
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'company-results';
  section.innerHTML = `
    <div class="section-header">
      <h2>${escHtml(companyName)}</h2>
    </div>
    <div class="carousel-placeholder">${__('Loading...')}</div>
  `;

  const existing = document.getElementById('company-results');
  if (existing) existing.remove();

  const homeContent = document.getElementById('home-content');
  const playerPage = document.getElementById('player-page');
  if (homeContent) homeContent.style.display = 'none';
  if (playerPage) playerPage.classList.remove('active');
  document.querySelector('.main-nav .nav-item.active')?.classList.remove('active');

  const carousels = document.getElementById('carousels');
  carousels.prepend(section);

  const movies = await API.getCompanyMovies(companyId);
  const indexed = indexItems(movies);

  section.querySelector('.carousel-placeholder').outerHTML = `<div class="carousel" data-carousel="company">${renderCarouselItems(movies, indexed)}</div>`;
  initCarousels();
}

function renderModalContent(item) {
  const cast = item._cast || [];
  const trailer = item._trailer;
  const director = item._director;
  const isTV = item.type === 'tv';

  const truncatedRating = item._voteCount || (item.rating ? `${item.rating}/10` : 'N/A');
  const facts = [
    { label: __('Rating'), value: `★ ${displayRating(item)} (${truncatedRating})` },
    { label: __('Year'), value: displayYear(item) },
    { label: __('Status'), value: item._status || __('—') },
    { label: __('Language'), value: item._originalLanguage || __('—') },
  ];

  if (item._runtime) facts.push({ label: __('Runtime'), value: `${Math.floor(item._runtime / 60)}${__('h')} ${item._runtime % 60}${__('m')}` });
  if (director) facts.push({ label: __('Director'), value: director });
  if (item._popularity) facts.push({ label: __('Popularity'), value: `#${item._popularity}` });
  if (item._budget > 0) facts.push({ label: __('Budget'), value: `$${(item._budget / 1e6).toFixed(0)}M` });
  if (item._revenue > 0) facts.push({ label: __('Revenue'), value: `$${(item._revenue / 1e6).toFixed(0)}M` });
  if (item._contentRating) facts.push({ label: __('Content Rating'), value: item._contentRating });
  if (isTV) {
    if (item._seasons) facts.push({ label: __('Seasons'), value: String(item._seasons) });
    if (item._episodes) facts.push({ label: __('Episodes'), value: String(item._episodes) });
    if (item._networks?.length) facts.push({ label: __('Network'), value: item._networks.join(', ') });
    if (item._createdBy?.length) facts.push({ label: __('Created By'), value: item._createdBy.join(', ') });
  }
  if (item._productionCompanies?.length) {
    const comps = item._productionCompanies.slice(0, 3);
    facts.push({ label: __('Production'), value: comps.map(c => `<span style="color:var(--accent);cursor:pointer" data-company-id="${c.id}" data-company-name="${escHtml(c.name)}">${escHtml(c.name)}</span>`).join(', '), html: true });
  }

  dom.modal.innerHTML = `
    <button class="modal-close" data-action="close-modal">✕</button>
    <img class="modal-backdrop" src="${posterUrl(item)}" alt="${escHtml(displayTitleText(item))}" onerror="this.style.display='none'">
    <div class="modal-body">
      <div class="detail-title-row">
        <div>
          <h2>${displayTitle(item)}</h2>
          ${(item._amTagline || item._tagline) ? `<div style="font-size:14px;color:var(--text-secondary);font-style:italic;margin-top:2px">"${escHtml(i18n.current === 'am' && item._amTagline ? item._amTagline : item._tagline)}"</div>` : ''}
        </div>
        ${trailer ? `<button class="trailer-btn" data-trailer="${trailer.key}" style="flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          ${trailer.name || __('Trailer')}
        </button>` : ''}
      </div>

      <div class="meta" style="margin-bottom:12px;margin-top:8px">
        <span class="rating">★ ${displayRating(item)}</span>
        <span>•</span>
        <span>${escHtml(displayYear(item))}</span>
        <span>•</span>
        <span>${escHtml(displayGenres(item))}</span>
        ${item._runtime ? `<span>•</span><span>${Math.floor(item._runtime / 60)}${__('h')} ${item._runtime % 60}${__('m')}</span>` : ''}
        ${director ? `<span>•</span><span>${escHtml(director)}</span>` : ''}
        ${item._status ? `<span>•</span><span>${escHtml(item._status)}</span>` : ''}
      </div>

      <p>${escHtml(displayOverview(item))}</p>

      ${renderTVSelector()}

      <div class="modal-actions" style="margin-bottom:16px">
        <button class="btn btn-primary" data-id="${item._id}" data-action="play" ${isTV ? `data-season="${state.currentSeason}" data-episode="${state.currentEpisode}"` : ''}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          ${__('Play Now')}
        </button>
        <button class="btn btn-secondary" data-action="close-modal">${__('Close')}</button>
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
          <h4>${__('Cast')} (${cast.length})</h4>
          <div class="cast-scroll">
            ${cast.map(c => `
              <div class="cast-card" data-person-id="${c.id}">
                <img src="${c.photo}" alt="${escHtml(c.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27 fill=%27%231a1a2e%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2732%27/%3E%3Ctext x=%2732%27 y=%2732%27 text-anchor=%27middle%27 dy=%27.3em%27 fill=%27%23a0a0b8%27 font-size=%2718%27%3E${escHtml(c.name[0] || '?')}%3C/text%3E%3C/svg%3E'">
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

function closeModal() {
  if (state.autoPlayTimer) { clearTimeout(state.autoPlayTimer); state.autoPlayTimer = null; }
  state.autoPlayDone = false;
  if (state._trailerDiv) {
    if (state._trailerDiv._ytPlayer) {
      state._trailerDiv._ytPlayer.destroy();
      delete state._trailerDiv._ytPlayer;
    }
    state._trailerDiv.remove();
    state._trailerDiv = null;
  }
  const backdrop = dom.modal.querySelector('.modal-backdrop');
  if (backdrop) backdrop.style.display = '';
  dom.modalOverlay.classList.remove('active');
  unlockScroll();}

const youtubeData = {
  'wvTRae6Awas': { title: 'Fasika (Easter) FCY Ad', description: 'Commercial Bank of Ethiopia Easter celebration advertisement.' },
  '44KofcrAw5I': { title: 'CBE TV Special Easter Program', description: 'Special Easter television program from CBE.' },
  'QFeMChEqrjE': { title: 'CBE TV Program', description: 'Banking services and updates from Commercial Bank of Ethiopia.' },
};

let _tvReqId = 0;

/* ── TV Season / Episode Loaders ── */
async function loadTVSeason(item) {
  if (!item?.tmdb_id) return;
  state.tvLoadingSeason = true;
  const totalSeasons = item._seasons || 1;
  state.tvSeasons = Array.from({ length: totalSeasons }, (_, i) => i + 1);
  state.currentSeason = 1;
  state.currentEpisode = 1;
  await loadTVEpisodes(item, 1);
}

async function loadTVEpisodes(item, seasonNum) {
  if (!item?.tmdb_id) return;
  const reqId = ++_tvReqId;
  state.currentSeason = seasonNum;
  state.currentEpisode = 1;
  const data = await API.fetchTVSeason(item.tmdb_id, seasonNum);
  if (reqId !== _tvReqId) return;
  state.tvEpisodes = (data?.episodes || []).filter(ep => ep.episode_number > 0);
  state.tvLoadingSeason = false;
  if (i18n.current === 'am') await Translator.translateEpisodes(item, state.tvEpisodes);
  if (state.currentItem?._id === item._id) rerenderModal(item);
}

function renderTVSelector() {
  const item = state.currentItem;
  if (!item || item.type !== 'tv') return '';

  if (state.tvLoadingSeason) {
    return `<div class="tv-selector"><div class="episode-loading">${__('Loading episodes...')}</div></div>`;
  }

  if (!state.tvSeasons.length) return '';

  return `
    <div class="tv-selector">
      <div class="tv-selector-header">
        <select class="tv-select" data-tv-action="season-change">
          ${state.tvSeasons.map(s => `<option value="${s}" ${s === state.currentSeason ? 'selected' : ''}>${__('Season')} ${s}</option>`).join('')}
        </select>
        <span style="font-size:13px;color:var(--text-secondary)">${state.tvEpisodes.length} ${__('Episodes').toLowerCase()}</span>
      </div>
      ${state.tvEpisodes.length ? `
      <div class="episode-grid">
        ${state.tvEpisodes.map(ep => `
          <div class="episode-item ${ep.episode_number === state.currentEpisode ? 'active' : ''}" data-tv-action="episode-select" data-tv-episode="${ep.episode_number}">
            ${ep.still_path ? `<img class="episode-still" src="${API.imgUrl(ep.still_path, 'w185')}" alt="" loading="lazy">` : ''}
            <div class="episode-num">${ep.episode_number}</div>
            <div class="episode-info">
              <div class="episode-title">${displayEpisodeTitle(ep)}</div>
              <div class="episode-meta">${ep.air_date ? formatDate(ep.air_date) : ''}${ep.runtime ? ` · ${ep.runtime}${__('m')}` : ''}${ep.vote_average && ep.vote_average > 0 ? ` · ★ ${ep.vote_average.toFixed(1)}` : ''}</div>
              ${ep.overview || ep._amOverview ? `<div class="episode-overview">${displayEpisodeOverview(ep)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      ` : `<div class="episode-loading">${__('No episodes available')}</div>`}
    </div>
  `;
}

/* ── Trailer Modal ── */
function openTrailer(key) {
  const url = `https://www.youtube.com/embed/${key}?autoplay=1&muted=1&playsinline=1&controls=0&rel=0&iv_load_policy=3&cc_load_policy=0&enablejsapi=1`;
  dom.trailerFrame.onload = () => {
    try { dom.trailerFrame.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*'); } catch {}
    dom.trailerFrame.onload = null;
  };
  dom.trailerFrame.src = url;
  dom.trailerModal.classList.add('active');
  lockScroll();
}

function closeTrailer() {
  dom.trailerFrame.src = '';
  dom.trailerModal.classList.remove('active');
  unlockScroll();
}

/* ── YouTube Detail Modal ── */
function showYouTubeDetail(videoId) {
  const data = youtubeData[videoId];
  if (!data) return;
  dom.modal.innerHTML = `
    <button class="modal-close" data-action="close-modal">✕</button>
    <img class="modal-backdrop" src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg" alt="${escHtml(data.title)}" onerror="this.style.display='none'">
    <div class="modal-body">
      <div class="detail-title-row">
        <h2>${escHtml(data.title)}</h2>
      </div>
      <p>${escHtml(data.description)}</p>
      <div class="modal-actions">
        <button class="btn btn-primary" data-youtube-play="${videoId}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          ${__('Play Video')}
        </button>
        <button class="btn btn-secondary" data-action="close-modal">${__('Close')}</button>
      </div>
    </div>
  `;
  dom.modalOverlay.classList.add('active');
  lockScroll();
}

/* ── YouTube Player ── */
function openYouTubePlayer(videoId) {
  const frame = document.getElementById('youtube-frame');
  const modal = document.getElementById('youtube-modal');
  if (!frame || !modal) return;
  frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&muted=1&playsinline=1&rel=0`;
  modal.classList.add('active');
  lockScroll();
}

function closeYouTubePlayer() {
  const frame = document.getElementById('youtube-frame');
  const modal = document.getElementById('youtube-modal');
  if (frame) frame.src = '';
  if (modal) modal.classList.remove('active');
  unlockScroll();}

/* ── Player ── */
let _currentPlayerUrl = '';
let _expectedIframeNav = false;

if (dom.playerFrame) {
  dom.playerFrame.addEventListener('load', () => {
    if (_expectedIframeNav) { _expectedIframeNav = false; return; }
    if (!_currentPlayerUrl) return;
    // Cinezo navigated internally (next-ep button, autonext) — advance our state too
    if (state.currentItem?.type === 'tv') {
      _expectedIframeNav = true; // prevent re-entrancy from playItem's src=''
      nextEpisode();
      return;
    }
    _expectedIframeNav = true;
    dom.playerFrame.src = _currentPlayerUrl;
  });
}

function playItem(item, season = 1, episode = 1) {
  if (!item) return showToast(__('No media selected'), true);
  if (!Auth.currentUser || !Auth.canAccessContent(Auth.userDoc)) {
    showToast(__('Subscribe to watch'), true);
    setTimeout(() => window.location.href = 'profile.html#subscription', 1500);
    return;
  }
  state.currentItem = item;
  state.currentSeason = season;
  state.currentEpisode = episode;
  state.playerSimilarItems = null;
  state._autoPlayTriggered = false;
  subtitleState.currentLang = null;
  subtitleState.available = [];
  hideSubtitleOverlay();
  cancelAutoNext();
  subState.autoNextDismissed = false;
  subState.cues = [];
  subState.currentTime = 0;
  subState.gotEvent = false;
  subState.fallbackStart = 0;
  subState.duration = 0;
  subState.saveCounter = 0;
  dom.playerFrame.src = '';
  const savedPos = loadSubPos(item.imdb_id || '');
  _currentPlayerUrl = API.getPlayerUrl(item, season, episode, savedPos);
  state.playerStartTime = 0;
  setTimeout(() => {
    _expectedIframeNav = true;
    dom.playerFrame.src = _currentPlayerUrl;
    state.playerStartTime = performance.now();
  }, 50);
  const nextBtn = document.getElementById('substep-next-btn');
  if (nextBtn) nextBtn.style.display = item.type === 'tv' ? '' : 'none';
  if (item.type === 'tv') {
    if (state.watchTimerId) { clearInterval(state.watchTimerId); state.watchTimerId = null; }
    state.watchTimerId = setInterval(watchLoop, 1000);
    scheduleAutoNextFallback(item, season, episode);
  }
  dom.playerPage.classList.remove('hidden');
  lockScroll();
  renderPlayerSidebar(item);
  listenPlayerProgress();
  setupSubtitleIdle();
  loadPlayerSimilar(item);
  loadSubtitles(item);
  if (item.type === 'tv' && item.tmdb_id) {
    API.fetchTVSeason(item.tmdb_id, season).then(data => {
      const eps = (data?.episodes || []).filter(ep => ep.episode_number > 0);
      if (eps.length) {
        state.tvEpisodes = eps;
        state.currentSeason = season;
        if (i18n.current === 'am') Translator.translateEpisodes(item, eps);
        // Re-evaluate fallback now that we have runtime data
        if (state._autoNextFallback) {
          scheduleAutoNextFallback(item, season, episode);
        }
      }
    });
  }
  if (!item._cast && item.tmdb_id && !item._enriching) {
    item._enriching = true;
    API.enrichItem(item).then(enriched => {
      if (enriched && state.currentItem?._id === item._id) {
        Object.assign(item, enriched);
        renderPlayerSidebar(item);
        if (i18n.current === 'am' && item.tmdb_id) {
          Translator.translateItem(item).then(() => {
            if (state.currentItem?._id === item._id) renderPlayerSidebar(item);
          });
        }
      }
    }).catch(() => {});
  }

  if (i18n.current === 'am' && item.tmdb_id) {
    Translator.translateItem(item).then(() => {
      if (state.currentItem?._id === item._id) renderPlayerSidebar(item);
    });
  }
}

function closePlayer() {
  dom.playerFrame.src = '';
  _currentPlayerUrl = '';
  _expectedIframeNav = false;
  subtitleState.currentLang = null;
  subtitleState.available = [];
  hideSubtitleOverlay();
  subState.cues = [];
  subState.currentTime = 0;
  subState.gotEvent = false;
  subState.fallbackStart = 0;
  subState.duration = 0;
  state.playerStartTime = 0;
  if (state.watchTimerId) { clearInterval(state.watchTimerId); state.watchTimerId = null; }
  if (state._autoNextFallback) { clearTimeout(state._autoNextFallback); state._autoNextFallback = null; }
  cancelAutoNext();
  const subBtn = document.getElementById('subtitle-btn');
  if (subBtn) { subBtn.textContent = 'CC'; subBtn.classList.remove('active'); }
  dom.playerPage.classList.add('hidden');
  unlockScroll();  state.playerSimilarItems = null;
  if (dom.playerPage._messageHandler) window.removeEventListener('message', dom.playerPage._messageHandler);
  dom.playerPage.querySelector('.player-sidebar')?.classList.remove('mobile-open');
  dom.playerPage.querySelector('.player-sidebar-overlay')?.remove();
}

/* ── Subtitle System ── */
let subtitleState = {
  currentLang: null,
  available: [],
  saved: [],
};

/* ── Subtitle overlay synced via fallback timer + user steps ── */
const subState = {
  cues: [],          // [{s,e,t}] parsed VTT cues
  currentTime: 0,    // fallback timer (elapsed since subtitle load) + user nudges
  timerId: null,
  idleTimer: null,   // mouse idle timeout for auto-hide
  fallbackStart: 0,  // performance.now() when fallback timer started
  gotEvent: false,   // always false (Cinezo doesn't send progress events)
  duration: 0,       // total subtitle duration (last cue end time)
  saveCounter: 0,    // frame counter for periodic position save
  autoNextCountdown: null, // seconds until next episode auto-plays (or null)
  autoNextTimer: null,     // interval ID for countdown
  autoNextDismissed: false, // true if user dismissed the banner
};

function parseVTT(text) {
  const cues = [];
  const lines = text.split('\n');
  let cue = null;
  for (const line of lines) {
    const m = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (m) {
      if (cue) cues.push(cue);
      cue = { s: +m[1]*3600 + +m[2]*60 + +m[3] + +m[4]/1000, e: +m[5]*3600 + +m[6]*60 + +m[7] + +m[8]/1000, t: '' };
    } else if (cue && line.trim() && !line.startsWith('WEBVTT') && !line.startsWith('NOTE')) {
      cue.t += (cue.t ? '\n' : '') + line.trim();
    }
  }
  if (cue) cues.push(cue);
  return cues;
}

function parseSRT(text) {
  const cues = [];
  const blocks = text.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;
    const timeIdx = lines.findIndex(l => l.includes('-->'));
    if (timeIdx === -1) continue;
    const [start, end] = lines[timeIdx].split('-->').map(t => t.trim().replace(/,/g, '.'));
    const s = parseSRTTime(start);
    const e = parseSRTTime(end);
    const t = lines.slice(timeIdx + 1).join('\n').trim();
    if (t && !isNaN(s) && !isNaN(e)) cues.push({ s, e, t });
  }
  return cues;
}

function parseSRTTime(t) {
  const parts = t.split(':');
  if (parts.length < 2) return 0;
  const secs = parts[parts.length - 1];
  const mins = parts[parts.length - 2];
  const hrs = parts.length > 2 ? parts[0] : '0';
  return +hrs * 3600 + +mins * 60 + +secs;
}

function saveSubPos(imdb, time) {
  try { localStorage.setItem(`sub_pos_${imdb}`, Math.floor(time)); } catch {}
}

function loadSubPos(imdb) {
  try { const v = localStorage.getItem(`sub_pos_${imdb}`); return v ? +v : 0; } catch { return 0; }
}

function clearSubPos(imdb) {
  try { localStorage.removeItem(`sub_pos_${imdb}`); } catch {}
}

function tryReadVideoTime() {
  try {
    const video = dom.playerFrame?.contentDocument?.querySelector('video');
    if (video && typeof video.currentTime === 'number' && isFinite(video.currentTime)) {
      subState.currentTime = video.currentTime;
      subState.fallbackStart = performance.now() - subState.currentTime * 1000;
      return true;
    }
  } catch (e) {}
  return false;
}

function subLoop() {
  if (!subState.cues.length) { subState.timerId = null; return; }
  if (!subState.gotEvent) {
    if (!tryReadVideoTime() && subState.fallbackStart) {
      subState.currentTime = (performance.now() - subState.fallbackStart) / 1000;
    }
  }
  let text = '';
  for (const c of subState.cues) {
    if (subState.currentTime >= c.s && subState.currentTime < c.e) { text = c.t; break; }
  }
  const el = document.getElementById('subtitle-text');
  if (el) el.textContent = text;
  const dbg = document.getElementById('subtitle-debug');
  if (dbg) {
    dbg.textContent = text ? `[${text.length}ch] ${text.slice(0, 30)}` : '';
  }
  const timeEl = document.getElementById('subtitle-time');
  if (timeEl) {
    const t = subState.currentTime;
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    timeEl.textContent = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  updateSubProgress(subState.currentTime);
  subState.saveCounter++;
  if (subState.saveCounter % 150 === 0) {
    const imdb = state.currentItem?.imdb_id;
    if (imdb) saveSubPos(imdb, subState.currentTime);
  }

  /* ── Autoplay next episode ── */
  subState.timerId = requestAnimationFrame(subLoop);
}

/* ── Wall-clock watch loop for TV autoplay (runs even without subtitles) ── */
function getWatchTime() {
  if (subState.timerId && subState.fallbackStart) {
    return subState.currentTime;
  }
  return state.playerStartTime ? (performance.now() - state.playerStartTime) / 1000 : 0;
}

function getWatchDuration() {
  if (subState.duration > 0) return subState.duration;
  const item = state.currentItem;
  if (item?.type === 'tv') {
    const ep = state.tvEpisodes?.find(e => e.episode_number === state.currentEpisode);
    if (ep?.runtime) return ep.runtime * 60;
    if (item._runtime) return item._runtime * 60;
  }
  return 45 * 60;
}

function scheduleAutoNextFallback(item, season, episode) {
  if (state._autoNextFallback) { clearTimeout(state._autoNextFallback); state._autoNextFallback = null; }
  let fallbackMs = 27 * 60 * 1000; // 27 min default (covers most 20-25min episodes)
  if (item._runtime) fallbackMs = (item._runtime + 2) * 60 * 1000;
  const ep = state.tvEpisodes?.find(e => e.episode_number === episode);
  if (ep?.runtime) fallbackMs = (ep.runtime + 2) * 60 * 1000;
  state._autoNextFallback = setTimeout(() => {
    if (!state.autoPlayNext || state.currentItem?._id !== item._id) return;
    if (subState.autoNextCountdown === null && !subState.autoNextDismissed) {
      startAutoNextCountdown(10);
    }
  }, fallbackMs);
}

function watchLoop() {
  try {
    if (!state.currentItem || state.currentItem.type !== 'tv') {
      if (state.watchTimerId) { clearInterval(state.watchTimerId); state.watchTimerId = null; }
      return;
    }
    if (!state.autoPlayNext) return;
    const time = getWatchTime();
    const dur = getWatchDuration();
    if (dur <= 0) return;
    // Fallback: 15s past expected end — Cinezo's internal autonext should have fired by now
    const pastEnd = time >= dur + 15;
    const beforeEnd = time < dur - 10;
    if (pastEnd && subState.autoNextCountdown === null && !subState.autoNextDismissed) {
      startAutoNextCountdown(5);
    } else if (beforeEnd) {
      if (subState.autoNextCountdown !== null || subState.autoNextDismissed) {
        subState.autoNextDismissed = false;
        cancelAutoNext();
      }
    }
  } catch (e) { console.error('watchLoop err', e); }
}

function startAutoNextCountdown(seconds) {
  subState.autoNextCountdown = seconds;
  updateAutoNextBanner();
  if (subState.autoNextTimer) clearInterval(subState.autoNextTimer);
  subState.autoNextTimer = setInterval(() => {
    subState.autoNextCountdown--;
    updateAutoNextBanner();
    if (subState.autoNextCountdown <= 0) {
      clearInterval(subState.autoNextTimer);
      subState.autoNextTimer = null;
      subState.autoNextCountdown = null;
      nextEpisode();
    }
  }, 1000);
}

function cancelAutoNext() {
  if (subState.autoNextTimer) {
    clearInterval(subState.autoNextTimer);
    subState.autoNextTimer = null;
  }
  subState.autoNextCountdown = null;
  const banner = document.getElementById('subtitle-next-banner');
  if (banner) banner.classList.add('hidden');
}

function dismissAutoNext() {
  subState.autoNextDismissed = true;
  cancelAutoNext();
}

function updateAutoNextBanner() {
  const banner = document.getElementById('subtitle-next-banner');
  const countdown = document.getElementById('subtitle-next-countdown');
  const text = document.getElementById('subtitle-next-text');
  if (!banner || !countdown || !text) return;
  if (subState.autoNextCountdown === null) {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  countdown.textContent = subState.autoNextCountdown + 's';
  const item = state.currentItem;
  if (item?.type === 'tv') {
    const idx = state.tvEpisodes.findIndex(ep => ep.episode_number === state.currentEpisode);
    const next = idx !== -1 && idx < state.tvEpisodes.length - 1 ? state.tvEpisodes[idx + 1]
      : state.currentSeason < (item._seasons || 1) ? { episode_number: 1, name: `Season ${state.currentSeason + 1} Episode 1` } : null;
    text.textContent = next ? `Next: ${displayEpisodeTitleText(next)}` : 'Next Episode';
  } else {
    text.textContent = 'Next Episode';
  }
}

function updateSubProgress(time) {
  const fill = document.getElementById('subtitle-progress-fill');
  const thumb = document.getElementById('subtitle-progress-thumb');
  if (!fill || !thumb) return;
  const dur = subState.duration || 1;
  const pct = Math.min(100, Math.max(0, (time / dur) * 100));
  fill.style.width = pct + '%';
  thumb.style.left = pct + '%';
}

function setupSubProgress() {
  const track = document.getElementById('subtitle-progress-track');
  if (!track) return;

  let dragging = false;

  const seekFromEvent = (clientX) => {
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dur = subState.duration || 1;
    subState.currentTime = pct * dur;
    subState.fallbackStart = performance.now() - subState.currentTime * 1000;
    subState.gotEvent = false;
    const imdb = state.currentItem?.imdb_id;
    if (imdb) saveSubPos(imdb, subState.currentTime);
    updateSubProgress(subState.currentTime);
    cancelAutoNext();
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    dragging = true;
    track.setPointerCapture(e.pointerId);
    seekFromEvent(e.clientX);
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    if (dragging) seekFromEvent(e.clientX);
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    track.releasePointerCapture(e.pointerId);
    seekFromEvent(e.clientX);
  };

  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', onPointerUp);
  track.addEventListener('pointerleave', (e) => {
    if (dragging) { dragging = false; track.releasePointerCapture(e.pointerId); }
  });
}

function showSubtitleOverlay() {
  const ov = document.getElementById('subtitle-overlay');
  if (!ov) return;
  ov.classList.remove('hidden');
  ov.classList.remove('idle');
  startSubtitleIdleTimer();
}

function startSubtitleIdleTimer() {
  if (subState.idleTimer) clearTimeout(subState.idleTimer);
  subState.idleTimer = setTimeout(() => {
    const ov = document.getElementById('subtitle-overlay');
    if (ov && !ov.classList.contains('hidden')) ov.classList.add('idle');
  }, 3000);
}

function setupSubtitleIdle() {
  const container = document.querySelector('.player-container');
  if (!container || container._subtitleIdleSetup) return;
  container._subtitleIdleSetup = true;
  container.addEventListener('mousemove', () => {
    const ov = document.getElementById('subtitle-overlay');
    if (!ov || ov.classList.contains('hidden')) return;
    ov.classList.remove('idle');
    startSubtitleIdleTimer();
  });
}

function hideSubtitleOverlay() {
  if (subState.timerId) { cancelAnimationFrame(subState.timerId); subState.timerId = null; }
  if (subState.idleTimer) { clearTimeout(subState.idleTimer); subState.idleTimer = null; }
  const ov = document.getElementById('subtitle-overlay');
  if (ov) ov.classList.add('hidden');
  const el = document.getElementById('subtitle-text');
  if (el) el.textContent = '';
  const fill = document.getElementById('subtitle-progress-fill');
  if (fill) fill.style.width = '0%';
  const thumb = document.getElementById('subtitle-progress-thumb');
  if (thumb) thumb.style.left = '0%';
}

async function loadSubtitles(item) {
  let imdb = item.imdb_id || '';
  if (!imdb && item.tmdb_id) {
    imdb = await API.fetchImdbId(item.tmdb_id, item.type) || '';
    if (imdb) item.imdb_id = imdb;
  }
  const list = document.getElementById('subtitle-list');
  const btn = document.getElementById('subtitle-btn');
  if (!list || !btn) return;

  list.innerHTML = '<div class="subtitle-menu-item" style="cursor:default;opacity:0.5">Loading...</div>';

  // Load saved subtitles from IndexedDB
  if (typeof getSubtitlesByImdb === 'function') {
    try {
      const saved = await getSubtitlesByImdb(imdb);
      subtitleState.saved = saved.map(s => ({ code: s.lang, lang: s.label, _internal: true }));
    } catch { subtitleState.saved = []; }
  } else {
    subtitleState.saved = [];
  }

  try {
    const res = await fetch(`/api/subtitle?imdb=${encodeURIComponent(imdb)}&list=1`);
    const data = await res.json();
    if (data.success && data.subtitles?.length) {
      subtitleState.available = data.subtitles;
    } else {
      subtitleState.available = [];
    }
  } catch {
    subtitleState.available = [];
  }
  renderSubtitleMenu();
}

function renderSubtitleMenu() {
  const list = document.getElementById('subtitle-list');
  const footer = document.getElementById('subtitle-footer');
  if (!list) return;

  const hasActive = subtitleState.currentLang !== null;
  const amActive = subtitleState.currentLang === 'am';

  let html = '';
  html += `<button class="subtitle-menu-item${!hasActive ? ' active' : ''}" onclick="selectSubtitle('off')"><span class="check">✓</span><span class="label">Off</span></button>`;
  html += `<button class="subtitle-menu-item${amActive ? ' active' : ''}" onclick="selectSubtitle('translate')"><span class="check">✓</span><span class="label">🇪🇹 Amharic (ትርጉም)</span></button>`;

  const savedItems = subtitleState.saved || [];
  if (savedItems.length) {
    html += '<div class="subtitle-menu-header" style="font-size:11px;padding:6px 14px">Saved</div>';
    savedItems.forEach(sub => {
      const active = subtitleState.currentLang === sub.code;
      const label = sub.label || sub.lang.toUpperCase();
      html += `<button class="subtitle-menu-item${active ? ' active' : ''}" onclick="selectSubtitle('saved:${sub.code}')"><span class="check">✓</span><span class="label">💾 ${label}</span></button>`;
    });
  }

  if (subtitleState.available.length > 0) {
    html += '<div class="subtitle-menu-header" style="font-size:11px;padding:6px 14px">Online</div>';
    subtitleState.available.forEach(sub => {
      const active = subtitleState.currentLang === sub.code;
      html += `<button class="subtitle-menu-item${active ? ' active' : ''}" onclick="selectSubtitle('${sub.code}')"><span class="check">✓</span><span class="label">${sub.lang}</span></button>`;
    });
  } else if (!savedItems.length) {
    html += '<div class="subtitle-menu-item" style="cursor:default;opacity:0.4;font-size:12px">No subtitles available</div>';
  }

  list.innerHTML = html;
  if (footer) footer.innerHTML = '';
}

async function selectSubtitle(lang) {
  if (lang === 'off') {
    subtitleState.currentLang = null;
    document.getElementById('subtitle-btn').textContent = 'CC';
    document.getElementById('subtitle-btn').classList.remove('active');
    const imdb = state.currentItem?.imdb_id;
    if (imdb) clearSubPos(imdb);
    renderSubtitleMenu();
    closeSubtitleMenu();
    hideSubtitleOverlay();
    return;
  }

  const btn = document.getElementById('subtitle-btn');
  btn.textContent = '...';
  btn.classList.add('active');

  const item = state.currentItem;
  let imdb = item?.imdb_id || '';
  if (!imdb && item?.tmdb_id) {
    imdb = await API.fetchImdbId(item.tmdb_id, item.type) || '';
    if (imdb) item.imdb_id = imdb;
  }
  if (!imdb) {
    showToast('No IMDB ID for subtitles', true);
    btn.textContent = 'CC';
    btn.classList.remove('active');
    return;
  }

  const isSaved = lang.startsWith('saved:');
  const langCode = isSaved ? lang.slice(6) : (lang === 'translate' ? 'am' : lang);

  try {
    let vtt;
    let needsProgressiveTranslate = false;

    if (isSaved) {
      if (typeof getSubtitle === 'function') {
        const saved = await getSubtitle(imdb, langCode);
        if (saved) vtt = saved.vtt;
      }
      if (!vtt) {
        showToast('Saved subtitle not found', true);
        btn.textContent = 'CC';
        btn.classList.remove('active');
        return;
      }
    } else {
      // Check IndexedDB cache first
      if (typeof getSubtitle === 'function') {
        const cached = await getSubtitle(imdb, langCode);
        if (cached) vtt = cached.vtt;
      }

      if (!vtt) {
        // For Amharic, fetch English VTT (fast) and translate progressively on client
        const fetchLang = lang === 'translate' ? 'en' : langCode;
        const url = `/api/subtitle?imdb=${encodeURIComponent(imdb)}&lang=${fetchLang}&from=en`;
        const res = await fetch(url);
        if (!res.ok) {
          showToast(`Subtitles unavailable (${res.status})`, true);
          btn.textContent = 'CC';
          btn.classList.remove('active');
          return;
        }
        vtt = await res.text();

        if (lang === 'translate') needsProgressiveTranslate = true;
      }
    }
    const cues = parseVTT(vtt);
    if (!cues.length) {
      showToast('No subtitle cues found', true);
      btn.textContent = 'CC';
      btn.classList.remove('active');
      return;
    }

    // Restore saved position for this movie
    subtitleState.currentLang = langCode;
    const label = lang === 'translate' ? 'አማ'
      : (subtitleState.available.find(s => s.code === langCode)?.lang || langCode.toUpperCase().slice(0, 3));
    btn.textContent = label;

    subState.cues = cues;
    subState.duration = cues.reduce((max, c) => Math.max(max, c.e), 0);
    subState.gotEvent = false;
    if (state.playerStartTime) {
      subState.currentTime = (performance.now() - state.playerStartTime) / 1000;
      subState.fallbackStart = state.playerStartTime;
    } else {
      subState.currentTime = 0;
      subState.fallbackStart = performance.now();
    }
    // Restore saved position — overrides smart timer on page reload
    const savedPos = loadSubPos(imdb);
    if (savedPos > 0 && savedPos < subState.duration) {
      subState.currentTime = savedPos;
      subState.fallbackStart = performance.now() - savedPos * 1000;
      subState.gotEvent = false;
    }
    tryReadVideoTime();
    showSubtitleOverlay();
    setupSubProgress();
    subLoop();
    renderSubtitleMenu();
    closeSubtitleMenu();

    if (needsProgressiveTranslate) {
      showToast(`Translating ${cues.length} cues to Amharic...`);
      translateAllCues(imdb, cues).then(fullVtt => {
        if (fullVtt && typeof saveSubtitle === 'function') {
          saveSubtitle(imdb, 'am', fullVtt, '🇪🇹 Amharic').catch(() => {});
        }
      });
    } else {
      showToast(`Subtitles: ${label}`);
    }
  } catch (err) {
    showToast('Failed to load subtitles', true);
    btn.textContent = 'CC';
    btn.classList.remove('active');
  }
}

async function translateAllCues(imdb, cues) {
  let translated = 0;
  const total = cues.length;
  const concurrency = 10;
  const queue = cues.filter(c => c.t && c.t !== '');

  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency);
    await Promise.all(batch.map(async (cue) => {
      try {
        const res = await fetch('/api/subtitle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cue.t.slice(0, 500), from: 'en', target: 'am' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.translatedText && data.translatedText !== cue.t) {
            cue.t = data.translatedText;
            translated++;
          }
        }
      } catch {}
    }));
  }

  if (translated > 0) {
    subState.cues = cues;
    showToast(`Translated ${translated}/${total} cues`);
    return entriesToVtt(cues);
  }
  return null;
}

function entriesToVtt(cues) {
  let vtt = 'WEBVTT\n\n';
  for (const c of cues) {
    if (!c.t) continue;
    const s = formatVTTTime(c.s);
    const e = formatVTTTime(c.e);
    vtt += `${s} --> ${e}\n${c.t}\n\n`;
  }
  return vtt;
}

function formatVTTTime(t) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(3).padStart(6, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s}`;
}

async function translateSubtitles() {
  await selectSubtitle('translate');
}

async function uploadSubtitleFile(file) {
  const raw = await file.text();
  const imdb = state.currentItem?.imdb_id || '';
  const btn = document.getElementById('subtitle-btn');
  if (!btn) return;
  btn.textContent = '...';
  btn.classList.add('active');

  // Parse SRT client-side
  const cues = parseSRT(raw);
  if (!cues.length) {
    showToast('No subtitle cues found in file', true);
    btn.textContent = 'CC';
    btn.classList.remove('active');
    return;
  }

  subtitleState.currentLang = 'am';
  btn.textContent = 'አማ';

  subState.cues = cues;
  subState.duration = cues.reduce((max, c) => Math.max(max, c.e), 0);
  subState.gotEvent = false;
  if (state.playerStartTime) {
    subState.currentTime = (performance.now() - state.playerStartTime) / 1000;
    subState.fallbackStart = state.playerStartTime;
  } else {
    subState.currentTime = 0;
    subState.fallbackStart = performance.now();
  }
  tryReadVideoTime();
  showSubtitleOverlay();
  setupSubProgress();
  subLoop();
  showToast('Translating uploaded subtitles...');

  translateAllCues(imdb, cues).then(fullVtt => {
    if (fullVtt && typeof saveSubtitle === 'function') {
      saveSubtitle(imdb, 'am', fullVtt, '📁 Uploaded (Amharic)').catch(() => {});
    }
    renderSubtitleMenu();
  });
}

function setupSubtitleUpload() {
  const input = document.getElementById('srt-upload-input');
  if (input) {
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) uploadSubtitleFile(file);
      input.value = '';
    });
  }
}

function toggleSubtitleMenu() {
  const menu = document.getElementById('subtitle-menu');
  if (!menu) return;
  const hidden = menu.classList.toggle('hidden');
  if (!hidden) renderSubtitleMenu();
}

function closeSubtitleMenu() {
  const menu = document.getElementById('subtitle-menu');
  if (menu) menu.classList.add('hidden');
}

function subStep(delta) {
  if (!subState.cues.length) return;
  cancelAutoNext();
  tryReadVideoTime();
  subState.currentTime = Math.max(0, subState.currentTime + delta);
  if (!subState.gotEvent && subState.fallbackStart) {
    subState.fallbackStart = performance.now() - subState.currentTime * 1000;
  }
  const imdb = state.currentItem?.imdb_id;
  if (imdb) saveSubPos(imdb, subState.currentTime);
  if (!subState.timerId) subLoop();
}

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'd') {
    const ov = document.getElementById('subtitle-overlay');
    if (ov && !ov.classList.contains('hidden')) ov.classList.toggle('show-debug');
    return;
  }
  if (!subState.cues.length) return;
  if (e.altKey && e.key === 'ArrowLeft') { subStep(-0.5); e.preventDefault(); }
  if (e.altKey && e.key === 'ArrowRight') { subStep(0.5); e.preventDefault(); }
  if (e.key === 'ArrowLeft' && e.shiftKey) { subStep(-5); e.preventDefault(); }
  if (e.key === 'ArrowRight' && e.shiftKey) { subStep(5); e.preventDefault(); }
});

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('subtitle-wrap');
  if (wrap && !wrap.contains(e.target)) closeSubtitleMenu();
});

function renderPlayerSidebar(item) {
  if (!item) return;
  const cast = item._cast || [];
  const trailer = item._trailer;
  const poster = item._poster || item.poster_url || '';
  const overview = displayOverview(item);
  const similar = state.playerSimilarItems || [];
  const isTV = item.type === 'tv';
  const totalSeasons = isTV ? (item._seasons || 1) : 0;
  const seasons = isTV ? Array.from({ length: totalSeasons }, (_, i) => i + 1) : [];

  dom.playerSidebarContent.innerHTML = `
    <div class="ps-header">
      ${poster ? `<img class="ps-poster" src="${poster}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
      <div>
        <h3>${displayTitle(item)}</h3>
        <div class="meta">${displayYear(item)} · ${escHtml(displayGenres(item))} · ★ ${displayRating(item)}${isTV ? ` · S${state.currentSeason} E${state.currentEpisode}` : ''}</div>
      </div>
    </div>
    ${overview ? `<p class="ps-overview">${escHtml(overview)}</p>` : ''}
    ${trailer ? `<button class="btn btn-outline ps-trailer-btn" data-trailer="${trailer.key}">▶ ${__('Trailer')}</button>` : ''}
    ${cast.length ? `
      <div class="ps-section">
        <h4>${__('Cast')}</h4>
        <div class="cast-scroll">
          ${cast.map(c => `
            <div class="cast-card">
              <img src="${c.photo}" alt="${escHtml(c.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27 fill=%27%231a1a2e%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2732%27/%3E%3Ctext x=%2732%27 y=%2732%27 text-anchor=%27middle%27 dy=%27.3em%27 fill=%27%23a0a0b8%27 font-size=%2718%27%3E${escHtml(c.name[0] || '?')}%3C/text%3E%3C/svg%3E'">
              <div class="name">${escHtml(c.name)}</div>
              <div class="role">${escHtml(c.character || '')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    ${isTV ? `
    <div class="ps-section">
      <div class="tv-player-info">
        <span>${__('Season')} <strong id="player-season-label">${state.currentSeason}</strong> ${__('Episode')} <strong id="player-episode-label">${state.currentEpisode}</strong></span>
      </div>
      <select class="tv-select" data-pv-action="season-change" id="player-season-select">
        ${seasons.map(s => `<option value="${s}" ${s === state.currentSeason ? 'selected' : ''}>${__('Season')} ${s}</option>`).join('')}
      </select>
      <select class="tv-select" data-pv-action="episode-change" id="player-episode-select">
        <option>${__('Loading episodes...')}</option>
      </select>
      <label class="autoplay-toggle">
        <input type="checkbox" id="autoplay-check" ${state.autoPlayNext ? 'checked' : ''}>
        <span class="autoplay-slider"></span>
        <span class="autoplay-label">${__('Autoplay Next Episode')}</span>
      </label>
    </div>
    ` : ''}
    ${similar.length ? `
      <div class="ps-section">
        <h4>${__('Similar Titles')}</h4>
        <div class="ps-similar-scroll">
          ${similar.map(s => `
            <div class="ps-similar-card" data-action="play-similar" data-id="${s._id}">
              <img src="${s.poster_url || ''}" alt="${escHtml(displayTitleText(s))}" loading="lazy" onerror="this.parentElement.style.display='none'">
              <span>${displayTitle(s)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  const cb = document.getElementById('autoplay-check');
  if (cb) {
    cb.onchange = () => { state.autoPlayNext = cb.checked; };
  }

  if (isTV && item.tmdb_id) populatePlayerSeason(item);
}

async function populatePlayerSeason(item) {
  if (state.currentItem?._id !== item._id) return;
  const select = document.getElementById('player-episode-select');
  if (!select) return;
  const data = await API.fetchTVSeason(item.tmdb_id, state.currentSeason);
  const episodes = (data?.episodes || []).filter(ep => ep.episode_number > 0);
  if (state.currentItem?._id !== item._id) return;
  if (i18n.current === 'am') await Translator.translateEpisodes(item, episodes);
  select.innerHTML = episodes.map(ep => `
    <option value="${ep.episode_number}" ${ep.episode_number === state.currentEpisode ? 'selected' : ''}>
      ${__('Ep')} ${ep.episode_number}: ${escHtml(displayEpisodeTitleText(ep))}
    </option>
  `).join('');
}

async function loadPlayerSimilar(item) {
  if (!item?.tmdb_id) return;
  try {
    const isTV = item.type === 'tv';
    const items = isTV ? await API.getSimilarTV(item.tmdb_id) : await API.getSimilarMovies(item.tmdb_id);
    state.playerSimilarItems = indexItems((items || []).slice(0, 10));
    if (state.currentItem?._id === item._id) renderPlayerSidebar(item);
  } catch {}
}

function togglePlayerFullscreen() {
  if (!document.fullscreenElement) {
    dom.playerPage.requestFullscreen?.() || dom.playerPage.webkitRequestFullscreen?.();
  } else {
    document.exitFullscreen?.() || document.webkitExitFullscreen?.();
  }
}

function togglePlayerSidebar() {
  const sidebar = dom.playerPage.querySelector('.player-sidebar');
  const overlay = dom.playerPage.querySelector('.player-sidebar-overlay');
  if (!sidebar) return;
  const open = sidebar.classList.toggle('mobile-open');
  if (open) {
    if (!overlay) {
      const o = document.createElement('div');
      o.className = 'player-sidebar-overlay';
      o.addEventListener('click', togglePlayerSidebar);
      dom.playerPage.appendChild(o);
    }
  } else {
    overlay?.remove();
  }
}
window.togglePlayerSidebar = togglePlayerSidebar;



function listenPlayerProgress() {
  if (dom.playerPage._messageHandler) {
    window.removeEventListener('message', dom.playerPage._messageHandler);
    dom.playerPage._messageHandler = null;
  }

  // Receive video time from postMessage events (hnembed relay or injected script)
  const handler = (event) => {
    if (!dom.playerPage || dom.playerPage.classList.contains('hidden')) return;
    if (!_currentPlayerUrl) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.context === 'player.js') {
      // embedly/player.js protocol: { context:'player.js', event:'timeupdate', value:{ seconds, duration } }
      if (data.event === 'timeupdate' && data.value && typeof data.value.seconds === 'number') {
        subState.currentTime = data.value.seconds;
        subState.gotEvent = true;
        subState.fallbackStart = performance.now() - data.value.seconds * 1000;
      }
      return;
    }
    let time;
    if (data.type === 'cbemovies-progress' || data.type === 'timeupdate' || data.type === 'playing') {
      time = data.currentTime;
    } else if (data.currentTime !== undefined && data.currentTime !== null) {
      time = data.currentTime;
    } else if (data.seconds !== undefined && data.seconds !== null) {
      time = data.seconds;
    } else if (data.event === 'timeupdate' && data.currentTime !== undefined) {
      time = data.currentTime;
    }
    if (typeof time === 'number' && isFinite(time)) {
      subState.currentTime = time;
      subState.gotEvent = true;
      subState.fallbackStart = performance.now() - time * 1000;
    }
  };

  dom.playerPage._messageHandler = handler;
  window.addEventListener('message', handler);
  tryReadVideoTime();
}

function resyncSubtitles() {
  if (!subState.cues.length) return;
  if (state.playerStartTime) {
    subState.currentTime = (performance.now() - state.playerStartTime) / 1000;
    subState.fallbackStart = state.playerStartTime;
    subState.gotEvent = false;
    showToast('Subtitles resynced');
  } else {
    showToast('Cannot resync: no start time', true);
  }
}

/* ── Player TV Controls ── */
function updatePlayerTV(season, episode) {
  playItem(state.currentItem, season, episode);
}

function nextEpisode() {
  const item = state.currentItem;
  if (!item || item.type !== 'tv') return;
  const idx = state.tvEpisodes.findIndex(ep => ep.episode_number === state.currentEpisode);
  if (idx !== -1 && idx < state.tvEpisodes.length - 1) {
    const next = state.tvEpisodes[idx + 1];
    updatePlayerTV(state.currentSeason, next.episode_number);
    showToast(`${__('Next Episode')}: ${displayEpisodeTitleText(next)}`);
    return;
  }
  if (idx >= state.tvEpisodes.length - 1 && state.currentSeason < (item._seasons || 1)) {
    const nextSeason = state.currentSeason + 1;
    API.fetchTVSeason(item.tmdb_id, nextSeason).then(data => {
      const eps = (data?.episodes || []).filter(ep => ep.episode_number > 0);
      if (!eps.length) {
        showToast(__('No more episodes'), true);
        return;
      }
      state.currentSeason = nextSeason;
      state.tvEpisodes = eps;
      if (i18n.current === 'am') Translator.translateEpisodes(item, eps);
      updatePlayerTV(nextSeason, eps[0].episode_number);
      showToast(`${__('Season')} ${nextSeason} ${__('Episode')} 1: ${displayEpisodeTitleText(eps[0])}`);
    });
    return;
  }
  showToast(__('No more episodes'), true);
}

/* ── Premium Search ── */
let searchTimeout;

function openSearch() {
  dom.searchOverlay.classList.add('active');
  dom.searchInput.value = '';
  dom.searchResults.innerHTML = `<div class="search-loading"><div class="spinner"></div><p style="color:var(--text-secondary);font-size:14px">${__('Type to search movies & TV shows...')}</p></div>`;
  setSearchTab('all');
  dom.searchInput.focus();
  lockScroll();
}

function closeSearch() {
  dom.searchOverlay.classList.remove('active');
  dom.searchDropdown?.classList.remove('active');
  unlockScroll();}

function setSearchTab(tab) {
  state.searchTab = tab;
  document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const q = dom.searchInput.value.trim();
  if (q) onSearchInput();
}

function onSearchInput() {
  clearTimeout(searchTimeout);
  const q = dom.searchInput.value.trim();
  if (!q) {
      dom.searchResults.innerHTML = `<div class="search-loading"><div class="spinner"></div><p style="color:var(--text-secondary);font-size:14px">${__('Type to search movies, TV shows & people...')}</p></div>`;
    dom.searchDropdown.classList.remove('active');
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const tab = state.searchTab;
      let movieResults = [], tvResults = [], personResults = [];

      if (tab === 'all' || tab === 'movies') movieResults = await API.searchTmdbMovie(q);
      if (tab === 'all' || tab === 'tv') tvResults = await API.searchTmdbTV(q);
      if (tab === 'all' || tab === 'people') personResults = await API.searchTmdbPerson(q);

      const allResults = [...movieResults, ...tvResults, ...personResults];
      const indexed = indexItems(allResults);

      renderSearchDropdown(indexed, q);

      if (!indexed.length) {
        dom.searchResults.innerHTML = `
          <div class="search-empty">
            <h3>${__('No results found')}</h3>
            <p>${__('Try a different search term for')} "${escHtml(q)}"</p>
          </div>
        `;
        return;
      }

      dom.searchResults.innerHTML = '';
      const parts = [];
      if (movieResults.length && (tab === 'all' || tab === 'movies')) {
        parts.push(`<h3 class="search-section-label">${__('Movies')} (${movieResults.length})</h3>`);
        parts.push(movieResults.map((item, i) => searchCard(item, q, i)).join(''));
      }
      if (tvResults.length && (tab === 'all' || tab === 'tv')) {
        parts.push(`<h3 class="search-section-label">${__('TV Shows')} (${tvResults.length})</h3>`);
        parts.push(tvResults.map((item, i) => searchCard(item, q, i)).join(''));
      }
      if (personResults.length && (tab === 'all' || tab === 'people')) {
        parts.push(`<h3 class="search-section-label">${__('People')} (${personResults.length})</h3>`);
        parts.push(`<div style="grid-column:1/-1;display:flex;flex-direction:column;gap:6px">`);
        parts.push(personResults.map((item, i) => `
          <div class="person-card" onclick="closeSearch();showPersonDetail(${item.tmdb_id})">
            ${item._poster ? `<img src="${item._poster}" alt="">` : `<div class="person-avatar">${escHtml(item.title[0])}</div>`}
            <div>
              <div class="person-name">${highlight(item.title, q)}</div>
              <div class="person-info">${escHtml(item._overview || '')}${item._knownFor ? ` · ${escHtml(item._knownFor)}` : ''}</div>
            </div>
          </div>
        `).join(''));
        parts.push(`</div>`);
      }
      dom.searchResults.innerHTML = parts.join('');

    } catch (err) {
      dom.searchResults.innerHTML = `
        <div class="search-empty">
          <h3>${__('Search failed')}</h3>
          <p>${__('Could not load data.')} ${__('Check your connection.')}</p>
        </div>
      `;
    }
  }, 300);
}

function renderSearchDropdown(results, q) {
  const dropdown = dom.searchDropdown;
  if (!results.length) { dropdown.classList.remove('active'); return; }

  const items = results.slice(0, 6);
  dropdown.innerHTML = items.map(item => {
    const isPerson = item.type === 'person' || item.media_type === 'person';
    const title = item.title || item.name || 'Untitled';
    const year = item.year || '';
    const typeLabel = isPerson ? __('Person') : item.type === 'tv' ? __('TV') : __('Movie');
    const poster = item.poster_url || item._poster || '';

    return `
      <div class="search-dd-item" data-action="${isPerson ? 'person-quick' : 'detail'}" data-id="${item._id}" data-person-id="${isPerson ? item.tmdb_id : ''}">
        ${poster ? `<img src="${poster}" alt="" loading="lazy">` : `<div class="dd-icon">${isPerson ? '👤' : '🎬'}</div>`}
        <div class="dd-info">
          <div class="dd-title">${escHtml(title)}</div>
          ${year ? `<div class="dd-meta">${year}</div>` : ''}
        </div>
        <span class="dd-type">${typeLabel}</span>
      </div>
    `;
  }).join('') + `
    <div class="search-dd-seeall" data-action="search-seeall">${__('See all results →')}</div>
  `;
  dropdown.classList.add('active');
}

function searchCard(item, q, i) {
  const title = escHtml(displayTitleText(item) || '');
  const year = item._year || item.year || '';
  const rating = item._rating || (item.rating ? parseFloat(item.rating).toFixed(1) : '');
  const stars = rating ? `<span class="card-rating">&#11088; ${rating}</span>` : '';
  const poster = item._poster || item.poster_url || '';
  const typeLabel = item.type === 'tv' ? 'TV' : 'Movie';
  const onclick = `closeSearch();showDetail(state.itemMap[${item._id}])`;
  return `
    <div class="movie-card" data-id="${item._id}" onclick="${onclick}">
      <img class="movie-card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22><rect fill=%22%231a1a2e%22 width=%22300%22 height=%22450%22/><text fill=%22%23666%22 font-size=%2218%22 x=%22150%22 y=%22225%22 text-anchor=%22middle%22>No Image</text></svg>'">
      ${stars}
      <div class="movie-card-overlay">
        <h3>${highlight(displayTitle(item), q)}</h3>
        <div class="meta">${year ? `<span>${year}</span>` : ''}<span>${typeLabel}</span></div>
      </div>
      <button class="play-btn">&#9654;</button>
    </div>
  `;
}

function highlight(text, query) {
  if (!text) return '';
  try {
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(re, '<mark style="background:rgba(255,148,202,0.3);color:#fff;border-radius:2px;padding:0 2px">$1</mark>');
  } catch { return escHtml(text); }
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function scrollCarousel(container, dir) {
  container.scrollBy({ left: dir * container.clientWidth * 0.7, behavior: 'smooth' });
}
window.scrollCarousel = scrollCarousel;

/* ── Mobile Nav ── */
function scrollToSection(name) {
  closeMobileNav();
  if (name === '.hero') { document.querySelector('.hero')?.scrollIntoView({ behavior: 'smooth' }); return; }
  if (name === 'youtube') { window.location.href = 'youtube.html'; return; }
  const sections = document.querySelectorAll('.section');
  const map = { trending: 0, nowPlaying: 2, latest: 3, popular: 6 };
  const idx = map[name];
  if (idx !== undefined && sections[idx]) sections[idx].scrollIntoView({ behavior: 'smooth' });
}
window.scrollToSection = scrollToSection;

function toggleMobileNav() {
  let panel = $('#mobile-nav-panel');
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
    <a href="youtube.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">🎬 ${__('CBE Movies')}</a>
    <a href="#" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="openSearch();closeMobileNav();return false">${__('Search')}</a>
    ${userLinks}
  `;
  document.body.appendChild(panel);
  lockScroll();
}

function closeMobileNav() {
  $('#mobile-nav-panel')?.remove();
  $('#mobile-nav-overlay')?.remove();
  unlockScroll();
}
window.toggleMobileNav = toggleMobileNav;

/* ── Event Delegation ── */
function setupEventDelegation() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (target) {
      const action = target.dataset.action;
      const id = target.dataset.id ? parseInt(target.dataset.id) : null;
      const item = id ? state.itemMap[id] : null;
      switch (action) {
        case 'detail': if (item) { closeSearch(); showDetail(item); } break;
        case 'play': if (item) { closeModal(); closeSearch(); const s = parseInt(target.dataset.season) || 1; const e = parseInt(target.dataset.episode) || 1; playItem(item, s, e); } break;
        case 'play-similar': if (item) { closeModal(); closeSearch(); playItem(item); } break;
        case 'close-modal': closeModal(); break;
        case 'hero-prev': prevHero(); break;
        case 'hero-next': nextHero(); break;
        case 'search-seeall': dom.searchDropdown?.classList.remove('active'); break;
        case 'person-quick': if (target.dataset.personId) { closeSearch(); showPersonDetail(parseInt(target.dataset.personId)); } break;
      }
      return;
    }

    const epSelect = e.target.closest('[data-tv-action="episode-select"]');
    if (epSelect && state.currentItem?.type === 'tv') {
      const episode = parseInt(epSelect.dataset.tvEpisode);
      if (episode) {
        state.currentEpisode = episode;
        document.querySelectorAll('.episode-item').forEach(el => el.classList.toggle('active', parseInt(el.dataset.tvEpisode) === episode));
        const playBtn = document.querySelector('.modal-actions .btn-primary');
        if (playBtn) playBtn.dataset.episode = episode;
      }
      return;
    }

    const trailerBtn = e.target.closest('[data-trailer]');
    if (trailerBtn) { openTrailer(trailerBtn.dataset.trailer); return; }

    const tabBtn = e.target.closest('.search-tab');
    if (tabBtn) { setSearchTab(tabBtn.dataset.tab); return; }

    const ytCard = e.target.closest('[data-video-id]');
    if (ytCard) { showYouTubeDetail(ytCard.dataset.videoId); return; }

    const ytPlay = e.target.closest('[data-youtube-play]');
    if (ytPlay) { closeModal(); openYouTubePlayer(ytPlay.dataset.youtubePlay); return; }

    const personCard = e.target.closest('[data-person-id]');
    if (personCard) { showPersonDetail(parseInt(personCard.dataset.personId)); return; }

      const companyLink = e.target.closest('[data-company-id]');
      if (companyLink) {
        const id = parseInt(companyLink.dataset.companyId);
        const name = companyLink.dataset.companyName || __('Company');
        closeModal();
        closeSearch();
        showCompanyMovies(id, name);
      return;
    }

    const creditItem = e.target.closest('[data-tmdb-id]');
    if (creditItem) {
      closeModal();
      const itemId = parseInt(creditItem.dataset.tmdbId);
      const mediaType = creditItem.dataset.mediaType || 'movie';
      const found = Object.values(state.itemMap).find(i => i.tmdb_id === itemId);
      if (found) { showDetail(found); return; }
      const temp = { tmdb_id: itemId, type: mediaType === 'tv' ? 'tv' : 'movie', title: '', _tmdb: true };
      indexItems([temp]);
      showDetail(temp);
      return;
    }

    if (e.target.closest('.mobile-menu-btn')) toggleMobileNav();
  });

  document.addEventListener('change', (e) => {
    const seasonSelect = e.target.closest('[data-tv-action="season-change"]');
    if (seasonSelect && state.currentItem?.type === 'tv') {
      const season = parseInt(seasonSelect.value);
      if (season) loadTVEpisodes(state.currentItem, season);
      return;
    }

    const playerSeason = e.target.closest('[data-pv-action="season-change"]');
    if (playerSeason && state.currentItem?.type === 'tv') {
      const season = parseInt(playerSeason.value);
      if (season) {
        state.currentSeason = season;
        state.currentEpisode = 1;
        updatePlayerTV(season, 1);
      }
      return;
    }

    const playerEpisode = e.target.closest('[data-pv-action="episode-change"]');
    if (playerEpisode && state.currentItem?.type === 'tv') {
      const episode = parseInt(playerEpisode.value);
      if (episode) updatePlayerTV(state.currentSeason, episode);
      return;
    }
  });

  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  dom.trailerModal.addEventListener('click', (e) => {
    if (e.target === dom.trailerModal) closeTrailer();
  });

  document.addEventListener('click', (e) => {
    if (dom.searchDropdown?.classList.contains('active') && !e.target.closest('.search-header')) {
      dom.searchDropdown.classList.remove('active');
    }
  });

  const ytModal = document.getElementById('youtube-modal');
  if (ytModal) {
    ytModal.addEventListener('click', (e) => {
      if (e.target === ytModal) closeYouTubePlayer();
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') { closeModal(); closeSearch(); closeTrailer(); closeYouTubePlayer(); closeMobileNav(); }
  });
}

/* ── Featured Movies from featured.txt ── */
async function loadFeaturedMovies() {
  try {
    const res = await fetch('featured.txt');
    const text = await res.text();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const entries = [];
    let current = [];
    for (const line of lines) {
      if (line === ',') {
        if (current.length > 0) { entries.push(current); current = []; }
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) entries.push(current);

    const titles = [];
    for (const entry of entries) {
      const titleLine = entry.find(l => !l.startsWith('•') && !l.startsWith('★') && !/^\d{4}$/.test(l) && l.length > 2);
      if (titleLine) {
        let t = titleLine.replace(/\s+\d{4}$/, '').replace(/\s+Trailer$/i, '').trim();
        if (t) titles.push(t);
      }
    }

    const results = [];
    for (const title of titles) {
      try {
        const items = await API.searchTmdbMovie(title);
        if (items.length > 0) results.push(items[0]);
      } catch {}
    }

    state.featuredItems = indexItems(results);
    return state.featuredItems;
  } catch (err) {
    console.warn('Could not load featured movies:', err);
    state.featuredItems = [];
    return [];
  }
}

/* ── Enrich ── */
async function enrichDisplayed() {
  if (state.enriched) return;
  state.enriched = true;

  const toEnrich = [...state.movies.slice(0, 24), ...state.tvShows.slice(0, 12)]
    .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  const enriched = await API.enrichItems(toEnrich);
  for (const e of enriched) {
    if (e?._id && state.itemMap[e._id]) Object.assign(state.itemMap[e._id], e);
  }

  renderHeroPreview([...Object.values(state.itemMap)].filter(i => i._trending).slice(0, 5));
  renderMovieCards(state.movies, dom.latestTrack);
  renderMovieCards(state.tvShows.slice(0, 12), dom.popularTrack, { numbered: true });
  renderFeatured(state.featuredItems.length ? state.featuredItems : state.movies.slice(0, 3));
}

/* ── Mobile Controls ── */
function repositionHeroControls() {
  const controls = document.querySelector('.hero-controls');
  const hero = document.getElementById('hero');
  if (!controls || !hero) return;
  const isMobile = window.innerWidth <= 768;
  if (isMobile && controls.parentElement === hero) {
    controls.classList.add('mobile-below');
    hero.parentElement.insertBefore(controls, hero.nextSibling);
  } else if (!isMobile && controls.parentElement !== hero) {
    controls.classList.remove('mobile-below');
    hero.appendChild(controls);
  }
}

/* ── Load ── */
async function loadContent() {
  if (state.loading) return;
  state.loading = true;

  try {
    const [moviesData, tvData, trending, nowPlaying] = await Promise.all([
      API.getMoviePage(1).catch(() => ({ items: [] })),
      API.getTVPage(1).catch(() => ({ items: [] })),
      API.getTrending('week'),
      API.getNowPlaying(1)
    ]);

    state.movies = indexItems(moviesData.items);
    state.tvShows = indexItems(tvData.items);

    const trendingMovies = indexItems(trending.movies);
    const trendingTV = indexItems(trending.tv);
    const nowPlayingItems = indexItems(nowPlaying);

    state.allContent = [...state.movies, ...state.tvShows, ...trendingMovies, ...trendingTV, ...nowPlayingItems];

    state.heroItems = [
      ...trendingMovies.slice(0, 10),
      ...state.movies.slice(0, 5),
      ...trendingTV.slice(0, 10),
      ...state.tvShows.slice(0, 5)
    ].filter(Boolean);
    state.heroIndex = 0;

    renderHero(state.heroItems[0]);
    renderHeroDots();
    setupHeroCarousel();
    resetHeroTimer();

    renderHeroPreview(state.heroItems.slice(1, 6));
    renderMovieCards(trendingMovies, dom.trendingTrack);
    renderMovieCards(trendingTV, dom.trendingTVTrack);
    renderMovieCards(nowPlayingItems, dom.nowPlayingTrack);
    renderMovieCards(state.movies, dom.latestTrack);
    renderMovieCards(state.tvShows.slice(0, 12), dom.popularTrack, { numbered: true });
    const featured = await loadFeaturedMovies();
    renderFeatured(featured.length ? featured : trendingMovies.slice(0, 3));

    const ethiopian = indexItems(await API.getEthiopianMovies());
    renderMovieCards(ethiopian, dom.ethiopianTrack);

      showToast('CBE Movies loaded');

    enrichDisplayed();

    if (i18n.current === 'am') translateInitialContent();

  } catch (err) {
    console.error('Load error:', err);
    showToast('Failed to load content.', true);
    dom.heroContent.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <h2 style="font-size:28px;margin-bottom:12px">${__('Connection Error')}</h2>
        <p style="color:var(--text-secondary)">${__('Could not load data.')}</p>
        <button class="btn btn-primary" style="margin-top:20px" onclick="loadContent()">${__('Retry')}</button>
      </div>
    `;
  } finally {
    state.loading = false;
    dom.preloader.classList.add('hidden');
  }
}

async function translateInitialContent() {
  const toTranslate = [];
  const heroItem = state.heroItems[state.heroIndex];
  if (heroItem?.tmdb_id) toTranslate.push(heroItem);
  const featuredArr = state.featuredItems.length ? state.featuredItems : state.movies.slice(0, 3);
  featuredArr.forEach(i => { if (i.tmdb_id) toTranslate.push(i); });
  await Promise.all(toTranslate.map(i => Translator.translateItem(i)));
  if (heroItem) renderHero(heroItem);
  renderFeatured(featuredArr);
}

function toggleLang() {
  const lang = i18n.current === 'en' ? 'am' : 'en';
  i18n.setLang(lang);
  document.querySelector('.lang-switch').textContent = lang === 'am' ? 'አማ' : 'EN';

  const heroItem = state.heroItems[state.heroIndex];
  if (heroItem) {
    renderHero(heroItem);
    if (lang === 'am' && heroItem.tmdb_id) {
      Translator.translateItem(heroItem).then(() => {
        if (state.heroItems[state.heroIndex]?._id === heroItem._id) renderHero(heroItem);
      });
    }
  }

  const featuredArr = state.featuredItems.length ? state.featuredItems : state.movies.slice(0, 3);
  renderFeatured(featuredArr);

  if (state.currentItem) {
    const isPlayer = dom.playerPage.classList.contains('active') || !dom.playerPage.classList.contains('hidden');
    if (isPlayer) {
      renderPlayerSidebar(state.currentItem);
    } else {
      rerenderModal(state.currentItem);
    }
    if (lang === 'am' && state.currentItem.tmdb_id) {
      Translator.translateItem(state.currentItem).then(() => {
        if (state.currentItem) {
          if (isPlayer) {
            renderPlayerSidebar(state.currentItem);
          } else {
            rerenderModal(state.currentItem);
          }
        }
      });
    }
    if (state.currentItem?.type === 'tv' && lang === 'am') {
      Translator.translateEpisodes(state.currentItem, state.tvEpisodes).then(() => {
        if (state.currentItem) {
          if (isPlayer) {
            renderPlayerSidebar(state.currentItem);
          } else {
            rerenderModal(state.currentItem);
          }
        }
      });
    }
  }

  renderMovieCards(state.movies, dom.latestTrack);
  renderMovieCards(state.tvShows.slice(0, 12), dom.popularTrack, { numbered: true });
}
window.toggleLang = toggleLang;

document.addEventListener('DOMContentLoaded', () => {
  i18n.init();
  document.querySelector('.lang-switch').textContent = i18n.current === 'am' ? 'አማ' : 'EN';
  setupEventDelegation();
  initParallax();
  repositionHeroControls();
  window.addEventListener('resize', repositionHeroControls);
  loadContent();
  loadYTAPI();
  setupSubtitleUpload();
});
