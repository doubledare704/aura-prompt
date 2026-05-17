# Structured Output for Prompt API

The Prompt API allows enforcing a specific JSON structure for responses using JSON Schema. This ensures that the model output is predictable and easy to parse.

## JSON Schema Support
This feature is available from Chrome 137.

### Example: Boolean Classification
```javascript
const schema = { "type": "boolean" };
const result = await session.prompt(
  "Is this post about pottery?\n\n" + postContent,
  { responseConstraint: schema }
);
console.log(JSON.parse(result)); // true or false
```

### Example: Complex Object (Hashtags)
```javascript
const schema = {
  "type": "object",
  "properties": {
    "hashtags": {
      "type": "array",
      "maxItems": 3,
      "items": { "type": "string", "pattern": "^#[^\\s#]+$" }
    }
  },
  "required": ["hashtags"],
  "additionalProperties": false
};

const result = await session.prompt("Generate hashtags for this post", {
  responseConstraint: schema
});
```

## Key Benefits
- **Predictability:** No need to parse Markdown or use regex to extract data.
- **Validation:** Ensures the model adheres to the required data types and constraints.
- **Efficiency:** Reduces the need for post-processing logic.

---
*Source: [https://developer.chrome.com/docs/ai/structured-output-for-prompt-api](https://developer.chrome.com/docs/ai/structured-output-for-prompt-api)*
