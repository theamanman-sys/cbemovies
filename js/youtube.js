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
    if (e.target.closest('.mobile-menu-btn')) {
      document.getElementById('nav').classList.toggle('nav-open');
      return;
    }
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

init();
