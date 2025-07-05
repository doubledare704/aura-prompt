<template>
  <div class="w-full h-full bg-background">
    <!-- Header -->
    <div class="border-b border-border p-4">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Sparkles class="w-4 h-4 text-primary-foreground"/>
        </div>
        <div>
          <h1 class="text-lg font-semibold">Aura Prompt</h1>
          <p class="text-xs text-muted-foreground">AI Assistant</p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="p-4 space-y-4">
      <!-- API Status -->
      <div v-if="!apiStatus.available" class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <div class="flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0"/>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-yellow-800">AI Not Available</p>
            <p class="text-xs text-yellow-700">{{ apiStatus.message }}</p>
          </div>
        </div>
      </div>

      <!-- Download Progress -->
      <div v-if="isDownloading" class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div class="flex items-center gap-2">
          <Download class="w-4 h-4 text-blue-600 flex-shrink-0"/>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-blue-800">Downloading AI Model</p>
            <div class="w-full bg-blue-200 rounded-full h-2 mt-1">
              <div
                  class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  :style="{ width: `${downloadProgress}%` }"
              ></div>
            </div>
            <p class="text-xs text-blue-700 mt-1">{{ downloadProgress }}% complete</p>
          </div>
        </div>
      </div>

      <!-- Page Info -->
      <div v-if="pageInfo.title" class="bg-muted/50 rounded-lg p-3">
        <div class="flex items-start gap-2">
          <Globe class="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0"/>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">{{ pageInfo.title }}</p>
            <p class="text-xs text-muted-foreground truncate">{{ pageInfo.url }}</p>
          </div>
        </div>
      </div>

      <!-- Smart Suggestions -->
      <div v-if="suggestions.length > 0 || isLoadingSuggestions">
        <h3 class="text-sm font-medium mb-2 flex items-center gap-2">
          <Lightbulb class="w-4 h-4"/>
          Smart Suggestions
          <span v-if="aiGeneratedSuggestions" class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
            AI
          </span>
        </h3>

        <!-- Loading state for suggestions -->
        <div v-if="isLoadingSuggestions" class="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 class="w-4 h-4 animate-spin"/>
          Generating smart suggestions...
        </div>

        <!-- Generated suggestions -->
        <div v-else class="grid grid-cols-1 gap-2">
          <Button
              v-for="suggestion in suggestions"
              :key="suggestion"
              variant="outline"
              size="sm"
              class="justify-start text-left h-auto py-2 px-3"
              @click="selectSuggestion(suggestion)"
          >
            {{ suggestion }}
          </Button>
        </div>
      </div>

      <!-- Chat Interface -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <MessageSquare class="w-4 h-4"/>
            Ask Anything
          </div>
          <span v-if="isLoading && tokensPerSecond > 0" class="text-xs text-muted-foreground font-normal">
            {{ tokensPerSecond.toFixed(1) }} tokens/s
          </span>
        </h3>


        <!-- Chat Messages -->
        <div ref="chatContainer" v-if="messages.length > 0" class="space-y-3 max-h-60 overflow-y-auto">
          <div
              v-for="message in messages"
              :key="message.id"
              class="flex gap-3"
              :class="message.type === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
                class="max-w-[95%] rounded-lg px-3 py-2 text-sm"
                :class="message.type === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'"
            >
              <!-- User messages (plain text) -->
              <div v-if="message.type === 'user'" class="whitespace-pre-wrap">
                {{ message.content }}
              </div>

              <!-- AI messages (parsed markdown) -->
              <div
                  v-else
                  class="markdown-content"
                  v-html="parseMarkdown(message.content)"
              ></div>

              <div v-if="message.streaming" class="flex items-center gap-1 mt-2">
                <Loader2 class="w-3 h-3 animate-spin"/>
                <span class="text-xs opacity-70">AI is typing...</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="space-y-2">
          <div class="flex gap-2">
            <Input
                v-model="currentPrompt"
                :placeholder="apiStatus.available ? 'Ask about this page or anything else...' : 'AI not available'"
                class="flex-1"
                @keyup.enter="sendPrompt"
                :disabled="isLoading || !apiStatus.available || isDownloading"
            />
            <Button
                @click="sendPrompt"
                :disabled="!currentPrompt.trim() || isLoading || !apiStatus.available || isDownloading"
                size="sm"
            >
              <Send class="w-4 h-4"/>
            </Button>
          </div>

          <!-- Loading indicator -->
          <div v-if="isLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="w-4 h-4 animate-spin"/>
            Thinking...
          </div>

          <!-- Error message -->
          <div v-if="error" class="text-sm text-destructive bg-destructive/10 rounded-lg p-2">
            {{ error }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import {AlertTriangle, Download, Globe, Lightbulb, Loader2, MessageSquare, Send, Sparkles} from 'lucide-vue-next'

// Markdown parsing utility optimized for chat messages
function parseMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  let html = text.trim();

  // Escape HTML to prevent XSS
  html = html.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // Code blocks first (to avoid processing markdown inside code)
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="code-block"><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold text (**text** or __text__) - avoid conflicts with italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic text (*text* or _text_) - only single chars
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');

  // Headers (# ## ###) - only at start of line
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Process lists
  const lines = html.split('\n');
  const processedLines = [];
  let inList = false;
  let listType = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    const numberMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);

    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) processedLines.push(`</${listType}>`);
        processedLines.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      processedLines.push(`<li>${bulletMatch[1]}</li>`);
    } else if (numberMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) processedLines.push(`</${listType}>`);
        processedLines.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      processedLines.push(`<li>${numberMatch[1]}</li>`);
    } else {
      if (inList) {
        processedLines.push(`</${listType}>`);
        inList = false;
        listType = null;
      }
      processedLines.push(line);
    }
  }

  if (inList) {
    processedLines.push(`</${listType}>`);
  }

  html = processedLines.join('\n');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Convert line breaks
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraphs, but avoid wrapping block elements
  const blockElements = /<(h[1-6]|ul|ol|pre|div)/;
  if (!blockElements.test(html)) {
    html = `<p>${html}</p>`;
  } else {
    // Smart paragraph wrapping
    const parts = html.split(/(<\/?(?:h[1-6]|ul|ol|pre|div)[^>]*>)/);
    let result = '';
    let inBlock = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.match(/<(h[1-6]|ul|ol|pre|div)/)) {
        if (!inBlock && result && !result.endsWith('>')) {
          result = `<p>${result}</p>`;
        }
        result += part;
        inBlock = true;
      } else if (part.match(/<\/(h[1-6]|ul|ol|pre|div)/)) {
        result += part;
        inBlock = false;
      } else if (part.trim()) {
        if (!inBlock) {
          result += `<p>${part}</p>`;
        } else {
          result += part;
        }
      }
    }
    html = result;
  }

  // Clean up empty paragraphs and fix nesting
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<[^>]+>)/g, '$1<p>');
  html = html.replace(/(<\/[^>]+>)<\/p>/g, '$1');
  html = html.replace(/<p><br><\/p>/g, '<br>');

  return html;
}

export default {
  name: 'App',
  components: {
    Button,
    Input,
    Sparkles,
    Globe,
    Lightbulb,
    MessageSquare,
    Send,
    Loader2,
    AlertTriangle,
    Download
  },
  setup() {
    const currentPrompt = ref('')
    const messages = ref([])
    const suggestions = ref([])
    const pageInfo = ref({title: '', url: ''})
    const pageContent = ref('')
    const isLoading = ref(false)
    const error = ref('')
    const apiStatus = ref({available: false, message: ''})
    const downloadProgress = ref(0)
    const isDownloading = ref(false)
    const isLoadingSuggestions = ref(false)
    const aiGeneratedSuggestions = ref(false)
    const chatContainer = ref(null)
    const tokensPerSecond = ref(0)

    // Connection port for background script communication
    let connectionPort = null

    // Load page content and suggestions on mount
    onMounted(async () => {
      // Establish connection with background script
      establishConnection()

      await loadPageData()
      await checkAPIStatus()
      setupMessageListeners()
    })

    // Cleanup on unmount
    onUnmounted(() => {
      if (connectionPort) {
        connectionPort.disconnect()
        connectionPort = null
      }
    })

    const establishConnection = () => {
      try {
        connectionPort = chrome.runtime.connect({name: 'popup'})

        // Handle heartbeat messages
        connectionPort.onMessage.addListener((message) => {
          if (message.action === 'heartbeat') {
            // Respond to heartbeat to keep connection alive
            try {
              connectionPort.postMessage({action: 'heartbeat_response'});
            } catch (error) {
              console.log('Failed to respond to heartbeat:', error);
            }
          }
        });

        connectionPort.onDisconnect.addListener(() => {
          console.log('Connection to background script lost')
          connectionPort = null
        })

        console.log('Connected to background script')
      } catch (error) {
        console.error('Failed to establish connection:', error)
      }
    }

    const loadPageData = async () => {
      try {
        isLoadingSuggestions.value = true

        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({action: 'getPageContent'}, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        if (response && !response.error) {
          pageContent.value = response.content || ''
          suggestions.value = response.suggestions || []
          aiGeneratedSuggestions.value = response.aiGenerated || false
          pageInfo.value = {
            title: response.title || '',
            url: response.url || ''
          }

          console.log('Loaded suggestions:', {
            count: suggestions.value.length,
            aiGenerated: aiGeneratedSuggestions.value,
            suggestions: suggestions.value
          })
        }
      } catch (err) {
        console.error('Failed to load page data:', err)
        // Set fallback suggestions on error
        suggestions.value = [
          "Summarize this page",
          "What are the main points?",
          "Explain this in simple terms"
        ]
        aiGeneratedSuggestions.value = false
      } finally {
        isLoadingSuggestions.value = false
      }
    }

    const selectSuggestion = (suggestion) => {
      currentPrompt.value = suggestion
      sendPrompt()
    }

    const sendPrompt = async () => {
      if (!currentPrompt.value.trim() || isLoading.value) return

      const userMessage = {
        id: Date.now(),
        type: 'user',
        content: currentPrompt.value
      }

      messages.value.push(userMessage)
      const prompt = currentPrompt.value
      currentPrompt.value = ''
      isLoading.value = true
      error.value = ''
      tokensPerSecond.value = 0 // Reset TPS counter
      let streamStartTime = 0 // To calculate TPS

      // Create assistant message for streaming
      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: '',
        streaming: true
      }
      messages.value.push(assistantMessage)

      try {
        const sessionId = `session_${Date.now()}_${Math.random()}`

        // Listen for streaming responses
        const messageListener = (message) => {
          if (message.action === 'streamingResponse' && message.sessionId === sessionId) {
            if (streamStartTime === 0) {
              streamStartTime = Date.now()
            }
            // Update the assistant message with streaming content
            const msgIndex = messages.value.findIndex(m => m.id === assistantMessage.id)
            if (msgIndex !== -1) {
              messages.value[msgIndex].content = message.fullResponse

              // Calculate approximate tokens per second
              const elapsedTime = (Date.now() - streamStartTime) / 1000 // in seconds
              if (elapsedTime > 0.1) { // To avoid division by zero and for smoother updates
                // Using word count as a rough approximation for tokens
                const tokenCount = message.fullResponse.split(/\s+/).length
                tokensPerSecond.value = tokenCount / elapsedTime
              }
            }
          }
        }

        chrome.runtime.onMessage.addListener(messageListener)

        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'promptAPI',
            prompt: prompt,
            context: pageContent.value,
            sessionId: sessionId
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        // Remove streaming listener
        chrome.runtime.onMessage.removeListener(messageListener)

        if (response.success) {
          // Update final response
          const msgIndex = messages.value.findIndex(m => m.id === assistantMessage.id)
          if (msgIndex !== -1) {
            messages.value[msgIndex].content = response.response
            messages.value[msgIndex].streaming = false
          }
        } else {
          // Remove the assistant message on error
          const msgIndex = messages.value.findIndex(m => m.id === assistantMessage.id)
          if (msgIndex !== -1) {
            messages.value.splice(msgIndex, 1)
          }
          throw new Error(response.error || 'Failed to get AI response')
        }
      } catch (err) {
        error.value = err.message || 'Something went wrong. Please try again.'
        console.error('Prompt API error:', err)

        // Remove the assistant message on error
        const msgIndex = messages.value.findIndex(m => m.id === assistantMessage.id)
        if (msgIndex !== -1) {
          messages.value.splice(msgIndex, 1)
        }
      } finally {
        isLoading.value = false
      }
    }


    const checkAPIStatus = async () => {
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({action: 'checkAPIAvailability'}, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        apiStatus.value = response

        if (!response.available && response.status === 'downloadable') {
          // Model needs to be downloaded
          isDownloading.value = true
        }
      } catch (err) {
        console.error('Failed to check API status:', err)
        apiStatus.value = {
          available: false,
          message: 'Failed to check AI availability'
        }
      }
    }

    const scrollToBottom = () => {
      // nextTick ensures this code runs after the DOM has been updated
      nextTick(() => {
        const container = chatContainer.value;
        console.log()
        if (container) {
          // Set the scroll position to the maximum scroll height
          console.log(container.scrollHeight)
          container.scrollTop = container.scrollHeight;
        }
      });
    };

    const setupMessageListeners = () => {
      // Listen for download progress updates
      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'downloadProgress') {
          downloadProgress.value = message.progress
          isDownloading.value = message.progress < 100

          if (message.progress === 100) {
            // Download completed, recheck API status
            setTimeout(() => {
              checkAPIStatus()
              isDownloading.value = false
            }, 1000)
          }
        }
      })
    }

    watch(messages, () => {
      scrollToBottom();
    }, {
      // deep: true is crucial. It watches for changes inside the message
      // objects, like when the 'content' property is updated during streaming.
      deep: true
    });

    return {
      currentPrompt,
      messages,
      suggestions,
      pageInfo,
      isLoading,
      error,
      apiStatus,
      downloadProgress,
      isDownloading,
      isLoadingSuggestions,
      aiGeneratedSuggestions,
      tokensPerSecond,
      selectSuggestion,
      sendPrompt,
      checkAPIStatus,
      parseMarkdown
    }
  }
}
</script>

<style scoped>
/* Markdown content styling optimized for chat interface */
.markdown-content {
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Paragraphs */
.markdown-content p {
  margin: 0.5rem 0;
}

.markdown-content p:first-child {
  margin-top: 0;
}

.markdown-content p:last-child {
  margin-bottom: 0;
}

/* Headings */
.markdown-content h1,
.markdown-content h2,
.markdown-content h3 {
  margin: 0.75rem 0 0.5rem 0;
  line-height: 1.3;
}

.markdown-content h1:first-child,
.markdown-content h2:first-child,
.markdown-content h3:first-child {
  margin-top: 0;
}

/* Lists */
.markdown-content ul,
.markdown-content ol {
  margin: 0.5rem 0;
  padding-left: 0;
}

.markdown-content li {
  margin: 0.25rem 0;
  padding-left: 0.5rem;
  line-height: 1.4;
}

/* Code styling */
.markdown-content .inline-code {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875em;
}

.markdown-content .code-block {
  background-color: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin: 0.5rem 0;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.4;
}

.markdown-content .code-block code {
  background: none;
  padding: 0;
  border-radius: 0;
}

/* Strong and emphasis */
.markdown-content strong {
  font-weight: 600;
}

.markdown-content em {
  font-style: italic;
}

/* Links */
.markdown-content a {
  color: #2563eb;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.markdown-content a:hover {
  color: #1d4ed8;
}

/* Responsive adjustments for small popup */
@media (max-width: 400px) {
  .markdown-content {
    font-size: 0.875rem;
  }

  .markdown-content .code-block {
    font-size: 0.75rem;
    padding: 0.5rem;
  }

  .markdown-content h1 {
    font-size: 1rem;
  }

  .markdown-content h2 {
    font-size: 0.95rem;
  }

  .markdown-content h3 {
    font-size: 0.9rem;
  }
}

/* Dark mode adjustments */
.dark .markdown-content .inline-code {
  background-color: rgba(255, 255, 255, 0.1);
}

.dark .markdown-content .code-block {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark .markdown-content a {
  color: #60a5fa;
}

.dark .markdown-content a:hover {
  color: #93c5fd;
}
</style>
