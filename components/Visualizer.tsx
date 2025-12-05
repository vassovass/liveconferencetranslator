import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  volume: number; // 0 to 1
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    // Smooth volume transition
    let currentVol = 0;

    const draw = () => {
      // Interpolate volume for smoothness
      currentVol += (volume - currentVol) * 0.2;
      
      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (!isActive) {
        // Draw a flat line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = '#3f3f46'; // zinc-700
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      // Draw wave
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) * 0.9;
      const baseRadius = maxRadius * 0.3;
      
      // Dynamic circle visualizer
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + (currentVol * (maxRadius - baseRadius)), 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.3 + currentVol * 0.7})`; // yellow-400
      ctx.lineWidth = 3 + currentVol * 5;
      ctx.stroke();
      
      // Inner fill
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + (currentVol * (maxRadius - baseRadius) * 0.8), 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(250, 204, 21, ${0.1 + currentVol * 0.2})`;
      ctx.fill();

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [volume, isActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={100} 
      height={100} 
      className="w-12 h-12 md:w-16 md:h-16"
    />
  );
};

export default Visualizer;
