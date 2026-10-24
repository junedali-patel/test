// client/types/voice.ts
// Shared types for the AI Voice Explanation feature.

export type PlaybackStatus =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'speaking'
  | 'paused'
  | 'stopped'
  | 'error';

export type ExplainLanguage = 'en' | 'hi';

export interface EditorSelection {
  lineStart: number;
  lineEnd: number;
  text?: string;
}
