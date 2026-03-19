// utils/dedup.js
// Track seen POST IDs (raw posts, before classification).
// Separate from signal IDs — we track both to avoid re-scraping and re-classifying.

window.isSeenPost = async function(postId) {
  return new Promise(resolve => {
    chrome.storage.local.get(['seenPostIds'], (result) => {
      const seen = result.seenPostIds || [];
      resolve(seen.includes(postId));
    });
  });
};

window.markPostsSeen = async function(postIds) {
  return new Promise(resolve => {
    chrome.storage.local.get(['seenPostIds'], (result) => {
      const seen = result.seenPostIds || [];
      const merged = [...new Set([...seen, ...postIds])].slice(-1000); // keep last 1000
      chrome.storage.local.set({ seenPostIds: merged }, resolve);
    });
  });
};
