/**
 * ElevenLabs API Client
 *
 * Handles communication with ElevenLabs Text-to-Speech API.
 * Supports both standard and streaming TTS generation.
 */

import {
  Voice,
  VoiceSettings,
  TTSRequest,
  TTSStreamOptions,
  ElevenLabsConfig,
  DEFAULT_VOICE_SETTINGS,
  DEFAULT_MODEL_ID,
} from './types';

export class ElevenLabsClient {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private defaultVoiceId: string;
  private defaultModelId: string;
  private defaultVoiceSettings: VoiceSettings;

  constructor(config: ElevenLabsConfig) {
    this.apiKey = config.apiKey;
    this.defaultVoiceId = config.defaultVoiceId || '';
    this.defaultModelId = config.defaultModelId || DEFAULT_MODEL_ID;
    this.defaultVoiceSettings = config.defaultVoiceSettings || DEFAULT_VOICE_SETTINGS;
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<Voice[]> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices || [];
  }

  /**
   * Get a specific voice by ID
   */
  async getVoice(voiceId: string): Promise<Voice> {
    const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
      headers: {
        'xi-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate speech from text (returns complete audio)
   */
  async generateSpeech(
    text: string,
    voiceId?: string,
    options?: Partial<TTSRequest>
  ): Promise<ArrayBuffer> {
    const voice = voiceId || this.defaultVoiceId;
    if (!voice) {
      throw new Error('Voice ID is required');
    }

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: options?.model_id || this.defaultModelId,
        voice_settings: options?.voice_settings || this.defaultVoiceSettings,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    return response.arrayBuffer();
  }

  /**
   * Generate speech with streaming (for lower latency)
   */
  async generateSpeechStream(options: TTSStreamOptions): Promise<void> {
    const voiceId = options.voiceId || this.defaultVoiceId;
    if (!voiceId) {
      throw new Error('Voice ID is required');
    }

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: options.text,
        model_id: options.modelId || this.defaultModelId,
        voice_settings: options.voiceSettings || this.defaultVoiceSettings,
        output_format: options.outputFormat || 'mp3_44100_128',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      options.onError?.(new Error(`ElevenLabs API error: ${response.status} - ${errorText}`));
      return;
    }

    if (!response.body) {
      options.onError?.(new Error('No response body'));
      return;
    }

    const reader = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          options.onComplete?.();
          break;
        }

        if (value) {
          options.onAudioChunk?.(value.buffer);
        }
      }
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Set default voice ID
   */
  setDefaultVoice(voiceId: string): void {
    this.defaultVoiceId = voiceId;
  }

  /**
   * Set default model ID
   */
  setDefaultModel(modelId: string): void {
    this.defaultModelId = modelId;
  }

  /**
   * Set default voice settings
   */
  setDefaultVoiceSettings(settings: Partial<VoiceSettings>): void {
    this.defaultVoiceSettings = { ...this.defaultVoiceSettings, ...settings };
  }
}
