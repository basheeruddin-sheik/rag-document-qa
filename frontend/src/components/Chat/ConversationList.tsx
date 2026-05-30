import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { listSessions, getSessionMessages, clearConversations } from '@/services/api';
import { LoadingSpinner } from '@/components/Common/LoadingSpinner';
import type { SessionSummary, Message } from '@/types';
import { nanoid } from '@/utils/nanoid';

interface Props {
  onLoadConversation: (messages: Message[], sessionId: string) => void;
  onNewChat: () => void;
  refreshSignal: number;   // increment to trigger a re-fetch
  activeSessionId: string; // highlight the currently active session
}

// ── Group sessions by date ────────────────────────────────────────────────
function groupByDate(sessions: SessionSummary[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, SessionSummary[]> = {
    Today: [],
    Yesterday: [],
    'This week': [],
    Older: [],
  };

  for (const s of sessions) {
    const d = new Date(s.updated_at);
    d.setHours(0, 0, 0, 0);
    if (d >= today) groups['Today'].push(s);
    else if (d >= yesterday) groups['Yesterday'].push(s);
    else if (d >= weekAgo) groups['This week'].push(s);
    else groups['Older'].push(s);
  }

  return groups;
}

export function ConversationList({
  onLoadConversation,
  onNewChat,
  refreshSignal,
  activeSessionId,
}: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  // Re-fetch session list whenever a new Q&A is saved
  useEffect(() => {
    setLoading(true);
    listSessions()
      .then(setSessions)
      .catch(() => {}) // silently ignore — user might not have any history
      .finally(() => setLoading(false));
  }, [refreshSignal]);

  const handleClear = async () => {
    if (!confirm('Clear all conversation history?')) return;
    setClearing(true);
    try {
      await clearConversations();
      setSessions([]);
      onNewChat();
      toast.success('History cleared');
    } catch {
      toast.error('Could not clear history');
    } finally {
      setClearing(false);
    }
  };

  // Load all messages in a session and hand them up to ChatPage
  const handleClickSession = async (session: SessionSummary) => {
    if (loadingSession) return;
    setLoadingSession(session.session_id);
    try {
      const records = await getSessionMessages(session.session_id);
      // Convert each Q&A record into a user + assistant message pair
      const messages: Message[] = records.flatMap((r) => [
        {
          id: nanoid(),
          role: 'user' as const,
          content: r.question,
          timestamp: new Date(r.created_at),
        },
        {
          id: nanoid(),
          role: 'assistant' as const,
          content: r.answer,
          sources: r.sources,
          timestamp: new Date(r.created_at),
        },
      ]);
      onLoadConversation(messages, session.session_id);
    } catch {
      toast.error('Could not load conversation');
    } finally {
      setLoadingSession(null);
    }
  };

  const groups = groupByDate(sessions);
  const hasAny = sessions.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* New chat button */}
      <div className="p-3 border-b border-slate-800">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="sm" />
          </div>
        ) : !hasAny ? (
          <div className="text-center py-8 px-3">
            <p className="text-slate-600 text-xs">No conversations yet.</p>
            <p className="text-slate-700 text-xs mt-1">Ask your first question!</p>
          </div>
        ) : (
          Object.entries(groups).map(([label, items]) =>
            items.length === 0 ? null : (
              <div key={label} className="mb-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-2 mb-1">
                  {label}
                </p>
                {items.map((session) => {
                  const isActive = session.session_id === activeSessionId;
                  const isLoading = loadingSession === session.session_id;
                  return (
                    <button
                      key={session.session_id}
                      onClick={() => handleClickSession(session)}
                      disabled={!!loadingSession}
                      className={`w-full text-left px-2 py-2 rounded-lg group transition ${
                        isActive
                          ? 'bg-slate-700 text-white'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {isLoading ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <svg
                            className="w-3 h-3 flex-shrink-0 text-slate-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"
                            />
                          </svg>
                        )}
                        <p className="text-xs truncate flex-1 group-hover:text-white transition">
                          {session.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 pl-4.5">
                        <p className="text-xs text-slate-600">
                          {new Date(session.updated_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <span className="text-xs text-slate-700">
                          {session.message_count}{' '}
                          {session.message_count === 1 ? 'msg' : 'msgs'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ),
          )
        )}
      </div>

      {/* Clear history */}
      {hasAny && (
        <div className="p-2 border-t border-slate-800">
          <button
            onClick={handleClear}
            disabled={clearing}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-600 hover:text-red-400 hover:bg-slate-800 rounded-lg transition disabled:opacity-50"
          >
            {clearing ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            )}
            Clear history
          </button>
        </div>
      )}
    </div>
  );
}
