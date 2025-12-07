import React, { useEffect, useRef } from 'react';
import { Caption } from '../types';

interface CaptionDisplayProps {
  captions: Caption[];
  currentText: string;
}

const CaptionDisplay: React.FC<CaptionDisplayProps> = ({ captions, currentText }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto scroll to bottom smoothly
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [captions, currentText]);

  return (
    <div 
      className="flex-1 overflow-y-auto px-6 py-8 md:px-16 md:py-12 space-y-10 min-h-0 scroll-smooth"
      ref={containerRef}
    >
      <div className="flex flex-col justify-end min-h-full space-y-8">
        {/* Empty state */}
        {captions.length === 0 && !currentText && (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-lg italic animate-pulse">
            Ready to translate Vietnamese to English...
          </div>
        )}

        {/* Historical Captions */}
        {captions.map((caption) => (
          <div key={caption.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            <p className="text-2xl md:text-3xl font-medium text-zinc-200 leading-relaxed tracking-wide opacity-80">
              {caption.text}
            </p>
          </div>
        ))}

        {/* Current Streaming Caption */}
        {currentText && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
             <p className="text-3xl md:text-5xl font-bold text-white leading-relaxed tracking-wide drop-shadow-2xl">
              <span className="text-yellow-300">{currentText}</span>
              <span className="inline-block w-3 h-8 md:h-12 ml-2 align-middle bg-yellow-400 animate-blink rounded-sm shadow-[0_0_10px_rgba(234,179,8,0.5)]"/>
            </p>
          </div>
        )}
        
        <div ref={bottomRef} className="h-2" />
      </div>
    </div>
  );
};

export default CaptionDisplay;
