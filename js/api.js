const API = {
  VIDAPI_BASE: 'https://vidapi.ru',
  PLAYER: 'https://vaplayer.ru',
  TMDB_BASE: 'https://api.themoviedb.org/3',
  IMG_BASE: 'https://image.tmdb.org/t/p',
  TMDB_TOKEN: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhMzQyZWNhZjBjNzNmYzU1NmI1NDk3NzQwYmJmZmE5MiIsIm5iZiI6MTc3NTIyMDE5OS42MDA5OTk4LCJzdWIiOiI2OWNmYjVlNzY4YjcwYWNmYjgyZjc2MmQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.jxycsZVC7uLmewooOKm20BvZUZ5s5H4qPsalI3FBmok',

  tmdbCache: {},

  /* ── HTTP ── */
  async fetchJSON(url, headers = {}) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.url}`);
    const text = await res.text();
    if (!text) throw new Error(`Empty response: ${res.url}`);
    return JSON.parse(text);
  },

  getTmdbHeaders() {
    return { Authorization: `Bearer ${this.TMDB_TOKEN}` };
  },

  async tmdbFetch(path) {
    const url = `${this.TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}language=en-US`;
    return this.fetchJSON(url, this.getTmdbHeaders());
  },

  /* ── Image URLs ── */
  imgUrl(path, size = 'w500') {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${this.IMG_BASE}/${size}${path}`;
  },

  /* ── VidAPI ── */
  getMoviePage(page = 1) {
    return this.fetchJSON(`${this.VIDAPI_BASE}/movies/latest/page-${page}.json`);
  },
  getTVPage(page = 1) {
    return this.fetchJSON(`${this.VIDAPI_BASE}/tvshows/latest/page-${page}.json`);
  },

  /* ── Player URL ── */
  getPlayerUrl(item, season = 1, episode = 1) {
    const themeParams = 'autoplay=1&theme=dark&color=ff94ca';
    if (item.type === 'movie' || !item.type) {
      const id = item.imdb_id || item.tmdb_id;
      return `${this.PLAYER}/embed/movie/${id}?${themeParams}`;
    }
    if (item.type === 'tv') {
      const id = item.imdb_id || item.tmdb_id;
      return `${this.PLAYER}/embed/tv/${id}/${season}/${episode}?${themeParams}`;
    }
    return item.embed_url;
  },

  /* ── Search ── */
  searchMovies(items, query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return items.filter(item =>
      item.title?.toLowerCase().includes(q) ||
      item._tmdbTitle?.toLowerCase().includes(q) ||
      item.genre?.toLowerCase().includes(q) ||
      item._genres?.some(g => g.toLowerCase().includes(q)) ||
      item.year?.includes(q)
    );
  },

  /* ── Item mapping helpers ── */
  mapTmdbMovie(m) {
    return {
      tmdb_id: m.id,
      imdb_id: m.imdb_id || null,
      title: m.title,
      year: (m.release_date || '').split('-')[0],
      genre: 'Trending',
      rating: m.vote_average?.toFixed(1) || '0',
      poster_url: this.imgUrl(m.poster_path, 'w500'),
      popularity: m.popularity?.toFixed(2) || '0',
      type: 'movie',
      embed_url: `${this.PLAYER}/embed/movie/${m.id}`,
      _backdrop: this.imgUrl(m.backdrop_path, 'original'),
      _overview: m.overview || '',
      _poster: this.imgUrl(m.poster_path, 'w500'),
      _rating: m.vote_average?.toFixed(1) || '0',
      _tmdbTitle: m.title,
      _year: (m.release_date || '').split('-')[0],
      _tmdb: true
    };
  },

  mapTmdbTV(t) {
    return {
      tmdb_id: t.id,
      imdb_id: null,
      title: t.name,
      year: (t.first_air_date || '').split('-')[0],
      genre: 'Trending',
      rating: t.vote_average?.toFixed(1) || '0',
      poster_url: this.imgUrl(t.poster_path, 'w500'),
      popularity: t.popularity?.toFixed(2) || '0',
      type: 'tv',
      embed_url: `${this.PLAYER}/embed/tv/${t.id}/1/1`,
      _backdrop: this.imgUrl(t.backdrop_path, 'original'),
      _overview: t.overview || '',
      _poster: this.imgUrl(t.poster_path, 'w500'),
      _rating: t.vote_average?.toFixed(1) || '0',
      _tmdbTitle: t.name,
      _year: (t.first_air_date || '').split('-')[0],
      _tmdb: true
    };
  },

  resolveTmdbItems(data, mediaType) {
    return (data.results || []).slice(0, 20).map(item => {
      if (mediaType === 'tv' || item.media_type === 'tv' || item.first_air_date)
        return this.mapTmdbTV(item);
      if (item.media_type === 'person')
        return this.mapTmdbPerson(item);
      return this.mapTmdbMovie(item);
    });
  },

  mapTmdbPerson(p) {
    return {
      tmdb_id: p.id,
      title: p.name,
      type: 'person',
      poster_url: this.imgUrl(p.profile_path, 'w185'),
      _poster: this.imgUrl(p.profile_path, 'w500'),
      _overview: p.known_for_department || '',
      _knownFor: (p.known_for || []).map(m => m.title || m.name).join(', '),
      _tmdbTitle: p.name,
      _tmdb: true
    };
  },

  /* ── TMDB Trending ── */
  async getTrending(timeWindow = 'week') {
    const [moviesRes, tvRes] = await Promise.all([
      this.tmdbFetch(`/trending/movie/${timeWindow}?page=1`),
      this.tmdbFetch(`/trending/tv/${timeWindow}?page=1`)
    ]);
    return {
      movies: (moviesRes.results || []).slice(0, 12).map(m => this.mapTmdbMovie(m)),
      tv: (tvRes.results || []).slice(0, 12).map(t => this.mapTmdbTV(t)),
    };
  },

  /* ── TMDB Movie Lists ── */
  getNowPlaying(page = 1) {
    return this.tmdbFetch(`/movie/now_playing?page=${page}`).then(d => this.resolveTmdbItems(d, 'movie'));
  },
  getPopularMovies(page = 1) {
    return this.tmdbFetch(`/movie/popular?page=${page}`).then(d => this.resolveTmdbItems(d, 'movie'));
  },
  getTopRatedMovies(page = 1) {
    return this.tmdbFetch(`/movie/top_rated?page=${page}`).then(d => this.resolveTmdbItems(d, 'movie'));
  },
  getUpcomingMovies(page = 1) {
    return this.tmdbFetch(`/movie/upcoming?page=${page}`).then(d => this.resolveTmdbItems(d, 'movie'));
  },

  /* ── TMDB TV Lists ── */
  getPopularTV(page = 1) {
    return this.tmdbFetch(`/tv/popular?page=${page}`).then(d => this.resolveTmdbItems(d, 'tv'));
  },
  getTopRatedTV(page = 1) {
    return this.tmdbFetch(`/tv/top_rated?page=${page}`).then(d => this.resolveTmdbItems(d, 'tv'));
  },
  getAiringToday(page = 1) {
    return this.tmdbFetch(`/tv/airing_today?page=${page}`).then(d => this.resolveTmdbItems(d, 'tv'));
  },
  getOnTheAir(page = 1) {
    return this.tmdbFetch(`/tv/on_the_air?page=${page}`).then(d => this.resolveTmdbItems(d, 'tv'));
  },

  /* ── Ethiopian / Amharic Movies ── */
  async getEthiopianMovies() {
    const [amharic, ethSearch] = await Promise.all([
      this.discoverMovie({ with_original_language: 'am', sort_by: 'popularity.desc', page: 1 }),
      this.searchTmdbMovie('ethiopian')
    ]);
    const seen = new Set();
    const merged = [...amharic];
    for (const item of ethSearch) {
      if (!seen.has(item.tmdb_id) && !amharic.some(a => a.tmdb_id === item.tmdb_id)) {
        seen.add(item.tmdb_id);
        merged.push(item);
      }
    }
    return merged;
  },

  /* ── TMDB Discover ── */
  discoverMovie(params = {}) {
    const qs = Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return this.tmdbFetch(`/discover/movie?${qs}`).then(d => this.resolveTmdbItems(d, 'movie'));
  },
  discoverTV(params = {}) {
    const qs = Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return this.tmdbFetch(`/discover/tv?${qs}`).then(d => this.resolveTmdbItems(d, 'tv'));
  },

  /* ── TMDB Search ── */
  searchTmdbMovie(query, page = 1) {
    return this.tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}&page=${page}`)
      .then(d => this.resolveTmdbItems(d, 'movie'));
  },
  searchTmdbTV(query, page = 1) {
    return this.tmdbFetch(`/search/tv?query=${encodeURIComponent(query)}&page=${page}`)
      .then(d => this.resolveTmdbItems(d, 'tv'));
  },
  searchTmdbPerson(query, page = 1) {
    return this.tmdbFetch(`/search/person?query=${encodeURIComponent(query)}&page=${page}`)
      .then(d => (d.results || []).map(p => this.mapTmdbPerson(p)));
  },
  searchAll(query, page = 1) {
    return this.tmdbFetch(`/search/multi?query=${encodeURIComponent(query)}&page=${page}`)
      .then(d => this.resolveTmdbItems(d));
  },

  /* ── TMDB Details ── */
  async fetchMovieDetails(tmdbId) {
    const key = `m_${tmdbId}`;
    if (this.tmdbCache[key]) return this.tmdbCache[key];
    try {
      const data = await this.tmdbFetch(`/movie/${tmdbId}?append_to_response=images,credits,recommendations,similar,videos,watch/providers`);
      this.tmdbCache[key] = data;
      return data;
    } catch { return null; }
  },

  async fetchTVDetails(tmdbId) {
    const key = `tv_${tmdbId}`;
    if (this.tmdbCache[key]) return this.tmdbCache[key];
    try {
      const data = await this.tmdbFetch(`/tv/${tmdbId}?append_to_response=images,credits,recommendations,similar,videos,content_ratings`);
      this.tmdbCache[key] = data;
      return data;
    } catch { return null; }
  },

  async fetchTVSeason(tmdbId, seasonNum) {
    const key = `tv_${tmdbId}_s${seasonNum}`;
    if (this.tmdbCache[key]) return this.tmdbCache[key];
    try {
      const data = await this.tmdbFetch(`/tv/${tmdbId}/season/${seasonNum}`);
      this.tmdbCache[key] = data;
      return data;
    } catch { return null; }
  },

  getTrailer(details) {
    if (!details?.videos?.results) return null;
    const trailer = details.videos.results.find(
      v => v.type === 'Trailer' && v.site === 'YouTube'
    ) || details.videos.results.find(
      v => v.type === 'Teaser' && v.site === 'YouTube'
    );
    return trailer ? { key: trailer.key, name: trailer.name } : null;
  },

  getCast(details, limit = 12) {
    if (!details?.credits?.cast) return [];
    return details.credits.cast.slice(0, limit).map(c => ({
      id: c.id,
      name: c.name,
      character: c.character,
      photo: c.profile_path ? this.imgUrl(c.profile_path, 'w185') : ''
    }));
  },

  getDirector(details) {
    if (!details?.credits?.crew) return null;
    const d = details.credits.crew.find(c => c.job === 'Director');
    return d ? d.name : null;
  },

  async enrichItem(item) {
    if (!item?.tmdb_id) return item;
    const isTV = item.type === 'tv';
    const details = isTV ? await this.fetchTVDetails(item.tmdb_id) : await this.fetchMovieDetails(item.tmdb_id);
    if (!details) return item;

    const common = {
      _overview: details.overview || '',
      _tagline: details.tagline || '',
      _backdrop: this.imgUrl(details.backdrop_path, 'original'),
      _genres: details.genres?.map(g => g.name) || [],
      _poster: this.imgUrl(details.poster_path, 'w500'),
      _year: details.release_date?.split('-')[0] || details.first_air_date?.split('-')[0] || item.year,
      _rating: details.vote_average?.toFixed(1) || item.rating,
      _voteCount: details.vote_count || 0,
      _popularity: details.popularity?.toFixed(0) || '0',
      _tmdbTitle: details.title || details.name || item.title,
      _trailer: this.getTrailer(details),
      _cast: this.getCast(details),
      _director: this.getDirector(details),
      _runtime: details.runtime || details.episode_run_time?.[0] || null,
      _status: details.status || '',
      _originalLanguage: details.original_language?.toUpperCase() || '',
      _homepage: details.homepage || '',
      _productionCompanies: details.production_companies?.map(c => ({ id: c.id, name: c.name })) || [],
      _productionCountries: details.production_countries?.map(c => c.name) || [],
      _imdbId: details.imdb_id || null
    };

    if (isTV) {
      const tvResult = {
        ...item,
        ...common,
        _seasons: details.number_of_seasons || 0,
        _episodes: details.number_of_episodes || 0,
        _networks: details.networks?.map(n => n.name) || [],
        _createdBy: details.created_by?.map(c => c.name) || [],
        _contentRating: details.content_ratings?.results?.find(r => r.iso_3166_1 === 'US')?.rating || '',
        _type: details.type || '',
        _lastAirDate: details.last_air_date || ''
      };

      // Prefer last season's trailer over the show-level trailer
      const lastSeasonNum = details.number_of_seasons;
      if (lastSeasonNum) {
        try {
          const season = await this.fetchTVSeason(item.tmdb_id, lastSeasonNum);
          if (season?.videos?.results) {
            const seasonTrailer = season.videos.results.find(
              v => v.type === 'Trailer' && v.site === 'YouTube'
            ) || season.videos.results.find(
              v => v.type === 'Teaser' && v.site === 'YouTube'
            );
            if (seasonTrailer) {
              tvResult._trailer = { key: seasonTrailer.key, name: seasonTrailer.name };
            }
          }
        } catch {}
      }

      return tvResult;
    }

    return {
      ...item,
      ...common,
      _budget: details.budget || 0,
      _revenue: details.revenue || 0,
      _originalTitle: details.original_title || ''
    };
  },

  async enrichItems(items) {
    const results = [];
    for (const item of items) {
      results.push(await this.enrichItem(item));
      await new Promise(r => setTimeout(r, 50));
    }
    return results;
  },

  /* ── TMDB Genres ── */
  getMovieGenres() {
    return this.tmdbFetch('/genre/movie/list').then(d => d.genres || []);
  },
  getTVGenres() {
    return this.tmdbFetch('/genre/tv/list').then(d => d.genres || []);
  },

  /* ── TMDB Related Content ── */
  getSimilarMovies(tmdbId, page = 1) {
    return this.tmdbFetch(`/movie/${tmdbId}/similar?page=${page}`).then(d => this.resolveTmdbItems(d, 'movie'));
  },
  getSimilarTV(tmdbId, page = 1) {
    return this.tmdbFetch(`/tv/${tmdbId}/similar?page=${page}`).then(d => this.resolveTmdbItems(d, 'tv'));
  },
  getRecommendations(tmdbId, page = 1) {
    return this.tmdbFetch(`/movie/${tmdbId}/recommendations?page=${page}`).then(d => this.resolveTmdbItems(d, 'movie'));
  },

  /* ── TMDB Configuration ── */
  getConfig() {
    return this.tmdbFetch('/configuration');
  },

  /* ── TMDB People ── */
  async fetchPersonDetails(personId) {
    const key = `p_${personId}`;
    if (this.tmdbCache[key]) return this.tmdbCache[key];
    try {
      const data = await this.tmdbFetch(`/person/${personId}?append_to_response=combined_credits,images,external_ids`);
      this.tmdbCache[key] = data;
      return data;
    } catch { return null; }
  },

  /* ── TMDB Companies ── */
  async getCompanyMovies(companyId, page = 1) {
    try {
      const data = await this.tmdbFetch(`/company/${companyId}/movies?page=${page}`);
      return this.resolveTmdbItems(data, 'movie');
    } catch { return []; }
  },

  /* ── TMDB Translations ── */
  translationCache: {},

  async fetchTranslations(tmdbId, mediaType = 'movie') {
    const key = `${mediaType}_${tmdbId}`;
    if (this.translationCache[key]) return this.translationCache[key];
    try {
      const url = `${this.TMDB_BASE}/${mediaType}/${tmdbId}/translations`;
      const data = await this.fetchJSON(url, this.getTmdbHeaders());
      this.translationCache[key] = data;
      return data;
    } catch {
      this.translationCache[key] = null;
      return null;
    }
  }
};
