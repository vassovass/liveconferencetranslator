/**
 * LiveTranslator Widget - Self-contained React component
 *
 * Mobile-first, embeddable live translation widget with:
 * - Configurable language pairs
 * - Optional ElevenLabs TTS
 * - Responsive design (320px+)
 * - Touch-friendly controls (44px min tap targets)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveTranslationService, AudioSource } from '../../services/liveService';
import {
  Caption,
  ConnectionState,
  WidgetConfig,
  SUPPORTED_LANGUAGES,
  SupportedLanguageCode,
} from '../../types';
import { DEFAULT_WIDGET_CONFIG, mergeConfig, validateConfig } from './WidgetConfig';

// Inline SVG icons (no external dependencies)
const MicIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const MicOffIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const LoaderIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lt-animate-spin"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const VolumeIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

interface WidgetProps {
  config: WidgetConfig;
  onDestroy?: () => void;
}

const Widget: React.FC<WidgetProps> = ({ config: initialConfig, onDestroy }) => {
  // Merge with defaults
  const config = mergeConfig(initialConfig);

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentText, setCurrentText] = useState<string>('');
  const [volume, setVolume] = useState<number>(0);
  const [sourceLanguage, setSourceLanguage] = useState<SupportedLanguageCode>(
    config.sourceLanguage || 'auto'
  );
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguageCode>(
    config.targetLanguage || 'en'
  );
  const [audioSource, setAudioSource] = useState<AudioSource>(config.audioSource || 'microphone');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(config.ttsEnabled || false);

  const liveService = useRef<LiveTranslationService | null>(null);
  const captionsContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Validate config on mount
  useEffect(() => {
    const validation = validateConfig(config);
    if (!validation.valid) {
      setErrorMsg(validation.errors.join('. '));
    }
  }, []);

  // Auto-scroll captions
  useEffect(() => {
    if (config.autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [captions, currentText, config.autoScroll]);

  // Limit captions
  useEffect(() => {
    if (captions.length > (config.maxCaptions || 50)) {
      setCaptions((prev) => prev.slice(-config.maxCaptions!));
    }
  }, [captions, config.maxCaptions]);

  // Call onReady callback
  useEffect(() => {
    config.onReady?.();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      liveService.current?.stop();
    };
  }, []);

  const getService = useCallback(() => {
    if (!liveService.current) {
      if (!config.apiKey) {
        setErrorMsg('API Key is missing');
        return null;
      }

      liveService.current = new LiveTranslationService(
        config.apiKey,
        '', // Model name (ignored, uses default)
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
            config.onCaption?.(newCaption);
          } else {
            setCurrentText(text);
          }
        },
        (state, error) => {
          setConnectionState(state);
          if (error) {
            setErrorMsg(error);
            config.onError?.(new Error(error));
          } else if (state === ConnectionState.CONNECTED) {
            setErrorMsg(undefined);
            config.onStart?.();
          } else if (state === ConnectionState.DISCONNECTED) {
            config.onStop?.();
          }
        },
        (vol) => {
          setVolume(vol);
        },
        { sourceLanguage, targetLanguage }
      );
    }

    // Update language config if changed
    liveService.current.setLanguageConfig({ sourceLanguage, targetLanguage });
    liveService.current.setAudioSource(audioSource);

    return liveService.current;
  }, [config, sourceLanguage, targetLanguage, audioSource]);

  const handleToggle = async () => {
    const service = getService();
    if (!service) return;

    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      service.stop();
    } else {
      // Reset service if language changed
      if (
        liveService.current &&
        (liveService.current.getLanguageConfig().sourceLanguage !== sourceLanguage ||
          liveService.current.getLanguageConfig().targetLanguage !== targetLanguage)
      ) {
        liveService.current.stop();
        liveService.current = null;
        const newService = getService();
        if (newService) {
          await newService.start();
        }
      } else {
        await service.start();
      }
    }
  };

  const handleAudioSourceChange = (source: AudioSource) => {
    if (connectionState === ConnectionState.CONNECTED) {
      liveService.current?.stop();
    }
    setAudioSource(source);
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;
  const isError = connectionState === ConnectionState.ERROR;

  // Theme classes
  const isDark = config.theme === 'dark' || (config.theme === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const themeClasses = isDark
    ? {
        container: 'lt-bg-zinc-950 lt-text-white',
        header: 'lt-bg-zinc-900 lt-border-zinc-800',
        caption: 'lt-text-zinc-200',
        currentCaption: 'lt-text-yellow-300',
        button: 'lt-bg-yellow-400 lt-text-black hover:lt-bg-yellow-300',
        buttonStop: 'lt-bg-red-500/10 lt-text-red-500 lt-border-red-500/50',
        select: 'lt-bg-zinc-900 lt-border-zinc-700 lt-text-white',
        error: 'lt-bg-red-500/10 lt-border-red-500/20 lt-text-red-400',
      }
    : {
        container: 'lt-bg-white lt-text-gray-900',
        header: 'lt-bg-gray-100 lt-border-gray-200',
        caption: 'lt-text-gray-700',
        currentCaption: 'lt-text-blue-600',
        button: 'lt-bg-blue-500 lt-text-white hover:lt-bg-blue-600',
        buttonStop: 'lt-bg-red-100 lt-text-red-600 lt-border-red-200',
        select: 'lt-bg-white lt-border-gray-300 lt-text-gray-900',
        error: 'lt-bg-red-50 lt-border-red-200 lt-text-red-600',
      };

  const languageOptions = Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    code: code as SupportedLanguageCode,
    name,
  }));

  return (
    <div
      className={`lt-widget lt-flex lt-flex-col lt-overflow-hidden lt-rounded-lg lt-border ${themeClasses.container} ${isDark ? 'lt-border-zinc-800' : 'lt-border-gray-200'}`}
      style={{ minHeight: '300px', maxHeight: '600px' }}
    >
      {/* Header - Mobile optimized */}
      <header
        className={`lt-px-3 lt-py-2 lt-flex lt-flex-wrap lt-items-center lt-justify-between lt-gap-2 lt-border-b ${themeClasses.header}`}
      >
        <div className="lt-flex lt-items-center lt-gap-2">
          <span
            className={`lt-w-2 lt-h-2 lt-rounded-full ${
              isConnected ? 'lt-bg-green-500' : isConnecting ? 'lt-bg-yellow-500 lt-animate-pulse' : isError ? 'lt-bg-red-500' : 'lt-bg-zinc-500'
            }`}
          />
          <span className="lt-text-sm lt-font-medium">
            {isConnected ? 'Live' : isConnecting ? 'Connecting...' : isError ? 'Error' : 'Ready'}
          </span>
        </div>

        {/* Language selector toggle */}
        <button
          onClick={() => setShowLanguageSelector(!showLanguageSelector)}
          className={`lt-flex lt-items-center lt-gap-1 lt-text-xs lt-px-2 lt-py-1 lt-rounded ${themeClasses.select} lt-border lt-min-h-[44px]`}
          type="button"
        >
          <span>
            {SUPPORTED_LANGUAGES[sourceLanguage]} → {SUPPORTED_LANGUAGES[targetLanguage]}
          </span>
          <ChevronDownIcon />
        </button>

        {/* Audio source toggle */}
        <div className="lt-flex lt-items-center lt-gap-1">
          <button
            onClick={() => handleAudioSourceChange('microphone')}
            className={`lt-text-xs lt-px-2 lt-py-1 lt-rounded lt-min-h-[44px] ${
              audioSource === 'microphone'
                ? isDark
                  ? 'lt-bg-yellow-400 lt-text-black'
                  : 'lt-bg-blue-500 lt-text-white'
                : isDark
                ? 'lt-text-zinc-400'
                : 'lt-text-gray-600'
            }`}
            type="button"
          >
            Mic
          </button>
          <button
            onClick={() => handleAudioSourceChange('system')}
            className={`lt-text-xs lt-px-2 lt-py-1 lt-rounded lt-min-h-[44px] ${
              audioSource === 'system'
                ? isDark
                  ? 'lt-bg-yellow-400 lt-text-black'
                  : 'lt-bg-blue-500 lt-text-white'
                : isDark
                ? 'lt-text-zinc-400'
                : 'lt-text-gray-600'
            }`}
            type="button"
          >
            Tab
          </button>
        </div>
      </header>

      {/* Language selector dropdown */}
      {showLanguageSelector && (
        <div className={`lt-px-3 lt-py-2 lt-border-b lt-flex lt-flex-wrap lt-gap-2 ${themeClasses.header}`}>
          <div className="lt-flex lt-flex-col lt-gap-1 lt-flex-1 lt-min-w-[140px]">
            <label className="lt-text-xs lt-opacity-70">From:</label>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value as SupportedLanguageCode)}
              className={`lt-text-sm lt-px-2 lt-py-2 lt-rounded lt-border lt-min-h-[44px] ${themeClasses.select}`}
              disabled={isConnected}
            >
              {languageOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
          <div className="lt-flex lt-flex-col lt-gap-1 lt-flex-1 lt-min-w-[140px]">
            <label className="lt-text-xs lt-opacity-70">To:</label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value as SupportedLanguageCode)}
              className={`lt-text-sm lt-px-2 lt-py-2 lt-rounded lt-border lt-min-h-[44px] ${themeClasses.select}`}
              disabled={isConnected}
            >
              {languageOptions.filter((opt) => opt.code !== 'auto').map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className={`lt-px-3 lt-py-2 lt-text-sm lt-border-b ${themeClasses.error}`}>
          {errorMsg}
        </div>
      )}

      {/* Captions area */}
      <div
        ref={captionsContainerRef}
        className="lt-flex-1 lt-overflow-y-auto lt-px-3 lt-py-4 lt-space-y-3 lt-min-h-0"
      >
        <div className="lt-flex lt-flex-col lt-justify-end lt-min-h-full lt-space-y-3">
          {/* Empty state */}
          {captions.length === 0 && !currentText && (
            <div className="lt-flex-1 lt-flex lt-items-center lt-justify-center lt-text-sm lt-opacity-50 lt-italic">
              Press start to begin translation...
            </div>
          )}

          {/* Historical captions */}
          {captions.map((caption) => (
            <div key={caption.id} className="lt-animate-fade-in">
              <p className={`lt-text-base lt-leading-relaxed lt-opacity-80 ${themeClasses.caption}`}>
                {caption.text}
              </p>
            </div>
          ))}

          {/* Current streaming caption */}
          {currentText && (
            <div className="lt-animate-fade-in">
              <p className={`lt-text-lg lt-font-semibold lt-leading-relaxed ${themeClasses.currentCaption}`}>
                {currentText}
                <span className="lt-inline-block lt-w-2 lt-h-5 lt-ml-1 lt-align-middle lt-bg-current lt-animate-blink lt-rounded-sm" />
              </p>
            </div>
          )}

          <div ref={bottomRef} className="lt-h-1" />
        </div>
      </div>

      {/* Control bar - Mobile optimized with large tap targets */}
      {config.showControls && (
        <div className={`lt-px-3 lt-py-3 lt-flex lt-items-center lt-justify-between lt-border-t ${themeClasses.header}`}>
          {/* Volume indicator */}
          {config.showVisualizer && (
            <div className="lt-flex lt-items-center lt-gap-2">
              <VolumeIcon />
              <div className="lt-w-16 lt-h-2 lt-bg-zinc-800 lt-rounded-full lt-overflow-hidden">
                <div
                  className={`lt-h-full lt-transition-all lt-duration-75 ${isDark ? 'lt-bg-yellow-400' : 'lt-bg-blue-500'}`}
                  style={{ width: `${volume * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* TTS toggle (if configured) */}
          {config.ttsApiKey && (
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`lt-text-xs lt-px-3 lt-py-2 lt-rounded lt-min-h-[44px] ${
                ttsEnabled
                  ? isDark
                    ? 'lt-bg-green-500/20 lt-text-green-400'
                    : 'lt-bg-green-100 lt-text-green-600'
                  : 'lt-opacity-50'
              }`}
              type="button"
            >
              TTS {ttsEnabled ? 'ON' : 'OFF'}
            </button>
          )}

          {/* Main toggle button - Large touch target */}
          <button
            onClick={handleToggle}
            disabled={isConnecting}
            className={`lt-flex lt-items-center lt-gap-2 lt-px-6 lt-py-3 lt-rounded-full lt-font-semibold lt-transition-all lt-min-h-[48px] lt-min-w-[120px] lt-justify-center ${
              isConnected
                ? `${themeClasses.buttonStop} lt-border`
                : themeClasses.button
            } disabled:lt-opacity-50 disabled:lt-cursor-not-allowed`}
            type="button"
          >
            {isConnecting ? (
              <LoaderIcon />
            ) : isConnected ? (
              <>
                <MicOffIcon />
                <span>Stop</span>
              </>
            ) : (
              <>
                <MicIcon />
                <span>Start</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default Widget;
