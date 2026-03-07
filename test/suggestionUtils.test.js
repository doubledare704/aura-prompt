const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildSuggestionPrompt,
    getFallbackSuggestions,
    parseAISuggestions
} = require('../src/utils/suggestionUtils');

test('buildSuggestionPrompt includes excluded suggestions when provided', () => {
    const prompt = buildSuggestionPrompt({
        content: 'Example article body',
        title: 'Example Title',
        url: 'https://example.com',
        excludedSuggestions: ['Summarize this page', 'What are the main points?']
    });

    assert.match(prompt, /Avoid reusing any of these suggestions:/);
    assert.match(prompt, /- Summarize this page/);
    assert.match(prompt, /- What are the main points\?/);
});

test('parseAISuggestions filters duplicates and excluded suggestions', () => {
    const suggestions = parseAISuggestions(
        [
            '1. Summarize this page',
            '2. What evidence supports the claim?',
            '3. What evidence supports the claim?',
            '4. How does this compare historically?'
        ].join('\n'),
        ['Summarize this page']
    );

    assert.deepEqual(suggestions, [
        'What evidence supports the claim?',
        'How does this compare historically?'
    ]);
});

test('getFallbackSuggestions rotates away from already used prompts', () => {
    const suggestions = getFallbackSuggestions([
        'Summarize this page',
        'What are the main points?',
        'Explain this in simple terms'
    ]);

    assert.deepEqual(suggestions, [
        'What stands out most here?',
        'What context matters most?',
        'What evidence supports this?'
    ]);
});

