import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../../api/client';

const chatStorageKey = 'intent-agent-ai-chat-session';
const initialMessages = [{ role: 'assistant', content: 'Halo, silakan kirim pesan untuk menguji AI.' }];

function getSessionId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now());
}

function createChatState() {
  return { sessionId: getSessionId(), messages: initialMessages, draft: '', loading: false, usecaseId: '' };
}

function extractChatReply(payload) {
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) return payload.map((item) => extractChatReply(item)).join('\n');

  const directReply = payload?.output || payload?.text || payload?.response || payload?.message || payload?.answer;
  if (directReply) return typeof directReply === 'string' ? directReply : JSON.stringify(directReply, null, 2);

  if (payload?.executionStarted) {
    const executionId = payload.executionId ? ` Execution ID: ${payload.executionId}.` : '';
    return `AIWO sudah menerima pesan.${executionId} Service belum mengirim teks jawaban langsung ke frontend.`;
  }

  return JSON.stringify(payload, null, 2);
}

const chatSessionStorage = {
  getItem: (name) => {
    try {
      const value = globalThis.sessionStorage?.getItem(name);
      if (!value) return null;

      const parsed = JSON.parse(value);
      if (parsed?.state) return parsed;
      return { state: parsed };
    } catch {
      try {
        globalThis.sessionStorage?.removeItem(name);
      } catch {
        // Chat can start clean even when browser storage is unavailable.
      }
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.sessionStorage?.setItem(name, JSON.stringify(value));
    } catch {
      // Chat stays available even when browser storage blocks writes.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.sessionStorage?.removeItem(name);
    } catch {
      // Ignore unavailable browser storage.
    }
  },
};

export const useChatStore = create(
  persist(
    (set, get) => ({
      ...createChatState(),

      setDraft: (draft) => set({ draft }),

      setUsecaseId: (usecaseId) => set({ usecaseId: usecaseId == null ? '' : String(usecaseId) }),

      resetChat: () => {
        const { usecaseId } = get();
        set({ ...createChatState(), usecaseId });
      },

      sendMessage: async ({ usecaseId: nextUsecaseId } = {}) => {
        const { draft, loading, messages, sessionId, usecaseId } = get();
        const message = draft.trim();
        const selectedUsecaseId = nextUsecaseId || usecaseId;
        if (!message || loading || !selectedUsecaseId) return;

        set({
          draft: '',
          loading: true,
          messages: [...messages, { role: 'user', content: message }],
        });

        try {
          const payload = await api.sendAiChat({
            sessionId,
            chatInput: message,
            usecaseId: Number(selectedUsecaseId),
          });
          set((current) => ({
            loading: false,
            messages: [...current.messages, { role: 'assistant', content: extractChatReply(payload) }],
          }));
        } catch (error) {
          set((current) => ({
            loading: false,
            messages: [...current.messages, { role: 'assistant', content: `Gagal menghubungi AI: ${error.message || 'request gagal'}` }],
          }));
        }
      },
    }),
    {
      name: chatStorageKey,
      storage: chatSessionStorage,
      partialize: ({ sessionId, messages, draft, usecaseId }) => ({ sessionId, messages, draft, usecaseId }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...persistedState,
        messages: Array.isArray(persistedState?.messages) && persistedState.messages.length
          ? persistedState.messages
          : initialMessages,
        draft: typeof persistedState?.draft === 'string' ? persistedState.draft : '',
        usecaseId: persistedState?.usecaseId == null ? '' : String(persistedState.usecaseId),
        loading: false,
      }),
    },
  ),
);

export const chatStore = {
  resetChat: () => useChatStore.getState().resetChat(),
  sendMessage: (options) => useChatStore.getState().sendMessage(options),
  setDraft: (draft) => useChatStore.getState().setDraft(draft),
  setUsecaseId: (usecaseId) => useChatStore.getState().setUsecaseId(usecaseId),
};
