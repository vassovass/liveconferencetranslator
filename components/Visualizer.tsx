/**
 * Visualizer Component
 *
 * Audio volume visualizer with:
 * - Smooth volume transitions
 * - Canvas-based animation
 * - Mobile-responsive sizing
 * - Accessibility considerations
 */

import React, { useEffect, useRef, memo } from 'react';
import { cn } from './ui';

interface VisualizerProps {
  volume: number; // 0 to 1
  isActive: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { canvas: 64, container: 'w-8 h-8' },
  md: { canvas: 100, container: 'w-12 h-12 md:w-16 md:h-16' },
  lg: { canvas: 128, container: 'w-16 h-16 md:w-20 md:h-20' },
};

const Visualizer: React.FC<VisualizerProps> = memo(({
  volume,
  isActive,
  size = 'md',
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentVolRef = useRef(0);
  const animationIdRef = useRef<number>();

  const { canvas: canvasSize, container: containerClass } = sizeMap[size];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Smooth volume interpolation
      currentVolRef.current += (volume - currentVolRef.current) * 0.2;
      const currentVol = currentVolRef.current;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) * 0.9;
      const baseRadius = maxRadius * 0.3;

      if (!isActive) {
        // Inactive state: flat line
        ctx.beginPath();
        ctx.moveTo(centerX - maxRadius, centerY);
        ctx.lineTo(centerX + maxRadius, centerY);
        ctx.strokeStyle = '#3f3f46'; // zinc-700
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      // Active state: dynamic circle
      const dynamicRadius = baseRadius + currentVol * (maxRadius - baseRadius);

      // Outer ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, dynamicRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.3 + currentVol * 0.7})`; // yellow-400
      ctx.lineWidth = 3 + currentVol * 5;
      ctx.stroke();

      // Inner fill
      ctx.beginPath();
      ctx.arc(centerX, centerY, dynamicRadius * 0.8, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(250, 204, 21, ${0.1 + currentVol * 0.2})`;
      ctx.fill();

      // Center dot when active
      if (currentVol > 0.01) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.5, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(250, 204, 21, ${0.5 + currentVol * 0.5})`;
        ctx.fill();
      }

      animationIdRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [volume, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      className={cn(containerClass, className)}
      role="img"
      aria-label={isActive ? `Audio volume: ${Math.round(volume * 100)}%` : 'Audio inactive'}
    />
  );
});

Visualizer.displayName = 'Visualizer';

export default Visualizer;
