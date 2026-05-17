function validateParameters(apiParams = {}, requestedParams = {}) {
    const limits = apiParams ?? {};
    const validated = {};

    if (requestedParams.temperature !== undefined) {
        const temp = requestedParams.temperature;
        const minTemp = limits.temperature?.min ?? 0.0;
        const maxTemp = limits.temperature?.max ?? limits.maxTemperature ?? 2.0;
        validated.temperature = Math.max(minTemp, Math.min(maxTemp, temp));
    }

    if (requestedParams.topK !== undefined) {
        const topK = requestedParams.topK;
        const minTopK = limits.topK?.min ?? 1;
        const maxTopK = limits.topK?.max ?? limits.maxTopK ?? 8;
        validated.topK = Math.max(minTopK, Math.min(maxTopK, topK));
    }

    return validated;
}

function buildSessionOptions(apiParams = {}) {
    const params = apiParams ?? {};

    return validateParameters(params, {
        temperature: params.defaultTemperature ?? params.temperature?.default ?? 0.7,
        topK: Math.min(
            params.defaultTopK ?? params.topK?.default ?? 3,
            params.maxTopK ?? params.topK?.max ?? 8
        ),
    });
}

module.exports = {
    buildSessionOptions,
    validateParameters
};