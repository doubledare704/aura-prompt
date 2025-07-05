# Quick Installation Guide

## Prerequisites

1. **Chrome 127+** - Make sure you have a recent version of Chrome
2. **Node.js 16+** - For building the extension

## Step 1: Build the Extension

```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

## Step 2: Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `dist` folder from this project
5. The extension should now appear in your extensions list

## Step 3: Test the Extension

1. Navigate to any webpage (e.g., a news article, blog post, or Wikipedia page)
2. Click the **Aura Prompt** extension icon in your toolbar
3. Try the smart suggestions or ask your own questions

## Troubleshooting

### "Prompt API not available" Error

This means Chrome's AI features aren't available. Try:

1. Make sure you're using Chrome 127 or later
2. Check Chrome's AI settings at `chrome://settings/ai`
3. Restart Chrome after enabling AI features

### Extension Not Loading

1. Make sure you built the project (`npm run build`)
2. Check that the `dist` folder contains all the files
3. Try reloading the extension in `chrome://extensions/`

### No Smart Suggestions

1. Make sure you're on a page with readable content
2. Try refreshing the page and reopening the extension
3. Check the browser console for any errors

## Features to Test

- **Page Analysis**: Ask "Summarize this page" on an article
- **Smart Suggestions**: Notice how suggestions change based on page content
- **General Questions**: Ask questions not related to the current page
- **Context Awareness**: Ask follow-up questions about the same topic

## Development

For development with hot reload:

```bash
npm run dev
```

Then reload the extension in Chrome after making changes.
