import axios from 'axios';
import type {
  AuthResponse,
  DocumentSummary,
  QueryResponse,
  ConversationRecord,
  SessionSummary,
} from '@/types';

// In dev, Vite proxies /api/* → http://localhost:3000/*
// In prod, change VITE_API_URL to point to your server.
const BASE = import.meta.env.VITE_API_URL ?? '/api';

const http = axios.create({ baseURL: BASE });

// Attach JWT to every request automatically
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────
export const register = (email: string, password: string) =>
  http.post<AuthResponse>('/auth/register', { email, password }).then((r) => r.data);

export const login = (email: string, password: string) =>
  http.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data);

// ── Documents ─────────────────────────────────────────────────────────────
export const listDocuments = () =>
  http.get<DocumentSummary[]>('/documents').then((r) => r.data);

export const deleteDocument = (filename: string) =>
  http.delete(`/documents/${encodeURIComponent(filename)}`).then((r) => r.data);

export const uploadDocument = (file: File, onProgress?: (pct: number) => void) => {
  const form = new FormData();
  form.append('file', file);
  return http
    .post<{ message: string; chunks: number }>('/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    })
    .then((r) => r.data);
};

// ── Query (non-streaming) ─────────────────────────────────────────────────
export const query = (question: string, sessionId: string) =>
  http.post<QueryResponse>('/query', { question, session_id: sessionId }).then((r) => r.data);

// ── Query (streaming) ─────────────────────────────────────────────────────
// Returns a ReadableStream of SSE chunks.
// Each SSE event carries:  { chunk: "some text" }  or  { done: true, sources: [...] }
export async function queryStream(
  question: string,
  sessionId: string,
  onChunk: (text: string) => void,
  onDone: (sources?: string[]) => void,
) {
  const token = localStorage.getItem('token') ?? '';

  const response = await fetch(`${BASE}/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, session_id: sessionId }),
  });

  if (!response.ok || !response.body) {
    throw new Error('Stream request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.chunk) onChunk(payload.chunk);
        if (payload.done) onDone(payload.sources);
      } catch {
        // ignore malformed lines
      }
    }
  }
}

// ── Conversations ─────────────────────────────────────────────────────────
// List all sessions (one entry per "New Chat" — shown in the sidebar)
export const listSessions = () =>
  http.get<SessionSummary[]>('/conversations/sessions').then((r) => r.data);

// Fetch every Q&A message in a specific session (used when clicking a session)
export const getSessionMessages = (sessionId: string) =>
  http.get<ConversationRecord[]>(`/conversations/sessions/${sessionId}`).then((r) => r.data);

export const clearConversations = () =>
  http.delete('/conversations').then((r) => r.data);
