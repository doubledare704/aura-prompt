# Best Practices for Session Management

Efficiently managing sessions is key to providing a smooth and responsive user experience with the Prompt API.

## Initial Prompts
Use `initialPrompts` to set the persona or provide examples (n-shot prompting).
```javascript
const languageModel = await LanguageModel.create({
  initialPrompts: [{ role: 'system', content: 'You speak like a pirate.' }],
});
```

## Cloning Sessions
Cloning allows for parallel independent conversations that inherit the same initial context and history.
```javascript
const mainSession = await LanguageModel.create({...});
const fork1 = await mainSession.clone();
const fork2 = await mainSession.clone();
```

## Restoring Past Sessions
Since sessions aren't automatically persisted, you can store the history in `localStorage` and restore it using `initialPrompts`.
```javascript
// Save history
sessionData.initialPrompts.push(
  { role: 'user', content: prompt },
  { role: 'assistant', content: result }
);
localStorage.setItem(uuid, JSON.stringify(sessionData));

// Restore
const session = await LanguageModel.create(JSON.parse(localStorage.getItem(uuid)));
```

## Preserving Quota
Use `AbortController` to allow users to stop the model if the output is no longer needed, saving context window space and resources.
```javascript
const controller = new AbortController();
const stream = languageModel.promptStreaming('Write a poem', { signal: controller.signal });
// To stop: controller.abort();
```

---
*Source: [https://developer.chrome.com/docs/ai/session-management](https://developer.chrome.com/docs/ai/session-management)*
