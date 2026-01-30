/**
 * TTS Service - Text-to-Speech Queue and Playback Manager
 *
 * Handles:
 * - Queuing text segments for TTS
 * - Coalescing rapid text segments
 * - Managing playback without overlap
 * - Prefetching next segment while current plays
 *
 * Architecture:
 *   Text Input → Queue → ElevenLabs API → Audio Buffer → Playback
 *                 ↓
 *            Coalesce rapid inputs
 */

import { ElevenLabsClient } from '../elevenlabs/ElevenLabsClient';
import { VoiceSettings, DEFAULT_VOICE_SETTINGS } from '../elevenlabs/types';

interface AudioSegment {
  id: string;
  text: string;
  priority: 'normal' | 'high';
  timestamp: number;
  audioBuffer?: ArrayBuffer;
  status: 'pending' | 'generating' | 'ready' | 'playing' | 'done' | 'error';
  error?: string;
}

interface TTSServiceConfig {
  apiKey: string;
  voiceId: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  maxQueueSize?: number;
  coalesceWindowMs?: number;
  volume?: number;
  onStateChange?: (state: TTSState) => void;
  onError?: (error: Error) => void;
}

type TTSState = 'idle' | 'generating' | 'playing' | 'paused';

export class TTSService {
  private client: ElevenLabsClient;
  private voiceId: string;
  private queue: AudioSegment[] = [];
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isProcessing = false;
  private isPaused = false;
  private state: TTSState = 'idle';
  private volume = 1;

  // Configuration
  private maxQueueSize: number;
  private coalesceWindowMs: number;

  // Callbacks
  private onStateChange?: (state: TTSState) => void;
  private onError?: (error: Error) => void;

  // Prefetch
  private prefetchPromise: Promise<ArrayBuffer> | null = null;
  private prefetchedId: string | null = null;

  constructor(config: TTSServiceConfig) {
    this.client = new ElevenLabsClient({
      apiKey: config.apiKey,
      defaultVoiceId: config.voiceId,
      defaultModelId: config.modelId,
      defaultVoiceSettings: config.voiceSettings || DEFAULT_VOICE_SETTINGS,
    });

    this.voiceId = config.voiceId;
    this.maxQueueSize = config.maxQueueSize || 5;
    this.coalesceWindowMs = config.coalesceWindowMs || 500;
    this.volume = config.volume ?? 1;
    this.onStateChange = config.onStateChange;
    this.onError = config.onError;
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  async initialize(): Promise<void> {
    if (this.audioContext) return;

    const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextConstructor();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(this.audioContext.destination);

    await this.audioContext.resume();
  }

  /**
   * Add text to the TTS queue
   */
  async queueText(text: string, priority: 'normal' | 'high' = 'normal'): Promise<void> {
    if (!text.trim()) return;

    // Initialize if needed
    await this.initialize();

    // Try to coalesce with last segment if within window
    const last = this.queue[this.queue.length - 1];
    if (
      last &&
      last.status === 'pending' &&
      Date.now() - last.timestamp < this.coalesceWindowMs
    ) {
      last.text += ' ' + text.trim();
      last.timestamp = Date.now();
      console.log('[TTS] Coalesced text with previous segment');
      return;
    }

    // Create new segment
    const segment: AudioSegment = {
      id: crypto.randomUUID(),
      text: text.trim(),
      priority,
      timestamp: Date.now(),
      status: 'pending',
    };

    // Add to queue, drop oldest if full
    this.queue.push(segment);
    if (this.queue.length > this.maxQueueSize) {
      const dropped = this.queue.shift();
      console.log('[TTS] Queue full, dropped oldest segment:', dropped?.id);
    }

    console.log('[TTS] Queued segment:', segment.id, 'Queue size:', this.queue.length);

    // Start processing if not already
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the TTS queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && !this.isPaused) {
      // Get next segment (prioritize 'high' priority)
      const segment = this.getNextSegment();
      if (!segment) {
        await this.wait(100);
        continue;
      }

      try {
        // Generate audio
        this.setState('generating');
        segment.status = 'generating';

        let audioBuffer: ArrayBuffer;

        // Use prefetched audio if available
        if (this.prefetchPromise && segment.id === this.prefetchedId) {
          console.log('[TTS] Using prefetched audio for:', segment.id);
          audioBuffer = await this.prefetchPromise;
          this.prefetchPromise = null;
          this.prefetchedId = null;
        } else {
          console.log('[TTS] Generating audio for:', segment.id);
          audioBuffer = await this.client.generateSpeech(segment.text, this.voiceId);
        }

        segment.audioBuffer = audioBuffer;
        segment.status = 'ready';

        // Start prefetching next segment
        const nextSegment = this.peekNextSegment();
        if (nextSegment && nextSegment.status === 'pending') {
          console.log('[TTS] Prefetching next segment:', nextSegment.id);
          this.prefetchedId = nextSegment.id;
          this.prefetchPromise = this.client.generateSpeech(nextSegment.text, this.voiceId);
          nextSegment.status = 'generating';
        }

        // Play audio
        this.setState('playing');
        segment.status = 'playing';
        await this.playAudioBuffer(audioBuffer);

        // Mark as done
        segment.status = 'done';

        // Remove from queue
        const index = this.queue.indexOf(segment);
        if (index > -1) {
          this.queue.splice(index, 1);
        }
      } catch (error) {
        console.error('[TTS] Error processing segment:', error);
        segment.status = 'error';
        segment.error = error instanceof Error ? error.message : String(error);
        this.onError?.(error instanceof Error ? error : new Error(String(error)));

        // Remove failed segment
        const index = this.queue.indexOf(segment);
        if (index > -1) {
          this.queue.splice(index, 1);
        }
      }
    }

    this.isProcessing = false;
    this.setState('idle');
  }

  /**
   * Get the next segment to process (prioritizes high priority)
   */
  private getNextSegment(): AudioSegment | null {
    // First try high priority ready segments
    let segment = this.queue.find((s) => s.status === 'ready' && s.priority === 'high');
    if (segment) return segment;

    // Then any ready segment
    segment = this.queue.find((s) => s.status === 'ready');
    if (segment) return segment;

    // Then high priority pending
    segment = this.queue.find((s) => s.status === 'pending' && s.priority === 'high');
    if (segment) return segment;

    // Then any pending
    segment = this.queue.find((s) => s.status === 'pending');
    return segment || null;
  }

  /**
   * Peek at the next pending segment (for prefetching)
   */
  private peekNextSegment(): AudioSegment | null {
    return this.queue.find((s) => s.status === 'pending') || null;
  }

  /**
   * Play an audio buffer
   */
  private async playAudioBuffer(buffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext || !this.gainNode) {
      throw new Error('Audio context not initialized');
    }

    // Decode audio data
    const audioBuffer = await this.audioContext.decodeAudioData(buffer.slice(0));

    return new Promise((resolve, reject) => {
      try {
        // Stop any currently playing audio
        if (this.currentSource) {
          this.currentSource.stop();
          this.currentSource.disconnect();
        }

        // Create and configure source
        this.currentSource = this.audioContext!.createBufferSource();
        this.currentSource.buffer = audioBuffer;
        this.currentSource.connect(this.gainNode!);

        // Handle completion
        this.currentSource.onended = () => {
          this.currentSource = null;
          resolve();
        };

        // Start playback
        this.currentSource.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Skip the currently playing segment
   */
  skip(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
      console.log('[TTS] Skipped current segment');
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.isPaused = true;
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
    this.setState('paused');
    console.log('[TTS] Paused');
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    if (!this.isProcessing && this.queue.length > 0) {
      this.processQueue();
    }
    console.log('[TTS] Resumed');
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = [];
    this.prefetchPromise = null;
    this.prefetchedId = null;
    console.log('[TTS] Queue cleared');
  }

  /**
   * Stop playback and clear queue
   */
  stop(): void {
    this.skip();
    this.clearQueue();
    this.isPaused = false;
    this.isProcessing = false;
    this.setState('idle');
    console.log('[TTS] Stopped');
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Set voice ID
   */
  setVoice(voiceId: string): void {
    this.voiceId = voiceId;
    this.client.setDefaultVoice(voiceId);
  }

  /**
   * Get current state
   */
  getState(): TTSState {
    return this.state;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Update state and notify
   */
  private setState(state: TTSState): void {
    if (this.state !== state) {
      this.state = state;
      this.onStateChange?.(state);
    }
  }

  /**
   * Utility: wait for ms
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.gainNode = null;
  }
}
