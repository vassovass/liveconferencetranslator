import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveTranslationService, AudioSource } from './services/liveService';
import { Caption, ConnectionState } from './types';
import CaptionDisplay from './components/CaptionDisplay';
import ControlBar from './components/ControlBar';
import { AlertCircle, Key, Crown, Bug, Clipboard, Activity, Mic, Monitor } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'livecaptions_api_key';
const DEFAULT_MODEL = 'gemini-live-2.5-flash-preview';

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentText, setCurrentText] = useState<string>('');
  const [volume, setVolume] = useState<number>(0);
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);
  const [manualApiKey, setManualApiKey] = useState<string>('');
  const [debugOpen, setDebugOpen] = useState<boolean>(false);
  const [debugLog, setDebugLog] = useState<{ ts: number; msg: string }[]>([]);
  const [audioSource, setAudioSource] = useState<AudioSource>('microphone');
  
  const liveService = useRef<LiveTranslationService | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  // Keyboard shortcut for debug
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = target && (
        target.hasAttribute('contenteditable') ||
        ['input', 'textarea', 'select', 'option'].includes(tag || '')
      );
      if (isEditable) return;

      if (e.key.toLowerCase() === 'd') {
        setDebugOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const appendDebug = useCallback((msg: string) => {
    const ts = Date.now();
    setDebugLog(prev => {
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
    const nodeKey = (typeof process !== 'undefined' ? (process as any)?.env?.API_KEY : '') || '';
    return viteKey || nodeKey || '';
  }, []);

  const getModelName = useCallback(() => {
    const viteModel = (import.meta as any)?.env?.VITE_GEMINI_MODEL || '';
    const nodeModel = (typeof process !== 'undefined' ? (process as any)?.env?.VITE_GEMINI_MODEL : '') || '';
    return viteModel || nodeModel || DEFAULT_MODEL;
  }, []);

  const checkApiKey = async () => {
    setIsCheckingKey(true);
    try {
      const savedKey = getStoredKey();
      if (savedKey) setManualApiKey(savedKey);
      const envKey = getEnvKey();
      appendDebug(`checkApiKey savedKey=${!!savedKey} envKey=${!!envKey}`);

      if (window.aistudio?.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has || !!envKey || !!savedKey);
        appendDebug(`AI Studio key check result: ${has}`);
      } else {
        setHasKey(!!envKey || !!savedKey);
      }
    } catch (e) {
      console.error("Error checking API key:", e);
      setHasKey(false);
      appendDebug(`checkApiKey error: ${String(e)}`);
    } finally {
      setIsCheckingKey(false);
    }
  };

  const handleConnectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        appendDebug('openSelectKey invoked');
        setHasKey(true); 
        if (liveService.current) {
          liveService.current.stop();
          liveService.current = null;
        }
      } catch (e) {
        console.error("Error selecting key:", e);
        setErrorMsg("Failed to select API Key. Please try again.");
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

  const getService = useCallback(() => {
    if (!liveService.current) {
      const apiKey = getEnvKey() || getStoredKey() || manualApiKey;
      if (!apiKey) {
        setConnectionState(ConnectionState.ERROR);
        setErrorMsg('API Key is missing. Please connect your account.');
        appendDebug('Service init failed: missing API key');
        return null;
      }

      const modelName = getModelName();
      appendDebug(`Using model=${modelName}`);

      liveService.current = new LiveTranslationService(
        apiKey,
        modelName,
        (text, isFinal) => {
          if (isFinal) {
            setCaptions(prev => [
              ...prev, 
              { 
                id: Date.now().toString(), 
                text, 
                isFinal: true, 
                timestamp: Date.now() 
              }
            ]);
            setCurrentText('');
            appendDebug(`Caption finalized (len=${text.length})`);
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
          }
          else if (state === ConnectionState.CONNECTED) setErrorMsg(undefined);
          appendDebug(msg);
        },
        (vol) => {
          setVolume(vol);
          if (vol > 0.5) appendDebug(`Volume peak=${vol.toFixed(2)}`);
        }
      );
      appendDebug(`Service instance created model=${modelName}`);
    }
    // Always update audio source in case it changed
    liveService.current.setAudioSource(audioSource);
    return liveService.current;
  }, [getEnvKey, getStoredKey, manualApiKey, getModelName, appendDebug, audioSource]);

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

  const handleClearManualKey = () => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (e) {
      console.warn('Unable to clear stored key:', e);
    }
    setManualApiKey('');
    setHasKey(false);
    liveService.current?.stop();
    liveService.current = null;
    setCaptions([]);
    setCurrentText('');
    setVolume(0);
    appendDebug('Manual API key cleared');
  };

  const handleToggle = async () => {
    const service = getService();
    if (!service) return;

    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      service.stop();
      appendDebug('Manual stop requested');
    } else {
      appendDebug('Manual start requested');
      await service.start();
    }
  };

  const handleAudioSourceChange = (source: AudioSource) => {
    // Stop current session if running
    if (liveService.current && connectionState === ConnectionState.CONNECTED) {
      liveService.current.stop();
    }
    setAudioSource(source);
    appendDebug(`Audio source changed to: ${source}`);
  };

  useEffect(() => {
    return () => {
      liveService.current?.stop();
    };
  }, []);

  const debugText = React.useMemo(() => {
    const envKey = getEnvKey();
    const summary = {
      connectionState,
      errorMsg,
      hasKey,
      isCheckingKey,
      captionsCount: captions.length,
      currentTextLength: currentText.length,
      volume: Number(volume.toFixed(3)),
      manualKey: manualApiKey ? `set(len=${manualApiKey.length})` : 'empty',
      envKeyPresent: !!envKey,
      aiStudioAvailable: typeof window !== 'undefined' && !!window.aistudio?.openSelectKey,
      modelName: getModelName(),
      audioSource,
    };
    const eventLines = debugLog.map(e => `${new Date(e.ts).toISOString()} ${e.msg}`);
    return [
      '=== Debug Summary ===',
      JSON.stringify(summary, null, 2),
      '=== Recent Events ===',
      ...eventLines
    ].join('\n');
  }, [connectionState, errorMsg, hasKey, isCheckingKey, captions, currentText, volume, manualApiKey, getEnvKey, debugLog, getModelName]);

  const handleCopyDebug = useCallback(() => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(debugText).catch(() => {});
    }
  }, [debugText]);

  const aiStudioAvailable = typeof window !== 'undefined' && !!window.aistudio?.openSelectKey;

  if (isCheckingKey) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-white px-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 rounded-full" />
            <div className="relative w-24 h-24 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center mx-auto shadow-2xl">
              <Crown className="w-12 h-12 text-yellow-400" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">Live Conference Translator</h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Connect your Google Cloud API key to enable live Vietnamese → English translation with Gemini 2.5.
            </p>
          </div>

          {aiStudioAvailable ? (
            <button
              onClick={handleConnectKey}
              className="w-full py-4 px-6 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-3 text-lg"
            >
              <Key className="w-5 h-5" />
              Connect API Key
            </button>
          ) : (
            <div className="space-y-4 text-left">
              <label className="text-sm text-zinc-400">Gemini API Key</label>
              <input
                value={manualApiKey}
                onChange={(e) => setManualApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:border-yellow-400/40"
                type="password"
                autoComplete="off"
              />
              <button
                onClick={handleSaveManualKey}
                className="w-full py-3 px-6 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-yellow-400/20 flex items-center justify-center gap-3 text-base"
              >
                <Key className="w-5 h-5" />
                Save & Start
              </button>
              {errorMsg && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {errorMsg}
                </div>
              )}
              {manualApiKey && (
                <button
                  onClick={handleClearManualKey}
                  className="w-full py-2 px-6 text-sm text-zinc-400 hover:text-white transition-colors"
                  type="button"
                >
                  Clear saved key
                </button>
              )}
              <p className="text-xs text-zinc-500">
                Key is stored locally in your browser (never sent to our servers). 
                Use https for microphone access on phones.
              </p>
            </div>
          )}
          
          <p className="text-xs text-zinc-600">
            Uses Gemini 2.5 Flash Native Audio Preview
            <br />
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer noopener" className="underline hover:text-zinc-500">
              View billing documentation
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-zinc-950 text-white">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-sm z-10">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
          LiveCaptions
        </h1>
        <div className="flex items-center gap-4">
          {/* Audio Source Toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 rounded-full p-1">
            <button
              onClick={() => handleAudioSourceChange('microphone')}
              className={`text-xs rounded-full px-3 py-1 flex items-center gap-1 transition-colors ${
                audioSource === 'microphone' 
                  ? 'bg-yellow-400 text-black' 
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Use microphone"
              type="button"
            >
              <Mic className="w-3 h-3" />
              Mic
            </button>
            <button
              onClick={() => handleAudioSourceChange('system')}
              className={`text-xs rounded-full px-3 py-1 flex items-center gap-1 transition-colors ${
                audioSource === 'system' 
                  ? 'bg-yellow-400 text-black' 
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Capture tab/system audio"
              type="button"
            >
              <Monitor className="w-3 h-3" />
              Tab Audio
            </button>
          </div>
          <button 
            onClick={handleConnectKey}
            className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
          >
            <Key className="w-3 h-3" /> Change Key
          </button>
          <div className="text-xs font-mono text-zinc-500">Tiếng Việt → English</div>
          <button
            onClick={() => setDebugOpen(prev => !prev)}
            className="text-xs rounded-full px-3 py-1 flex items-center gap-1 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
            title="Toggle debug info panel (press D)"
            type="button"
          >
            <Bug className="w-3 h-3" />
            Debug
          </button>
        </div>
      </header>

      {debugOpen && (
        <div className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-200 text-sm px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <Bug className="w-4 h-4 text-yellow-400" />
              Debug info (press D to toggle)
            </div>
            <button
              onClick={handleCopyDebug}
              className="text-xs flex items-center gap-1 px-3 py-1 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-200"
              type="button"
            >
              <Clipboard className="w-3 h-3" />
              Copy
            </button>
          </div>
          <textarea
            readOnly
            value={debugText}
            aria-label="Debug information"
            className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded p-2 font-mono text-xs text-zinc-200 resize-none"
          />
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* Main Display */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-zinc-950 to-transparent pointer-events-none z-10" />
        <CaptionDisplay captions={captions} currentText={currentText} />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none z-10" />
      </main>

      {/* Controls */}
      <ControlBar 
        state={connectionState} 
        onToggle={handleToggle}
        volume={volume}
      />
    </div>
  );
}
