import { useState, useRef } from 'react';
import { LoadingSpinner } from '@/components/Common/LoadingSpinner';

interface Props {
  onSubmit: (question: string) => void;
  disabled?: boolean;
}

export function QueryInput({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const q = value.trim();
    if (!q || disabled) return;
    onSubmit(q);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift). Shift+Enter adds a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    // Auto-grow textarea up to ~5 lines
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  };

  return (
    <div className="border-t border-slate-800 bg-slate-950 px-4 py-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 focus-within:border-brand-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Ask a question about your documents… (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={disabled}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none focus:outline-none disabled:opacity-50 min-h-[24px]"
          />

          <button
            onClick={handleSubmit}
            disabled={!value.trim() || disabled}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Send (Enter)"
          >
            {disabled ? (
              <LoadingSpinner size="sm" className="text-white" />
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-600 text-center mt-2">
          AI answers are grounded in your uploaded documents only
        </p>
      </div>
    </div>
  );
}
