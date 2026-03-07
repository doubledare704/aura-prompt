// Background service worker for Aura Prompt Extension

const {
    buildSessionOptions
} = require('./utils/promptApiSession');
const {
    buildSuggestionPrompt,
    getFallbackSuggestions,
    parseAISuggestions
} = require('./utils/suggestionUtils');

const MESSAGE_PORT_CLOSED_WITHOUT_RESPONSE = 'The message port closed before a response was received.';

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Aura Prompt Extension installed');
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle content script ready notifications
    if (request.action === 'contentScriptReady') {
        const tabId = sender.tab?.id;
        if (tabId) {
            contentScriptStatus.set(tabId, {
                alive: true,
                ready: true,
                url: request.url,
                title: request.title,
                lastPing: Date.now()
            });
            console.log(`Content script ready on tab ${tabId}: ${request.url}`);
        }
        return;
    }

    if (request.action === 'getPageContent') {
        // Handle page content extraction with proper content script management
        handlePageContentRequest(sendResponse);
        return true; // Keep message channel open for async response
    }

    if (request.action === 'refreshSuggestions') {
        handleSuggestionRefresh(request)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({
                suggestions: getFallbackSuggestions(request.excludeSuggestions),
                aiGenerated: false,
                error: error.message
            }));
        return true;
    }

    if (request.action === 'promptAPI') {
        // Handle Prompt API requests with session management
        const sessionId = request.sessionId || `session_${Date.now()}_${Math.random()}`;

        handlePromptAPI(request.prompt, request.context, sessionId)
            .then(response => sendResponse({
                success: true,
                response,
                sessionId
            }))
            .catch(error => {
                // Provide user-friendly error messages based on error type
                let userMessage = error.message;

                if (error.message.includes('not available')) {
                    userMessage = 'AI features are not available. Please ensure you have Chrome 138+';
                } else if (error.message.includes('downloading')) {
                    userMessage = 'AI model is downloading. Please wait a moment and try again.';
                } else if (error.message.includes('download')) {
                    userMessage = 'Failed to download AI model. Please check your internet connection and try again.';
                }

                sendResponse({
                    success: false,
                    error: userMessage,
                    originalError: error.message,
                    sessionId
                });
            });
        return true; // Keep message channel open for async response
    }

    if (request.action === 'cancelSession') {
        // Handle session cancellation
        const cancelled = cancelSession(request.sessionId);
        sendResponse({success: cancelled});
        return true;
    }

    if (request.action === 'checkAPIAvailability') {
        // Check if Prompt API is available
        checkAPIAvailability()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({
                available: false,
                error: error.message
            }));
        return true;
    }
});

// Store active sessions for cancellation capability
const activeSessions = new Map();

// Track active popup connections to avoid sending messages to closed popups
const activeConnections = new Set();

// Track content script readiness for each tab
const contentScriptStatus = new Map();

// Cache for AI-generated suggestions to improve performance
const suggestionCache = new Map();

// List of URL patterns where content scripts cannot be injected
const restrictedUrlPatterns = [
    /^chrome:\/\//,
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    /^edge-extension:\/\//,
    /^file:\/\//,
    /^about:/,
    /^data:/,
    /^blob:/
];

// Helper function to check if URL is restricted for content script injection
function isRestrictedUrl(url) {
    if (!url) return true;
    return restrictedUrlPatterns.some(pattern => pattern.test(url));
}

// Helper function to ping a content script and check if it's ready
async function pingContentScript(tabId, timeout = 3000) {
    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
            resolve(false);
        }, timeout);

        try {
            chrome.tabs.sendMessage(tabId, {action: 'ping'}, (response) => {
                clearTimeout(timeoutId);

                if (chrome.runtime.lastError) {
                    console.log(`Content script ping failed for tab ${tabId}:`, chrome.runtime.lastError.message);
                    resolve(false);
                } else if (response && response.alive) {
                    console.log(`Content script is alive on tab ${tabId}, ready: ${response.ready}`);
                    contentScriptStatus.set(tabId, {
                        alive: true,
                        ready: response.ready,
                        url: response.url,
                        title: response.title,
                        lastPing: Date.now()
                    });
                    resolve(response.ready);
                } else {
                    resolve(false);
                }
            });
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Error pinging content script:', error);
            resolve(false);
        }
    });
}

// Helper function to inject a content script if needed
async function ensureContentScript(tabId, url) {
    if (isRestrictedUrl(url)) {
        console.log(`Cannot inject content script on restricted URL: ${url}`);
        return false;
    }

    try {
        // Try to ping an existing content script first
        const isReady = await pingContentScript(tabId);
        if (isReady) {
            return true;
        }

        // Content script is not ready, try to inject it
        console.log(`Injecting content script into tab ${tabId}`);
        await chrome.scripting.executeScript({
            target: {tabId: tabId},
            files: ['content.js']
        });

        // Wait a bit for a content script to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Ping again to verify injection worked
        return await pingContentScript(tabId);
    } catch (error) {
        console.error(`Failed to inject content script into tab ${tabId}:`, error);
        return false;
    }
}

// Helper function to generate AI-powered suggestions based on page content
async function generateAISuggestions(content, title, url, excludedSuggestions = []) {
    try {
        // Create a cache key based on content hash for performance
        const excludedKey = [...new Set((excludedSuggestions || [])
            .map(suggestion => suggestion?.trim().toLowerCase())
            .filter(Boolean))]
            .sort()
            .join('|');
        const contentHash = simpleHash(content + title + excludedKey);

        // Check cache first
        if (suggestionCache.has(contentHash)) {
            console.log('Using cached suggestions for:', title);
            return {
                suggestions: suggestionCache.get(contentHash),
                aiGenerated: true
            };
        }

        if (!("LanguageModel" in self)) {
            throw new Error('Chrome Prompt API is not available. Please ensure you have Chrome 127+ and the AI features are enabled.');
        }
        // Check model availability
        const availability = await LanguageModel.availability();
        console.log('Model availability:', availability);
        if (availability !== 'available') {
            console.log('AI model is not available for suggestion generation');
            return {
                suggestions: getFallbackSuggestions(excludedSuggestions),
                aiGenerated: false
            };
        }

        // Create a focused prompt for suggestion generation
        const suggestionPrompt = buildSuggestionPrompt({
            content,
            title,
            url,
            excludedSuggestions
        });

        // Create a session for suggestion generation
        const session = await LanguageModel.create({
            temperature: 0.7,
            topK: 3,
        });

        try {
            const response = await session.prompt(suggestionPrompt);

            // Parse the AI response to extract suggestions
            const suggestions = parseAISuggestions(response, excludedSuggestions);

            // Validate we have exactly 3 suggestions
            if (suggestions.length === 3) {
                console.log('Generated AI suggestions:', suggestions);

                // Cache the suggestions
                suggestionCache.set(contentHash, suggestions);

                // Limit cache size to prevent memory issues
                if (suggestionCache.size > 50) {
                    const firstKey = suggestionCache.keys().next().value;
                    suggestionCache.delete(firstKey);
                }

                return {
                    suggestions,
                    aiGenerated: true
                };
            } else {
                console.warn('AI generated wrong number of suggestions:', suggestions.length);
                return {
                    suggestions: getFallbackSuggestions(excludedSuggestions),
                    aiGenerated: false
                };
            }
        } finally {
            session.destroy();
        }
    } catch (error) {
        console.error('Error generating AI suggestions:', error);
        return {
            suggestions: getFallbackSuggestions(excludedSuggestions),
            aiGenerated: false
        };
    }
}

// Simple hash function for caching
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
}

// Helper function to get fallback page info when content script is unavailable
async function getFallbackPageInfo(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        return {
            success: true,
            content: '',
            suggestions: getFallbackSuggestions(),
            url: tab.url,
            title: tab.title,
            fallback: true,
            reason: 'Content script unavailable on this page type'
        };
    } catch (error) {
        return {
            error: 'Failed to get page information',
            fallback: true
        };
    }
}

// Handle page content extraction requests with comprehensive error handling
async function handlePageContentRequest(sendResponse) {
    try {
        // Get active tab
        const tabs = await new Promise((resolve, reject) => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(tabs);
                }
            });
        });

        if (!tabs || tabs.length === 0) {
            sendResponse({error: 'No active tab found'});
            return;
        }

        const tab = tabs[0];
        const tabId = tab.id;
        const url = tab.url;

        // Check if URL is restricted
        if (isRestrictedUrl(url)) {
            console.log(`Restricted URL detected: ${url}`);
            const fallbackInfo = await getFallbackPageInfo(tabId);
            sendResponse(fallbackInfo);
            return;
        }

        // Ensure content script is ready
        const isContentScriptReady = await ensureContentScript(tabId, url);

        if (!isContentScriptReady) {
            console.log(`Content script not available for tab ${tabId}, using fallback`);
            const fallbackInfo = await getFallbackPageInfo(tabId);
            sendResponse(fallbackInfo);
            return;
        }

        // Content script is ready, request content extraction
        chrome.tabs.sendMessage(tabId, {action: 'extractContent'}, async (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error communicating with content script:', chrome.runtime.lastError);
                // Fallback to basic page info
                const fallbackInfo = await getFallbackPageInfo(tabId);
                sendResponse(fallbackInfo);
            } else if (response && response.success) {
                try {
                    // Generate AI-powered suggestions based on the extracted content
                    console.log('Generating AI suggestions for:', response.title);
                    const suggestionResult = await generateAISuggestions(
                        response.content,
                        response.title,
                        response.url
                    );

                    // Add suggestions to the response
                    const enhancedResponse = {
                        ...response,
                        suggestions: suggestionResult.suggestions,
                        aiGenerated: suggestionResult.aiGenerated
                    };

                    sendResponse(enhancedResponse);
                } catch (error) {
                    console.error('Error generating suggestions:', error);
                    // Fallback to response without AI suggestions
                    sendResponse({
                        ...response,
                        suggestions: getFallbackSuggestions(),
                        aiGenerated: false
                    });
                }
            } else {
                // Content script responded but with error
                console.warn('Content script error:', response?.error);
                const fallbackInfo = await getFallbackPageInfo(tabId);
                sendResponse({
                    ...fallbackInfo,
                    reason: response?.error || 'Content extraction failed'
                });
            }
        });

    } catch (error) {
        console.error('Error in handlePageContentRequest:', error);
        sendResponse({
            error: 'Failed to process page content request: ' + error.message
        });
    }
}

async function handleSuggestionRefresh(request) {
    const suggestionResult = await generateAISuggestions(
        request.content || '',
        request.title || '',
        request.url || '',
        request.excludeSuggestions || []
    );

    return {
        suggestions: suggestionResult.suggestions,
        aiGenerated: suggestionResult.aiGenerated
    };
}

// Helper function to safely send messages with proper error handling
function safeSendMessage(message, callback = null, timeout = 5000, options = {}) {
    const expectResponse = options.expectResponse ?? false;

    return new Promise((resolve) => {
        let settled = false;

        const finish = (value) => {
            if (!settled) {
                settled = true;
                resolve(value);
            }
        };

        try {
            // Check if there are any active connections before sending
            if (activeConnections.size === 0) {
                console.log('No active connections, skipping message:', message.action);
                finish(false);
                return;
            }

            // Set up timeout to prevent hanging
            const timeoutId = setTimeout(() => {
                console.log(`Message timeout (${message.action})`);
                finish(false);
            }, timeout);

            chrome.runtime.sendMessage(message, (response) => {
                clearTimeout(timeoutId);

                if (chrome.runtime.lastError) {
                    const errorMessage = chrome.runtime.lastError.message || '';
                    const isFireAndForgetDelivery = !expectResponse
                        && errorMessage.includes(MESSAGE_PORT_CLOSED_WITHOUT_RESPONSE);

                    if (isFireAndForgetDelivery) {
                        if (callback) callback(response);
                        finish(true);
                        return;
                    }

                    // Connection error - popup likely closed
                    console.log(`Message send failed (${message.action}):`, errorMessage);
                    finish(false);
                } else {
                    if (callback) callback(response);
                    finish(true);
                }
            });
        } catch (error) {
            console.error('Error sending message:', error);
            finish(false);
        }
    });
}

async function createSessionWithFallback(params) {
    const sessionOptions = buildSessionOptions(params);
    const availability = await LanguageModel.availability(sessionOptions);

    console.log('Model availability:', availability);

    if (availability === 'unavailable') {
        throw new Error('The AI language model is not available on this device.');
    }

    if (availability === 'downloadable' || availability === 'downloading') {
        await handleModelDownload(sessionOptions, availability);
    }

    console.log(`Creating session with parameters: ${JSON.stringify(sessionOptions)}`);
    return await LanguageModel.create(sessionOptions);
}

// Track popup connections
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        console.log('Popup connected');
        activeConnections.add(port);

        // Set up heartbeat to detect stale connections
        const heartbeatInterval = setInterval(() => {
            try {
                port.postMessage({action: 'heartbeat'});
            } catch (error) {
                // Connection is stale, clean it up
                console.log('Stale connection detected, cleaning up');
                clearInterval(heartbeatInterval);
                activeConnections.delete(port);
            }
        }, 30000); // Check every 30 seconds

        port.onDisconnect.addListener(() => {
            console.log('Popup disconnected');
            clearInterval(heartbeatInterval);
            activeConnections.delete(port);
        });
    }
});

// Function to interact with Chrome's Prompt API
async function handlePromptAPI(prompt, context = '', sessionId = null) {
    let session = null;

    try {
        // Check if Prompt API is available
        if (!("LanguageModel" in self)) {
            throw new Error('Chrome Prompt API is not available. Please ensure you have Chrome 138+ and the AI features are enabled.');
        }

        const params = await LanguageModel.params();
        session = await createSessionWithFallback(params);

        // Store session for potential cancellation
        if (sessionId) {
            activeSessions.set(sessionId, session);
        }

        const fullPrompt = context
            ? `Context: ${context}\n\nUser Question: ${prompt}`
            : prompt;

        return await streamResponse(session, fullPrompt, sessionId);
    } catch (error) {
        console.error('Prompt API error:', error);
        throw error;
    } finally {
        // Clean up the session
        if (session) {
            try {
                session.destroy();
            } catch (destroyError) {
                console.warn('Error destroying session:', destroyError);
            }
        }

        // Remove from active sessions
        if (sessionId && activeSessions.has(sessionId)) {
            activeSessions.delete(sessionId);
        }
    }
}

// Helper function to handle model download
async function handleModelDownload(options, availability) {
    if (availability !== 'downloadable' && availability !== 'downloading') {
        return;
    }

    console.log('AI model needs to be downloaded or is still downloading. Waiting for readiness...');

    try {
        const session = await LanguageModel.create({
            ...options,
            monitor(m) {
                m.addEventListener('downloadprogress', async (e) => {
                    const progress = Math.max(0, Math.min(100, Math.round((e.loaded ?? 0) * 100)));
                    console.log(`Downloaded ${progress}%`);
                    await safeSendMessage({
                        action: 'downloadProgress',
                        progress
                    });
                });
            }
        });

        await safeSendMessage({
            action: 'downloadProgress',
            progress: 100
        });

        session.destroy();
        console.log('Model download completed');
    } catch (error) {
        throw new Error(`Failed to download AI model: ${error.message}`);
    }
}

// Helper function to handle streaming responses
async function streamResponse(session, prompt, sessionId) {
    try {
        let fullResponse = '';
        let shouldSendStreamingUpdates = true;
        console.log(`${session.inputUsage}/${session.inputQuota}`);
        // Use streaming API for real-time responses
        const stream = session.promptStreaming(prompt);

        for await (const chunk of stream) {
            // Check if session was canceled
            if (sessionId && !activeSessions.has(sessionId)) {
                console.log('Session cancelled, stopping stream');
                break;
            }

            // Check if popup is still connected before sending streaming updates
            if (!shouldSendStreamingUpdates || activeConnections.size === 0) {
                console.log('No active popup connections, continuing stream silently');
                fullResponse += chunk;
                continue;
            }

            fullResponse += chunk;

            // Send partial response to popup for real-time display
            const messageSent = await safeSendMessage({
                action: 'streamingResponse',
                sessionId: sessionId,
                chunk: chunk,
                fullResponse: fullResponse
            });

            // If message sending fails consistently, popup is likely closed
            // Continue processing but stop sending updates
            if (!messageSent) {
                shouldSendStreamingUpdates = false;
                console.log('Popup disconnected during streaming, continuing silently');
            }
        }

        return fullResponse;
    } catch (error) {
        // Fallback to non-streaming if streaming is not available
        console.warn('Streaming not available, falling back to regular prompt:', error);
        try {
            return await session.prompt(prompt);
        } catch (fallbackError) {
            console.error('Both streaming and regular prompt failed:', fallbackError);
            throw fallbackError;
        }
    }
}

// Function to cancel an active session
function cancelSession(sessionId) {
    if (activeSessions.has(sessionId)) {
        const session = activeSessions.get(sessionId);
        try {
            session.destroy();
            activeSessions.delete(sessionId);
            console.log(`Session ${sessionId} cancelled`);
            return true;
        } catch (error) {
            console.error('Error cancelling session:', error);
            return false;
        }
    }
    return false;
}

// Function to check API availability
async function checkAPIAvailability() {
    try {
        if (!("LanguageModel" in self)) {
            return {
                available: false,
                reason: 'API_NOT_FOUND',
                message: 'Chrome Prompt API is not available. Please ensure you have Chrome 138+'
            };
        }

        const availability = await LanguageModel.availability();

        switch (availability) {
            case 'available':
                return {
                    available: true,
                    status: 'ready',
                    message: 'AI model is ready to use.'
                };
            case 'downloadable':
                return {
                    available: true,
                    status: 'downloadable',
                    message: 'AI model needs to be downloaded before first use.'
                };
            case 'downloading':
                return {
                    available: false,
                    status: 'downloading',
                    message: 'AI model is currently downloading. Please wait.'
                };
            case 'unavailable':
                return {
                    available: false,
                    status: 'unavailable',
                    message: 'AI model is not available on this device.'
                };
            default:
                return {
                    available: false,
                    status: 'unknown',
                    message: `Unknown availability status: ${availability}`
                };
        }
    } catch (error) {
        return {
            available: false,
            reason: 'ERROR',
            message: `Error checking availability: ${error.message}`
        };
    }
}

// Clean up content script status when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    if (contentScriptStatus.has(tabId)) {
        contentScriptStatus.delete(tabId);
        console.log(`Cleaned up content script status for closed tab ${tabId}`);
    }
});

// Clean up content script status when tabs are updated (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        // URL changed, content script status is no longer valid
        if (contentScriptStatus.has(tabId)) {
            contentScriptStatus.delete(tabId);
            console.log(`Cleared content script status for tab ${tabId} due to URL change`);
        }
    }
});

// Periodic cleanup of suggestion cache to prevent memory bloat
setInterval(() => {
    if (suggestionCache.size > 30) {
        console.log('Cleaning up suggestion cache');
        const keysToDelete = Array.from(suggestionCache.keys()).slice(0, 10);
        keysToDelete.forEach(key => suggestionCache.delete(key));
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will open the popup automatically due to default_popup in manifest
    console.log('Extension icon clicked');
});


