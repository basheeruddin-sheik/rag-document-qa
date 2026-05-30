import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '@/types';

interface Props {
  messages: Message[];
}

export function ChatWindow({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever a new message arrives or a token streams in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="text-5xl mb-4">💬</div>
        <h2 className="text-xl font-semibold text-slate-300 mb-2">
          Ask anything about your documents
        </h2>
        <p className="text-slate-500 text-sm max-w-md">
          Upload a PDF using the sidebar, then type your question below.
          The AI will find the relevant parts and answer from your actual documents.
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
          {[
            'What is the main topic of this document?',
            'Summarise the key points',
            'What are all the names mentioned?',
            'What dates are referenced?',
          ].map((hint) => (
            <div
              key={hint}
              className="px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-400 text-left"
            >
              "{hint}"
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
