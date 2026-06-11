import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import { modules } from '../../config/resources';
import { getUserUsecases } from '../auth/access';
import { PageHeader, StatusStrip } from '../../templates/components/PageHeader';
import { itemLabel } from '../../utils/resourceUtils.jsx';
import { chatStore, useChatStore } from './chatStore';

function fallbackCopyText(value) {
  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '-1000px';
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textArea);
  return copied;
}

function usecaseIdOf(usecase) {
  const id = usecase?.id ?? usecase?.usecase_id;
  return id == null || id === '' ? '' : String(id);
}

function resolveChatUsecases(user, data) {
  const apiUsecases = Array.isArray(data?.usecases) ? data.usecases : [];
  const usecasesById = new Map(apiUsecases.map((usecase) => [usecaseIdOf(usecase), usecase]));
  const assignedUsecases = getUserUsecases(user);
  const source = assignedUsecases.length ? assignedUsecases : apiUsecases;
  const uniqueUsecases = new Map();

  source.forEach((usecase) => {
    const id = usecaseIdOf(usecase);
    if (!id) return;
    uniqueUsecases.set(id, usecasesById.get(id) || usecase);
  });

  return [...uniqueUsecases.values()];
}

export function ChatPage({ data, user }) {
  const [copied, setCopied] = useState(false);
  const { draft, loading, messages, sessionId, usecaseId } = useChatStore();
  const chatUsecases = resolveChatUsecases(user, data);
  const selectedUsecaseIsValid = Boolean(usecaseId) && chatUsecases.some((usecase) => usecaseIdOf(usecase) === String(usecaseId));
  const threadEndRef = useRef(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (usecaseId && chatUsecases.length && !selectedUsecaseIsValid) chatStore.setUsecaseId('');
  }, [chatUsecases.length, selectedUsecaseIsValid, usecaseId]);

  async function copySessionId() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sessionId);
      } else if (!fallbackCopyText(sessionId)) {
        throw new Error('copy failed');
      }
      setCopied(true);
    } catch {
      setCopied(fallbackCopyText(sessionId));
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    if (!readyToSend) return;
    chatStore.sendMessage({ usecaseId });
  }

  const hasSelectedUsecase = Boolean(usecaseId) && selectedUsecaseIsValid;
  const readyToSend = Boolean(draft.trim()) && hasSelectedUsecase && !loading;
  const statusText = loading
    ? 'Mengirim pesan...'
    : hasSelectedUsecase
      ? 'AI Chat siap digunakan.'
      : chatUsecases.length
        ? 'Pilih usecase untuk mulai chat.'
        : 'Akun belum memiliki usecase aktif untuk chat.';

  return (
    <>
      <PageHeader config={modules.chat} countLabel="chat session" onRefresh={chatStore.resetChat} refreshTitle="Reset chat" />
      <StatusStrip warning={!hasSelectedUsecase}>{statusText}</StatusStrip>

      <section className="chat-panel">
        <div className="chat-layout">
          <div className="chat-meta">
            <div>
              <p className="eyebrow">AI Chat</p>
              <strong>Uji percakapan</strong>
            </div>
            <label className="chat-usecase-field" htmlFor="chat-usecase-select">
              <span>Usecase</span>
              <select
                id="chat-usecase-select"
                value={selectedUsecaseIsValid ? usecaseId : ''}
                onChange={(event) => chatStore.setUsecaseId(event.target.value)}
                disabled={loading || !chatUsecases.length}
              >
                <option value="">Pilih usecase</option>
                {chatUsecases.map((usecase) => {
                  const id = usecaseIdOf(usecase);
                  return <option key={id} value={id}>{itemLabel('usecases', usecase, data)}</option>;
                })}
              </select>
            </label>
            <div className="chat-session">
              <span>Session ID</span>
              <code>{sessionId}</code>
              <button className="ghost-button" type="button" onClick={copySessionId} title="Copy session ID">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div className="chat-thread" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                <span>{message.role === 'user' ? 'You' : 'AI'}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant">
                <span>AI</span>
                <p>Mengambil respons...</p>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          <form className="chat-composer" onSubmit={sendChatMessage}>
            <textarea
              rows={3}
              value={draft}
              placeholder={hasSelectedUsecase ? 'Tulis pesan untuk AI' : 'Pilih usecase dulu untuk mulai chat'}
              onChange={(event) => chatStore.setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form.requestSubmit();
                }
              }}
            />
            <button type="submit" className="primary-button" disabled={!readyToSend}>
              <Send size={18} />
              Send
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
