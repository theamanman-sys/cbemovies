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
  const { tmdb, imdb, type = 'movie', season, episode, subs } = req.query;

  if (req.query.url) {
    const upstreamUrl = decodeURIComponent(req.query.url);
    try {
      const response = await fetch(upstreamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Referer': 'https://vidsrc.pm/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      if (!response.ok) { res.status(response.status).end(); return; }
      let html = await response.text();
      html = html.replace(/<script>[\s\S]*?(?:die\(|self\.location|top\.location|parent\.location|frameElement)[\s\S]*?<\/script>/gi, '');
      html = html.replace(/<script[\s\S]*?disable-devtool[\s\S]*?<\/script>/gi, '');
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('X-Frame-Options', '');
      res.status(200).send(html);
    } catch { res.status(502).end(); }
    return;
  }

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

  if (req.query.vidphantom) {
    let upstreamUrl;
    if (type === 'tv' && season && episode) {
      upstreamUrl = `https://vidphantom.com/tv/${tmdbId}/${season}/${episode}?primaryColor=FF94CA`;
    } else {
      upstreamUrl = `https://vidphantom.com/movie/${tmdbId}?primaryColor=FF94CA`;
    }
    try {
      const vpRes = await fetch(upstreamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      if (!vpRes.ok) {
        res.status(502).json({ error: `Vidphantom returned ${vpRes.status}` });
        return;
      }
      let html = await vpRes.text();
      html = html.replace(/(src|href)="(\/[^"]*)"/g, function(m, attr, fullpath) {
        if (fullpath.startsWith('//') || fullpath.startsWith('/api/')) return m;
        return attr + '="/api/vp?path=' + encodeURIComponent(fullpath) + '"';
      });
      html = html.replace(/(url\(['"]?)\/(?!\/)/g, '$1/api/vp?path=/');
      html = html.replace(/VidPhantom|VidAPI|BrightPathSignals|vaplayer/gi, 'VideoBet');
      html = html.replace(/>Phantom\b/gi, '>VideoBet');

      if (subs && imdbId) {
        const subImdb = imdbId.replace(/^tt/, '');
        html = html.replace(
          '</body>',
          `<div id="subtitle-overlay" style="position:absolute;bottom:70px;left:0;right:0;text-align:center;pointer-events:none;z-index:20;padding:0 20px;color:#fff;font-family:'Noto Sans Ethiopic',sans-serif;text-shadow:0 2px 6px rgba(0,0,0,0.9);line-height:1.5"><span class="sub-inner" style="display:inline-block;background:rgba(0,0,0,0.7);padding:6px 14px;border-radius:4px;max-width:90%;backdrop-filter:blur(2px)"></span></div>
<script>
(function(){
var lang='${subs}',imdb='tt${subImdb}';
var iframe=document.getElementById('embed-iframe');
if(!iframe)return;
var _mo=new MutationObserver(function(){
var s=iframe.getAttribute('src');
if(s&&!s.includes('/api/player?subs=')){iframe.setAttribute('src','/api/player?subs='+encodeURIComponent(lang)+'&url='+encodeURIComponent(s))}
});
_mo.observe(iframe,{attributes:true,attributeFilter:['src']});
var vtt='',cues=[];
function parseVTT(t){var p=t.split(/[:.]/);return(+p[0])*3600+(+p[1])*60+(+p[2])+(+(p[3]||0))/1000}
fetch('/api/subtitle?imdb='+encodeURIComponent(imdb)+'&lang='+encodeURIComponent(lang)+'&from=en').then(function(r){
if(!r.ok)return;
return r.text();
}).then(function(t){
if(!t||t.startsWith('{'))return;
vtt=t;
var lines=vtt.split('\\n'),cue=null;
for(var i=0;i<lines.length;i++){
var m=lines[i].match(/(\\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s*-->\\s*(\\d{2}:\\d{2}:\\d{2}\\.\\d{3})/);
if(m){cue={s:parseVTT(m[1]),e:parseVTT(m[2]),t:''};cues.push(cue);}
else if(cue&&lines[i].trim()&&!lines[i].startsWith('WEBVTT')){cue.t+=(cue.t?'\\n':'')+lines[i];}
}
var overlay=document.getElementById('subtitle-overlay');
var inner=overlay&&overlay.querySelector('.sub-inner');
function attach(){
try{
var video=iframe.contentDocument&&iframe.contentDocument.getElementById('video');
if(!video){setTimeout(attach,500);return}
video.addEventListener('timeupdate',function(){
var time=video.currentTime,text='';
for(var j=0;j<cues.length;j++){if(time>=cues[j].s&&time<=cues[j].e){text=cues[j].t;break}}
if(inner)inner.textContent=text;
if(overlay)overlay.style.display=text?'block':'none';
});
}catch(e){setTimeout(attach,500)}
}
iframe.addEventListener('load',attach);
if(iframe.contentDocument)attach();
});
})();
</script>
</body>`
        );
      }

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).send(html);
    } catch {
      res.status(502).json({ error: 'Failed to fetch vidphantom' });
    }
    return;
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

    html = html.replace(/(src|href)="(\/[^"]*)"/g, function(m, attr, fullpath) {
      if (fullpath.startsWith('//') || fullpath.startsWith('/api/')) return m;
      return attr + '="/api/bs?path=' + encodeURIComponent(fullpath) + '"';
    });

    html = html.replace(
      /<a\s+class="player-brand"[\s\S]*?<\/a>/g,
      ''
    );
    html = html.replace(/VidAPI|BrightPathSignals|vaplayer/gi, 'VideoBet');
    html = html.replace(/(url\(['"]?)\/(?!\/)/g, '$1/api/bs?path=/');

    const fallbackImdb = imdbId ? `'${imdbId}'` : 'null';
    const subLang = subs || '';
    const subImdb = (imdbId || imdb || '').replace(/^tt/, '').replace(/^0+/, '') || '';

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
${subLang ? `#subtitle-overlay{position:absolute;bottom:70px;left:0;right:0;text-align:center;pointer-events:none;z-index:20;padding:0 20px;font-size:1.2em;color:#fff;font-family:'Noto Sans Ethiopic',sans-serif;text-shadow:0 2px 6px rgba(0,0,0,0.9);line-height:1.5;transition:opacity .15s}
#subtitle-overlay .sub-inner{display:inline-block;background:rgba(0,0,0,0.7);padding:6px 14px;border-radius:4px;max-width:90%;backdrop-filter:blur(2px)}` : ''}
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
 (function(){
 function replaceText(n){
 if(n.nodeType===3){var t=n.textContent;if(/Phantom|vidphantom|vidapi|brightpathsignals|vaplayer/i.test(t)){n.textContent=t.replace(/VidPhantom|VidAPI|BrightPathSignals|vaplayer/gi,'VideoBet').replace(/Phantom/gi,'VideoBet')}}
 else if(n.nodeType===1&&!['SCRIPT','STYLE'].includes(n.tagName)){if(n.title&&/Phantom|vidphantom|vidapi|brightpathsignals|vaplayer/i.test(n.title)){n.title=n.title.replace(/VidPhantom|VidAPI|BrightPathSignals|vaplayer/gi,'VideoBet').replace(/Phantom/gi,'VideoBet')}
for(var c=0;c<n.childNodes.length;c++)replaceText(n.childNodes[c])}
}
document.addEventListener('DOMContentLoaded',function(){replaceText(document.body)});
var mo=new MutationObserver(function(m){m.forEach(function(mut){mut.addedNodes.forEach(function(n){if(n.nodeType===1||n.nodeType===3)replaceText(n)})})});
mo.observe(document.documentElement,{childList:true,subtree:true});
})();
</script>
</head>`
    );

    if (subLang && subImdb) {
      const subUrl = `/api/subtitle?imdb=tt${subImdb}&lang=${encodeURIComponent(subLang)}&from=en`;
      html = html.replace(
        '</body>',
        `<div id="subtitle-overlay"><span class="sub-inner"></span></div>
<script>
(function(){
var lang='${subLang}',imdb='tt${subImdb}';
var vtt='',cues=[];
var overlay=document.getElementById('subtitle-overlay');
var inner=overlay&&overlay.querySelector('.sub-inner');
function parseVTT(t){
var parts=t.split(/[:.]/);return(+parts[0])*3600+(+parts[1])*60+(+parts[2])+(+(parts[3]||0))/1000;
}
fetch('/api/subtitle?imdb='+encodeURIComponent(imdb)+'&lang='+encodeURIComponent(lang)+'&from=en').then(function(r){
if(!r.ok)return r.text().then(function(t){overlay&&(overlay.style.display='none');return});
return r.text();
}).then(function(t){
if(!t||t.startsWith('{')){overlay&&(overlay.style.display='none');return}
vtt=t;
var lines=vtt.split('\\n'),cue=null;
for(var i=0;i<lines.length;i++){
var m=lines[i].match(/(\\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s*-->\\s*(\\d{2}:\\d{2}:\\d{2}\\.\\d{3})/);
if(m){cue={s:parseVTT(m[1]),e:parseVTT(m[2]),t:''};cues.push(cue);}
else if(cue&&lines[i].trim()&&!lines[i].startsWith('WEBVTT')){cue.t+=(cue.t?'\\n':'')+lines[i];}
}
var video=document.getElementById('video');
if(!video){overlay&&(overlay.style.display='none');return}
video.addEventListener('timeupdate',function(){
var time=video.currentTime,text='';
for(var j=0;j<cues.length;j++){if(time>=cues[j].s&&time<=cues[j].e){text=cues[j].t;break;}}
if(inner)inner.textContent=text;
if(overlay)overlay.style.display=text?'block':'none';
});
}).catch(function(){overlay&&(overlay.style.display='none')});
})();
</script>
</body>`
      );
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(html);

  } catch (err) {
    console.error('Player proxy error:', err);
    res.status(502).json({ error: 'Failed to fetch player page', detail: err.message });
  }
};
