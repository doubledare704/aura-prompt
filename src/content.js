// Content script for extracting page content and generating smart suggestions

let isContentScriptReady = false;

function initializeContentScript() {
  isContentScriptReady = true;
  try {
    chrome.runtime.sendMessage({
      action: 'contentScriptReady',
      url: window.location.href,
      title: document.title
    }).catch(() => {});
  } catch (e) {}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ alive: true, ready: isContentScriptReady, url: window.location.href, title: document.title });
    return true;
  }

  if (request.action === 'extractContent') {
    try {
      const pageContent = extractPageContent();
      const leadImage = findLeadImage();

      sendResponse({
        success: true,
        content: pageContent,
        leadImage: leadImage,
        url: window.location.href,
        title: document.title
      });
    } catch (error) {
      sendResponse({ error: error.message, url: window.location.href, title: document.title });
    }
    return true;
  }
});

function extractPageContent() {
  try {
    // Use the body if available, otherwise the document
    const root = document.body || document.documentElement;
    const clone = root.cloneNode(true);
    
    // Remove unwanted elements from the clone
    clone.querySelectorAll('script, style, nav, header, footer, aside, .ads, .sidebar').forEach(el => el.remove());

    const contentSelectors = ['main', 'article', '[role="main"]', '.content', '.main-content', '.post-content', 'body'];
    let content = '';
    
    for (const selector of contentSelectors) {
      const element = clone.querySelector(selector) || (selector === 'body' ? clone : null);
      if (element) {
        // innerText is cleaner but depends on layout, textContent is more reliable
        content = (element.innerText || element.textContent || '').trim();
        if (content.length > 200) break;
      }
    }

    if (!content) {
      content = clone.textContent.trim();
    }

    // Clean up whitespace and limit length
    content = content.replace(/\s+/g, ' ').substring(0, 3000);
    console.log(`[Aura] Extracted ${content.length} characters of content.`);
    return content;
  } catch (e) {
    console.error('[Aura] Extraction error:', e);
    return '';
  }
}

function findLeadImage() {
  // 1. Check OpenGraph image
  const ogImage = document.querySelector('meta[property="og:image"]')?.content;
  if (ogImage) return ogImage;

  // 2. Check Twitter image
  const twitterImage = document.querySelector('meta[name="twitter:image"]')?.content;
  if (twitterImage) return twitterImage;

  // 3. Find largest image in the main content area
  const main = document.querySelector('main, article, [role="main"]');
  if (main) {
    const images = Array.from(main.querySelectorAll('img'))
      .filter(img => img.width > 200 && img.height > 200)
      .sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    if (images.length > 0) return images[0].src;
  }

  return null;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}
