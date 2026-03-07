const FALLBACK_SUGGESTION_POOL = [
    'Summarize this page',
    'What are the main points?',
    'Explain this in simple terms',
    'What stands out most here?',
    'What context matters most?',
    'What evidence supports this?',
    'What should I question here?',
    'What are the key takeaways?',
    'How does this compare to similar cases?'
];

function normalizeSuggestion(value = '') {
    return value.trim().toLowerCase();
}

function uniqueSuggestions(suggestions = []) {
    const seen = new Set();

    return suggestions.filter((suggestion) => {
        const normalized = normalizeSuggestion(suggestion);

        if (!normalized || seen.has(normalized)) {
            return false;
        }

        seen.add(normalized);
        return true;
    }).map((suggestion) => suggestion.trim());
}

function buildSuggestionPrompt({ content = '', title = '', url = '', excludedSuggestions = [] }) {
    const exclusions = uniqueSuggestions(excludedSuggestions);
    const exclusionBlock = exclusions.length > 0
        ? `\nAvoid reusing any of these suggestions:\n${exclusions.map((item) => `- ${item}`).join('\n')}\n`
        : '';

    return `Based on the following webpage content, generate exactly 3 unique, specific, and contextually relevant questions or prompts that would help someone understand or engage with this content better.

Page Title: ${title}
URL: ${url}
Content: ${content.substring(0, 1500)}...
${exclusionBlock}
Requirements:
- Generate exactly 3 suggestions
- Make them specific to this content, not generic
- Focus on the most important or interesting aspects
- Keep each suggestion under 60 characters
- Do not repeat excluded suggestions
- Format as a simple numbered list (1. 2. 3.)
- No explanations, just the suggestions

Example format:
1. What are the key findings?
2. How does this compare to alternatives?
3. What are the practical implications?`;
}

function parseAISuggestions(response, excludedSuggestions = []) {
    try {
        const lines = response.split('\n').filter((line) => line.trim());
        const suggestions = [];
        const seen = new Set(uniqueSuggestions(excludedSuggestions).map(normalizeSuggestion));

        for (const line of lines) {
            const match = line.match(/^\d+\.\s*(.+)$/);
            if (!match || !match[1]) {
                continue;
            }

            const suggestion = match[1].trim().replace(/^["']|["']$/g, '');
            const normalized = normalizeSuggestion(suggestion);

            if (!normalized || seen.has(normalized)) {
                continue;
            }

            seen.add(normalized);
            suggestions.push(suggestion);

            if (suggestions.length >= 3) {
                break;
            }
        }

        return suggestions;
    } catch (error) {
        console.error('Error parsing AI suggestions:', error);
        return [];
    }
}

function getFallbackSuggestions(excludedSuggestions = []) {
    const excluded = new Set(uniqueSuggestions(excludedSuggestions).map(normalizeSuggestion));
    const available = FALLBACK_SUGGESTION_POOL.filter(
        (suggestion) => !excluded.has(normalizeSuggestion(suggestion))
    );

    return available.slice(0, 3);
}

module.exports = {
    buildSuggestionPrompt,
    getFallbackSuggestions,
    parseAISuggestions
};

