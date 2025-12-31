import React, { useEffect, useRef, useState } from 'react';
import { detectSensitiveContent, loadModel } from '../services/geminiService'; // Keeping filename but using new logic
import { DetectionResult, ProcessingStats } from '../types';

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
  const resultRef = useRef<DetectionResult | null>(null);
  const lastProcessedTimeRef = useRef<number>(0);
  const [modelReady, setModelReady] = useState(false);

  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });

  // Init Model
  useEffect(() => {
    loadModel().then(() => setModelReady(true));
  }, []);

  // Handle stream attachment
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Main Processing Loop (AI Detection)
  useEffect(() => {
    let isMounted = true;
    let animationFrameId: number;
    
    const processFrame = async () => {
      if (!isMounted || !isActive || !videoRef.current || !modelReady) {
        if (isMounted && isActive) {
             animationFrameId = requestAnimationFrame(processFrame);
        }
        return;
      }

      const now = Date.now();
      // Client-side can run faster than API calls. 
      // Running at ~5-10 FPS is usually sufficient for safety without killing CPU.
      if (now - lastProcessedTimeRef.current > 200 && !processingRef.current) {
        // Ensure video is playing and has data
        if (videoRef.current.readyState === 4) {
            processingRef.current = true;
            
            try {
              const startTime = performance.now();
              // Pass video element directly to TFJS
              const result = await detectSensitiveContent(videoRef.current);
              const endTime = performance.now();
              
              if (isMounted) {
                resultRef.current = result;
                if (onStatsUpdate) {
                  // Get probability of the top category for stats display
                  const topProb = result.predictions[0]?.probability || 0;
                  
                  onStatsUpdate({
                    fps: Math.round(1000 / (endTime - startTime)),
                    latencyMs: Math.round(endTime - startTime),
                    detectionsCount: result.isSafe ? 0 : Math.round(topProb * 100)
                  });
                }
              }
            } catch (err) {
              console.error("Frame processing error", err);
            } finally {
              processingRef.current = false;
              lastProcessedTimeRef.current = Date.now();
            }
        }
      }

      if (isActive) {
        animationFrameId = requestAnimationFrame(processFrame);
      }
    };

    if (isActive && modelReady) {
      processFrame();
    } else {
      resultRef.current = null;
    }

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, modelReady, onStatsUpdate]);


  // Rendering Loop (Drawing the Mask)
  useEffect(() => {
    let animationFrameId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const result = resultRef.current;

      if (canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // Clear previous drawings
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Apply mirroring to the canvas context so any text/rects we draw match video orientation
          ctx.save();
          if (isMirrored) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }

          if (isActive && result && !result.isSafe) {
              // Full frame blocking for client-side classification
              const w = canvas.width;
              const h = canvas.height;

              // 1. Heavy Blur Backdrop (simulated with semi-transparent fill because real blur is expensive in canvas)
              ctx.fillStyle = 'rgba(20, 20, 20, 0.98)';
              ctx.fillRect(0, 0, w, h);

              // 2. Warning visual (needs to be un-mirrored to be readable if we are mirrored)
              ctx.restore(); // Restore context to normal for text
              ctx.save();
              
              // Draw centered warning
              const centerX = w / 2;
              const centerY = h / 2;

              ctx.shadowColor = 'rgba(0,0,0,0.5)';
              ctx.shadowBlur = 10;

              // Icon
              ctx.fillStyle = '#ef4444'; // Red
              ctx.beginPath();
              ctx.arc(centerX, centerY - 20, 30, 0, 2 * Math.PI);
              ctx.fill();

              // Cross line
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(centerX - 15, centerY - 20);
              ctx.lineTo(centerX + 15, centerY - 20);
              ctx.stroke();

              ctx.font = 'bold 24px sans-serif';
              ctx.fillStyle = '#f87171';
              ctx.textAlign = 'center';
              ctx.fillText('SENSITIVE CONTENT', centerX, centerY + 30);
              
              ctx.font = '16px sans-serif';
              ctx.fillStyle = '#9ca3af';
              ctx.fillText(`Category: ${result.primaryCategory}`, centerX, centerY + 55);
          }

          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(renderOverlay);
    };

    renderOverlay();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, isMirrored]);


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
        muted // Muted locally, audio stream is handled by WebRTC
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
         <div className={`w-2 h-2 rounded-full ${isActive && modelReady ? 'bg-green-500 animate-pulse' : !modelReady ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
         {isActive ? (modelReady ? 'TFJS SHIELD ACTIVE' : 'LOADING MODEL...') : 'SHIELD PAUSED'}
      </div>
    </div>
  );
};