module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  const upstreamUrl = decodeURIComponent(url);
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
    html = html.replace(/(src|href)="(\/[^"]*)"/g, function(m, attr, fullpath) {
      if (fullpath.startsWith('//') || fullpath.startsWith('/api/')) return m;
      return attr + '="/api/vp?path=' + encodeURIComponent(fullpath) + '"';
    });
    html = html.replace(/(url\(['"]?)\/(?!\/)/g, '$1/api/vp?path=/');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', '');
    res.status(200).send(html);
  } catch { res.status(502).end(); }
};
