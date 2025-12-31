import React, { useEffect, useRef, useState, useCallback } from 'react';
import { detectSensitiveContent } from '../services/geminiService';
import { BoundingBox, ProcessingStats } from '../types';

interface VideoProcessorProps {
  stream: MediaStream | null;
  isActive: boolean;
  onStatsUpdate?: (stats: ProcessingStats) => void;
  isMirrored?: boolean;
}

export const VideoProcessor: React.FC<VideoProcessorProps> = ({ 
  stream, 
  isActive, 
  onStatsUpdate,
  isMirrored = true 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processingRef = useRef<boolean>(false);
  const detectionsRef = useRef<BoundingBox[]>([]);
  const lastProcessedTimeRef = useRef<number>(0);

  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });

  // Handle stream attachment
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Main Processing Loop (AI Detection)
  useEffect(() => {
    let isMounted = true;
    
    const processFrame = async () => {
      if (!isMounted || !isActive || !videoRef.current || !canvasRef.current) return;

      const now = Date.now();
      // Rate limit to avoid overwhelming the API and creating too much lag
      // Gemini Flash is fast, but we'll stick to ~2-3 FPS for the detection logic to keep it smooth enough without high cost.
      if (now - lastProcessedTimeRef.current > 400 && !processingRef.current) {
        processingRef.current = true;
        
        try {
          // 1. Capture current frame to a temporary canvas for encoding
          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = videoDimensions.width;
          offscreenCanvas.height = videoDimensions.height;
          const ctx = offscreenCanvas.getContext('2d');
          
          if (ctx) {
            // Draw without mirroring for analysis to ensure coordinates match standard orientation,
            // or mirror if the display is mirrored? 
            // Actually, coordinates from Gemini are normalized. 
            // If we display mirrored, we should probably analyze mirrored or flip coordinates.
            // For simplicity, we send what the user SEES.
            
            ctx.save();
            if (isMirrored) {
                ctx.translate(videoDimensions.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(videoRef.current, 0, 0, videoDimensions.width, videoDimensions.height);
            ctx.restore();

            // Low quality jpeg to speed up upload
            const base64 = offscreenCanvas.toDataURL('image/jpeg', 0.6); 
            
            const startTime = performance.now();
            const result = await detectSensitiveContent(base64);
            const endTime = performance.now();
            
            if (isMounted) {
              detectionsRef.current = result.detections || [];
              if (onStatsUpdate) {
                onStatsUpdate({
                  fps: Math.round(1000 / (endTime - startTime)),
                  latencyMs: Math.round(endTime - startTime),
                  detectionsCount: result.detections.length
                });
              }
            }
          }
        } catch (err) {
          console.error("Frame processing error", err);
        } finally {
          processingRef.current = false;
          lastProcessedTimeRef.current = Date.now();
        }
      }

      // Continue loop
      if (isActive) {
        requestAnimationFrame(processFrame);
      }
    };

    if (isActive) {
      processFrame();
    } else {
        // Clear detections if inactive
        detectionsRef.current = [];
    }

    return () => {
      isMounted = false;
    };
  }, [isActive, videoDimensions, onStatsUpdate, isMirrored]);


  // Rendering Loop (Drawing the Mask)
  useEffect(() => {
    let animationFrameId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && video) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // Clear previous drawings
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (isActive) {
              // Get current detections
              const boxes = detectionsRef.current;

              // Apply blurring/pixelation to detected areas
              if (boxes.length > 0) {
                boxes.forEach(box => {
                  // Convert normalized coordinates to pixel coordinates
                  const y = box.ymin * canvas.height;
                  const x = box.xmin * canvas.width;
                  const h = (box.ymax - box.ymin) * canvas.height;
                  const w = (box.xmax - box.xmin) * canvas.width;

                  ctx.save();
                  
                  // Draw the privacy shield
                  ctx.beginPath();
                  ctx.rect(x, y, w, h);
                  ctx.clip();

                  // 1. Draw a dark background
                  ctx.fillStyle = 'rgba(20, 20, 20, 0.98)';
                  ctx.fillRect(x, y, w, h);

                  // 2. Add a label
                  ctx.font = 'bold 14px sans-serif';
                  ctx.fillStyle = '#f87171'; // Red-400
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText('SENSITIVE CONTENT', x + w/2, y + h/2);
                  ctx.font = '10px sans-serif';
                  ctx.fillStyle = '#9ca3af';
                  ctx.fillText('AI HIDDEN', x + w/2, y + h/2 + 15);

                  ctx.restore();

                  // Draw border
                  ctx.strokeStyle = '#ef4444';
                  ctx.lineWidth = 3;
                  ctx.strokeRect(x, y, w, h);
                });
              }
          }
        }
      }

      animationFrameId = requestAnimationFrame(renderOverlay);
    };

    renderOverlay();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive]);


  const handleMetadataLoaded = () => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
    }
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-800 flex items-center justify-center group">
      {/* Video Element (The Source) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleMetadataLoaded}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }} 
      />

      {/* Canvas Overlay (The Shield) */}
      <canvas
        ref={canvasRef}
        width={videoDimensions.width}
        height={videoDimensions.height}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-20">
          <div className="text-center">
            <div className="animate-pulse rounded-full h-16 w-16 bg-gray-700 mx-auto mb-4 flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
            </div>
            <p className="text-gray-400">No Signal</p>
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-mono border border-gray-700 flex items-center gap-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
         <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
         {isActive ? 'SHIELD ACTIVE' : 'SHIELD PAUSED'}
      </div>
    </div>
  );
};