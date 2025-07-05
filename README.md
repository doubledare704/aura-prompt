# Aura Prompt—AI Chrome Extension

A modern Chrome extension built with Vue.js and shadcn/ui that integrates with Chrome's built-in Prompt API
to provide AI-powered assistance for webpage analysis and general questions.

## Features

- 🤖 **AI-Powered Assistance**: Leverages Chrome's native Prompt API for intelligent responses
- 📄 **Page Content Analysis**: Automatically extracts and analyzes webpage content
- 💡 **Smart Suggestions**: Context-aware prompt suggestions based on page content
- 🎨 **Modern UI**: Built with Vue.js and shadcn/ui components
- ⚡ **Fast & Lightweight**: Optimized for performance with minimal overhead
- 🔄 **Streaming Responses**: Real-time AI responses with live typing indicators
- 📥 **Model Download Management**: Automatic AI model download with progress tracking
- 🛡️ **Robust Error Handling**: Comprehensive error handling and user feedback
- 🎯 **Session Management**: Ability to cancel ongoing AI requests
- 📊 **API Status Monitoring**: Real-time availability checking and status updates

## Prerequisites

- **Chrome 127+** with Prompt API support
- **Node.js 16+** for development
- **npm or yarn** package manager

### Enabling Chrome's Prompt API

The extension uses Chrome's built-in Prompt API. To ensure it works:

1. Make sure you're using Chrome 138 or later
2. The Prompt API should be available by default in recent Chrome versions

## Installation

### For Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aura-prompt
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder

### For Production

1. Download the latest release from the releases' page
2. Extract the ZIP file
3. Load the extracted folder in Chrome as described above

## Usage

### Basic Usage

1. **Click the extension icon** in your Chrome toolbar
2. **Ask questions** about the current webpage or general topics
3. **Use smart suggestions** for quick analysis of page content

### Smart Suggestions

The extension automatically generates contextual suggestions based on the type of content on the page:

- **Articles/News**: "What's the main story?", "Who are the key people involved?"
- **Tutorials**: "Break down the steps," "What skills do I need?"
- **Research Papers**: "What were the findings?", "What's the methodology?"
- **Product Pages**: "What are the pros and cons?", "Is this worth buying?"
- **Recipes**: "What are the ingredients?", "How long does it take?"

### Page Analysis

The extension can analyze various types of content:
- Article text and main content
- Product descriptions and reviews
- Tutorial steps and instructions
- Research findings and data
- News articles and reports

## Development

### Project Structure

```
src/
├── popup/              # Vue.js popup application
│   ├── App.vue        # Main Vue component
│   ├── main.js        # Vue app entry point
│   ├── popup.html     # Popup HTML template
│   └── style.css      # Tailwind CSS styles
├── components/ui/      # shadcn/ui components
│   ├── Button.vue     # Button component
│   └── Input.vue      # Input component
├── utils/             # Utility functions
│   └── cn.js          # Class name utility
├── icons/             # Extension icons
├── background.js      # Service worker
└── content.js         # Content script
```

### Available Scripts

- `npm run dev` - Build in development mode with watch
- `npm run build` - Build for production
- `npm run build:dev` - Build for development

### Building

The build process uses Webpack to bundle the Vue.js application and extension files:

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build
```

Built files will be output to the `dist/` directory.

## Technical Details

### Chrome Extension Architecture

- **Manifest V3**: Uses the latest Chrome extension manifest version
- **Service Worker**: Background script for handling API calls
- **Content Script**: Extracts page content and generates suggestions
- **Popup**: Vue.js application for user interaction

### AI Integration

- **Chrome Prompt API**: Native Chrome AI capabilities with full lifecycle management
- **Availability Checking**: Automatic detection of AI model status (available, downloadable, downloading, unavailable)
- **Model Download**: Automatic download with progress monitoring when needed
- **Parameter Validation**: Validates temperature (0.0–2.0) and topK (1–8) parameters against API constraints
- **Streaming Responses**: Real-time response chunks using `promptStreaming()` API
- **Session Management**: Proper session creation, management, and cleanup
- **Context-Aware**: Includes page content as context for better responses
- **Cancellation Support**: Ability to abort ongoing AI requests
- **Error Handling**: Comprehensive error handling with user-friendly messages

### UI Components

Built with shadcn/ui design system:
- Consistent styling with CSS custom properties
- Dark/light theme support
- Accessible components
- Responsive design

## Permissions

The extension requires the following permissions:

- `activeTab`: Access current tab content
- `storage`: Store user preferences
- `scripting`: Inject content scripts
- `host_permissions`: Access all websites for content extraction

## Troubleshooting

### Common Issues

1. **"Prompt API not available"**
   - Ensure you're using Chrome 127+
   - Check if AI features are enabled in Chrome settings

2. **Extension not loading**
   - Make sure you've built the project (`npm run build`)
   - Check the `dist` folder exists and contains the built files

3. **No smart suggestions**
   - The page might not have extractable content
   - Try refreshing the page and reopening the extension

### Debug Mode

For development, you can enable debug logging:
1. Open Chrome DevTools
2. Go to the Extensions tab
3. Find "Aura Prompt" and click "Inspect views: service worker"
4. Check console for debug messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License—see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section above
- Open an issue on GitHub
- Review Chrome's Prompt API documentation
