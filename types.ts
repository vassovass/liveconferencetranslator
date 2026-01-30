export interface Caption {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface ServiceConfig {
  apiKey: string;
}

// Language configuration for translation
export interface LanguageConfig {
  sourceLanguage: string; // 'vi', 'es', 'auto', etc.
  targetLanguage: string; // 'en', 'es', etc.
}

// Supported languages with display names
export const SUPPORTED_LANGUAGES = {
  auto: 'Auto Detect',
  en: 'English',
  vi: 'Vietnamese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  th: 'Thai',
  tr: 'Turkish',
} as const;

export type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// TTS Configuration
export interface TTSConfig {
  enabled: boolean;
  apiKey?: string;
  voiceId?: string;
  volume?: number;
}

// Widget configuration for embedding
export interface WidgetConfig {
  // Required
  apiKey: string;

  // Language settings (defaults: auto → en)
  sourceLanguage?: SupportedLanguageCode;
  targetLanguage?: SupportedLanguageCode;

  // Audio source
  audioSource?: 'microphone' | 'system';

  // TTS settings (default: disabled)
  ttsEnabled?: boolean;
  ttsApiKey?: string;
  ttsVoiceId?: string;

  // UI settings
  theme?: 'light' | 'dark' | 'auto';
  position?: 'inline' | 'floating';
  showControls?: boolean;
  showVisualizer?: boolean;

  // Behavior
  autoStart?: boolean;
  autoScroll?: boolean;
  maxCaptions?: number;

  // Callbacks
  onReady?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  onCaption?: (caption: Caption) => void;
  onError?: (error: Error) => void;
}

// AI Studio integration types
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    LiveTranslator?: {
      init: (selector: string | HTMLElement, config: WidgetConfig) => WidgetInstance;
      version: string;
    };
  }
}

// Widget instance API
export interface WidgetInstance {
  start(): Promise<void>;
  stop(): void;
  configure(options: Partial<WidgetConfig>): void;
  destroy(): void;

  // Event handlers
  on(event: 'caption', handler: (caption: Caption) => void): void;
  on(event: 'stateChange', handler: (state: ConnectionState) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;

  // TTS controls
  tts: {
    enable(): void;
    disable(): void;
    setVoice(voiceId: string): void;
    setVolume(volume: number): void;
    skip(): void;
  };
}
