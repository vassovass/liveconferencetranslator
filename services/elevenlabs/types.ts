/**
 * ElevenLabs API Types
 *
 * Type definitions for ElevenLabs Text-to-Speech API
 */

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export interface VoiceSettings {
  stability: number; // 0-1, higher = more consistent
  similarity_boost: number; // 0-1, higher = closer to original voice
  style?: number; // 0-1, style exaggeration
  use_speaker_boost?: boolean;
}

export interface TTSRequest {
  text: string;
  model_id?: string;
  voice_settings?: VoiceSettings;
  output_format?: 'mp3_44100_128' | 'mp3_22050_32' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000' | 'pcm_44100';
}

export interface TTSStreamOptions {
  voiceId: string;
  text: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  outputFormat?: string;
  onAudioChunk?: (chunk: ArrayBuffer) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface ElevenLabsConfig {
  apiKey: string;
  defaultVoiceId?: string;
  defaultModelId?: string;
  defaultVoiceSettings?: VoiceSettings;
}

// Default voice settings optimized for real-time
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
};

// Turbo model for low latency
export const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';

// Popular voice IDs
export const POPULAR_VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM', // Female, American
  drew: '29vD33N1CtxCmqQRPOHJ', // Male, American
  clyde: '2EiwWnXFnvU5JabPnv8n', // Male, American
  paul: '5Q0t7uMcjvnagumLfvZi', // Male, American
  domi: 'AZnzlk1XvdvUeBnXmlld', // Female, American
  dave: 'CYw3kZ02Hs0563khs1Fj', // Male, British
  fin: 'D38z5RcWu1voky8WS1ja', // Male, Irish
  sarah: 'EXAVITQu4vr4xnSDxMaL', // Female, American (soft)
  antoni: 'ErXwobaYiN019PkySvjV', // Male, American
  thomas: 'GBv7mTt0atIp3Br8iCZE', // Male, American
} as const;
