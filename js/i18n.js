const LANG_KEY = 'cbemovies_lang';

const i18n = {
  current: localStorage.getItem(LANG_KEY) || 'en',

  strings: {
    en: {
      'Home': 'Home',
      'Trending': 'Trending',
      'Movies': 'Movies',
      'TV Shows': 'TV Shows',
      'CBE Movies': 'CBE Movies',
      'Trending Movies': 'Trending Movies',
      'Trending TV Shows': 'Trending TV Shows',
      'Now Playing in Theaters': 'Now Playing in Theaters',
      'Latest Movies': 'Latest Movies',
      'Featured': 'Featured',
      'Popular TV Shows': 'Popular TV Shows',
      'Ethiopian Movies': 'Ethiopian Movies',
      'Search': 'Search',
      'Play Now': 'Play Now',
      'More Info': 'More Info',
      'Close': 'Close',
      'Loading...': 'Loading...',
      'Loading the latest content for you...': 'Loading the latest content for you...',
      'Trailer': 'Trailer',
      'Rating': 'Rating',
      'Year': 'Year',
      'Status': 'Status',
      'Language': 'Language',
      'Runtime': 'Runtime',
      'Director': 'Director',
      'Popularity': 'Popularity',
      'Budget': 'Budget',
      'Revenue': 'Revenue',
      'Content Rating': 'Content Rating',
      'Seasons': 'Seasons',
      'Episodes': 'Episodes',
      'Network': 'Network',
      'Created By': 'Created By',
      'Production': 'Production',
      'Cast': 'Cast',
      'Overview': 'Overview',
      'Similar Titles': 'Similar Titles',
      'Playback Progress': 'Playback Progress',
      'Season': 'Season',
      'Episode': 'Episode',
      'No episodes available': 'No episodes available',
      'Loading episodes...': 'Loading episodes...',
      'All': 'All',
      'People': 'People',
      'Type to search movies & TV shows...': 'Type to search movies & TV shows...',
      'Type to search movies, TV shows & people...': 'Type to search movies, TV shows & people...',
      'No results found': 'No results found',
      'Try a different search term for': 'Try a different search term for',
      'Search failed': 'Search failed',
      'Could not load data.': 'Could not load data.',
      'Check your connection.': 'Check your connection.',
      'See all results →': 'See all results →',
      'Filmography': 'Filmography',
      'No biography available.': 'No biography available.',
      'CBE Movies loaded': 'CBE Movies loaded',
      'Failed to load content.': 'Failed to load content.',
      'No media selected': 'No media selected',
      'Retry': 'Retry',
      'View Full Channel →': 'View Full Channel →',
      'Browse': 'Browse',
      'New Releases': 'New Releases',
      'About': 'About',
      'Privacy Policy': 'Privacy Policy',
      'Terms of Service': 'Terms of Service',
      'DMCA': 'DMCA',
      'Contact': 'Contact',
      'All rights reserved.': 'All rights reserved.',
      'CBE Movies — Experience Cinema': 'CBE Movies — Experience Cinema',
      'Official YouTube channel — banking, financial insights, and community updates': 'Official YouTube channel — banking, financial insights, and community updates',
    },

    am: {
      'Home': 'መነሻ',
      'Trending': 'ተወዳጅ',
      'Movies': 'ፊልሞች',
      'TV Shows': 'የቲቪ ፕሮግራሞች',
      'CBE Movies': 'ሲቢኢ ሙቪስ',
      'Trending Movies': 'ተወዳጅ ፊልሞች',
      'Trending TV Shows': 'ተወዳጅ የቲቪ ፕሮግራሞች',
      'Now Playing in Theaters': 'በሲኒማ ቤቶች እየታየ ያለ',
      'Latest Movies': 'አዳዲስ ፊልሞች',
      'Featured': 'ተለይተው የቀረቡ',
      'Popular TV Shows': 'ታዋቂ የቲቪ ፕሮግራሞች',
      'Ethiopian Movies': 'የኢትዮጵያ ፊልሞች',
      'Search': 'ፈልግ',
      'Play Now': 'አሁን አጫውት',
      'More Info': 'ተጨማሪ መረጃ',
      'Close': 'ዝጋ',
      'Loading...': 'በማስመጣት ላይ...',
      'Loading the latest content for you...': 'አዳዲስ ይዘቶችን እያመጣልን ነው...',
      'Trailer': 'የማስታወቂያ ቪዲዮ',
      'Rating': 'ደረጃ',
      'Year': 'ዓመት',
      'Status': 'ሁኔታ',
      'Language': 'ቋንቋ',
      'Runtime': 'ርዝመት',
      'Director': 'ዳይሬክተር',
      'Popularity': 'ተወዳጅነት',
      'Budget': 'በጀት',
      'Revenue': 'ገቢ',
      'Content Rating': 'የይዘት ደረጃ',
      'Seasons': 'ምዕራፎች',
      'Episodes': 'ክፍሎች',
      'Network': 'አውታር',
      'Created By': 'ፈጣሪ',
      'Production': 'አዘጋጅ',
      'Cast': 'ተዋንያን',
      'Overview': 'አጠቃላይ እይታ',
      'Similar Titles': 'ተመሳሳይ ፊልሞች',
      'Playback Progress': 'የመጫወቻ ሂደት',
      'Season': 'ምዕራፍ',
      'Episode': 'ክፍል',
      'No episodes available': 'ምንም ክፍሎች የሉም',
      'Loading episodes...': 'ክፍሎችን በማስመጣት ላይ...',
      'All': 'ሁሉም',
      'People': 'ሰዎች',
      'Type to search movies & TV shows...': 'ፊልሞች እና የቲቪ ፕሮግራሞችን ለመፈለግ ይፃፉ...',
      'Type to search movies, TV shows & people...': 'ፊልሞች፣ የቲቪ ፕሮግራሞች እና ሰዎችን ለመፈለግ ይፃፉ...',
      'No results found': 'ምንም ውጤት አልተገኘም',
      'Try a different search term for': 'ለዚህ የተለየ የፍለጋ ቃል ይሞክሩ',
      'Search failed': 'ፍለጋ አልተሳካም',
      'Could not load data.': 'ውሂብ መጫን አልተቻለም።',
      'Check your connection.': 'ግንኙነትዎን ያረጋግጡ።',
      'See all results →': 'ሁሉንም ውጤቶች ይመልከቱ →',
      'Filmography': 'የፊልም ስራዎች',
      'No biography available.': 'የህይወት ታሪክ የለም።',
      'CBE Movies loaded': 'ሲቢኢ ሙቪስ ተጭኗል',
      'Failed to load content.': 'ይዘት መጫን አልተሳካም።',
      'No media selected': 'ምንም ሚዲያ አልተመረጠም',
      'Retry': 'ደግሞ ሞክር',
      'View Full Channel →': 'ሙሉ ቻናል ይመልከቱ →',
      'Browse': 'ማሰስ',
      'New Releases': 'አዳዲስ ልቀቶች',
      'About': 'ስለኛ',
      'Privacy Policy': 'የግላዊነት ፖሊሲ',
      'Terms of Service': 'የአገልግሎት ውሎች',
      'DMCA': 'DMCA',
      'Contact': 'አግኙን',
      'All rights reserved.': 'መብቱ በህግ የተጠበቀ ነው።',
      'CBE Movies — Experience Cinema': 'ሲቢኢ ሙቪስ — ሲኒማን ያግኙ',
      'Official YouTube channel — banking, financial insights, and community updates': 'የኢትዮጵያ ንግድ ባንክ ኦፊሴላዊ የዩቱዩብ ቻናል — የባንክ አገልግሎቶች፣ የፋይናንስ መረጃዎች እና የማህበረሰብ ዝማኔዎች',
    }
  },

  t(key) {
    const lang = this.strings[this.current];
    return lang && lang[key] !== undefined ? lang[key] : key;
  },

  setLang(lang) {
    if (!this.strings[lang]) return;
    this.current = lang;
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    this.applyToDOM();
  },

  applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      el.placeholder = this.t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      el.title = this.t(key);
    });
  },

  init() {
    document.documentElement.lang = this.current;
    this.applyToDOM();
  }
};

function __(key) {
  return i18n.t(key);
}

window.__ = __;
window.i18n = i18n;
