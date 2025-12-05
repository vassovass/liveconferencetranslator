import React from 'react';
import { ConnectionState } from '../types';
import { Mic, MicOff, AlertCircle, Loader2 } from 'lucide-react';
import Visualizer from './Visualizer';

interface ControlBarProps {
  state: ConnectionState;
  onToggle: () => void;
  volume: number;
}

const ControlBar: React.FC<ControlBarProps> = ({ state, onToggle, volume }) => {
  const isConnected = state === ConnectionState.CONNECTED;
  const isConnecting = state === ConnectionState.CONNECTING;
  const isError = state === ConnectionState.ERROR;

  return (
    <div className="bg-zinc-900 border-t border-zinc-800 p-4 md:p-6 flex items-center justify-between sticky bottom-0 z-50 shadow-2xl">
      <div className="flex items-center gap-4">
        <Visualizer volume={volume} isActive={isConnected} />
        <div className="flex flex-col">
          <span className={`text-sm font-semibold tracking-wider uppercase ${
            isConnected ? 'text-green-500' : 
            isConnecting ? 'text-yellow-500' : 
            isError ? 'text-red-500' : 'text-zinc-500'
          }`}>
            {state === ConnectionState.CONNECTED ? 'Live Translation' : 
             state === ConnectionState.CONNECTING ? 'Connecting...' :
             state === ConnectionState.ERROR ? 'Connection Error' : 'Ready'}
          </span>
          <span className="text-xs text-zinc-500 hidden md:inline">
            Gemini 2.5 Live • Vietnamese → English
          </span>
        </div>
      </div>

      <button
        onClick={onToggle}
        disabled={isConnecting}
        className={`
          flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all transform hover:scale-105 active:scale-95
          ${isConnected 
            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50' 
            : 'bg-yellow-400 text-black hover:bg-yellow-300 shadow-lg shadow-yellow-400/20'}
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        `}
      >
        {isConnecting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isConnected ? (
          <>
            <MicOff className="w-5 h-5" />
            <span>Stop</span>
          </>
        ) : (
          <>
            <Mic className="w-5 h-5" />
            <span>Start Listening</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ControlBar;
