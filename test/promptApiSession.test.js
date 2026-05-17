const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildSessionOptions,
    validateParameters
} = require('../src/utils/promptApiSession');

test('validateParameters clamps temperature and topK to API limits', () => {
    const validated = validateParameters({
        temperature: {min: 0.2, max: 1.2},
        topK: {min: 2, max: 5}
    }, {
        temperature: 5,
        topK: 1
    });

    assert.deepEqual(validated, {
        temperature: 1.2,
        topK: 2
    });
});

test('buildSessionOptions keeps sampling defaults for text-only sessions', () => {
    const options = buildSessionOptions({
        defaultTemperature: 0.6,
        defaultTopK: 9,
        maxTopK: 4
    });

    assert.deepEqual(options, {
        temperature: 0.6,
        topK: 4
    });
});

test('buildSessionOptions falls back to Prompt API-friendly defaults', () => {
    const options = buildSessionOptions({});

    assert.deepEqual(options, {
        temperature: 0.7,
        topK: 3
    });
});

test('buildSessionOptions handles null params while the model is downloading', () => {
    const options = buildSessionOptions(null);

    assert.deepEqual(options, {
        temperature: 0.7,
        topK: 3
    });
});

test('buildSessionOptions uses nested API defaults when top-level defaults are absent', () => {
    const options = buildSessionOptions({
        temperature: {min: 0.2, max: 1.2, default: 0.5},
        topK: {min: 1, max: 6, default: 4}
    });

    assert.deepEqual(options, {
        temperature: 0.5,
        topK: 4
    });
});