/**
 * CaptionDisplay Component
 *
 * Displays live captions with:
 * - Auto-scrolling to latest caption
 * - Historical captions with fade effect
 * - Current streaming caption with cursor
 * - Mobile-first responsive text sizing
 */

import React, { useEffect, useRef } from 'react';
import { Caption } from '../types';
import { cn } from './ui';

interface CaptionDisplayProps {
  captions: Caption[];
  currentText: string;
  autoScroll?: boolean;
  emptyStateText?: string;
  className?: string;
}

const CaptionDisplay: React.FC<CaptionDisplayProps> = ({
  captions,
  currentText,
  autoScroll = true,
  emptyStateText = 'Ready to translate...',
  className,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [captions, currentText, autoScroll]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 overflow-y-auto',
        'px-4 py-6 sm:px-6 sm:py-8 md:px-12 md:py-10',
        'space-y-6 sm:space-y-8',
        'min-h-0 scroll-smooth',
        className
      )}
    >
      <div className="flex flex-col justify-end min-h-full space-y-4 sm:space-y-6">
        {/* Empty state */}
        {captions.length === 0 && !currentText && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-zinc-600 text-base sm:text-lg italic animate-pulse text-center px-4">
              {emptyStateText}
            </p>
          </div>
        )}

        {/* Historical Captions */}
        {captions.map((caption, index) => (
          <div
            key={caption.id}
            className={cn(
              'animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out',
              // Fade older captions more
              index < captions.length - 3 && 'opacity-60',
              index < captions.length - 5 && 'opacity-40'
            )}
          >
            <p
              className={cn(
                'font-medium leading-relaxed tracking-wide',
                // Responsive text sizing (mobile-first)
                'text-lg sm:text-xl md:text-2xl lg:text-3xl',
                'text-zinc-200'
              )}
            >
              {caption.text}
            </p>
          </div>
        ))}

        {/* Current Streaming Caption */}
        {currentText && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <p
              className={cn(
                'font-bold leading-relaxed tracking-wide',
                // Larger text for current caption
                'text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl',
                'text-white drop-shadow-2xl'
              )}
            >
              <span className="text-yellow-300">{currentText}</span>
              {/* Blinking cursor */}
              <span
                className={cn(
                  'inline-block align-middle ml-1 sm:ml-2',
                  'w-2 sm:w-3 h-6 sm:h-8 md:h-10 lg:h-12',
                  'bg-yellow-400 rounded-sm',
                  'animate-blink',
                  'shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                )}
              />
            </p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-2" aria-hidden="true" />
      </div>
    </div>
  );
};

export default CaptionDisplay;
