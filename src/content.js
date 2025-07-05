// Content script for extracting page content and generating smart suggestions

// Track content script readiness
let isContentScriptReady = false;

// Initialize content script when DOM is ready
function initializeContentScript() {
  isContentScriptReady = true;
  console.log('Aura Prompt content script initialized on:', window.location.href);

  // Notify background script that content script is ready
  try {
    chrome.runtime.sendMessage({
      action: 'contentScriptReady',
      url: window.location.href,
      title: document.title
    }).catch(() => {
      // Background script might not be ready, ignore error
    });
  } catch (error) {
    // Extension context might be invalid, ignore
  }
}

// Listen for messages from background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle ping requests to verify content script is alive
  if (request.action === 'ping') {
    sendResponse({
      alive: true,
      ready: isContentScriptReady,
      url: window.location.href,
      title: document.title
    });
    return true;
  }

  if (request.action === 'extractContent') {
    try {
      if (!isContentScriptReady) {
        sendResponse({
          error: 'Content script not ready',
          url: window.location.href,
          title: document.title
        });
        return true;
      }

      const pageContent = extractPageContent();

      sendResponse({
        success: true,
        content: pageContent,
        url: window.location.href,
        title: document.title
      });
    } catch (error) {
      console.error('Error extracting content:', error);
      sendResponse({
        error: 'Failed to extract page content: ' + error.message,
        url: window.location.href,
        title: document.title
      });
    }
    return true; // Keep message channel open for async response
  }
});

// Function to extract meaningful content from the page
function extractPageContent() {
  // Remove script and style elements
  const elementsToRemove = document.querySelectorAll('script, style, nav, header, footer, aside');
  const clonedDoc = document.cloneNode(true);
  
  elementsToRemove.forEach(el => {
    const clonedEl = clonedDoc.querySelector(el.tagName.toLowerCase());
    if (clonedEl) clonedEl.remove();
  });

  // Extract text from main content areas
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '.post-content',
    '.entry-content',
    '.article-content',
    'body'
  ];

  let content = '';
  
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      content = extractTextFromElement(element);
      if (content.length > 100) break; // Found substantial content
    }
  }

  // Fallback: extract from body if no main content found
  if (!content || content.length < 100) {
    content = extractTextFromElement(document.body);
  }

  // Clean and limit content
  content = cleanText(content);
  
  // Limit to ~2000 characters to avoid token limits
  if (content.length > 2000) {
    content = content.substring(0, 2000) + '...';
  }

  return content;
}

// Helper function to extract text from an element
function extractTextFromElement(element) {
  if (!element) return '';
  
  // Clone element to avoid modifying original
  const clone = element.cloneNode(true);
  
  // Remove unwanted elements
  const unwanted = clone.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation, .ads, .advertisement');
  unwanted.forEach(el => el.remove());
  
  return clone.innerText || clone.textContent || '';
}

// Helper function to clean extracted text
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim();
}

// Static fallback suggestions for when AI generation fails
function getFallbackSuggestions() {
  return [
    "Summarize this page",
    "What are the main points?",
    "Explain this in simple terms"
  ];
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  // DOM is already ready
  initializeContentScript();
}
