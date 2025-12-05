import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob } from '../utils/audioUtils';
import { ConnectionState } from '../types';

type TranscriptionCallback = (text: string, isFinal: boolean) => void;
type StateCallback = (state: ConnectionState, error?: string) => void;
type VolumeCallback = (volume: number) => void;

export class LiveTranslationService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sessionPromise: Promise<any> | null = null;
  private active = false;

  private onTranscription: TranscriptionCallback;
  private onStateChange: StateCallback;
  private onVolume: VolumeCallback;

  // Buffer for accumulation of current turn
  private currentTranscription = '';

  constructor(
    apiKey: string,
    onTranscription: TranscriptionCallback,
    onStateChange: StateCallback,
    onVolume: VolumeCallback
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onTranscription = onTranscription;
    this.onStateChange = onStateChange;
    this.onVolume = onVolume;
  }

  public async start() {
    if (this.active) return;
    
    try {
      this.onStateChange(ConnectionState.CONNECTING);
      
      // Initialize Audio Context
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Gemini expects 16k for optimal PCM
      });

      // Get Microphone Stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      // Connect to Gemini Live
      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          // We MUST use AUDIO modality as per the prompt instructions.
          // The model will "speak" the translation, and we capture the transcription of that speech.
          responseModalities: [Modality.AUDIO], 
          outputAudioTranscription: {}, 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `
            You are an expert simultaneous interpreter for a Vietnamese conference.
            Your objective is to provide a COMPLETE and ACCURATE word-for-word translation into English.
            
            CRITICAL RULES:
            1. DO NOT SUMMARIZE. DO NOT OMIT DETAILS. Translate every concept spoken.
            2. Stream the English translation immediately as you hear the Vietnamese.
            3. If the speaker pauses, output what you have so far immediately.
            4. Maintain the original tone and accuracy.
            5. STRICTLY English output only. Do not speak Vietnamese. Do not add conversational fillers.
          `,
        },
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onclose: this.handleClose.bind(this),
          onerror: this.handleError.bind(this),
        },
      });
      
      this.active = true;

    } catch (error: any) {
      console.error('Failed to start service:', error);
      this.onStateChange(ConnectionState.ERROR, error.message);
      this.stop();
    }
  }

  private handleOpen() {
    this.onStateChange(ConnectionState.CONNECTED);
    this.startAudioStreaming();
  }

  private startAudioStreaming() {
    if (!this.inputAudioContext || !this.mediaStream) return;

    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    // Reduced buffer size from 4096 to 2048 to improve latency (approx 128ms at 16k)
    this.processor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.active) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onVolume(Math.min(rms * 5, 1)); // Scale up a bit for visibility

      const pcmBlob = createBlob(inputData);
      
      if (this.sessionPromise) {
        this.sessionPromise.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        }).catch(err => console.error("Session send error", err));
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private handleMessage(message: LiveServerMessage) {
    // We are primarily interested in outputTranscription
    const transcription = message.serverContent?.outputTranscription;
    
    if (transcription?.text) {
      this.currentTranscription += transcription.text;
      this.onTranscription(this.currentTranscription, false);
    }

    // Handle turn completion to finalize the caption
    if (message.serverContent?.turnComplete) {
      if (this.currentTranscription.trim()) {
        this.onTranscription(this.currentTranscription, true);
        this.currentTranscription = ''; // Reset for next turn
      }
    }
  }

  private handleClose() {
    console.log('Session closed');
    // If it closed unexpectedly while active, update state
    if (this.active) {
       this.onStateChange(ConnectionState.DISCONNECTED);
       this.stop(); 
    }
  }

  private handleError(e: ErrorEvent) {
    console.error('Session error:', e);
    this.onStateChange(ConnectionState.ERROR, 'Connection error occurred.');
    this.stop();
  }

  public stop() {
    this.active = false;
    
    // Disconnect audio nodes
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    // Close MediaStream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close AudioContext
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }

    // Close Live Session
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.close();
      });
      this.sessionPromise = null;
    }
    
    this.onStateChange(ConnectionState.DISCONNECTED);
    this.currentTranscription = '';
    this.onVolume(0);
  }
}