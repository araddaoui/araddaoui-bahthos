export interface Source {
  id: string;
  title: string;
  content: string;
  dateAdded: string;
  wordCount: number;
  enabled: boolean;
  language: "ar" | "en" | "fr";
  summary?: string;
  error?: string;
}

export interface SourceDraft {
  title: string;
  content: string;
  language: "ar" | "en" | "fr";
  summary?: string;
  error?: string;
  terms?: any[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  references?: string[]; // list of source IDs cited
  isThinking?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  sourceIds: string[]; // enabled source IDs at the time of the conversation
  dateUpdated: string;
}

export interface Synthesis {
  id: string;
  title: string;
  text: string;
  sourceIds: string[];
  dateCreated: string;
}

export interface DalilBriefing {
  id: string;
  text: string;
  sourceIdsAtTime: string[];
  sourceFingerprint?: string;
  dateCreated: string;
}

export interface GlossaryTerm {
  term: string;
  transliteration: string;
  definition: string;
  draft_term?: string;
  verified_term?: string;
  sourceId?: string; // tracks which source triggered it (optional)
}

export type ActiveTab = "home" | "sources" | "editor" | "history" | "settings";

export interface Project {
  id: string;
  name: string;
  dateCreated: string;
  temperature?: number;
}
