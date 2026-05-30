import { useState, useCallback } from 'react';
import { ConversationList } from '@/components/Chat/ConversationList';
import { ChatWindow } from '@/components/Chat/ChatWindow';
import { QueryInput } from '@/components/Chat/QueryInput';
import { queryStream } from '@/services/api';
import type { Message } from '@/types';
import { nanoid } from '@/utils/nanoid';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  // Each "session" is a single conversation thread identified by a UUID.
  // A new UUID is generated when the page first loads or "New Chat" is clicked.
  const [sessionId, setSessionId] = useState(() => nanoid());
  // Increment to tell ConversationList to re-fetch after a new Q&A is saved
  const [historyRefresh, setHistoryRefresh] = useState(0);

  // ── Load a past conversation from history sidebar ────────────────────────
  // When the user clicks a past session we show all its messages and
  // switch the active sessionId so any follow-ups go to the same session.
  const handleLoadConversation = useCallback((msgs: Message[], sid?: string) => {
    setMessages(msgs);
    if (sid) setSessionId(sid);
  }, []);

  // ── Start a fresh blank chat ─────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setSessionId(nanoid()); // new UUID → a brand-new session in the DB
  }, []);

  // ── Send a question and stream the answer ────────────────────────────────
  const handleQuestion = useCallback(
    async (question: string) => {
      if (streaming) return;

      const userMsg: Message = {
        id: nanoid(),
        role: 'user',
        content: question,
        timestamp: new Date(),
      };

      const assistantId = nanoid();
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);

      try {
        await queryStream(
          question,
          sessionId,
          (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + chunk } : m,
              ),
            );
          },
          (sources) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, sources: sources ?? [], streaming: false }
                  : m,
              ),
            );
            setStreaming(false);
            // Trigger history sidebar to refresh so the new Q&A appears
            setHistoryRefresh((n) => n + 1);
          },
        );
      } catch {
        toast.error('Failed to get answer. Is the server running?');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Something went wrong. Please try again.', streaming: false }
              : m,
          ),
        );
        setStreaming(false);
      }
    },
    [streaming, sessionId],
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── History sidebar ────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
        <div className="h-14 flex items-center px-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300">Conversations</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList
            onLoadConversation={handleLoadConversation}
            onNewChat={handleNewChat}
            refreshSignal={historyRefresh}
            activeSessionId={sessionId}
          />
        </div>
      </aside>

      {/* ── Chat area ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Thin top bar */}
        <div className="h-14 flex items-center px-6 border-b border-slate-800 bg-slate-950 flex-shrink-0">
          <h1 className="text-sm font-semibold text-slate-300">Chat</h1>
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Clear
            </button>
          )}
        </div>

        <ChatWindow messages={messages} />
        <QueryInput onSubmit={handleQuestion} disabled={streaming} />
      </div>
    </div>
  );
}
