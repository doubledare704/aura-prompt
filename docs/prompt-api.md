# The Prompt API

With the Prompt API, you can send natural language requests to Gemini Nano in the browser. This allows for AI-powered search, personalized news feeds, custom content filters, and more, all running locally on the user's device.

## Hardware Requirements

To use the Prompt API (and other Gemini Nano-based APIs), the following conditions must be met:
- **Operating System:** Windows 10/11, macOS 13+, Linux, or ChromeOS (Chromebook Plus).
- **Storage:** At least 22 GB of free space.
- **GPU/CPU:** 
    - GPU: > 4 GB VRAM.
    - CPU: 16 GB RAM and 4+ cores.
- **Network:** Required only for the initial model download.

## Usage

### Checking Availability
```javascript
const availability = await LanguageModel.availability();
if (availability === 'readily') {
  // Model is available
}
```

### Creating a Session
```javascript
const session = await LanguageModel.create({
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  },
});
```

### Model Parameters (Extensions/Origin Trial)
```javascript
const params = await LanguageModel.params();
// Returns {defaultTopK, maxTopK, defaultTemperature, maxTemperature}

const session = await LanguageModel.create({
  temperature: 1.2,
  topK: 3,
});
```

## Prompting the Model

### Request-based Output
```javascript
const result = await session.prompt('Write me a poem!');
console.log(result);
```

### Streamed Output
```javascript
const stream = session.promptStreaming('Write me an extra-long poem!');
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Advanced Features

### Initial Prompts (Context)
```javascript
const session = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of Italy?' },
    { role: 'assistant', content: 'The capital of Italy is Rome.' }
  ],
});
```

### Multimodal Capabilities
The Prompt API supports multimodal capabilities, allowing you to interact with Gemini Nano using various input types beyond just text.

#### Use Cases
*   **Audio Transcription:** Transcribe audio messages within chat applications.
*   **Image Description:** Generate captions or alt text for uploaded images.

#### Supported Input Types
The Prompt API supports the following input modalities:

*   **Audio:** `AudioBuffer`, `ArrayBufferView`, `ArrayBuffer`, `Blob`
*   **Visual:** `HTMLImageElement`, `SVGImageElement`, `HTMLVideoElement`, `HTMLCanvasElement`, `ImageBitmap`, `OffscreenCanvas`, `VideoFrame`, `Blob`, `ImageData`

#### Implementation Example
When creating a session, you must specify the expected modalities in the `expectedInputs` and `expectedOutputs` fields.

```javascript
const session = await LanguageModel.create({
  expectedInputs: [
    { type: "text", languages: ["en"] },
    { type: "audio" },
    { type: "image" },
  ],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
});

const referenceImage = await (await fetch("reference-image.jpeg")).blob();
const userDrawnImage = document.querySelector("canvas");

// Prompting with multiple images
const response1 = await session.prompt([
  { 
    role: "user", 
    content: [
      { type: "text", value: "Give a helpful artistic critique of how well the second image matches the first:" },
      { type: "image", value: referenceImage },
      { type: "image", value: userDrawnImage },
    ],
  },
]);

console.log(response1);

// Prompting with audio input
const audioBuffer = await captureMicrophoneInput({ seconds: 10 });
const response2 = await session.prompt([
  { 
    role: "user", 
    content: [
      { type: "text", value: "My response to your critique:" },
      { type: "audio", value: audioBuffer },
    ],
  },
]);

console.log(response2);
```

#### Important Notes
*   **Output Modality:** Currently, the Prompt API only supports `text` as an output modality.
*   **Hardware Requirements:** Using the Prompt API with audio input requires a GPU.
*   **Error Handling:** A `NotSupportedError` DOMException may be thrown if the model encounters an unsupported input or output type.

### Session Management
- **Context Window:** `session.contextUsage` / `session.contextWindow`.
- **Cloning:** `const clonedSession = await session.clone();`
- **Termination:** `session.destroy();`

---
*Source: [https://developer.chrome.com/docs/ai/prompt-api](https://developer.chrome.com/docs/ai/prompt-api)*
