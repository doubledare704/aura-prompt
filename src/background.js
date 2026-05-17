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

// JSON Schemas for Structured Output
const SCHEMAS = {
    FACT_CHECK: {
        type: "object",
        properties: {
            claim: { type: "string" },
            verdict: { type: "string", enum: ["True", "False", "Mixed", "Unverified"] },
            explanation: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["claim", "verdict", "explanation", "confidence"],
        additionalProperties: false
    },
    TLDR: {
        type: "object",
        properties: {
            summary: { type: "string" },
            reading_time: { type: "string" },
            sentiment: { type: "string" },
            takeaways: { type: "array", items: { type: "string" }, maxItems: 5 }
        },
        required: ["summary", "reading_time", "sentiment", "takeaways"],
        additionalProperties: false
    },
    ENTITIES: {
        type: "object",
        properties: {
            people: { type: "array", items: { type: "string" } },
            organizations: { type: "array", items: { type: "string" } },
            locations: { type: "array", items: { type: "string" } }
        },
        required: ["people", "organizations", "locations"],
        additionalProperties: false
    }
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Aura Prompt Extension installed');
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error('Failed to set side panel behavior:', error));
});

chrome.runtime.onStartup.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error('Failed to set side panel behavior:', error));
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        }
        return;
    }

    if (request.action === 'getPageContent') {
        handlePageContentRequest(request, sendResponse);
        return true;
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
        const sessionId = request.sessionId || `session_${Date.now()}`;
        
        let schema = null;
        if (request.feature === 'FACT_CHECK') schema = SCHEMAS.FACT_CHECK;
        else if (request.feature === 'TLDR') schema = SCHEMAS.TLDR;
        else if (request.feature === 'ENTITIES') schema = SCHEMAS.ENTITIES;

        handlePromptAPI(request.prompt, request.context, sessionId, {
            schema,
            imageData: request.imageData
        })
            .then(response => sendResponse({ success: true, response, sessionId }))
            .catch(error => sendResponse({ success: false, error: error.message, sessionId }));
        return true;
    }

    if (request.action === 'checkAPIAvailability') {
        checkAPIAvailability()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ available: false, error: error.message }));
        return true;
    }
});

// State Management
const activeSessions = new Map();
const activeConnections = new Set();
const contentScriptStatus = new Map();
const suggestionCache = new Map();

const restrictedUrlPatterns = [
    /^chrome:\/\//, /^chrome-extension:\/\//, /^moz-extension:\/\//,
    /^edge-extension:\/\//, /^file:\/\//, /^about:/, /^data:/, /^blob:/
];

function isRestrictedUrl(url) {
    return !url || restrictedUrlPatterns.some(pattern => pattern.test(url));
}

async function pingContentScript(tabId, timeout = 3000) {
    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => resolve(false), timeout);
        try {
            chrome.tabs.sendMessage(tabId, {action: 'ping'}, (response) => {
                clearTimeout(timeoutId);
                if (chrome.runtime.lastError || !response?.alive) resolve(false);
                else {
                    contentScriptStatus.set(tabId, {
                        alive: true, ready: response.ready, url: response.url,
                        title: response.title, lastPing: Date.now()
                    });
                    resolve(response.ready);
                }
            });
        } catch (e) { clearTimeout(timeoutId); resolve(false); }
    });
}

async function ensureContentScript(tabId, url) {
    if (isRestrictedUrl(url)) return false;
    try {
        if (await pingContentScript(tabId)) return true;
        await chrome.scripting.executeScript({ target: {tabId}, files: ['src/content.js'] });
        await new Promise(r => setTimeout(r, 500));
        return await pingContentScript(tabId);
    } catch (e) { return false; }
}

async function handlePageContentRequest(request, sendResponse) {
    try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tab) return sendResponse({error: 'No active tab'});

        if (isRestrictedUrl(tab.url)) return sendResponse(await getFallbackPageInfo(tab.id, request.excludeSuggestions));

        if (!(await ensureContentScript(tab.id, tab.url))) return sendResponse(await getFallbackPageInfo(tab.id, request.excludeSuggestions));

        chrome.tabs.sendMessage(tab.id, {action: 'extractContent'}, async (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                sendResponse(await getFallbackPageInfo(tab.id, request.excludeSuggestions));
            } else {
                const suggestionResult = await generateAISuggestions(response.content, response.title, response.url, request.excludeSuggestions);
                sendResponse({ ...response, ...suggestionResult });
            }
        });
    } catch (e) { sendResponse({error: e.message}); }
}

async function handleSuggestionRefresh(request) {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab) return { suggestions: getFallbackSuggestions(request.excludeSuggestions) };
    
    // We need the page content for suggestions
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, {action: 'extractContent'}, async (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                resolve({ suggestions: getFallbackSuggestions(request.excludeSuggestions) });
            } else {
                const result = await generateAISuggestions(response.content, response.title, response.url, request.excludeSuggestions);
                resolve(result);
            }
        });
    });
}

async function generateAISuggestions(content, title, url, excluded = []) {
    try {
        const hash = simpleHash(content + title + excluded.join(''));
        if (suggestionCache.has(hash)) return { suggestions: suggestionCache.get(hash), aiGenerated: true };

        if (!("LanguageModel" in self)) return { suggestions: getFallbackSuggestions(excluded), aiGenerated: false };
        
        const availability = await LanguageModel.availability();
        if (availability !== 'available') return { suggestions: getFallbackSuggestions(excluded), aiGenerated: false };

        const session = await LanguageModel.create({ temperature: 0.7, topK: 3 });
        try {
            const response = await session.prompt(buildSuggestionPrompt({ content, title, url, excludedSuggestions: excluded }));
            const suggestions = parseAISuggestions(response, excluded);
            if (suggestions.length === 3) {
                suggestionCache.set(hash, suggestions);
                return { suggestions, aiGenerated: true };
            }
        } finally { session.destroy(); }
    } catch (e) { console.error(e); }
    return { suggestions: getFallbackSuggestions(excluded), aiGenerated: false };
}

async function handlePromptAPI(prompt, context, sessionId, options = {}) {
    let session = null;
    try {
        const safePrompt = String(prompt || '');
        const safeContext = String(context || '');
        
        console.log(`[Aura] Handling prompt: "${safePrompt.substring(0, 50)}..."`);
        
        if (!("LanguageModel" in self)) throw new Error('Prompt API not found');
        
        const params = await LanguageModel.params().catch(() => ({}));
        
        const createOptions = {};
        
        // Reconstruct image Blob if Base64 data is present
        let imageBlob = null;
        if (options.imageData && options.imageData.base64) {
            try {
                const byteCharacters = atob(options.imageData.base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                imageBlob = new Blob([byteArray], { type: options.imageData.type });
                console.log(`[Aura] Image reconstructed. Type: ${imageBlob.type}, Size: ${imageBlob.size}`);
            } catch (e) {
                console.error('[Aura] Failed to reconstruct image:', e);
            }
        }

        if (imageBlob) {
            createOptions.expectedInputs = [{ type: "text" }, { type: "image" }];
            createOptions.expectedOutputs = [{ type: "text" }];
        } else if (safeContext) {
            // Only ground with text if there's no image (multimodal grounding is different)
            createOptions.initialPrompts = [
                { role: 'system', content: 'You are a helpful assistant that analyzes webpage content. Use the following context to answer the users questions.' },
                { role: 'user', content: `The following is the text content from the current web page: \n\n ${safeContext}` },
                { role: 'assistant', content: 'I have read the page content and am ready to help you analyze it. What would you like to know?' }
            ];
        }

        session = await createSessionWithFallback(params, createOptions);
        if (sessionId) activeSessions.set(sessionId, session);

        let promptInput;
        if (imageBlob) {
            promptInput = [
                { role: "user", content: [
                    { type: "text", value: safePrompt },
                    { type: "image", value: imageBlob }
                ]}
            ];
        } else {
            promptInput = safePrompt;
        }

        const promptOptions = {};
        if (options.schema) promptOptions.responseConstraint = options.schema;

        return await streamResponse(session, promptInput, sessionId, promptOptions);
    } finally {
        if (session) session.destroy();
        if (sessionId) activeSessions.delete(sessionId);
    }
}

async function createSessionWithFallback(params, options = {}) {
    const sessionOptions = { ...buildSessionOptions(params), ...options };
    const availability = await LanguageModel.availability(sessionOptions);
    
    if (availability === 'unavailable') throw new Error('AI Model Unavailable');
    if (availability !== 'available') await handleModelDownload(sessionOptions, availability);
    
    return await LanguageModel.create(sessionOptions);
}

async function streamResponse(session, prompt, sessionId, options = {}) {
    let fullResponse = '';
    const stream = session.promptStreaming(prompt, options);
    for await (const chunk of stream) {
        if (sessionId && !activeSessions.has(sessionId)) break;
        fullResponse += chunk;
        await safeSendMessage({ action: 'streamingResponse', sessionId, fullResponse });
    }
    return fullResponse;
}

async function handleModelDownload(options, availability) {
    const session = await LanguageModel.create({
        ...options,
        monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
                const progress = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
                safeSendMessage({ action: 'downloadProgress', progress });
            });
        }
    });
    session.destroy();
}

function safeSendMessage(message) {
    return new Promise(resolve => {
        chrome.runtime.sendMessage(message, () => {
            chrome.runtime.lastError; // Clear error
            resolve();
        });
    });
}

async function checkAPIAvailability() {
    if (!("LanguageModel" in self)) return { available: false, message: 'Chrome 138+ required' };
    const status = await LanguageModel.availability();
    return { available: status === 'available', status };
}

async function getFallbackPageInfo(tabId, excludeSuggestions = []) {
    const tab = await chrome.tabs.get(tabId).catch(() => ({}));
    return { success: true, url: tab.url, title: tab.title, suggestions: getFallbackSuggestions(excludeSuggestions) };
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
    return hash.toString();
}

chrome.runtime.onConnect.addListener((port) => {
    activeConnections.add(port);
    port.onDisconnect.addListener(() => activeConnections.delete(port));
});
