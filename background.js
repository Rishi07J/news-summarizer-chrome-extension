// background.js
let lastArticle = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PAGE_EXTRACTED" && msg.isArticle) {
    const pageData = msg.pageData || {};
    lastArticle = pageData;
    // store with tag suggestions (so popup can access)
    chrome.storage.local.set({ lastArticle, lastTagSuggestions: msg.tagSuggestions || [] }, () => {
      // Auto-open popup only for active tab and non-search pages
      try {
        // sender.tab may be undefined in some contexts; check
        const tab = sender && sender.tab;
        const url = (tab && tab.url) ? tab.url : (pageData.url || '');
        // simple search-page guard: don't auto-open on search result pages
        const isSearchPage = /(^|\.)google\./i.test(url) && /\/search(\?|$)/i.test(url) || /\/results\?/i.test(url);
        if (tab && tab.active && !isSearchPage) {
          chrome.action.openPopup?.();
        }
      } catch (e) {
        console.warn("openPopup failed:", e);
      }
    });
  }
});
