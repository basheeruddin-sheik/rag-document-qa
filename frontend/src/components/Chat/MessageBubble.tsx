import ReactMarkdown from 'react-markdown';
import type { Message } from '@/types';

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center mr-3 mt-0.5">
          <span className="text-sm">🤖</span>
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-brand-600 text-white rounded-br-sm'
              : 'bg-slate-800 text-slate-100 rounded-bl-sm'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className={`prose prose-invert prose-sm max-w-none ${message.streaming ? 'typing-cursor' : ''}`}>
              {message.content ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                // Empty assistant bubble while waiting for first token
                <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse rounded-sm" />
              )}
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && !message.streaming && message.sources && message.sources.length > 0 && (
          <div className="mt-2 px-1">
            <p className="text-xs text-slate-500 font-medium mb-1">📎 Sources</p>
            <div className="flex flex-wrap gap-1">
              {[...new Set(message.sources.map((s) => s.split(' (chunk')[0]))].map((src) => (
                <span
                  key={src}
                  className="inline-block text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700"
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs text-slate-600 mt-1 ${isUser ? 'text-right' : 'text-left'} px-1`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center ml-3 mt-0.5">
          <span className="text-sm">👤</span>
        </div>
      )}
    </div>
  );
}
