/**
 * Live Conference Translator - Main Application
 *
 * Features:
 * - Real-time speech-to-text with translation
 * - Configurable language pairs
 * - Optional ElevenLabs TTS output
 * - Mobile-first responsive design
 * - Low-latency AudioWorklet audio capture
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveTranslationService, AudioSource } from './services/liveService';
import { TTSService } from './services/tts/TTSService';
import {
  Caption,
  ConnectionState,
  SUPPORTED_LANGUAGES,
  SupportedLanguageCode,
} from './types';
import CaptionDisplay from './components/CaptionDisplay';
import ControlBar from './components/ControlBar';
import { Button, Select, Toggle, cn } from './components/ui';
import { AlertCircle, Key, Crown, Bug, Clipboard, Mic, Monitor, Settings, X } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'livecaptions_api_key';
const LOCAL_STORAGE_LANG_KEY = 'livecaptions_languages';
const LOCAL_STORAGE_TTS_KEY = 'livecaptions_tts';

export default function App() {
  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  // Captions
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentText, setCurrentText] = useState<string>('');
  const [volume, setVolume] = useState<number>(0);

  // API Key
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);
  const [manualApiKey, setManualApiKey] = useState<string>('');

  // Language configuration
  const [sourceLanguage, setSourceLanguage] = useState<SupportedLanguageCode>('auto');
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguageCode>('en');

  // Audio source
  const [audioSource, setAudioSource] = useState<AudioSource>('microphone');

  // TTS configuration
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [ttsApiKey, setTtsApiKey] = useState<string>('');
  const [ttsVoiceId, setTtsVoiceId] = useState<string>('EXAVITQu4vr4xnSDxMaL');

  // UI state
  const [debugOpen, setDebugOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [debugLog, setDebugLog] = useState<{ ts: number; msg: string }[]>([]);

  // Service refs
  const liveService = useRef<LiveTranslationService | null>(null);
  const ttsService = useRef<TTSService | null>(null);

  // Load saved settings
  useEffect(() => {
    checkApiKey();
    loadSavedSettings();
  }, []);

  const loadSavedSettings = () => {
    try {
      const savedLang = localStorage.getItem(LOCAL_STORAGE_LANG_KEY);
      if (savedLang) {
        const { source, target } = JSON.parse(savedLang);
        if (source) setSourceLanguage(source);
        if (target) setTargetLanguage(target);
      }

      const savedTts = localStorage.getItem(LOCAL_STORAGE_TTS_KEY);
      if (savedTts) {
        const { enabled, apiKey, voiceId } = JSON.parse(savedTts);
        setTtsEnabled(enabled || false);
        setTtsApiKey(apiKey || '');
        if (voiceId) setTtsVoiceId(voiceId);
      }
    } catch (e) {
      console.warn('Failed to load saved settings:', e);
    }
  };

  const saveLanguageSettings = useCallback(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_LANG_KEY,
        JSON.stringify({ source: sourceLanguage, target: targetLanguage })
      );
    } catch {}
  }, [sourceLanguage, targetLanguage]);

  const saveTtsSettings = useCallback(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_TTS_KEY,
        JSON.stringify({ enabled: ttsEnabled, apiKey: ttsApiKey, voiceId: ttsVoiceId })
      );
    } catch {}
  }, [ttsEnabled, ttsApiKey, ttsVoiceId]);

  useEffect(() => {
    saveLanguageSettings();
  }, [sourceLanguage, targetLanguage, saveLanguageSettings]);

  useEffect(() => {
    saveTtsSettings();
  }, [ttsEnabled, ttsApiKey, ttsVoiceId, saveTtsSettings]);

  // Keyboard shortcut for debug
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        target &&
        (target.hasAttribute('contenteditable') ||
          ['input', 'textarea', 'select', 'option'].includes(tag || ''));
      if (isEditable) return;

      if (e.key.toLowerCase() === 'd') {
        setDebugOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const appendDebug = useCallback((msg: string) => {
    const ts = Date.now();
    setDebugLog((prev) => {
      const next = [...prev, { ts, msg }];
      return next.slice(-80);
    });
  }, []);

  const getStoredKey = useCallback(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }, []);

  const getEnvKey = useCallback(() => {
    const viteKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY || '';
    return viteKey || '';
  }, []);

  const checkApiKey = async () => {
    setIsCheckingKey(true);
    try {
      const savedKey = getStoredKey();
      if (savedKey) setManualApiKey(savedKey);
      const envKey = getEnvKey();
      appendDebug(`checkApiKey savedKey=${!!savedKey} envKey=${!!envKey}`);

      if ((window as any).aistudio?.hasSelectedApiKey) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasKey(has || !!envKey || !!savedKey);
        appendDebug(`AI Studio key check result: ${has}`);
      } else {
        setHasKey(!!envKey || !!savedKey);
      }
    } catch (e) {
      console.error('Error checking API key:', e);
      setHasKey(false);
      appendDebug(`checkApiKey error: ${String(e)}`);
    } finally {
      setIsCheckingKey(false);
    }
  };

  const handleConnectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      try {
        await (window as any).aistudio.openSelectKey();
        appendDebug('openSelectKey invoked');
        setHasKey(true);
        if (liveService.current) {
          liveService.current.stop();
          liveService.current = null;
        }
      } catch (e) {
        console.error('Error selecting key:', e);
        setErrorMsg('Failed to select API Key. Please try again.');
        appendDebug(`openSelectKey error: ${String(e)}`);
      }
    } else {
      setHasKey(false);
      setErrorMsg(undefined);
      liveService.current?.stop();
      liveService.current = null;
      setCaptions([]);
      setCurrentText('');
      setVolume(0);
      appendDebug('Switched to manual key mode');
    }
  };

  const initializeTTS = useCallback(() => {
    if (ttsEnabled && ttsApiKey && !ttsService.current) {
      ttsService.current = new TTSService({
        apiKey: ttsApiKey,
        voiceId: ttsVoiceId,
        onStateChange: (state) => appendDebug(`TTS state: ${state}`),
        onError: (error) => appendDebug(`TTS error: ${error.message}`),
      });
      appendDebug('TTS service initialized');
    }
  }, [ttsEnabled, ttsApiKey, ttsVoiceId, appendDebug]);

  const getService = useCallback(() => {
    if (!liveService.current) {
      const apiKey = getEnvKey() || getStoredKey() || manualApiKey;
      if (!apiKey) {
        setConnectionState(ConnectionState.ERROR);
        setErrorMsg('API Key is missing. Please connect your account.');
        appendDebug('Service init failed: missing API key');
        return null;
      }

      appendDebug(`Creating service with languages: ${sourceLanguage} → ${targetLanguage}`);

      liveService.current = new LiveTranslationService(
        apiKey,
        '',
        (text, isFinal) => {
          if (isFinal) {
            const newCaption: Caption = {
              id: Date.now().toString(),
              text,
              isFinal: true,
              timestamp: Date.now(),
            };
            setCaptions((prev) => [...prev, newCaption]);
            setCurrentText('');
            appendDebug(`Caption finalized (len=${text.length})`);

            if (ttsEnabled && ttsService.current) {
              ttsService.current.queueText(text);
            }
          } else {
            setCurrentText(text);
          }
        },
        (state, error) => {
          setConnectionState(state);
          let msg = `State change=${state}`;
          if (error) {
            setErrorMsg(error);
            if (error.includes('Requested entity was not found')) {
              setHasKey(false);
              liveService.current = null;
            }
            msg += ` error=${error}`;
          } else if (state === ConnectionState.CONNECTED) {
            setErrorMsg(undefined);
          }
          appendDebug(msg);
        },
        (vol) => {
          setVolume(vol);
        },
        { sourceLanguage, targetLanguage }
      );
      appendDebug('Service instance created');
    }

    liveService.current.setLanguageConfig({ sourceLanguage, targetLanguage });
    liveService.current.setAudioSource(audioSource);
    return liveService.current;
  }, [getEnvKey, getStoredKey, manualApiKey, sourceLanguage, targetLanguage, audioSource, ttsEnabled, appendDebug]);

  const handleSaveManualKey = () => {
    const trimmed = manualApiKey.trim();
    if (!trimmed) {
      setErrorMsg('Please paste your Gemini API key to continue.');
      return;
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, trimmed);
    } catch (e) {
      console.warn('Unable to persist API key to localStorage:', e);
    }
    setErrorMsg(undefined);
    setHasKey(true);
    if (liveService.current) {
      liveService.current.stop();
      liveService.current = null;
    }
    appendDebug('Manual API key saved');
  };

  const handleToggle = async () => {
    const service = getService();
    if (!service) return;

    if (ttsEnabled && ttsApiKey) {
      initializeTTS();
    }

    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      service.stop();
      appendDebug('Manual stop requested');
    } else {
      if (
        liveService.current &&
        (liveService.current.getLanguageConfig().sourceLanguage !== sourceLanguage ||
          liveService.current.getLanguageConfig().targetLanguage !== targetLanguage)
      ) {
        liveService.current.stop();
        liveService.current = null;
        const newService = getService();
        if (newService) {
          appendDebug('Manual start requested (new language config)');
          await newService.start();
        }
      } else {
        appendDebug('Manual start requested');
        await service.start();
      }
    }
  };

  const handleAudioSourceChange = (source: AudioSource) => {
    if (liveService.current && connectionState === ConnectionState.CONNECTED) {
      liveService.current.stop();
    }
    setAudioSource(source);
    appendDebug(`Audio source changed to: ${source}`);
  };

  useEffect(() => {
    return () => {
      liveService.current?.stop();
      ttsService.current?.destroy();
    };
  }, []);

  const languageOptions = Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    value: code,
    label: name,
  }));

  const targetLanguageOptions = languageOptions.filter((opt) => opt.value !== 'auto');

  const aiStudioAvailable = typeof window !== 'undefined' && !!(window as any).aistudio?.openSelectKey;

  // Loading state
  if (isCheckingKey) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // No API key - show setup screen
  if (!hasKey) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-white px-4 py-8">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 rounded-full" />
            <div className="relative w-24 h-24 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center mx-auto shadow-2xl">
              <Crown className="w-12 h-12 text-yellow-400" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Live Conference Translator</h1>
            <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
              Real-time speech translation powered by Gemini 2.5. Connect your API key to get started.
            </p>
          </div>

          {aiStudioAvailable ? (
            <Button onClick={handleConnectKey} size="lg" className="w-full">
              <Key className="w-5 h-5" />
              Connect API Key
            </Button>
          ) : (
            <div className="space-y-4 text-left">
              <label className="text-sm text-zinc-400">Gemini API Key</label>
              <input
                value={manualApiKey}
                onChange={(e) => setManualApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-yellow-400/40 min-h-[48px]"
                type="password"
                autoComplete="off"
              />
              <Button onClick={handleSaveManualKey} size="lg" className="w-full">
                <Key className="w-5 h-5" />
                Save & Start
              </Button>
              {errorMsg && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {errorMsg}
                </div>
              )}
              <p className="text-xs text-zinc-500">
                Key is stored locally in your browser. Use HTTPS for microphone access on mobile.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main app view
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-zinc-950 text-white">
      {/* Header */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-sm z-20">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          LiveCaptions
        </h1>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Audio Source Toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 rounded-full p-1">
            <Button
              variant={audioSource === 'microphone' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleAudioSourceChange('microphone')}
              className="rounded-full"
            >
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">Mic</span>
            </Button>
            <Button
              variant={audioSource === 'system' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleAudioSourceChange('system')}
              className="rounded-full"
            >
              <Monitor className="w-4 h-4" />
              <span className="hidden sm:inline">Tab</span>
            </Button>
          </div>

          {/* Settings button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="rounded-full"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>

          {/* Debug button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDebugOpen(!debugOpen)}
            className="hidden sm:flex"
          >
            <Bug className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Settings Panel */}
      {settingsOpen && (
        <div className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm px-4 py-4 sm:px-6 animate-in slide-in-from-top-2">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Translation Settings</h2>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Language Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="From Language"
                options={languageOptions}
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value as SupportedLanguageCode)}
                disabled={connectionState === ConnectionState.CONNECTED}
              />
              <Select
                label="To Language"
                options={targetLanguageOptions}
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value as SupportedLanguageCode)}
                disabled={connectionState === ConnectionState.CONNECTED}
              />
            </div>

            {/* TTS Settings */}
            <div className="pt-2 border-t border-zinc-800">
              <Toggle
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
                label="Text-to-Speech Output"
                description="Speak translations aloud using ElevenLabs"
              />

              {ttsEnabled && (
                <div className="mt-3 pl-14 space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400">ElevenLabs API Key</label>
                    <input
                      type="password"
                      value={ttsApiKey}
                      onChange={(e) => setTtsApiKey(e.target.value)}
                      placeholder="Enter your ElevenLabs API key"
                      className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/50 min-h-[44px]"
                    />
                  </div>
                  <Select
                    label="Voice"
                    options={[
                      { value: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah (Soft Female)' },
                      { value: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel (Female)' },
                      { value: '29vD33N1CtxCmqQRPOHJ', label: 'Drew (Male)' },
                      { value: '5Q0t7uMcjvnagumLfvZi', label: 'Paul (Male)' },
                      { value: 'GBv7mTt0atIp3Br8iCZE', label: 'Thomas (Male)' },
                    ]}
                    value={ttsVoiceId}
                    onChange={(e) => setTtsVoiceId(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* API Key */}
            <div className="pt-2 border-t border-zinc-800">
              <Button variant="ghost" size="sm" onClick={handleConnectKey}>
                <Key className="w-4 h-4" />
                Change API Key
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      {debugOpen && (
        <div className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-200 text-sm px-4 py-3 flex flex-col gap-2 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <Bug className="w-4 h-4 text-yellow-400" />
              Debug (press D)
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(
                    debugLog.map((e) => `${new Date(e.ts).toISOString()} ${e.msg}`).join('\n')
                  );
                }
              }}
            >
              <Clipboard className="w-3 h-3" />
              Copy
            </Button>
          </div>
          <textarea
            readOnly
            value={debugLog.map((e) => `${new Date(e.ts).toISOString()} ${e.msg}`).join('\n')}
            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded p-2 font-mono text-xs text-zinc-300 resize-none"
          />
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{errorMsg}</span>
        </div>
      )}

      {/* Main Display */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-16 sm:h-24 bg-gradient-to-b from-zinc-950 to-transparent pointer-events-none z-10" />
        <CaptionDisplay
          captions={captions}
          currentText={currentText}
          emptyStateText={`Ready to translate ${SUPPORTED_LANGUAGES[sourceLanguage]} → ${SUPPORTED_LANGUAGES[targetLanguage]}...`}
        />
        <div className="absolute bottom-0 left-0 w-full h-16 sm:h-24 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none z-10" />
      </main>

      {/* Controls */}
      <ControlBar
        state={connectionState}
        onToggle={handleToggle}
        volume={volume}
        sourceLanguage={SUPPORTED_LANGUAGES[sourceLanguage]}
        targetLanguage={SUPPORTED_LANGUAGES[targetLanguage]}
      />
    </div>
  );
}
