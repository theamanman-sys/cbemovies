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
function displayGenres(item) {
  if (item._genres?.length) return item._genres.join(', ');
  return item.genre || __('General');
}
function displayYear(item) { return item._year || item.year || __('N/A'); }
function displayOverview(item) {
  const am = i18n.current === 'am' && item._amOverview;
  return am || item._overview || `${__('Watch')} "${displayTitle(item)}" ${__('in high definition.')}`;
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
function showDetail(item) {
  state.currentItem = item;
  state.currentSeason = 1;
  state.currentEpisode = 1;
  state.tvEpisodes = [];
  state.tvSeasons = [];
  state.autoPlayTimer = null;
  state.autoPlayDone = false;
  rerenderModal(item);
  dom.modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (item._trailer) {
    const backdrop = dom.modal.querySelector('.modal-backdrop');
    if (backdrop) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;flex:none;width:100%;aspect-ratio:16/9;z-index:5;overflow:hidden;opacity:0';
      wrapper.dataset.trailerWrapper = '';
      backdrop.parentNode.insertBefore(wrapper, backdrop.nextSibling);
      backdrop.style.display = 'none';
      state._trailerDiv = wrapper;
      state.autoPlayTimer = setTimeout(() => tryAutoPlayTrailer(item), 2000);
    }
  }

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
    <div style="position:absolute;top:0;left:0;right:0;height:56px;background:var(--bg-secondary);z-index:2"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(to top,#12121a,#08080c);z-index:2"></div>
    <button class="trailer-mute-btn" data-muted="1" style="position:absolute;bottom:8px;right:8px;z-index:3;width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1" title="Unmute">🔇</button>
  `);
  div.style.opacity = '1';
  if (!_ytReady) {
    loadYTAPI(() => createYTPlayer(div, item._trailer.key));
  } else {
    createYTPlayer(div, item._trailer.key);
  }
}
function loadYTAPI(cb) {
  if (_ytLoading) { setTimeout(() => loadYTAPI(cb), 200); return; }
  _ytLoading = true;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onload = () => { _ytReady = true; if (cb) cb(); };
  const first = document.getElementsByTagName('script')[0];
  first.parentNode.insertBefore(tag, first);
}
window.onYouTubeIframeAPIReady = () => {
  _ytReady = true;
  _ytLoading = false;
};
function createYTPlayer(div, key) {
  if (!_ytReady) { setTimeout(() => createYTPlayer(div, key), 200); return; }
  if (div._ytPlayer) return;
  const playerDiv = document.createElement('div');
  playerDiv.id = 'yt-trailer-' + Date.now();
  div.insertBefore(playerDiv, div.firstChild);
  const btn = div.querySelector('.trailer-mute-btn');
  div._ytPlayer = new YT.Player(playerDiv.id, {
    height: '100%', width: '100%',
    videoId: key,
    playerVars: {
      playsinline: 1,
      controls: 0, rel: 0, modestbranding: 1,
      iv_load_policy: 3, cc_load_policy: 0,
      loop: 1, playlist: key, hl: 'en'
    },
    events: {
      onReady: (e) => {
        e.target.mute();
        e.target.playVideo();
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING && !div._unmuted) {
          div._unmuted = true;
          try { e.target.unMute(); } catch {}
          if (btn && btn.isConnected) {
            btn.dataset.muted = '0';
            btn.textContent = '🔊';
            btn.title = 'Mute';
          }
        }
      }
    }
  });
  if (btn) {
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
  document.body.style.overflow = 'hidden';
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
  document.body.style.overflow = '';
}

const youtubeData = {
  'ulCGyn4fcKI': { title: 'Videobet Podcast Episode 4: The Development of African Cinema', description: 'Films Discussed: Cairo Station, Black Girl, Yeelen, Teza, Atlantics.' },
  'JBAPC6Hvoso': { title: 'Launching Soon', description: 'Where silence hums, frames linger, and Addis watches itself dream.' },
  'CNtJrircaNo': { title: 'Videobet Shorts: Ep 05 — Close-Up by Abbas Kiarostami', description: 'Kiarostami\'s Close-Up concludes our film series.' },
  'Lw8XueLnU88': { title: 'Videobet Shorts: EP 4 — Taste of Cherry by Abbas Kiarostami', description: 'Kiarostami\'s Taste of Cherry continues our film series.' },
  'iZeBBkAOOE8': { title: 'Videobet Shorts: Ep 03 — Through the Olive Trees', description: 'Kiarostami\'s Through the Olive Trees continues our film series.' },
  'hgfPsRhRz0g': { title: 'Videobet Shorts: Ep 02 — And Life Goes On', description: 'Kiarostami\'s And Life Goes On continues our film series.' },
  'XezOY3I2zlc': { title: 'Videobet Shorts: Ep 01 — Where\'s the Friend\'s House?', description: 'Kiarostami\'s classic kicks off our film series.' },
  'j0N3v4V7Xr8': { title: 'ቪዲዮቤት ክፍል 4 በቅርብ ቀን', description: 'Episode 4 — A new guest and their top 5 film picks.' },
  'XL99u8Zqyp8': { title: 'ከልዑል ሸዋፈራው — Sexy Beast', description: 'A discussion on Jonathan Glazer\'s Sexy Beast.' },
  'ruxJkpcbJ98': { title: 'ከልዑል ሸዋፈራው — To Sleep With Anger', description: 'A discussion on Charles Burnett\'s classic.' },
  'HvFyZsz77vk': { title: 'ቪዲዮቤት ክፍል 3 — አምስት ፊልሞች ከልዑል ሸዋፈራው ጋር', description: 'Episode 3 — Leul Shewaferaw interview.' },
  'A1Z-3Piz7wI': { title: 'Losing Ground Screening — Thank You', description: 'Thanks to everyone who came to the screening.' },
  '0Yn_AlF9OJ8': { title: 'የ Losing Ground ፊልም እይታ በሴንቸሪ ሲኒማ', description: 'A screening of the 1982 classic at Century Cinema.' },
  'JdZKvDYFzRU': { title: 'ከአብረሃም ገዛኸኝ — 12 Angry Men', description: 'A discussion on Sidney Lumet\'s 12 Angry Men.' },
  'Jci0fu2VFto': { title: 'ቪዲዮቤት ክፍል 2 — አምስት ፊልሞች ከአብረሃም ገዛኸኝ ጋር', description: 'Episode 2 — Abraham Gezahagne interview.' },
  'HuGynsdFTPs': { title: 'Top 10 Movies of 2024', description: 'Episode 1 — Our hosts discuss the best films of the year.' },
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
  dom.trailerFrame.src = `https://www.youtube.com/embed/${key}?autoplay=1&muted=1&playsinline=1&controls=0&rel=0&iv_load_policy=3&cc_load_policy=0`;
  dom.trailerModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeTrailer() {
  dom.trailerFrame.src = '';
  dom.trailerModal.classList.remove('active');
  document.body.style.overflow = '';
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
  document.body.style.overflow = 'hidden';
}

/* ── YouTube Player ── */
function openYouTubePlayer(videoId) {
  const frame = document.getElementById('youtube-frame');
  const modal = document.getElementById('youtube-modal');
  if (!frame || !modal) return;
  frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&muted=1&playsinline=1&rel=0`;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeYouTubePlayer() {
  const frame = document.getElementById('youtube-frame');
  const modal = document.getElementById('youtube-modal');
  if (frame) frame.src = '';
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

/* ── Player ── */
function playItem(item, season = 1, episode = 1) {
  if (!item) return showToast(__('No media selected'), true);
  state.currentItem = item;
  state.currentSeason = season;
  state.currentEpisode = episode;
  state.playerSimilarItems = null;
  state._autoPlayTriggered = false;
  dom.playerFrame.sandbox = 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation';
  dom.playerFrame.src = API.getPlayerUrl(item, season, episode);
  dom.playerPage.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderPlayerSidebar(item);
  listenPlayerProgress();
  loadPlayerSimilar(item);
  if (item.type === 'tv' && item.tmdb_id) {
    API.fetchTVSeason(item.tmdb_id, season).then(data => {
      const eps = (data?.episodes || []).filter(ep => ep.episode_number > 0);
      if (eps.length) {
        state.tvEpisodes = eps;
        state.currentSeason = season;
        if (i18n.current === 'am') Translator.translateEpisodes(item, eps);
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
  dom.playerPage.classList.add('hidden');
  document.body.style.overflow = '';
  state.playerSimilarItems = null;
  if (dom.playerPage._messageHandler) window.removeEventListener('message', dom.playerPage._messageHandler);
}

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

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement?.closest?.('.player-page')) {
    document.querySelector('.player-fs-btn')?.setAttribute('title', 'Exit Fullscreen');
  } else {
    document.querySelector('.player-fs-btn')?.setAttribute('title', 'Fullscreen');
    // If iframe somehow entered fullscreen, redirect to container
    if (document.fullscreenElement === dom.playerFrame) {
      document.exitFullscreen();
      dom.playerPage.requestFullscreen();
    }
  }
});

function listenPlayerProgress() {
  if (dom.playerPage._messageHandler) window.removeEventListener('message', dom.playerPage._messageHandler);
  const handler = (e) => {
    if (e.data?.type === 'PLAYER_EVENT') {
      const d = e.data.data;
      if (d.player_duration && d.player_progress != null) {
        if (state.autoPlayNext && state.currentItem?.type === 'tv' && !state._autoPlayTriggered) {
          const ratio = d.player_progress / d.player_duration;
          if (ratio >= 0.95) {
            state._autoPlayTriggered = true;
            nextEpisode();
          }
        }
      }
    }
  };
  window.addEventListener('message', handler);
  dom.playerPage._messageHandler = handler;
}

/* ── Player TV Controls ── */
function updatePlayerTV(season, episode) {
  state.currentSeason = season;
  state.currentEpisode = episode;
  state._autoPlayTriggered = false;
  dom.playerFrame.src = API.getPlayerUrl(state.currentItem, season, episode);
  renderPlayerSidebar(state.currentItem);
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
  document.body.style.overflow = 'hidden';
}

function closeSearch() {
  dom.searchOverlay.classList.remove('active');
  dom.searchDropdown?.classList.remove('active');
  document.body.style.overflow = '';
}

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
      if (movieResults.length && (tab === 'all' || tab === 'movies')) {
        dom.searchResults.insertAdjacentHTML('beforeend', `<h3 class="search-section-label">${__('Movies')} (${movieResults.length})</h3>`);
        const grid = document.createElement('div');
        grid.style.cssText = 'display:contents';
        grid.innerHTML = movieResults.map((item, i) => searchCard(item, q, i)).join('');
        dom.searchResults.appendChild(grid);
      }
      if (tvResults.length && (tab === 'all' || tab === 'tv')) {
        dom.searchResults.insertAdjacentHTML('beforeend', `<h3 class="search-section-label">${__('TV Shows')} (${tvResults.length})</h3>`);
        const grid = document.createElement('div');
        grid.style.cssText = 'display:contents';
        grid.innerHTML = tvResults.map((item, i) => searchCard(item, q, i)).join('');
        dom.searchResults.appendChild(grid);
      }
      if (personResults.length && (tab === 'all' || tab === 'people')) {
        dom.searchResults.insertAdjacentHTML('beforeend', `<h3 class="search-section-label">${__('People')} (${personResults.length})</h3>`);
        dom.searchResults.insertAdjacentHTML('beforeend', personResults.map((item, i) => `
          <div class="person-card" data-person-id="${item.tmdb_id}" style="grid-column:1/-1;cursor:pointer;padding:10px 14px;border-radius:8px;display:flex;align-items:center;gap:12px;transition:var(--transition)" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
            ${item._poster ? `<img src="${item._poster}" alt="" style="width:44px;height:66px;border-radius:4px;object-fit:cover">` : `<div style="width:44px;height:66px;border-radius:4px;background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--text-secondary)">${escHtml(item.title[0])}</div>`}
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--text-primary)">${highlight(item.title, q)}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${escHtml(item._overview || '')}${item._knownFor ? ` · ${escHtml(item._knownFor)}` : ''}</div>
            </div>
          </div>
        `).join(''));
      }

    } catch (err) {
      dom.searchResults.innerHTML = `
        <div class="search-empty">
          <h3>${__('Search failed')}</h3>
          <p>${__('Could not reach TMDB or VidAPI.')} ${__('Check your connection.')}</p>
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
  return `
    <div class="movie-card" data-id="${item._id}" data-action="detail" style="animation:fadeInScale 0.3s ease ${i * 0.03}s both">
      <div class="card-rating">★ ${displayRating(item)}</div>
      <img class="movie-card-poster" src="${posterUrl(item)}" alt="${escHtml(displayTitleText(item))}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27450%27 fill=%27%231a1a2e%27%3E%3Crect width=%27300%27 height=%27450%27/%3E%3Ctext x=%2750%%25%27 y=%2750%%25%27 text-anchor=%27middle%27 fill=%27%23a0a0b8%27 font-size=%2716%27%3E${escHtml(displayTitleText(item)[0] || '?')}%3C/text%3E%3C/svg%3E'">
      <button class="play-btn" data-id="${item._id}" data-action="play">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="movie-card-overlay">
        <h3>${highlight(displayTitle(item), q)}</h3>
        <div class="meta"><span>${displayYear(item)}</span><span>${item.type === 'tv' ? __('TV') : __('Movie')}</span></div>
      </div>
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
  panel.innerHTML = `
    <a href="#" style="color:var(--text-primary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="scrollToSection('.hero');return false">${__('Home')}</a>
    <a href="#" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="scrollToSection('trending');return false">${__('Trending')}</a>
    <a href="#" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="scrollToSection('nowPlaying');return false">${__('Now Playing in Theaters')}</a>
    <a href="#" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="scrollToSection('latest');return false">${__('Latest Movies')}</a>
    <a href="#" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="scrollToSection('popular');return false">${__('Popular TV Shows')}</a>
    <a href="#" style="color:var(--text-primary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="scrollToSection('youtube');return false">🎬 ${__('VideoBet')}</a>
    <a href="#" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0" onclick="openSearch();closeMobileNav();return false">${__('Search')}</a>
  `;
  document.body.appendChild(panel);
  document.body.style.overflow = 'hidden';
}
function closeMobileNav() {
  const panel = $('#mobile-nav-panel');
  if (panel) panel.remove();
  const overlay = $('#mobile-nav-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
}
function scrollToSection(id) {
  closeMobileNav();
  if (id === '.hero') { document.querySelector('.hero').scrollIntoView({behavior:'smooth'}); return; }
  if (id === 'youtube') { document.getElementById('youtube-section').scrollIntoView({behavior:'smooth'}); return; }
  const track = dom[id + 'Track'];
  if (track) track.parentElement.parentElement.scrollIntoView({behavior:'smooth'});
}

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

    showToast('VideoBet loaded');

    enrichDisplayed();

    if (i18n.current === 'am') translateInitialContent();

  } catch (err) {
    console.error('Load error:', err);
    showToast('Failed to load content.', true);
    dom.heroContent.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <h2 style="font-size:28px;margin-bottom:12px">${__('Connection Error')}</h2>
        <p style="color:var(--text-secondary)">${__('Could not reach TMDB or VidAPI.')}</p>
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
});
