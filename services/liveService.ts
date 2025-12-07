import { GoogleGenAI, Modality } from '@google/genai';
import { ConnectionState } from '../types';

type TranscriptionCallback = (text: string, isFinal: boolean) => void;
type StateCallback = (state: ConnectionState, error?: string) => void;
type VolumeCallback = (volume: number) => void;

export type AudioSource = 'microphone' | 'system';

/**
 * LiveTranslationService - Real-time Speech-to-Text with Translation
 * 
 * Uses Gemini Live API for streaming audio → text conversion.
 * 
 * Audio Sources:
 * - microphone: Captures from mic (default)
 * - system: Captures from browser tab/system audio (screen share)
 * 
 * Model Selection:
 * - gemini-live-2.5-flash-preview: TEXT output (STT/captions) ✓ USING THIS
 * - gemini-2.5-flash-native-audio-preview-09-2025: AUDIO output only (voice conversations)
 */
export class LiveTranslationService {
  private ai: GoogleGenAI;
  private modelName: string;
  private inputAudioContext: AudioContext | null = null;
  private inputSampleRate = 16000;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private session: any = null;
  private active = false;
  private audioStreamingStarted = false;
  private audioSource: AudioSource = 'microphone';

  private onTranscription: TranscriptionCallback;
  private onStateChange: StateCallback;
  private onVolume: VolumeCallback;

  private currentTranscription = '';

  constructor(
    apiKey: string,
    _modelName: string, // Ignored - we force the correct model
    onTranscription: TranscriptionCallback,
    onStateChange: StateCallback,
    onVolume: VolumeCallback
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    
    // CRITICAL: Use the TEXT-capable model for STT/captioning
    // Native audio model CANNOT output text - it requires AUDIO modality
    this.modelName = 'gemini-live-2.5-flash-preview';
    
    console.log('[LiveService] Initialized with model:', this.modelName);
    console.log('[LiveService] Mode: Vietnamese → English translation');
    
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
        }
      });
      
      // Check if audio track exists
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        // Stop video track and throw error
        stream.getTracks().forEach(t => t.stop());
        throw new Error('No audio track found. Make sure to select "Share tab audio" or "Share system audio" in the dialog.');
      }
      
      // Stop video track - we only need audio
      stream.getVideoTracks().forEach(track => track.stop());
      
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
        } 
      });
    }
  }

  public async start() {
    if (this.active) return;
    
    try {
      this.onStateChange(ConnectionState.CONNECTING);
      this.audioStreamingStarted = false;
      
      // Initialize Audio Context at 16kHz (Gemini's native rate)
      const AudioContextConstructor = (window.AudioContext || (window as any).webkitAudioContext);
      try {
        this.inputAudioContext = new AudioContextConstructor({ sampleRate: 16000 });
      } catch {
        this.inputAudioContext = new AudioContextConstructor();
      }

      await this.inputAudioContext.resume();
      this.inputSampleRate = this.inputAudioContext.sampleRate || 16000;
      console.log('[LiveService] AudioContext sample rate:', this.inputSampleRate);

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
          // AUDIO modality = voice response (not what we want)
          responseModalities: [Modality.TEXT],
          
          // System instruction: Vietnamese → English translation ONLY
          systemInstruction: {
            parts: [{
              text: `Bạn là một phiên dịch viên chuyên nghiệp. Dịch tiếng Việt sang tiếng Anh.

You are a Vietnamese to English interpreter for live conference captioning.

YOUR ONLY JOB: Listen to Vietnamese speech (tiếng Việt) and output the English translation.

RULES:
1. When you hear Vietnamese, translate it to English immediately
2. Output ONLY the English translation - never output Vietnamese text
3. Do NOT add any labels like "Translation:" or explanations
4. Do NOT summarize - translate every word accurately
5. If you hear silence, output nothing
6. Stream the translation as you hear it - do not wait

Example:
- Hear: "Xin chào, tôi tên là Nam" → Output: "Hello, my name is Nam"
- Hear: "Hôm nay thời tiết đẹp quá" → Output: "The weather is so nice today"

You are a real-time Vietnamese to English translator. Output English text only.`
            }]
          },
        },
        callbacks: {
          onopen: () => {
            console.log('[LiveService] ✓ Session opened successfully');
            this.onStateChange(ConnectionState.CONNECTED);
            // Small delay to ensure session is fully ready
            setTimeout(() => this.startAudioStreaming(), 100);
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
      
      console.log('[LiveService] ✓ Session created, waiting for audio...');

    } catch (error: any) {
      console.error('[LiveService] Failed to start:', error);
      
      let friendlyError = error?.message || 'Unable to start translation.';
      if (error?.name === 'NotAllowedError') {
        friendlyError = this.audioSource === 'system' 
          ? 'Screen share was cancelled or denied.'
          : 'Microphone permission denied. Please allow mic access.';
      } else if (error?.name === 'NotFoundError') {
        friendlyError = 'No audio input found.';
      } else if (error?.message?.includes('No audio track')) {
        friendlyError = 'No audio selected. Click "Share tab audio" checkbox in the share dialog.';
      } else if (error?.message?.includes('not found') || error?.message?.includes('404')) {
        friendlyError = 'Model not available. Check API key permissions.';
      }

      this.onStateChange(ConnectionState.ERROR, friendlyError);
      this.cleanup();
    }
  }

  private startAudioStreaming() {
    if (this.audioStreamingStarted) {
      console.log('[LiveService] Audio streaming already started');
      return;
    }

    if (!this.inputAudioContext || !this.mediaStream || !this.session) {
      console.error('[LiveService] Cannot start audio - missing resources');
      return;
    }

    console.log('[LiveService] Starting audio capture and streaming...');
    this.audioStreamingStarted = true;

    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    let chunkCount = 0;

    this.processor.onaudioprocess = (e) => {
      if (!this.active || !this.session) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer (RMS)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      const normalizedVolume = Math.min(rms * 5, 1);
      this.onVolume(normalizedVolume);

      // Send ALL audio (removed silence threshold - let the model decide)

      // Resample to 16kHz if needed
      const resampled = this.inputSampleRate === 16000 
        ? inputData 
        : this.resampleTo16k(inputData, this.inputSampleRate);

      // Convert Float32 → Int16 PCM
      const int16 = new Int16Array(resampled.length);
      for (let i = 0; i < resampled.length; i++) {
        const s = Math.max(-1, Math.min(1, resampled[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Convert to base64
      const uint8 = new Uint8Array(int16.buffer);
      const base64 = this.uint8ToBase64(uint8);

      // Send to Gemini
      try {
        this.session.sendRealtimeInput({
          audio: {
            data: base64,
            mimeType: 'audio/pcm;rate=16000'
          }
        });
        
        chunkCount++;
        if (chunkCount % 50 === 0) {
          console.log(`[LiveService] Sent ${chunkCount} audio chunks, vol=${normalizedVolume.toFixed(3)}`);
        }
      } catch (err) {
        console.error('[LiveService] Error sending audio:', err);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
    console.log('[LiveService] ✓ Audio streaming active');
  }

  private uint8ToBase64(uint8: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  private resampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
    if (inputSampleRate === 16000) return input;

    const targetSampleRate = 16000;
    const sampleRatio = inputSampleRate / targetSampleRate;
    const newLength = Math.round(input.length / sampleRatio);
    const output = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * sampleRatio;
      const index0 = Math.floor(sourceIndex);
      const index1 = Math.min(index0 + 1, input.length - 1);
      const weight = sourceIndex - index0;
      output[i] = input[index0] * (1 - weight) + input[index1] * weight;
    }

    return output;
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
    // Debug: log raw message structure
    console.log('[LiveService] Message:', JSON.stringify(message, null, 2));

    // Method 1: Direct text property (full text, not delta)
    if (message.text) {
      this.currentTranscription = message.text; // REPLACE, not append
      this.onTranscription(this.currentTranscription, false);
      console.log('[LiveService] TEXT:', message.text);
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
        console.log('[LiveService] TEXT (parts):', partsText);
      }
    }

    // Method 3: outputTranscription
    if (message.serverContent?.outputTranscription?.text) {
      this.currentTranscription = message.serverContent.outputTranscription.text;
      this.onTranscription(this.currentTranscription, false);
      console.log('[LiveService] TEXT (transcript):', message.serverContent.outputTranscription.text);
    }

    // Handle turn completion - finalize the caption
    if (message.serverContent?.turnComplete) {
      if (this.currentTranscription.trim()) {
        this.onTranscription(this.currentTranscription, true);
        console.log('[LiveService] ✓ FINAL:', this.currentTranscription);
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
    
    if (this.source) {
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
    if (this.processor) {
      try { this.processor.disconnect(); } catch {}
      this.processor = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioContext) {
      try { this.inputAudioContext.close(); } catch {}
      this.inputAudioContext = null;
    }

    if (this.session) {
      try { this.session.close(); } catch {}
      this.session = null;
    }
    
    this.currentTranscription = '';
    this.onVolume(0);
  }

  public stop() {
    console.log('[LiveService] Stopping service...');
    this.cleanup();
    this.onStateChange(ConnectionState.DISCONNECTED);
    console.log('[LiveService] ✓ Stopped');
  }
}
