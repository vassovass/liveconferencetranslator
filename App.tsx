import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveTranslationService } from './services/liveService';
import { Caption, ConnectionState } from './types';
import CaptionDisplay from './components/CaptionDisplay';
import ControlBar from './components/ControlBar';
import { AlertCircle, Key, Crown } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'livecaptions_api_key';

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentText, setCurrentText] = useState<string>('');
  const [volume, setVolume] = useState<number>(0);
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);
  const [manualApiKey, setManualApiKey] = useState<string>('');
  
  const liveService = useRef<LiveTranslationService | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const getStoredKey = useCallback(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }, []);

  const getEnvKey = useCallback(() => {
    // Vite exposes env vars with the VITE_ prefix
    const viteKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY || '';
    const nodeKey = (typeof process !== 'undefined' ? (process as any)?.env?.API_KEY : '') || '';
    return viteKey || nodeKey || '';
  }, []);

  const checkApiKey = async () => {
    setIsCheckingKey(true);
    try {
      const savedKey = getStoredKey();
      if (savedKey) setManualApiKey(savedKey);
      const envKey = getEnvKey();

      if (window.aistudio?.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasKey(has || !!envKey || !!savedKey);
      } else {
        // Fallback for non-AI Studio environments
        setHasKey(!!envKey || !!savedKey);
      }
    } catch (e) {
      console.error("Error checking API key:", e);
      setHasKey(false);
    } finally {
      setIsCheckingKey(false);
    }
  };

  const handleConnectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        // Assuming success if the modal closes without error, 
        // as we can't easily detect cancellation vs success in all versions.
        // Re-check logic:
        setHasKey(true); 
        // Force cleanup of old service to ensure new key is used
        if (liveService.current) {
          liveService.current.stop();
          liveService.current = null;
        }
      } catch (e) {
        console.error("Error selecting key:", e);
        setErrorMsg("Failed to select API Key. Please try again.");
      }
    } else {
      // Non-AI Studio: show the manual key entry screen
      setHasKey(false);
      setErrorMsg(undefined);
      liveService.current?.stop();
      liveService.current = null;
      setCaptions([]);
      setCurrentText('');
      setVolume(0);
    }
  };

  // Initialize service instance
  const getService = useCallback(() => {
    if (!liveService.current) {
      const apiKey = getEnvKey() || getStoredKey() || manualApiKey;
      if (!apiKey) {
        setConnectionState(ConnectionState.ERROR);
        setErrorMsg('API Key is missing. Please connect your account.');
        return null;
      }

      liveService.current = new LiveTranslationService(
        apiKey,
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
          } else {
            setCurrentText(text);
          }
        },
        (state, error) => {
          setConnectionState(state);
          if (error) {
            setErrorMsg(error);
            // If we get a specific error about entity not found (key issue), reset key state
            if (error.includes('Requested entity was not found')) {
              setHasKey(false);
              liveService.current = null;
            }
          }
          else if (state === ConnectionState.CONNECTED) setErrorMsg(undefined);
        },
        (vol) => {
          setVolume(vol);
        }
      );
    }
    return liveService.current;
  }, [getEnvKey, getStoredKey, manualApiKey]);

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
  };

  const handleToggle = async () => {
    const service = getService();
    if (!service) return;

    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      service.stop();
    } else {
      await service.start();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      liveService.current?.stop();
    };
  }, []);

  if (isCheckingKey) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const aiStudioAvailable = typeof window !== 'undefined' && !!window.aistudio?.openSelectKey;

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
            <h1 className="text-3xl font-bold tracking-tight">Premium Translation</h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Connect your Google Cloud API key to enable high-speed, unlimited translations with Gemini 2.5.
              Works on desktop and mobile browsers (Chrome, Edge, Safari).
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
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-zinc-500">
              View billing documentation
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Header Area */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-sm z-10">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
          LiveCaptions
          <span className="hidden sm:inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 text-[10px] font-bold uppercase tracking-wider border border-yellow-400/20">
            <Crown className="w-3 h-3" /> Premium
          </span>
        </h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleConnectKey}
            className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
          >
            <Key className="w-3 h-3" /> Change Key
          </button>
          <div className="text-xs font-mono text-zinc-500">VN → EN</div>
        </div>
      </header>

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* Main Display */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background Gradients for aesthetic */}
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