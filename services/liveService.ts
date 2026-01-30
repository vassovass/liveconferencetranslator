import { GoogleGenAI, Modality } from '@google/genai';
import { ConnectionState, LanguageConfig, SUPPORTED_LANGUAGES, SupportedLanguageCode } from '../types';
import { int16ToBase64Fast } from './utils/fastBase64';

type TranscriptionCallback = (text: string, isFinal: boolean) => void;
type StateCallback = (state: ConnectionState, error?: string) => void;
type VolumeCallback = (volume: number) => void;

export type AudioSource = 'microphone' | 'system';

/**
 * LiveTranslationService - Real-time Speech-to-Text with Translation
 *
 * Uses Gemini Live API for streaming audio → text conversion.
 * Supports AudioWorklet for low-latency audio capture (~32ms vs 256ms).
 *
 * Audio Sources:
 * - microphone: Captures from mic (default)
 * - system: Captures from browser tab/system audio (screen share)
 *
 * Language Configuration:
 * - sourceLanguage: Source language code (e.g., 'vi', 'auto')
 * - targetLanguage: Target language code (e.g., 'en')
 */
export class LiveTranslationService {
  private ai: GoogleGenAI;
  private modelName: string;
  private inputAudioContext: AudioContext | null = null;
  private inputSampleRate = 16000;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private session: any = null;
  private active = false;
  private audioStreamingStarted = false;
  private audioSource: AudioSource = 'microphone';
  private languageConfig: LanguageConfig;
  private useAudioWorklet = true; // Try AudioWorklet first, fallback to ScriptProcessor

  // Fallback for browsers without AudioWorklet support
  private processor: ScriptProcessorNode | null = null;

  // Audio buffering for connection not ready
  private audioBuffer: ArrayBuffer[] = [];
  private sessionReady = false;
  private maxBufferSize = 10; // Max chunks to buffer before discarding old ones

  private onTranscription: TranscriptionCallback;
  private onStateChange: StateCallback;
  private onVolume: VolumeCallback;

  private currentTranscription = '';

  constructor(
    apiKey: string,
    _modelName: string, // Ignored - we force the correct model
    onTranscription: TranscriptionCallback,
    onStateChange: StateCallback,
    onVolume: VolumeCallback,
    languageConfig?: LanguageConfig
  ) {
    this.ai = new GoogleGenAI({ apiKey });

    // CRITICAL: Use the TEXT-capable model for STT/captioning
    this.modelName = 'gemini-live-2.5-flash-preview';

    // Default language config
    this.languageConfig = languageConfig || {
      sourceLanguage: 'vi',
      targetLanguage: 'en',
    };

    console.log('[LiveService] Initialized with model:', this.modelName);
    console.log('[LiveService] Language config:', this.languageConfig);

    this.onTranscription = onTranscription;
    this.onStateChange = onStateChange;
    this.onVolume = onVolume;
  }

  public getModelName() {
    return this.modelName;
  }

  public setAudioSource(source: AudioSource) {
    this.audioSource = source;
    console.log('[LiveService] Audio source set to:', source);
  }

  public getAudioSource() {
    return this.audioSource;
  }

  public setLanguageConfig(config: LanguageConfig) {
    this.languageConfig = config;
    console.log('[LiveService] Language config updated:', config);
  }

  public getLanguageConfig() {
    return this.languageConfig;
  }

  /**
   * Generate system instruction based on language configuration
   */
  private generateSystemInstruction(): string {
    const { sourceLanguage, targetLanguage } = this.languageConfig;

    const sourceName =
      sourceLanguage === 'auto'
        ? 'any language'
        : SUPPORTED_LANGUAGES[sourceLanguage as SupportedLanguageCode] || sourceLanguage;
    const targetName =
      SUPPORTED_LANGUAGES[targetLanguage as SupportedLanguageCode] || targetLanguage;

    if (sourceLanguage === targetLanguage) {
      // Transcription only (no translation)
      return `You are a professional transcriptionist for live captioning.

YOUR ONLY JOB: Listen to speech and output accurate text transcription.

RULES:
1. Transcribe speech accurately and immediately
2. Output ONLY the transcribed text - no labels or explanations
3. Do NOT summarize - transcribe every word accurately
4. If you hear silence, output nothing
5. Stream the transcription as you hear it - do not wait

You are a real-time transcriptionist. Output text only.`;
    }

    if (sourceLanguage === 'auto') {
      // Auto-detect source language
      return `You are a professional interpreter for live conference captioning.

YOUR ONLY JOB: Listen to speech in any language and translate it to ${targetName}.

RULES:
1. Detect the spoken language automatically
2. Translate to ${targetName} immediately
3. Output ONLY the ${targetName} translation - never output the source text
4. Do NOT add any labels like "Translation:" or explanations
5. Do NOT summarize - translate every word accurately
6. If you hear silence, output nothing
7. Stream the translation as you hear it - do not wait

You are a real-time translator. Output ${targetName} text only.`;
    }

    // Specific source → target translation
    return `You are a professional interpreter for live conference captioning.

YOUR ONLY JOB: Listen to ${sourceName} speech and output the ${targetName} translation.

RULES:
1. When you hear ${sourceName}, translate it to ${targetName} immediately
2. Output ONLY the ${targetName} translation - never output ${sourceName} text
3. Do NOT add any labels like "Translation:" or explanations
4. Do NOT summarize - translate every word accurately
5. If you hear silence, output nothing
6. Stream the translation as you hear it - do not wait

You are a real-time ${sourceName} to ${targetName} translator. Output ${targetName} text only.`;
  }

  /**
   * Get audio stream based on selected source
   * - microphone: getUserMedia (default mic)
   * - system: getDisplayMedia (tab/screen audio)
   */
  private async getAudioStream(): Promise<MediaStream> {
    if (this.audioSource === 'system') {
      // Capture system/tab audio via screen share
      console.log('[LiveService] Requesting system audio (screen/tab capture)...');

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required by some browsers, we'll ignore it
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // Check if audio track exists
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        // Stop video track and throw error
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(
          'No audio track found. Make sure to select "Share tab audio" or "Share system audio" in the dialog.'
        );
      }

      // Stop video track - we only need audio
      stream.getVideoTracks().forEach((track) => track.stop());

      console.log('[LiveService] System audio captured:', audioTracks[0].label);
      return stream;
    } else {
      // Default: microphone
      console.log('[LiveService] Requesting microphone access...');

      return await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    }
  }

  /**
   * Check if AudioWorklet is supported
   */
  private async isAudioWorkletSupported(): Promise<boolean> {
    try {
      return typeof AudioWorkletNode !== 'undefined' && 'audioWorklet' in AudioContext.prototype;
    } catch {
      return false;
    }
  }

  public async start() {
    if (this.active) return;

    try {
      this.onStateChange(ConnectionState.CONNECTING);
      this.audioStreamingStarted = false;
      this.sessionReady = false;
      this.audioBuffer = [];

      // Initialize Audio Context at 16kHz (Gemini's native rate)
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
      try {
        this.inputAudioContext = new AudioContextConstructor({ sampleRate: 16000 });
      } catch {
        this.inputAudioContext = new AudioContextConstructor();
      }

      await this.inputAudioContext.resume();
      this.inputSampleRate = this.inputAudioContext.sampleRate || 16000;
      console.log('[LiveService] AudioContext sample rate:', this.inputSampleRate);

      // Check AudioWorklet support
      this.useAudioWorklet = await this.isAudioWorkletSupported();
      console.log('[LiveService] AudioWorklet supported:', this.useAudioWorklet);

      // Get audio stream (microphone or system)
      if (!navigator?.mediaDevices) {
        throw new Error('Media devices not supported in this browser.');
      }

      this.mediaStream = await this.getAudioStream();
      console.log('[LiveService] Audio stream acquired:', this.audioSource);

      this.active = true;

      console.log('[LiveService] Connecting to Gemini Live API...');
      console.log('[LiveService] Model:', this.modelName);
      console.log('[LiveService] Response modality: TEXT (for captions)');

      // Connect to Gemini Live with TEXT modality for STT
      this.session = await this.ai.live.connect({
        model: this.modelName,
        config: {
          // TEXT modality = speech-to-text output (captions)
          responseModalities: [Modality.TEXT],

          // Dynamic system instruction based on language config
          systemInstruction: {
            parts: [
              {
                text: this.generateSystemInstruction(),
              },
            ],
          },
        },
        callbacks: {
          onopen: () => {
            console.log('[LiveService] Session opened successfully');
            this.onStateChange(ConnectionState.CONNECTED);
            this.sessionReady = true;

            // Start audio streaming immediately (no delay!)
            this.startAudioStreaming();

            // Flush any buffered audio
            this.flushAudioBuffer();
          },
          onmessage: (message: any) => {
            this.handleMessage(message);
          },
          onclose: (event: any) => {
            console.log('[LiveService] Session closed:', event?.reason || 'No reason');
            if (this.active) {
              this.onStateChange(ConnectionState.DISCONNECTED);
              this.cleanup();
            }
          },
          onerror: (error: any) => {
            console.error('[LiveService] Session error:', error);
            this.onStateChange(ConnectionState.ERROR, error?.message || 'Connection error');
            this.cleanup();
          },
        },
      });

      console.log('[LiveService] Session created, waiting for audio...');
    } catch (error: any) {
      console.error('[LiveService] Failed to start:', error);

      let friendlyError = error?.message || 'Unable to start translation.';
      if (error?.name === 'NotAllowedError') {
        friendlyError =
          this.audioSource === 'system'
            ? 'Screen share was cancelled or denied.'
            : 'Microphone permission denied. Please allow mic access.';
      } else if (error?.name === 'NotFoundError') {
        friendlyError = 'No audio input found.';
      } else if (error?.message?.includes('No audio track')) {
        friendlyError =
          'No audio selected. Click "Share tab audio" checkbox in the share dialog.';
      } else if (error?.message?.includes('not found') || error?.message?.includes('404')) {
        friendlyError = 'Model not available. Check API key permissions.';
      }

      this.onStateChange(ConnectionState.ERROR, friendlyError);
      this.cleanup();
    }
  }

  /**
   * Flush buffered audio chunks to the session
   */
  private flushAudioBuffer() {
    if (!this.session || !this.sessionReady || this.audioBuffer.length === 0) return;

    console.log(`[LiveService] Flushing ${this.audioBuffer.length} buffered audio chunks`);

    for (const buffer of this.audioBuffer) {
      this.sendAudioChunk(buffer);
    }
    this.audioBuffer = [];
  }

  /**
   * Send audio chunk to Gemini session
   */
  private sendAudioChunk(pcmBuffer: ArrayBuffer) {
    if (!this.session) return;

    const uint8 = new Uint8Array(pcmBuffer);
    const base64 = int16ToBase64Fast(new Int16Array(pcmBuffer));

    try {
      this.session.sendRealtimeInput({
        audio: {
          data: base64,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    } catch (err) {
      console.error('[LiveService] Error sending audio:', err);
    }
  }

  /**
   * Start audio streaming using AudioWorklet (preferred) or ScriptProcessor (fallback)
   */
  private async startAudioStreaming() {
    if (this.audioStreamingStarted) {
      console.log('[LiveService] Audio streaming already started');
      return;
    }

    if (!this.inputAudioContext || !this.mediaStream) {
      console.error('[LiveService] Cannot start audio - missing resources');
      return;
    }

    console.log('[LiveService] Starting audio capture and streaming...');
    this.audioStreamingStarted = true;

    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);

    if (this.useAudioWorklet) {
      await this.startWithAudioWorklet();
    } else {
      this.startWithScriptProcessor();
    }

    console.log('[LiveService] Audio streaming active');
  }

  /**
   * Start audio capture with AudioWorklet (low latency ~32ms)
   */
  private async startWithAudioWorklet() {
    if (!this.inputAudioContext || !this.source) return;

    try {
      // Load the worklet module
      await this.inputAudioContext.audioWorklet.addModule('/audio-processor.worklet.js');

      // Create the worklet node
      this.audioWorkletNode = new AudioWorkletNode(
        this.inputAudioContext,
        'audio-capture-processor'
      );

      let chunkCount = 0;

      // Handle messages from worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        if (!this.active) return;

        const { type, samples, volume } = event.data;

        if (type === 'audio') {
          // Update volume visualizer
          this.onVolume(volume);

          // Send or buffer audio
          if (this.sessionReady && this.session) {
            this.sendAudioChunk(samples);
          } else {
            // Buffer audio until session is ready
            this.audioBuffer.push(samples);
            if (this.audioBuffer.length > this.maxBufferSize) {
              this.audioBuffer.shift(); // Drop oldest
            }
          }

          chunkCount++;
          if (chunkCount % 100 === 0) {
            console.log(`[LiveService] Sent ${chunkCount} audio chunks (AudioWorklet)`);
          }
        }
      };

      // Connect the audio graph
      this.source.connect(this.audioWorkletNode);
      // Note: Don't connect worklet to destination to avoid feedback

      console.log('[LiveService] AudioWorklet streaming active (~32ms latency)');
    } catch (error) {
      console.warn('[LiveService] AudioWorklet failed, falling back to ScriptProcessor:', error);
      this.useAudioWorklet = false;
      this.startWithScriptProcessor();
    }
  }

  /**
   * Start audio capture with ScriptProcessor (fallback, ~256ms latency)
   */
  private startWithScriptProcessor() {
    if (!this.inputAudioContext || !this.source) return;

    // Use smaller buffer for lower latency (1024 samples = ~64ms at 16kHz)
    this.processor = this.inputAudioContext.createScriptProcessor(1024, 1, 1);

    let chunkCount = 0;

    this.processor.onaudioprocess = (e) => {
      if (!this.active) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Calculate volume for visualizer (RMS)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      const normalizedVolume = Math.min(rms * 5, 1);
      this.onVolume(normalizedVolume);

      // Convert Float32 → Int16 PCM
      const int16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Send or buffer audio
      if (this.sessionReady && this.session) {
        this.sendAudioChunk(int16.buffer);
      } else {
        this.audioBuffer.push(int16.buffer.slice(0));
        if (this.audioBuffer.length > this.maxBufferSize) {
          this.audioBuffer.shift();
        }
      }

      chunkCount++;
      if (chunkCount % 100 === 0) {
        console.log(`[LiveService] Sent ${chunkCount} audio chunks (ScriptProcessor)`);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);

    console.log('[LiveService] ScriptProcessor streaming active (~64ms latency)');
  }

  /**
   * Handle incoming messages from Gemini Live API
   *
   * With TEXT modality, we get text directly in:
   * - message.text (direct text)
   * - message.serverContent.modelTurn.parts[].text
   *
   * IMPORTANT: Each message contains the FULL response so far, not a delta.
   * So we REPLACE currentTranscription, not append to it.
   */
  private handleMessage(message: any) {
    // Method 1: Direct text property (full text, not delta)
    if (message.text) {
      this.currentTranscription = message.text; // REPLACE, not append
      this.onTranscription(this.currentTranscription, false);
    }

    // Method 2: Text in serverContent.modelTurn.parts
    if (message.serverContent?.modelTurn?.parts) {
      // Combine all parts into one string (replace, not append)
      const partsText = message.serverContent.modelTurn.parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join('');

      if (partsText) {
        this.currentTranscription = partsText; // REPLACE, not append
        this.onTranscription(this.currentTranscription, false);
      }
    }

    // Method 3: outputTranscription
    if (message.serverContent?.outputTranscription?.text) {
      this.currentTranscription = message.serverContent.outputTranscription.text;
      this.onTranscription(this.currentTranscription, false);
    }

    // Handle turn completion - finalize the caption
    if (message.serverContent?.turnComplete) {
      if (this.currentTranscription.trim()) {
        this.onTranscription(this.currentTranscription, true);
        console.log('[LiveService] FINAL:', this.currentTranscription);
        this.currentTranscription = ''; // Clear for next turn
      }
    }

    // Handle interruption
    if (message.serverContent?.interrupted) {
      console.log('[LiveService] Interrupted');
      this.currentTranscription = '';
    }
  }

  private cleanup() {
    this.active = false;
    this.audioStreamingStarted = false;
    this.sessionReady = false;
    this.audioBuffer = [];

    // Cleanup AudioWorklet
    if (this.audioWorkletNode) {
      try {
        this.audioWorkletNode.port.postMessage({ type: 'stop' });
        this.audioWorkletNode.disconnect();
      } catch {}
      this.audioWorkletNode = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {}
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioContext) {
      try {
        this.inputAudioContext.close();
      } catch {}
      this.inputAudioContext = null;
    }

    if (this.session) {
      try {
        this.session.close();
      } catch {}
      this.session = null;
    }

    this.currentTranscription = '';
    this.onVolume(0);
  }

  public stop() {
    console.log('[LiveService] Stopping service...');
    this.cleanup();
    this.onStateChange(ConnectionState.DISCONNECTED);
    console.log('[LiveService] Stopped');
  }
}
