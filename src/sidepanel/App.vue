<template>
  <div class="app-shell">
    <div class="app-top">
      <header class="app-header">
      <div class="app-header__brand">
        <div class="app-header__logo">
          <Sparkles class="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 class="app-header__title">Aura Assistant</h1>
          <div class="app-header__status">
            <span class="app-header__dot" :class="apiStatus.available ? 'app-header__dot--ready' : 'app-header__dot--pending'" />
            <span class="app-header__status-text">{{ apiStatus.available ? 'Ready' : 'Initializing' }}</span>
          </div>
        </div>
      </div>
      <button type="button" class="icon-btn" @click="refreshPageData"><RotateCcw class="w-4 h-4" /></button>
      </header>

      <section v-if="apiStatus.available" class="toolbox no-scrollbar">
        <button
          v-for="tool in tools"
          :key="tool.id"
          type="button"
          class="tool-btn"
          :class="activeTool === tool.id ? 'tool-btn--active' : ''"
          :disabled="isLoading"
          @click="runTool(tool)"
        >
          <component :is="tool.icon" class="w-3.5 h-3.5" />
          <span>{{ tool.label }}</span>
        </button>
      </section>
    </div>

    <main class="app-main">
      <div ref="chatContainer" class="chat-scroll custom-scrollbar">
        <div v-if="messages.length === 0" class="welcome">
          <div class="welcome__icon"><MessageSquare class="w-7 h-7 text-blue-600" /></div>
          <h2 class="welcome__title">Smart News Assistant</h2>
          <p class="welcome__text">Analyze articles, fact-check claims, and explore visual content with local AI.</p>
        </div>

        <div v-for="message in messages" :key="message.id" class="message-row" :class="message.type === 'user' ? 'message-row--user' : 'message-row--assistant'">
          <div v-if="message.type === 'assistant'" class="message-avatar"><Sparkles class="w-4 h-4 text-blue-600" /></div>
          
          <div class="message-bubble" :class="message.type === 'user' ? 'message-bubble--user' : 'message-bubble--assistant'">
            <!-- Image Attachment Display -->
            <div v-if="message.image" class="mb-2 rounded-lg overflow-hidden border border-neutral-100">
               <img :src="message.image" class="w-full h-auto object-cover max-h-40" alt="Analyzed content" />
            </div>

            <!-- Structured Data Rendering -->
            <div v-if="message.feature === 'FACT_CHECK' && !message.streaming" class="structured-card">
               <div class="flex items-center justify-between mb-2">
                 <span class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Fact Check</span>
                 <span :class="verdictClass(message.data?.verdict)" class="px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                   {{ message.data?.verdict }}
                 </span>
               </div>
               <p class="font-semibold text-neutral-800 mb-1">{{ message.data?.claim }}</p>
               <p class="text-neutral-600 text-xs leading-relaxed">{{ message.data?.explanation }}</p>
               <div class="mt-2 text-[10px] text-neutral-400">Confidence: {{ (message.data?.confidence * 100).toFixed(0) }}%</div>
            </div>

            <div v-else-if="message.feature === 'TLDR' && !message.streaming" class="structured-card">
               <div class="flex items-center gap-2 mb-3">
                 <span class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Article Dashboard</span>
                 <span class="text-[10px] bg-neutral-100 px-2 py-0.5 rounded">{{ message.data?.reading_time }} read</span>
                 <span class="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{{ message.data?.sentiment }}</span>
               </div>
               <p class="text-sm font-medium text-neutral-800 mb-3">{{ message.data?.summary }}</p>
               <ul class="space-y-1.5">
                 <li v-for="item in message.data?.takeaways" :key="item" class="flex gap-2 text-xs text-neutral-600">
                   <span class="text-blue-500">•</span> {{ item }}
                 </li>
               </ul>
            </div>

            <div v-else-if="message.feature === 'ENTITIES' && !message.streaming" class="structured-card space-y-3">
               <div v-for="(list, type) in message.data" :key="type" v-show="list.length">
                 <span class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 block mb-1">{{ type }}</span>
                 <div class="flex flex-wrap gap-1">
                   <span v-for="item in list" :key="item" class="bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded text-[11px] text-neutral-700">
                     {{ item }}
                   </span>
                 </div>
               </div>
            </div>

            <!-- Standard Markdown / Streaming -->
            <div v-else class="markdown-content" v-html="parseMarkdown(message.content)" />

            <div v-if="message.streaming" class="typing-indicator">
              <div class="typing-indicator__dots"><span /><span /><span /></div>
              <span class="typing-indicator__label">Thinking...</span>
            </div>
          </div>
        </div>
      </div>

      <footer class="composer">
        <div v-if="isDownloading" class="download-banner">
          <Download class="w-4 h-4 text-blue-600" />
          <div class="download-banner__body">
            <div class="download-banner__meta"><span>Downloading model</span><span>{{ downloadProgress }}%</span></div>
            <div class="download-banner__track"><div class="download-banner__fill" :style="{ width: `${downloadProgress}%` }" /></div>
          </div>
        </div>

        <section v-if="suggestions.length > 0 && !isLoading" class="suggestions no-scrollbar">
          <button v-for="suggestion in suggestions" :key="suggestion" @click="selectSuggestion(suggestion)" class="suggestion-chip">
            {{ suggestion }}
          </button>
        </section>

        <div class="input-row">
          <textarea
            v-model="currentPrompt"
            placeholder="Ask anything..."
            rows="1"
            class="input-row__field"
            :disabled="isLoading"
            @keydown.enter.exact.prevent="submitFromInput"
          />
          <button
            type="button"
            @click="submitFromInput"
            :disabled="!currentPrompt.trim() || isLoading"
            class="input-row__send"
          >
            <Send class="w-4 h-4" />
          </button>
        </div>
      </footer>
    </main>
  </div>
</template>

<script>
import { nextTick, onMounted, ref, watch } from 'vue'
import { Sparkles, RotateCcw, MessageSquare, Send, Download, ShieldCheck, CheckCircle, ListTree, LayoutDashboard, Image as ImageIcon } from 'lucide-vue-next'

function parseMarkdown(text) {
  if (!text || typeof text !== 'string') return ''
  // If JSON, don't parse as markdown if it looks like start of object
  if (text.startsWith('{')) return 'Processing data...'
  return text.trim()
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

export default {
  name: 'SidebarApp',
  components: { Sparkles, RotateCcw, MessageSquare, Send, Download, ShieldCheck },
  setup() {
    const currentPrompt = ref('')
    const messages = ref([])
    const suggestions = ref([])
    const pageInfo = ref({ title: '', url: '', leadImage: null })
    const pageContent = ref('')
    const isLoading = ref(false)
    const apiStatus = ref({ available: false, message: '' })
    const downloadProgress = ref(0)
    const isDownloading = ref(false)
    const chatContainer = ref(null)
    const activeTool = ref(null)

    const tools = [
      { id: 'TLDR', label: 'TL;DR', icon: LayoutDashboard, prompt: 'Summarize this article into a structured dashboard summary.' },
      { id: 'FACT_CHECK', label: 'Fact Check', icon: CheckCircle, prompt: 'Verify the central claim of this text and provide a verdict.' },
      { id: 'ENTITIES', label: 'Entities', icon: ListTree, prompt: 'Extract and categorize key people, organizations, and locations.' },
      { id: 'MULTIMODAL', label: 'Analyze Image', icon: ImageIcon, prompt: 'Analyze the main image of this article and explain its relevance.' }
    ]

    const usedSuggestions = ref(new Set())
    const suggestionClickCount = ref(0)

    const loadPageData = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ 
          action: 'getPageContent',
          excludeSuggestions: Array.from(usedSuggestions.value)
        })
        if (response && !response.error) {
          pageContent.value = response.content || ''
          // Filter out suggestions that have already been used
          suggestions.value = (response.suggestions || []).filter(s => !usedSuggestions.value.has(s))
          pageInfo.value = { title: response.title || '', url: response.url || '', leadImage: response.leadImage }
        }
      } catch {
        suggestions.value = ['Summarize this page', 'Explain concepts'].filter(s => !usedSuggestions.value.has(s))
      }
    }

    const runTool = async (tool) => {
      if (tool.id === 'MULTIMODAL' && !pageInfo.value.leadImage) {
        alert('No lead image found on this page.');
        return;
      }
      
      let imageData = null; // Will hold { base64, type }
      let imageUrl = null;

      if (tool.id === 'MULTIMODAL') {
        try {
          console.log(`[Aura] Fetching lead image: ${pageInfo.value.leadImage}`);
          const res = await fetch(pageInfo.value.leadImage);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          
          const blob = await res.blob();
          imageUrl = pageInfo.value.leadImage;
          
          // Convert Blob to Base64 for reliable serialization
          imageData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({
              base64: reader.result.split(',')[1],
              type: blob.type
            });
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          console.log(`[Aura] Image prepared. Type: ${imageData.type}`);
        } catch (e) {
          console.error('[Aura] Failed to prepare image:', e);
          alert('Could not process the image. It might be blocked by the site.');
          return;
        }
      }

      activeTool.value = tool.id;
      await sendPrompt(tool.prompt, { 
        feature: tool.id, 
        imageData,
        image: imageUrl
      });
      activeTool.value = null;
    }

    const isDomEvent = (value) => {
      if (value == null || typeof value !== 'object') return false
      if (typeof value.preventDefault === 'function') return true
      const name = value.constructor?.name
      return typeof name === 'string' && name.endsWith('Event')
    }

    const resolvePromptText = (forcedPrompt) => {
      if (typeof forcedPrompt === 'string') return forcedPrompt.trim()
      if (forcedPrompt == null || isDomEvent(forcedPrompt)) {
        return currentPrompt.value.trim()
      }
      return ''
    }

    const submitFromInput = () => {
      sendPrompt()
    }

    const sendPrompt = async (forcedPrompt = null, options = {}) => {
      const fromTypedInput = typeof forcedPrompt !== 'string'
      const promptText = resolvePromptText(forcedPrompt)

      if (!promptText || isLoading.value) return

      console.log(`[Aura] Sending prompt: ${promptText.substring(0, 30)}...`)

      const userMsg = { 
        id: Date.now(), 
        type: 'user', 
        content: promptText, 
        image: options.image 
      };
      
      messages.value.push(userMsg);
      if (fromTypedInput) currentPrompt.value = '';
      isLoading.value = true;

      const assistantMsgId = Date.now() + 1;
      messages.value.push({ id: assistantMsgId, type: 'assistant', content: '', streaming: true, feature: options.feature });

      try {
        const sessionId = `sid_${Date.now()}`;
        const streamListener = (msg) => {
          if (msg.action === 'streamingResponse' && msg.sessionId === sessionId) {
            const idx = messages.value.findIndex(m => m.id === assistantMsgId);
            if (idx !== -1) messages.value[idx].content = msg.fullResponse;
          }
        };

        chrome.runtime.onMessage.addListener(streamListener);
        const response = await chrome.runtime.sendMessage({
          action: 'promptAPI', 
          prompt: promptText, 
          context: String(pageContent.value || ''), 
          sessionId, 
          feature: options.feature, 
          imageData: options.imageData 
        });
        chrome.runtime.onMessage.removeListener(streamListener);

        const idx = messages.value.findIndex(m => m.id === assistantMsgId);
        if (idx !== -1) {
          messages.value[idx].streaming = false;
          if (response.success) {
            messages.value[idx].content = response.response;
            if (options.feature) {
              try {
                messages.value[idx].data = JSON.parse(response.response);
              } catch (e) { console.error('JSON Parse Error:', e) }
            }
          } else {
            messages.value[idx].content = 'AI Error: ' + response.error;
          }
        }
      } catch (e) {
        console.error('[Aura] sendPrompt Error:', e);
        const idx = messages.value.findIndex(m => m.id === assistantMsgId);
        if (idx !== -1) {
          messages.value[idx].content = 'Error: ' + e.message;
          messages.value[idx].streaming = false;
        }
      } finally {
        isLoading.value = false;
      }
    }

    const selectSuggestion = (s) => {
      usedSuggestions.value.add(s)
      suggestionClickCount.value++
      
      // If we've used 3 suggestions, fetch new ones
      if (suggestionClickCount.value >= 3) {
        suggestionClickCount.value = 0
        loadPageData()
      } else {
        // Just filter the current ones
        suggestions.value = suggestions.value.filter(item => item !== s)
      }
      
      sendPrompt(s)
    }

    const verdictClass = (v) => {
      if (v === 'True') return 'bg-emerald-100 text-emerald-700'
      if (v === 'False') return 'bg-rose-100 text-rose-700'
      return 'bg-amber-100 text-amber-700'
    }

    onMounted(() => {
      loadPageData()
      chrome.runtime.sendMessage({ action: 'checkAPIAvailability' }).then(res => {
        apiStatus.value = res
        isDownloading.value = res.status === 'downloadable'
      })
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'downloadProgress') {
          isDownloading.value = true;
          downloadProgress.value = msg.progress;
          if (msg.progress >= 100) setTimeout(loadPageData, 1000);
        }
      })
    })

    watch(messages, () => {
      nextTick(() => { if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight })
    }, { deep: true })

    return {
      currentPrompt, messages, suggestions, pageInfo, isLoading, apiStatus, downloadProgress, isDownloading, chatContainer, activeTool, tools,
      refreshPageData: () => { messages.value = []; usedSuggestions.value.clear(); suggestionClickCount.value = 0; loadPageData(); },
      selectSuggestion, sendPrompt, submitFromInput, runTool, parseMarkdown, verdictClass
    }
  }
}
</script>

<style scoped>
@reference "tailwindcss";

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-neutral-300 rounded-full;
}

.app-shell { @apply flex flex-col h-full min-h-0 overflow-hidden bg-neutral-50; }
.app-top { @apply shrink-0 z-20 bg-white border-b border-neutral-200 shadow-sm; }
.app-header { @apply flex items-center justify-between px-4 py-3 border-b border-neutral-200; }
.app-header__brand { @apply flex items-center gap-3; }
.app-header__logo { @apply flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600; }
.app-header__title { @apply text-sm font-bold; }
.app-header__status { @apply flex items-center gap-1.5; }
.app-header__dot { @apply w-1.5 h-1.5 rounded-full; }
.app-header__dot--ready { @apply bg-emerald-500; }
.app-header__dot--pending { @apply bg-amber-500; }
.app-header__status-text { @apply text-[10px] uppercase font-bold text-neutral-400; }

.app-main { @apply flex flex-col flex-1 min-h-0; }
.toolbox { @apply flex gap-2 px-4 py-2.5 overflow-x-auto; }
.tool-btn { @apply flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-600 whitespace-nowrap transition-all hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50; }
.tool-btn--active { @apply bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white; }

.chat-scroll { @apply flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6; }
.welcome { @apply flex flex-col items-center justify-center h-full text-center py-12; }
.welcome__icon { @apply p-4 bg-blue-50 rounded-2xl mb-4; }
.welcome__title { @apply text-base font-bold; }
.welcome__text { @apply text-sm text-neutral-500 max-w-[14rem]; }

.message-row { @apply flex gap-2; }
.message-row--user { @apply justify-end; }
.message-bubble { @apply max-w-[90%] px-4 py-3 rounded-2xl text-sm shadow-sm; }
.message-bubble--user { @apply bg-blue-600 text-white rounded-br-none; }
.message-bubble--assistant { @apply bg-white border border-neutral-200 text-neutral-800 rounded-bl-none; }

.structured-card { @apply bg-neutral-50/50 border border-neutral-100 rounded-xl p-3 mt-1; }

.typing-indicator { @apply flex items-center gap-2 mt-2; }
.typing-indicator__dots { @apply flex gap-1; }
.typing-indicator__dots span { @apply w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce; }
.typing-indicator__label { @apply text-[10px] font-bold text-neutral-400 uppercase; }

.composer { @apply shrink-0 px-4 py-4 bg-white border-t border-neutral-200 space-y-3; }
.suggestions { @apply flex gap-2 overflow-x-auto; }
.suggestion-chip { @apply whitespace-nowrap px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-semibold; }
.input-row { @apply relative; }
.input-row__field { @apply w-full pl-4 pr-12 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-400 transition-all; }
.input-row__send { @apply absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-xl shadow-md disabled:bg-neutral-200; }

.icon-btn { @apply p-2 rounded-lg text-neutral-400 hover:bg-neutral-50; }

.markdown-content :deep(strong) { @apply font-bold text-neutral-900; }
.markdown-content :deep(code) { @apply bg-neutral-100 text-blue-600 px-1 rounded font-mono text-xs; }
</style>
