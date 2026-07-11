const ALLOWED_DOMAINS = [
  'vixsrc.to',
  'vidcore.org',
  'player.cinezo.live',
  'vidsrc.pm',
  'vidphantom.com',
  'brightpathsignals.com',
  'streamdata.vaplayer.ru',
  'yapgrid.com',
  'apiplayer.ru',
  'vidsrc.sbs',
];

function isAllowedUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.port && !['80', '443', ''].includes(parsed.port)) return false;
    const hostname = parsed.hostname.toLowerCase();
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f\u2000-\u200f\u2028-\u202f\u205f-\u206f\uff00-\uffef]/.test(hostname)) return false;
    if (hostname !== decodeURIComponent(hostname)) return false;
    return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}

module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  const upstreamUrl = decodeURIComponent(url);
  if (!isAllowedUrl(upstreamUrl)) {
    res.status(403).json({ error: 'Domain not allowed' });
    return;
  }

  const upstreamParsed = new URL(upstreamUrl);
  const upstreamHost = upstreamParsed.hostname;
  const upstreamOrigin = upstreamParsed.origin;
  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': `https://${upstreamHost}/`,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    if (!response.ok) { res.status(response.status).end(); return; }
    let html = await response.text();
    // Strip anti-embed scripts that detect iframe context
    html = html.replace(/<script[\s\S]*?(?:die\s*\(|self\.location|top\.location|parent\.location|frameElement|window\s*\.\s*(?:self|top|parent)|top\s*!==\s*self|self\s*!==\s*top)[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<script[\s\S]*?disable-devtool[\s\S]*?<\/script>/gi, '');
    // Strip known ad/tracker CDN scripts
    html = html.replace(/<script[^>]*\s+src=["'](?:https?:)?\/\/(?:acscdn\.com|dpjf9a2rbjbvp\.cloudfront\.net|s10\.histats\.com)[^"']*["'][^>]*><\/script>/gi, '');
    // Cloudflare Turnstile may be needed by HLS proxy to serve streams
    // Inject base tag so relative/absolute paths resolve against upstream origin
    html = html.replace('<head>', `<head><base href="${upstreamOrigin}/">`);
    // Inject postMessage progress relay from video element
    html = html.replace('</body>', '<script>\n' +
'(function(){\n' +
'  var ORIGIN = ' + JSON.stringify(process.env.BASE_URL || 'https://cbemovies.vercel.app') + ';\n' +
'  function hook(v){\n' +
'    function send(){try{parent.postMessage({type:\'cbemovies-progress\',currentTime:v.currentTime},ORIGIN)}catch(e){}}\n' +
'    v.addEventListener(\'timeupdate\',send);\n' +
'    v.addEventListener(\'play\',send);\n' +
'    v.addEventListener(\'seeked\',send);\n' +
'    send();\n' +
'  }\n' +
'  function poll(){\n' +
'    var v=document.querySelector(\'video\');\n' +
'    if(v){hook(v);return;}\n' +
'    setTimeout(poll,300);\n' +
'  }\n' +
'  poll();\n' +
'})();\n' +
'</script></body>');
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (err) { res.status(502).json({ error: 'Upstream fetch failed' }); }
};
