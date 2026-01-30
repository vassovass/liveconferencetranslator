/**
 * LiveTranslator Widget Entry Point
 *
 * Provides multiple ways to embed the widget:
 * 1. Data attribute auto-initialization
 * 2. JavaScript API
 * 3. React component import
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import Widget from './Widget';
import { parseDataAttributes, mergeConfig, validateConfig } from './WidgetConfig';
import { WidgetConfig, WidgetInstance, Caption, ConnectionState } from '../../types';

// Version
const VERSION = '1.0.0';

// Track initialized widgets
const initializedWidgets = new Map<HTMLElement, { root: ReactDOM.Root; instance: WidgetInstance }>();

/**
 * Create a widget instance API
 */
function createWidgetAPI(
  element: HTMLElement,
  config: WidgetConfig,
  root: ReactDOM.Root
): WidgetInstance {
  // Event handlers storage
  const eventHandlers: Record<string, Array<(...args: any[]) => void>> = {
    caption: [],
    stateChange: [],
    error: [],
  };

  // Inject event handlers into config
  const enhancedConfig: WidgetConfig = {
    ...config,
    onCaption: (caption: Caption) => {
      eventHandlers.caption.forEach((handler) => handler(caption));
      config.onCaption?.(caption);
    },
    onError: (error: Error) => {
      eventHandlers.error.forEach((handler) => handler(error));
      config.onError?.(error);
    },
  };

  // Re-render with enhanced config
  root.render(React.createElement(Widget, { config: enhancedConfig }));

  const instance: WidgetInstance = {
    start: async () => {
      // Trigger start through event dispatch
      element.dispatchEvent(new CustomEvent('lt-command', { detail: { action: 'start' } }));
    },
    stop: () => {
      element.dispatchEvent(new CustomEvent('lt-command', { detail: { action: 'stop' } }));
    },
    configure: (options: Partial<WidgetConfig>) => {
      const newConfig = { ...enhancedConfig, ...options };
      root.render(React.createElement(Widget, { config: newConfig }));
    },
    destroy: () => {
      root.unmount();
      initializedWidgets.delete(element);
      element.innerHTML = '';
    },
    on: (event: string, handler: (...args: any[]) => void) => {
      if (eventHandlers[event]) {
        eventHandlers[event].push(handler);
      }
    },
    off: (event: string, handler: (...args: any[]) => void) => {
      if (eventHandlers[event]) {
        const index = eventHandlers[event].indexOf(handler);
        if (index > -1) {
          eventHandlers[event].splice(index, 1);
        }
      }
    },
    tts: {
      enable: () => {
        instance.configure({ ttsEnabled: true });
      },
      disable: () => {
        instance.configure({ ttsEnabled: false });
      },
      setVoice: (voiceId: string) => {
        instance.configure({ ttsVoiceId: voiceId });
      },
      setVolume: (_volume: number) => {
        // TTS volume control - to be implemented with ElevenLabs
        console.log('[Widget] TTS volume control not yet implemented');
      },
      skip: () => {
        // TTS skip - to be implemented with ElevenLabs
        console.log('[Widget] TTS skip not yet implemented');
      },
    },
  };

  return instance;
}

/**
 * Initialize a widget on a DOM element
 */
function init(
  selector: string | HTMLElement,
  config: Partial<WidgetConfig>
): WidgetInstance | null {
  // Find element
  const element =
    typeof selector === 'string' ? document.querySelector<HTMLElement>(selector) : selector;

  if (!element) {
    console.error('[LiveTranslator] Element not found:', selector);
    return null;
  }

  // Check if already initialized
  if (initializedWidgets.has(element)) {
    console.warn('[LiveTranslator] Widget already initialized on element');
    return initializedWidgets.get(element)!.instance;
  }

  // Parse data attributes and merge with provided config
  const dataConfig = parseDataAttributes(element);
  const mergedConfig = mergeConfig({ ...dataConfig, ...config });

  // Validate
  const validation = validateConfig(mergedConfig);
  if (!validation.valid) {
    console.error('[LiveTranslator] Invalid config:', validation.errors);
  }

  // Create React root and render
  const root = ReactDOM.createRoot(element);
  const instance = createWidgetAPI(element, mergedConfig, root);

  // Store reference
  initializedWidgets.set(element, { root, instance });

  // Dispatch custom event for native DOM event listeners
  element.dispatchEvent(
    new CustomEvent('caption', {
      bubbles: true,
      detail: { type: 'ready' },
    })
  );

  // Auto-start if configured
  if (mergedConfig.autoStart) {
    setTimeout(() => instance.start(), 100);
  }

  return instance;
}

/**
 * Auto-initialize widgets with data-live-translator attribute
 */
function autoInit() {
  const elements = document.querySelectorAll<HTMLElement>('[data-live-translator]');
  elements.forEach((element) => {
    if (!initializedWidgets.has(element)) {
      init(element, {});
    }
  });
}

// Auto-init on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // DOM already loaded
    setTimeout(autoInit, 0);
  }
}

// Export global API
const LiveTranslator = {
  init,
  autoInit,
  version: VERSION,
};

// Attach to window for script tag usage
if (typeof window !== 'undefined') {
  (window as any).LiveTranslator = LiveTranslator;
}

// Export for module usage
export { init, autoInit, Widget, VERSION };
export default LiveTranslator;
