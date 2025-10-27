// content_script.js
// Only extract & send article when heuristics indicate a news/article page.
// Also compute simple tag suggestions (top frequent words + meta keywords).

(function () {
  try {
    // Helper: safe querySelector for meta
    const metaContent = (selector, prop = 'content') => {
      const el = document.querySelector(selector);
      return el ? (el.getAttribute(prop) || '').trim() : '';
    };

    // Clone document and parse with Readability
    const docClone = document.cloneNode(true);
    const article = new Readability(docClone).parse();

    const url = window.location.href || '';
    const title = (article && article.title) ? article.title : (document.title || '');
    const byline = (article && article.byline) ? article.byline : (metaContent('meta[name="author"]') || '');

    // Heuristics
    function hasArticleTag() { return !!document.querySelector('article'); }

    function metaOgIsArticle() {
      const ogTypeEl = document.querySelector('meta[property="og:type"]');
      const ogType = ogTypeEl ? (ogTypeEl.getAttribute('content') || '').toLowerCase() : '';
      if (ogType) return ogType.includes('article');
      const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(s => s.textContent || '').join(' ');
      return /"@type"\s*:\s*"(Article|NewsArticle)"/i.test(ld);
    }

    function urlLooksLikeArticle(u) {
      const lower = (u || '').toLowerCase();
      if (/(\/news\/|\/article\/|\/articles\/|\/stories\/)/.test(lower)) return true;
      if (/(\/20\d{2}\/\d{1,2}\/\d{1,2}\/|\/20\d{2}\/\d{1,2}\/)/.test(lower)) return true;
      if (/news\./.test(lower)) return true;
      return false;
    }

    function articleLengthSignal(parsed) {
      if (!parsed || !parsed.textContent) return false;
      const words = parsed.textContent.trim().split(/\s+/).filter(Boolean).length;
      return words >= 300;
    }

    function keywordSignal() {
      const keywords = (metaContent('meta[name="keywords"]') || metaContent('meta[name="news_keywords"]') || metaContent('meta[name="description"]') || '').toLowerCase();
      if (!keywords) return false;
      const newsKeywords = ['news', 'breaking', 'report', 'analysis', 'opinion', 'coverage', 'exclusive', 'editorial', 'interview', 'update'];
      return newsKeywords.some(k => keywords.includes(k));
    }

    function titleBylineSignal(t, b) {
      if (!t) return false;
      const tlen = t.trim().split(/\s+/).length;
      return (tlen >= 3) || (b && b.trim().length > 0);
    }

    // Build signals and decide
    const signals = [
      hasArticleTag(),
      metaOgIsArticle(),
      urlLooksLikeArticle(url),
      articleLengthSignal(article),
      keywordSignal(),
      titleBylineSignal(title, byline)
    ];
    const positiveCount = signals.filter(Boolean).length;
    const REQUIRED_SIGNALS = 2; // tuneable

    // compute tag suggestions if we have article text
    function computeTagSuggestions(text) {
      if (!text || !text.length) return [];
      // small stopword list
      const STOP = new Set(("a,about,above,after,again,against,all,am,an,and,any,are,as,at,be,because,been,before,being," +
        "below,between,both,but,by,could,did,do,does,doing,down,during,each,few,for,from,further,had,has,have,having," +
        "he,her,here,hers,him,himself,his,how,i,if,in,into,is,it,its,itself,just,me,more,most,my,myself,no,nor,not,now," +
        "of,off,on,once,only,or,other,our,ours,ourselves,out,over,own,same,she,should,so,some,such,than,that,the,their," +
        "theirs,them,themselves,then,there,these,they,this,those,through,to,too,under,until,up,very,was,we,were,what,when," +
        "where,which,while,who,whom,why,will,with,you,your,yours,yourself,yourselves").split(","));
      // normalize
      const normalized = text.toLowerCase().replace(/[\u2018\u2019\u201C\u201D]/g, "'").replace(/[^a-z0-9'\s]/g, " ");
      const tokens = normalized.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
      const freq = {};
      for (let t of tokens) freq[t] = (freq[t] || 0) + 1;
      // convert to array and sort, pick top 8
      const items = Object.keys(freq).map(k => ({ k, v: freq[k] })).sort((a, b) => b.v - a.v).slice(0, 12);
      return items.map(x => x.k);
    }

    // meta keywords (comma separated)
    const metaKeysRaw = (metaContent('meta[name="keywords"]') || metaContent('meta[name="news_keywords"]') || '').trim();
    const metaKeys = metaKeysRaw ? metaKeysRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const tagSuggestions = (article && article.textContent)
      ? Array.from(new Set([...metaKeys, ...computeTagSuggestions(article.textContent)])).slice(0, 10)
      : metaKeys.slice(0, 6);

    // If we pass required signals, send pageData and tag suggestions
    const isArticle = positiveCount >= REQUIRED_SIGNALS;

    if (isArticle) {
      const pageData = {
        title: title || '',
        byline: byline || '',
        text: (article && article.textContent) ? article.textContent : '',
        excerpt: (article && article.excerpt) ? article.excerpt : '',
        url: url
      };
      chrome.runtime.sendMessage({ type: 'PAGE_EXTRACTED', pageData, isArticle: true, tagSuggestions });
    } else {
      // don't send if not article
    }
  } catch (e) {
    console.error('Content extraction failed:', e);
  }
})();
