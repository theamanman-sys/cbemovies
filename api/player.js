const ALLOWED_DOMAINS = [
  'vixsrc.to',
  'vidcore.org',
  'player.cinezo.live',
  'vidsrc.pm',
  'vidphantom.com',
  'brightpathsignals.com',
  'streamdata.vaplayer.ru',
];

function isAllowedUrl(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
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
    html = html.replace(/<script[^>]*>[\s\S]*?(?:die\(|self\.location|top\.location|parent\.location|frameElement|window\.(?:self|top|parent))[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<script[^>]*>[\s\S]*?disable-devtool[\s\S]*?<\/script>/gi, '');
    // Rewrite full origin URLs (src="https://upstream/...") through our proxy
    html = html.replace(new RegExp(`((?:src|href)=)["']${upstreamOrigin}([^"']*)["']`, 'gi'), `$1"/api/vp/${upstreamHost}$2"`);
    html = html.replace(new RegExp(`(url\\(['"]?)${upstreamOrigin}([^)"']*)`, 'g'), `$1/api/vp/${upstreamHost}$2`);
    // Rewrite absolute path URLs on asset elements (scripts, styles, images, video sources)
    // to go through our proxy, avoiding CORS issues with module scripts
    // Uses path-based URLs so module scripts can resolve relative import('./foo.js') correctly
    html = html.replace(/(<(?:script|link|img|source|video|audio)[^>]*\s(?:src|href)=["'])\/(?!\/|api\/)([^"']*)(["'])/gi, `$1/api/vp/${upstreamHost}/$2$3`);
    // Inject <base> tag so relative paths resolve against the upstream origin
    html = html.replace('<head>', `<head><base href="${upstreamOrigin}/">`);
    // If the page is from a source that sends postMessage progress events natively,
    // we only inject our progress relay for sources that lack native support
    html = html.replace('</body>', '<script>\n' +
'(function(){\n' +
'  var v=document.querySelector(\'video\');\n' +
'  if(!v)return;\n' +
'  function send(){try{parent.postMessage({type:\'cbemovies-progress\',currentTime:v.currentTime},\'*\')}catch(e){}}\n' +
'  v.addEventListener(\'timeupdate\',send);\n' +
'  v.addEventListener(\'play\',send);\n' +
'  v.addEventListener(\'seeked\',send);\n' +
'  send();\n' +
'})();\n' +
'</script></body>');
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch { res.status(502).end(); }
};
