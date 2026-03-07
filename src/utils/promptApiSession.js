function validateParameters(apiParams = {}, requestedParams = {}) {
    const validated = {};

    if (requestedParams.temperature !== undefined) {
        const temp = requestedParams.temperature;
        const minTemp = apiParams.temperature?.min ?? 0.0;
        const maxTemp = apiParams.temperature?.max ?? apiParams.maxTemperature ?? 2.0;
        validated.temperature = Math.max(minTemp, Math.min(maxTemp, temp));
    }

    if (requestedParams.topK !== undefined) {
        const topK = requestedParams.topK;
        const minTopK = apiParams.topK?.min ?? 1;
        const maxTopK = apiParams.topK?.max ?? apiParams.maxTopK ?? 8;
        validated.topK = Math.max(minTopK, Math.min(maxTopK, topK));
    }

    return validated;
}

function buildSessionOptions(apiParams = {}) {
    return validateParameters(apiParams, {
        temperature: apiParams.defaultTemperature ?? apiParams.temperature?.default ?? 0.7,
        topK: Math.min(apiParams.defaultTopK ?? apiParams.topK?.default ?? 3, apiParams.maxTopK ?? apiParams.topK?.max ?? 8)
    });
}

module.exports = {
    buildSessionOptions,
    validateParameters
};