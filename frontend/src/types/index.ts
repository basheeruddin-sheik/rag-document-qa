export interface User {
  id: number;
  email: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
}

export interface DocumentSummary {
  filename: string;
  chunks: number;
  uploaded_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  streaming?: boolean;
  timestamp: Date;
}

export interface QueryResponse {
  answer: string;
  sources: string[];
}

export interface ConversationRecord {
  id: number;
  session_id: string;
  question: string;
  answer: string;
  sources: string[];
  created_at: string;
}

// One entry per chat session shown in the history sidebar
export interface SessionSummary {
  session_id: string;
  title: string;          // the first question asked in that session
  message_count: number;
  created_at: string;
  updated_at: string;
}
