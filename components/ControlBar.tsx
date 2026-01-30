/**
 * ControlBar Component
 *
 * Bottom control bar with:
 * - Play/Stop button with states
 * - Status indicator
 * - Volume visualizer
 * - Mobile-first with large touch targets (48px)
 */

import React from 'react';
import { ConnectionState } from '../types';
import { Button, Badge, cn } from './ui';
import Visualizer from './Visualizer';

// Icons as inline SVGs for zero dependencies
const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const MicOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

interface ControlBarProps {
  state: ConnectionState;
  onToggle: () => void;
  volume: number;
  sourceLanguage?: string;
  targetLanguage?: string;
  className?: string;
}

const ControlBar: React.FC<ControlBarProps> = ({
  state,
  onToggle,
  volume,
  sourceLanguage,
  targetLanguage,
  className,
}) => {
  const isConnected = state === ConnectionState.CONNECTED;
  const isConnecting = state === ConnectionState.CONNECTING;
  const isError = state === ConnectionState.ERROR;

  // Status badge config
  const statusConfig = {
    [ConnectionState.CONNECTED]: {
      variant: 'success' as const,
      label: 'Live',
      pulse: true,
    },
    [ConnectionState.CONNECTING]: {
      variant: 'warning' as const,
      label: 'Connecting',
      pulse: true,
    },
    [ConnectionState.ERROR]: {
      variant: 'error' as const,
      label: 'Error',
      pulse: false,
    },
    [ConnectionState.DISCONNECTED]: {
      variant: 'default' as const,
      label: 'Ready',
      pulse: false,
    },
  };

  const status = statusConfig[state];

  return (
    <div
      className={cn(
        // Layout
        'flex items-center justify-between gap-4',
        // Padding (larger on mobile for thumb reach)
        'px-4 py-4 sm:px-6 sm:py-5',
        // Background
        'bg-zinc-900 border-t border-zinc-800',
        // Sticky positioning
        'sticky bottom-0 z-50',
        // Shadow for elevation
        'shadow-2xl',
        className
      )}
    >
      {/* Left: Visualizer + Status */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Visualizer volume={volume} isActive={isConnected} size="md" />

        <div className="flex flex-col gap-0.5">
          <Badge
            variant={status.variant}
            size="md"
            dot
            pulse={status.pulse}
          >
            {status.label}
          </Badge>

          {/* Language indicator - hidden on very small screens */}
          {sourceLanguage && targetLanguage && (
            <span className="hidden sm:block text-xs text-zinc-500">
              {sourceLanguage} → {targetLanguage}
            </span>
          )}
        </div>
      </div>

      {/* Right: Toggle Button */}
      <Button
        onClick={onToggle}
        disabled={isConnecting}
        loading={isConnecting}
        variant={isConnected ? 'destructive' : 'primary'}
        size="lg"
        className="min-w-[140px]"
      >
        {isConnected ? (
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
      </Button>
    </div>
  );
};

export default ControlBar;
