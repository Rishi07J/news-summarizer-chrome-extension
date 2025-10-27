// popup.js — immediate/dynamic sentence counter + scrollable summary adjustments
document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const mainContainer = document.getElementById('mainContainer');
  const elTitle = document.getElementById('title');
  const elMeta = document.getElementById('meta');
  const elSummary = document.getElementById('summary');
  const saveBtn = document.getElementById('saveBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const bookmarksBtn = document.getElementById('bookmarksBtn');
  const sentencesInput = document.getElementById('sentencesInput');
  const snapPlaceholder = document.getElementById('snapPlaceholder');

  const bmInline = document.getElementById('bmInline');
  const dropdownList = document.getElementById('dropdownList');
  const dropdownSearch = document.getElementById('dropdownSearch');
  const dropdownClear = document.getElementById('dropdownClear');

  const saveMode = document.getElementById('saveMode');
  const saveTitle = document.getElementById('saveTitle');
  const saveMeta = document.getElementById('saveMeta');
  const saveTagsInput = document.getElementById('saveTagsInput');
  const saveTagSuggestions = document.getElementById('saveTagSuggestions');
  const confirmSaveBtn = document.getElementById('confirmSaveBtn');
  const cancelSaveBtn = document.getElementById('cancelSaveBtn');

  const tagsInput = document.getElementById('tagsInput');
  const themeBtn = document.getElementById('themeBtn');

  const SNAP_SIZES = [
    { id: 'snap-sm', label: 'Small', w: 360, h: 480 },
    { id: 'snap-md', label: 'Medium', w: 480, h: 640 },
    { id: 'snap-lg', label: 'Large', w: 720, h: 800 }
  ];

  /* ---------- helpers ---------- */
  function clampSentences(n) { n = parseInt(n) || 2; if (n < 1) n = 1; if (n > 8) n = 8; return n; }
  function clampWidth(n) { return Math.min(Math.max(parseInt(n) || 480, 300), 1000); }
  function clampHeight(n) { return Math.min(Math.max(parseInt(n) || 640, 200), 2000); }

  /* theme */
  function applyTheme(theme) { if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark'); themeBtn.textContent = theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'; }
  function loadTheme(cb) { chrome.storage.local.get(['settings'], res => { const theme = (res.settings && res.settings.theme) || 'light'; applyTheme(theme); if (cb) cb(theme); }); }
  function persistTheme(theme) { chrome.storage.local.get(['settings'], res => { const s = res.settings || {}; s.theme = theme; chrome.storage.local.set({ settings: s }); }); }
  themeBtn.addEventListener('click', () => chrome.storage.local.get(['settings'], res => { const s = res.settings || {}; const next = (s.theme === 'dark') ? 'light' : 'dark'; applyTheme(next); persistTheme(next); }));

  /* size handling */
  function applySize(w, h) {
    const W = clampWidth(w);
    const H = clampHeight(h);
    root.style.setProperty('--popup-width', W + 'px');
    root.style.setProperty('--popup-max-height', H + 'px');
    chrome.storage.local.get(['settings'], res => {
      const s = res.settings || {}; s.popupWidth = W; s.popupMaxHeight = H;
      chrome.storage.local.set({ settings: s }, () => highlightActiveSnap(W, H));
    });
    highlightActiveSnap(W, H);
    adjustSummaryMaxHeight();
  }
  function loadSize(cb) {
    chrome.storage.local.get(['settings'], res => {
      const s = res.settings || {};
      const w = clampWidth(s.popupWidth || 360);
      const h = clampHeight(s.popupMaxHeight || 480);
      applySize(w, h);
      if (cb) cb(w, h);
    });
  }

  function renderSnapButtons() {
    snapPlaceholder.innerHTML = '';
    SNAP_SIZES.forEach(s => {
      const btn = document.createElement('button'); btn.id = s.id; btn.className = 'snap-btn'; btn.textContent = s.label;
      btn.addEventListener('click', () => applySize(s.w, s.h));
      snapPlaceholder.appendChild(btn);
    });
  }
  function highlightActiveSnap(w, h) {
    SNAP_SIZES.forEach(s => {
      const el = document.getElementById(s.id);
      if (!el) return;
      if (s.w === w && s.h === h) el.classList.add('snap-active'); else el.classList.remove('snap-active');
    });
  }

  /* favicon & article */
  function getDomain(url) { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } }
  function setFaviconForUrl(url) { const d = getDomain(url); const fimg = document.getElementById('faviconImg'); if (!d) { fimg.style.display = 'none'; return; } fimg.src = `https://www.google.com/s2/favicons?sz=64&domain=${d}`; fimg.style.display = 'block'; }

  let currentArticle = null, currentSummaryFull = '', currentSummaryShort = '', showFull = false;
  function computeSummaries(article) {
    if (!article || !article.text) { currentSummaryFull = currentSummaryShort = ''; return; }
    try {
      currentSummaryFull = window.TextRankSummarizer.summarize(article.text, { numSentences: 6 }) || (article.excerpt || '');
    } catch (e) {
      console.error('TextRank full summarization error', e);
      currentSummaryFull = article.excerpt || '';
    }
    // short summary depends on chosen sentence count — computed on demand
  }
  function renderArticle(article, numSentences = 2) {
    elTitle.textContent = article.title || getDomain(article.url) || 'Article';
    elMeta.textContent = `${getDomain(article.url)} • ${new Date().toLocaleString()}`;
    setFaviconForUrl(article.url);
    numSentences = clampSentences(numSentences);
    sentencesInput.value = numSentences;
    // compute full once, compute short dynamically
    computeSummaries(article);
    updateShortSummary(numSentences);
    showFull = false; updateSummaryUI();
    setTimeout(()=> { if (isInlineOpen()) expandPopupToFitInline(); adjustSummaryMaxHeight(); }, 40);
  }
  function updateShortSummary(numSentences) {
    try {
      if (!currentArticle || !currentArticle.text) currentSummaryShort = '';
      else currentSummaryShort = window.TextRankSummarizer.summarize(currentArticle.text, { numSentences }) || currentArticle.excerpt || '';
    } catch (e) {
      console.error('TextRank short summarization error', e);
      currentSummaryShort = currentArticle && currentArticle.excerpt ? currentArticle.excerpt : '';
    }
  }
  function updateSummaryUI() {
    // If showFull -> full; else short
    const display = showFull ? currentSummaryFull : currentSummaryShort;
    elSummary.textContent = display || 'Could not summarize this article.';
    // decide if 'moreToggle' should show
    const moreToggle = document.getElementById('moreToggle');
    if (!currentSummaryFull || !currentSummaryShort || currentSummaryFull === currentSummaryShort) {
      moreToggle.style.display = 'none';
    } else {
      moreToggle.style.display = 'inline';
      moreToggle.textContent = showFull ? 'Show less' : 'Show more';
    }
    // If not showing full, keep scroll at top so user sees start
    if (!showFull) elSummary.scrollTop = 0;
  }
  document.getElementById('moreToggle').addEventListener('click', () => {
    showFull = !showFull; updateSummaryUI();
  });

  /* Immediately update summary when sentences input changes (dynamic & seamless) */
  function onSentencesInputChange(rawVal, persist = true) {
    const n = clampSentences(rawVal);
    // update UI immediately
    sentencesInput.value = n;
    if (currentArticle) {
      updateShortSummary(n);
      showFull = false;
      updateSummaryUI();
    }
    if (persist) {
      chrome.storage.local.get(['settings'], res => { const s = res.settings || {}; s.summarySentences = n; chrome.storage.local.set({ settings: s }); });
    }
    // ensure summary scroll constraints recalc
    adjustSummaryMaxHeight();
  }
  // wire input events for a seamless experience (handles keyboard arrows, paste, etc.)
  sentencesInput.addEventListener('input', (e) => onSentencesInputChange(e.target.value));
  sentencesInput.addEventListener('change', (e) => onSentencesInputChange(e.target.value));
  sentencesInput.addEventListener('keydown', (e) => {
    // allow quick +/- using up/down arrows (native already does increase/decrease for number input,
    // but ensure immediate update on keydown)
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      setTimeout(() => onSentencesInputChange(sentencesInput.value), 0);
    }
  });

  /* tag suggestions (save-mode tiles) */
  function showTagSuggestionsForSave(suggestions) {
    saveTagSuggestions.innerHTML = '';
    if (!suggestions || !suggestions.length) { saveTagSuggestions.style.display = 'none'; return; }
    saveTagSuggestions.style.display = 'flex';
    suggestions.slice(0, 8).forEach(t => {
      const el = document.createElement('div'); el.className = 'suggestion'; el.textContent = t;
      el.addEventListener('click', () => {
        const existing = (saveTagsInput.value || '').split(',').map(x => x.trim()).filter(Boolean);
        if (!existing.includes(t)) existing.push(t); saveTagsInput.value = existing.join(', ');
      });
      saveTagSuggestions.appendChild(el);
    });
  }

  /* bookmarks inline rendering */
  function parseTags(str) { return (str || '').split(',').map(t => t.trim()).filter(Boolean).slice(0,8); }
  function saveBookmarkObject(article, tagStr) {
    const nSent = clampSentences(sentencesInput.value || 2);
    const tags = parseTags(tagStr);
    const bm = { id: 'bm_' + Date.now(), title: article.title || article.url, url: article.url, summary: window.TextRankSummarizer.summarize(article.text, { numSentences: nSent }) || article.excerpt || '', tags: tags, saved_at: Date.now() };
    chrome.storage.local.get(['bookmarks'], res => {
      const list = res.bookmarks || []; list.unshift(bm); chrome.storage.local.set({ bookmarks: list }, () => {
        renderInlineBookmarks(dropdownSearch.value || '');
        chrome.storage.local.set({ lastTagSuggestions: tags.slice(0,6) });
      });
    });
  }

  function scoreItemForSearch(query, item) {
    query = (query || '').trim().toLowerCase();
    if (!query) return 1.0;
    const hay = `${item.title} ${item.summary} ${item.url} ${(item.tags||[]).join(' ')}`.toLowerCase();
    if (hay.includes(query)) return 1.0;
    const qTokens = (query||'').toLowerCase().split(/\s+/).map(t => t.replace(/[^a-z0-9]/g,'')).filter(Boolean);
    const textTokens = hay.split(/\s+/).map(t => t.replace(/[^a-z0-9]/g,'')).filter(Boolean);
    const qSet = new Set(qTokens);
    let overlap = 0; for (let t of textTokens) if (qSet.has(t)) overlap++;
    const tokenScore = qTokens.length ? (overlap / qTokens.length) : 0;
    return Math.min(1, tokenScore);
  }

  function renderInlineBookmarks(query = '') {
    chrome.storage.local.get(['bookmarks'], res => {
      const list = res.bookmarks || [];
      const scored = list.map(b => ({ b, s: scoreItemForSearch(query, b) })).filter(x => x.s > 0);
      scored.sort((a,c) => c.s - a.s || c.b.saved_at - a.b.saved_at);
      dropdownList.innerHTML = '';
      if (!scored.length) { dropdownList.innerHTML = `<div class="empty">No bookmarks</div>`; return; }
      scored.forEach(obj => {
        const b = obj.b;
        const card = document.createElement('div'); card.className = 'bm-card';
        const t = document.createElement('div'); t.className = 'bm-title'; t.textContent = b.title;
        const s = document.createElement('div'); s.className = 'bm-summary'; s.textContent = b.summary;
        const tagWrap = document.createElement('div'); tagWrap.className = 'bm-tags';
        (b.tags||[]).forEach(tag => { const el = document.createElement('div'); el.className='tag'; el.textContent = tag; tagWrap.appendChild(el); });
        const actions = document.createElement('div'); actions.className = 'bm-actions';
        actions.style.display = 'flex'; actions.style.gap = '6px'; actions.style.marginTop = '6px';
        const open = document.createElement('button'); open.textContent='Open'; open.addEventListener('click', ()=>chrome.tabs.create({ url: b.url }));
        const del = document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=>{ deleteBookmarkAndRefresh(b.id); });
        actions.appendChild(open); actions.appendChild(del);
        card.appendChild(t); card.appendChild(s); card.appendChild(tagWrap); card.appendChild(actions);
        dropdownList.appendChild(card);
      });
      if (isInlineOpen()) requestAnimationFrame(() => expandPopupToFitInline());
    });
  }

  function deleteBookmarkAndRefresh(id) {
    chrome.storage.local.get(['bookmarks'], res => {
      const list = (res.bookmarks || []).filter(b => b.id !== id);
      chrome.storage.local.set({ bookmarks: list }, () => renderInlineBookmarks(dropdownSearch.value || ''));
    });
  }

  /* expand/collapse inline (reuse previous robust logic) */
  let savedExplicitHeight = null;
  let savedPopupMaxHeightVar = null;
  function isInlineOpen() { return bmInline.style.display === 'block'; }

  function expandPopupToFitInline() {
    if (!isInlineOpen()) return;
    // measure main + inline area (offsetHeight is reliable)
    const mainH = mainContainer.offsetHeight || document.documentElement.clientHeight;
    const inlineH = bmInline.offsetHeight || bmInline.scrollHeight || 0;
    const padding = 14;
    let target = Math.ceil(mainH + inlineH + padding);
    const persistedMax = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--popup-max-height')) || 480;
    const cap = Math.max(persistedMax, 1200);
    if (target > cap) target = cap;
    if (savedExplicitHeight === null) savedExplicitHeight = document.documentElement.style.height || null;
    if (savedPopupMaxHeightVar === null) savedPopupMaxHeightVar = getComputedStyle(document.documentElement).getPropertyValue('--popup-max-height') || null;
    document.documentElement.style.height = target + 'px';
    root.style.setProperty('--popup-max-height', target + 'px');
    adjustSummaryMaxHeight();
  }

  function restorePopupAfterInlineClose() {
    if (savedExplicitHeight !== null) {
      if (savedExplicitHeight) document.documentElement.style.height = savedExplicitHeight;
      else document.documentElement.style.removeProperty('height');
    } else {
      document.documentElement.style.removeProperty('height');
    }
    if (savedPopupMaxHeightVar !== null) {
      root.style.setProperty('--popup-max-height', savedPopupMaxHeightVar);
    } else {
      root.style.setProperty('--popup-max-height', '480px');
    }
    savedExplicitHeight = null;
    savedPopupMaxHeightVar = null;
    adjustSummaryMaxHeight();
  }

  /* summary max-height adjustment: keeps summary scrollable but nicely sized relative to popup */
  function adjustSummaryMaxHeight() {
    // calculate a reasonable max height for summary area based on popup max height
    const popupMax = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--popup-max-height')) || 480;
    // use between 18% and 30% depending on popup height
    const ratio = popupMax < 420 ? 0.22 : (popupMax < 700 ? 0.22 : 0.28);
    const max = Math.max(120, Math.floor(popupMax * ratio));
    elSummary.style.maxHeight = max + 'px';
  }

  /* save-mode */
  function openSaveMode() {
    if (!currentArticle) return;
    saveTitle.textContent = currentArticle.title || currentArticle.url;
    saveMeta.textContent = `${getDomain(currentArticle.url)} • ${new Date().toLocaleString()}`;
    chrome.storage.local.get(['lastTagSuggestions'], res => { const s = res.lastTagSuggestions || []; showTagSuggestionsForSave(s); });
    saveTagsInput.value = '';
    saveMode.style.display = 'block';
    saveMode.setAttribute('aria-hidden', 'false');
    setTimeout(()=> window.scrollTo(0,0), 30);
  }
  function closeSaveMode() { saveMode.style.display = 'none'; saveMode.setAttribute('aria-hidden', 'true'); }
  confirmSaveBtn.addEventListener('click', () => { if (!currentArticle) { closeSaveMode(); return; } saveBookmarkObject(currentArticle, saveTagsInput.value || ''); closeSaveMode(); });
  cancelSaveBtn.addEventListener('click', () => closeSaveMode());

  /* inline show/hide */
  function showInline(show) {
    if (show) {
      bmInline.style.display = 'block';
      bmInline.setAttribute('aria-hidden', 'false');
      renderInlineBookmarks('');
      dropdownSearch.value = '';
      dropdownSearch.focus();
    } else {
      bmInline.style.display = 'none';
      bmInline.setAttribute('aria-hidden', 'true');
      restorePopupAfterInlineClose();
    }
  }
  bookmarksBtn.addEventListener('click', () => showInline(!isInlineOpen()));
  dropdownSearch.addEventListener('input', (e) => renderInlineBookmarks(e.target.value));
  dropdownClear.addEventListener('click', () => {
    if (!confirm('Clear all bookmarks?')) return;
    chrome.storage.local.set({ bookmarks: [] }, () => renderInlineBookmarks(''));
  });

  /* loading article for active tab */
  function loadLastArticleForActiveTab(activeUrl) {
    chrome.storage.local.get(['lastArticle','lastTagSuggestions','settings'], res => {
      const article = res.lastArticle; const tagsSuggestedStored = res.lastTagSuggestions || [];
      const settings = res.settings || {};
      const numSentences = clampSentences(settings.summarySentences || 2);
      if (!article || !article.text || !activeUrl || (article.url !== activeUrl)) {
        currentArticle = null; elTitle.textContent = 'No article detected on this tab.'; elMeta.textContent = ''; elSummary.textContent = 'Open a news article and reload the page to extract it, or use Bookmarks.'; saveBtn.disabled = true; return;
      }
      currentArticle = article; renderArticle(article, numSentences); saveBtn.disabled = false;
      chrome.storage.local.set({ lastTagSuggestions: tagsSuggestedStored });
    });
  }
  function getActiveTabUrl(cb){ chrome.tabs.query({ active:true, currentWindow:true }, tabs => { if (!tabs || !tabs.length) return cb(''); cb(tabs[0].url || ''); }); }

  /* init */
  function init() {
    renderSnapButtons();
    loadTheme(() => {
      loadSize(() => {
        chrome.storage.local.get(['settings'], res => {
          const s = res.settings || {};
          const n = clampSentences(s.summarySentences || 2);
          sentencesInput.value = n;
          getActiveTabUrl(url => { loadLastArticleForActiveTab(url); renderInlineBookmarks(''); });
        });
      });
    });

    // outside click: if inline open and click outside popup content, close inline
    document.addEventListener('click', (e) => {
      if (isInlineOpen()) {
        const inside = mainContainer.contains(e.target) || saveMode.contains(e.target);
        if (!inside) showInline(false);
      }
    });

    // Esc closes inline and save-mode
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isInlineOpen()) showInline(false);
        if (saveMode.style.display === 'block') closeSaveMode();
      }
    });

    saveBtn.addEventListener('click', () => openSaveMode());
    refreshBtn.addEventListener('click', () => { getActiveTabUrl(url => loadLastArticleForActiveTab(url)); });

    // adjust summary box size now (in case stored snap present)
    setTimeout(() => adjustSummaryMaxHeight(), 40);
  }

  init();
});
