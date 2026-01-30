/**
 * Widget Configuration Types and Defaults
 */

import { WidgetConfig, SupportedLanguageCode, ConnectionState, Caption } from '../../types';

// Default configuration values
export const DEFAULT_WIDGET_CONFIG: Required<Omit<WidgetConfig, 'apiKey' | 'onReady' | 'onStart' | 'onStop' | 'onCaption' | 'onError'>> & Pick<WidgetConfig, 'apiKey'> = {
  apiKey: '',
  sourceLanguage: 'auto' as SupportedLanguageCode,
  targetLanguage: 'en' as SupportedLanguageCode,
  audioSource: 'microphone',
  ttsEnabled: false,
  ttsApiKey: undefined,
  ttsVoiceId: undefined,
  theme: 'dark',
  position: 'inline',
  showControls: true,
  showVisualizer: true,
  autoStart: false,
  autoScroll: true,
  maxCaptions: 50,
};

/**
 * Parse data attributes from a DOM element to WidgetConfig
 */
export function parseDataAttributes(element: HTMLElement): Partial<WidgetConfig> {
  const config: Partial<WidgetConfig> = {};

  // Required
  const apiKey = element.dataset.apiKey;
  if (apiKey) config.apiKey = apiKey;

  // Language settings
  const sourceLang = element.dataset.sourceLang || element.dataset.sourceLanguage;
  if (sourceLang) config.sourceLanguage = sourceLang as SupportedLanguageCode;

  const targetLang = element.dataset.targetLang || element.dataset.targetLanguage;
  if (targetLang) config.targetLanguage = targetLang as SupportedLanguageCode;

  // Audio source
  const audioSource = element.dataset.audioSource;
  if (audioSource === 'microphone' || audioSource === 'system') {
    config.audioSource = audioSource;
  }

  // TTS settings
  const ttsEnabled = element.dataset.tts || element.dataset.ttsEnabled;
  if (ttsEnabled !== undefined) {
    config.ttsEnabled = ttsEnabled === 'true' || ttsEnabled === '1';
  }

  const ttsApiKey = element.dataset.ttsApiKey;
  if (ttsApiKey) config.ttsApiKey = ttsApiKey;

  const ttsVoiceId = element.dataset.ttsVoiceId || element.dataset.ttsVoice;
  if (ttsVoiceId) config.ttsVoiceId = ttsVoiceId;

  // UI settings
  const theme = element.dataset.theme;
  if (theme === 'light' || theme === 'dark' || theme === 'auto') {
    config.theme = theme;
  }

  const position = element.dataset.position;
  if (position === 'inline' || position === 'floating') {
    config.position = position;
  }

  const showControls = element.dataset.showControls;
  if (showControls !== undefined) {
    config.showControls = showControls !== 'false' && showControls !== '0';
  }

  const showVisualizer = element.dataset.showVisualizer;
  if (showVisualizer !== undefined) {
    config.showVisualizer = showVisualizer !== 'false' && showVisualizer !== '0';
  }

  // Behavior
  const autoStart = element.dataset.autoStart;
  if (autoStart !== undefined) {
    config.autoStart = autoStart === 'true' || autoStart === '1';
  }

  const autoScroll = element.dataset.autoScroll;
  if (autoScroll !== undefined) {
    config.autoScroll = autoScroll !== 'false' && autoScroll !== '0';
  }

  const maxCaptions = element.dataset.maxCaptions;
  if (maxCaptions) {
    const parsed = parseInt(maxCaptions, 10);
    if (!isNaN(parsed) && parsed > 0) {
      config.maxCaptions = parsed;
    }
  }

  return config;
}

/**
 * Merge config with defaults
 */
export function mergeConfig(config: Partial<WidgetConfig>): WidgetConfig {
  return {
    ...DEFAULT_WIDGET_CONFIG,
    ...config,
  } as WidgetConfig;
}

/**
 * Validate configuration
 */
export function validateConfig(config: WidgetConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push('API key is required');
  }

  if (config.ttsEnabled && !config.ttsApiKey) {
    errors.push('TTS API key is required when TTS is enabled');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
