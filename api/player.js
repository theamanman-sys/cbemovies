const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhMzQyZWNhZjBjNzNmYzU1NmI1NDk3NzQwYmJmZmE5MiIsIm5iZiI6MTc3NTIyMDE5OS42MDA5OTk4LCJzdWIiOiI2OWNmYjVlNzY4YjcwYWNmYjgyZjc2MmQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.jxycsZVC7uLmewooOKm20BvZUZ5s5H4qPsalI3FBmok';
const TMDB_BASE = 'https://api.themoviedb.org/3';

async function tmdbFetch(path) {
  const url = `${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}language=en-US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.url}`);
  return res.json();
}

async function resolveImdb(tmdbId, type) {
  try {
    const endpoint = type === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
    const data = await tmdbFetch(endpoint);
    return data.imdb_id || null;
  } catch { return null; }
}

module.exports = async (req, res) => {
  const { tmdb, imdb, type = 'movie', season, episode } = req.query;

  if (!imdb && !tmdb) {
    res.status(400).json({ error: 'Missing tmdb or imdb parameter' });
    return;
  }

  let imdbId = imdb || null;
  let tmdbId = tmdb || null;

  if (tmdbId && !imdbId) {
    imdbId = await resolveImdb(tmdbId, type);
  }

  if (!tmdbId && imdbId) {
    tmdbId = imdbId;
  }

  let upstreamUrl;
  if (type === 'tv' && season && episode) {
    upstreamUrl = `https://brightpathsignals.com/embed/tv/${tmdbId}/${season}/${episode}/`;
  } else {
    upstreamUrl = `https://brightpathsignals.com/embed/movie/${tmdbId}/`;
  }

  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': 'https://vidsrc.pm/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      res.status(502).json({ error: `Upstream returned ${response.status}` });
      return;
    }

    let html = await response.text();

    html = html.replace(
      /<!-- Sandbox Protection -->[\s\S]*?<\/script>\s*<\/script>\s*/g,
      ''
    );

    html = html.replace(
      /<!-- DevTools Protection -->[\s\S]*?<\/script>\s*<\/script>\s*/g,
      ''
    );

    html = html.replace(
      /<script>[\s\S]*?\(function\(\)\{[\s\S]*?if\(s\)\{die\(\);throw'';\}[\s\S]*?<\/script>/g,
      ''
    );

    html = html.replace(
      /<script[\s\S]*?disable-devtool[\s\S]*?<\/script>/g,
      ''
    );

    html = html.replace(
      /(src|href)="(\/embed\/)/g,
      '$1="https://brightpathsignals.com$2'
    );

    html = html.replace(
      /<a\s+class="player-brand"[\s\S]*?<\/a>/g,
      ''
    );

    const fallbackImdb = imdbId ? `'${imdbId}'` : 'null';

    html = html.replace(
      '</head>',
      `<style>
:root{--accent:#FF94CA;--player-accent:#FF94CA}
.player-wrapper{--accent:#FF94CA}
.player-brand{display:none!important}
.disney-btn:hover,.disney-circle-btn:hover{background:rgba(255,148,202,0.3)!important;border-color:#FF94CA!important}
.disney-circle-btn{color:#FF94CA!important}
.disney-play-btn{background:#FF94CA!important;color:#fff!important}
.progress-current,.volume-level{background:#FF94CA!important}
.disney-handle{background:#FF94CA!important;border-color:#FF94CA!important;box-shadow:0 0 8px rgba(255,148,202,0.5)!important}
.volume-slider::-webkit-slider-thumb{background:#FF94CA!important}
.volume-slider::-moz-range-thumb{background:#FF94CA!important}
input[type=range]::-webkit-slider-thumb{background:#FF94CA!important}
.video-title{color:#FF94CA!important}
.big-play{background:rgba(255,148,202,0.2)!important;border-color:#FF94CA!important;color:#FF94CA!important}
.big-play:hover{background:rgba(255,148,202,0.35)!important}
.poster-play{color:#FF94CA!important}
.loading-spinner{border-top-color:#FF94CA!important;border-bottom-color:#FF94CA!important}
.menu-tab.active{color:#FF94CA!important;border-bottom-color:#FF94CA!important}
.sync-btn{color:#FF94CA!important;border-color:#FF94CA!important}
.menu-action{background:rgba(255,148,202,0.15)!important;color:#FF94CA!important}
.menu-action:hover{background:rgba(255,148,202,0.25)!important}
.section-title{color:#FF94CA!important}
.style-reset-btn{color:#FF94CA!important}
.settings-item:hover{background:rgba(255,148,202,0.1)!important}
.ep-dropdown-btn{color:#FF94CA!important}
.ep-dropdown-menu{background:rgba(255,148,202,0.1)!important}
.ctrl-btn{color:#fff!important}
.ctrl-btn:hover{color:#FF94CA!important}
.time-display{color:#fff!important}
</style>
<script>
try{
var _origFetch=window.fetch;
window.fetch=function(){
var a=arguments;
if(typeof a[0]==='string'&&(a[0].includes('streamdata.vaplayer.ru')||a[0].includes('source-api.php'))){
return _origFetch.apply(this,a).then(function(r){
if(!r.ok||r.status===404){
var fallbackImdb=${fallbackImdb};
if(fallbackImdb){
console.warn('[VideoBet] Primary stream returned '+r.status+', trying IMDB fallback:',fallbackImdb);
var fallbackUrl='https://streamdata.vaplayer.ru/api.php?imdb='+encodeURIComponent(fallbackImdb)+'&type=${type}'${type==='tv'&&season&&episode?'+\'&season=${season}&episode=${episode}\'':''};
return _origFetch(fallbackUrl,{headers:{'User-Agent':'Mozilla/5.0','Referer':'https://brightpathsignals.com/'}}).then(function(fr){
if(!fr.ok)return r;
try{return fr.json().then(function(fj){
if(fj.status_code==200||fj.status_code==='200'||(fj.data&&fj.data.stream_urls)){
return new Response(JSON.stringify(fj),{status:200,headers:{'Content-Type':'application/json'}});
}
return r;
})}catch(e){return r}
});
}
}
return r;
}).catch(function(){return _origFetch.apply(this,a)});
}
return _origFetch.apply(this,a);
};
}catch(e){console.warn('[VideoBet] Fetch override failed:',e);}
</script>
</head>`
    );

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(html);

  } catch (err) {
    console.error('Player proxy error:', err);
    res.status(502).json({ error: 'Failed to fetch player page', detail: err.message });
  }
};
