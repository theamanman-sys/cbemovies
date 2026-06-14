const youtubeVideos = [
  {
    id: 'wvTRae6Awas',
    title: 'Fasika (Easter) FCY Ad April, 2019',
    description: 'Commercial Bank of Ethiopia Easter celebration advertisement.',
    fullDescription: 'Commercial Bank of Ethiopia wishes you a Happy Easter! Celebrate the season with CBE.',
    date: 'Apr 2019',
    views: '',
    category: 'podcast'
  },
  {
    id: '44KofcrAw5I',
    title: 'CBE TV Special Easter Program | ልዩ የትንሳኤ በዓል ፕሮግራም',
    description: 'Special Easter program from Commercial Bank of Ethiopia.',
    fullDescription: 'Commercial Bank of Ethiopia presents a special Easter television program. Join us in celebration.\n\nCopyright © CBE (Commercial Bank of Ethiopia)',
    date: 'Apr 2019',
    views: '',
    category: 'podcast'
  },
  {
    id: 'QFeMChEqrjE',
    title: 'CBE TV Program | የኢትዮጵያ ንግድ ባንክ የቴሌቪዥን ፕሮግራም',
    description: 'Commercial Bank of Ethiopia television program featuring banking services and updates.',
    fullDescription: 'የኢትዮጵያ ንግድ ባንክ የቴሌቪዥን ፕሮግራም — ስለ ባንክ አገልግሎቶች እና ማሻሻያዎች መረጃ።\n\nCopyright © CBE (Commercial Bank of Ethiopia)',
    date: 'May 2019',
    views: '',
    category: 'discussion'
  },
  {
    id: 'QJ5bQWcFc88',
    title: 'Facts and Figures about CBE | ስለ ኢትዮጵያ ንግድ ባንክ እውነታዎች እና አሃዞች',
    description: 'Key facts and figures about the Commercial Bank of Ethiopia — Ethiopia\'s largest bank.',
    fullDescription: 'Facts and Figures about CBE — learn about the history, reach, and impact of the Commercial Bank of Ethiopia.\n\nCopyright © CBE (Commercial Bank of Ethiopia)',
    date: '2024',
    views: '',
    category: 'promotional'
  },
  {
    id: 'gVivmkr4Q6g',
    title: 'CBE Iftar Program in Addis Ababa | የኢትዮጵያ ንግድ ባንክ የኢፍጣር ፕሮግራም',
    description: 'Commercial Bank of Ethiopia Iftar program held in Addis Ababa.',
    fullDescription: 'CBE hosted an Iftar program in Addis Ababa, bringing together communities during the holy month.\n\nCopyright © CBE (Commercial Bank of Ethiopia)',
    date: '2024',
    views: '',
    category: 'discussion'
  },
  {
    id: 'HOKqO75MOjM',
    title: 'CBE Iftar Program in Dire Dawa and Jimma | የኢፍጣር ፕሮግራም በድሬዳዋ እና ጅማ',
    description: 'Commercial Bank of Ethiopia Iftar program in Dire Dawa and Jimma cities.',
    fullDescription: 'CBE continues its community engagement with Iftar programs in Dire Dawa and Jimma.\n\nCopyright © CBE (Commercial Bank of Ethiopia)',
    date: '2024',
    views: '',
    category: 'discussion'
  },
  {
    id: '9wykvM6O36Q',
    title: 'CBE Eid Al-Fitir Special TV Program Part 1 | ልዩ የኢድ አል-ፈጥር በዓል ፕሮግራም',
    description: 'Commercial Bank of Ethiopia special Eid Al-Fitir television program — Part 1.',
    fullDescription: 'CBE presents a special Eid Al-Fitir television program. Join us in celebration.\n\nCopyright © CBE (Commercial Bank of Ethiopia)',
    date: '2024',
    views: '',
    category: 'podcast'
  },
  {
    id: 'IaLQ7x3NWQc',
    title: 'CBE Eid Al-Fitir Special TV Program Part 2 | ልዩ የኢድ አል-ፈጥር በዓል ፕሮግራም ክፍል 2',
    description: 'Commercial Bank of Ethiopia special Eid Al-Fitir television program — Part 2.',
    fullDescription: 'CBE presents a special Eid Al-Fitir television program (Part 2). Join us in celebration.\n\nCopyright © CBE (Commercial Bank of Ethiopia)',
    date: '2024',
    views: '',
    category: 'podcast'
  }
];

let currentFilter = 'all';
const dom = {};

function init() {
  dom.grid = document.getElementById('video-grid');
  dom.modalOverlay = document.getElementById('modal-overlay');
  dom.modal = document.getElementById('modal');

  renderGrid('all');

  document.getElementById('filter-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderGrid(currentFilter);
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.mobile-menu-btn')) { toggleMobileNav(); return; }
    const card = e.target.closest('.video-card');
    if (card) { showDetail(card.dataset.videoId); return; }

    const playBtn = e.target.closest('[data-video-play]');
    if (playBtn) { closeModal(); openYouTubePlayer(playBtn.dataset.videoPlay); return; }

    const action = e.target.closest('[data-action]');
    if (action) {
      switch (action.dataset.action) {
        case 'close-modal': closeModal(); break;
      }
      return;
    }
  });

  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeYouTubePlayer(); closeModal(); }
  });

  document.getElementById('preloader').classList.add('hidden');
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderGrid(filter) {
  const items = filter === 'all'
    ? youtubeVideos
    : youtubeVideos.filter(v => v.category === filter);

  dom.grid.innerHTML = items.map(v => `
    <div class="video-card" data-video-id="${v.id}">
      <div class="video-thumb">
        <img src="https://img.youtube.com/vi/${v.id}/mqdefault.jpg" alt="${escHtml(v.title)}" loading="lazy">
        <div class="video-play"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
        <span class="video-badge ${v.category}">${v.category}</span>
      </div>
      <div class="video-card-body">
        <h3>${escHtml(v.title)}</h3>
        <div class="video-meta">${v.date}${v.views ? ' · ' + v.views + ' views' : ''}</div>
        <p>${escHtml(v.description)}</p>
      </div>
    </div>
  `).join('');
}

function showDetail(videoId) {
  const v = youtubeVideos.find(x => x.id === videoId);
  if (!v) return;

  dom.modal.innerHTML = `
    <button class="modal-close" data-action="close-modal">✕</button>
    <img class="modal-backdrop" src="https://img.youtube.com/vi/${v.id}/maxresdefault.jpg" alt="${escHtml(v.title)}" onerror="this.style.display='none'">
    <div class="modal-body">
      <div class="detail-title-row">
        <h2>${escHtml(v.title)}</h2>
      </div>
      <div class="video-meta-detail">
        <span>${escHtml(v.date)}</span>
        ${v.views ? '<span>' + escHtml(v.views) + ' views</span>' : ''}
        <span class="video-badge ${v.category}" style="position:static;display:inline-block">${v.category}</span>
      </div>
      <div class="video-full-description">${escHtml(v.fullDescription)}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" data-video-play="${v.id}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Play Video
        </button>
        <button class="btn btn-secondary" data-action="close-modal">Close</button>
      </div>
    </div>
  `;
  dom.modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  dom.modalOverlay.classList.remove('active');
  dom.modal.innerHTML = '';
  document.body.style.overflow = '';
}

function openYouTubePlayer(videoId) {
  const frame = document.getElementById('youtube-frame');
  const modal = document.getElementById('youtube-modal');
  if (!frame || !modal) return;
  frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
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

/* ── Mobile Nav ── */
function lockScroll() {
  document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  document.body.style.overflow = '';
}
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
    <a href="/" style="color:var(--text-primary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">Home</a>
    <a href="movies.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">Movies</a>
    <a href="tv.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">TV Shows</a>
    <a href="youtube.html" style="color:var(--text-secondary);font-size:16px;font-weight:500;text-decoration:none;padding:12px 0">\uD83C\uDFAC CBE Movies</a>
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

init();
