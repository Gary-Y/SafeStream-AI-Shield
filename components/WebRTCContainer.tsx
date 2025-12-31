import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoProcessor } from './VideoProcessor';
import { CallStatus, ProcessingStats } from '../types';
import Peer, { MediaConnection } from 'peerjs';

export const WebRTCContainer: React.FC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.IDLE);
  const [isAiEnabled, setIsAiEnabled] = useState<boolean>(true);
  
  // PeerJS State
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [remotePeerIdInput, setRemotePeerIdInput] = useState<string>('');
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<MediaConnection | null>(null);

  // Separate stats for local and remote for debugging
  const [localStats, setLocalStats] = useState<ProcessingStats>({ fps: 0, latencyMs: 0, detectionsCount: 0 });
  const [remoteStats, setRemoteStats] = useState<ProcessingStats>({ fps: 0, latencyMs: 0, detectionsCount: 0 });
  
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Initialize PeerJS on mount
  useEffect(() => {
    const initPeer = async () => {
      try {
        // Create a new Peer instance. We let PeerJS server assign an ID.
        const peer = new Peer();
        
        peer.on('open', (id) => {
          console.log('My peer ID is: ' + id);
          setMyPeerId(id);
        });

        peer.on('call', (call) => {
          // Answer incoming call automatically if we are ready, 
          // or prompt user. For this demo, we answer if we have a local stream.
          // Note: In a real app, you'd show an "Answer" button.
          
          if (localStream) {
             console.log("Answering incoming call...");
             call.answer(localStream); // Answer the call with our A/V stream.
             setupCallEventHandlers(call);
          } else {
             // If we don't have camera yet, we can't answer with video instantly.
             // We could answer audio-only or ask user to start camera.
             // For simplicity, we auto-start camera then answer.
             navigator.mediaDevices.getUserMedia({ video: true, audio: true })
               .then((stream) => {
                  setLocalStream(stream);
                  setCallStatus(CallStatus.CONNECTED);
                  call.answer(stream);
                  setupCallEventHandlers(call);
               })
               .catch(err => setError("Could not access camera to answer call."));
          }
        });

        peer.on('error', (err) => {
          console.error("PeerJS error:", err);
          setError(`Connection error: ${err.type}`);
        });

        peerRef.current = peer;
      } catch (e) {
        console.error("Failed to initialize PeerJS", e);
      }
    };

    initPeer();

    return () => {
      peerRef.current?.destroy();
    };
  }, [localStream]); // Re-bind if localStream changes? No, Peer init is once.

  const setupCallEventHandlers = (call: MediaConnection) => {
    setCallStatus(CallStatus.CONNECTED);
    connectionRef.current = call;

    call.on('stream', (remoteStream) => {
      console.log("Received remote stream");
      setRemoteStream(remoteStream);
    });

    call.on('close', () => {
      console.log("Call closed");
      endCall(false); // Don't stop local camera
    });
    
    call.on('error', (err) => {
        console.error("Call error", err);
        setError("Call connection lost.");
        endCall(false);
    });
  };

  const startLocalCamera = async () => {
    try {
      setCallStatus(CallStatus.CONNECTING);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: true 
      });
      setLocalStream(stream);
      // We don't set CONNECTED yet, we wait for P2P connection or stay in "Ready" state
      // But for UI simplicity, let's say IDLE -> READY (Camera On) -> CONNECTED (Call active)
      // We'll reuse CONNECTED for "Camera On" in this simple state model, 
      // but distinguishing "In Call" vs "Camera Ready" is better.
      // Let's stick to: CONNECTED = Camera On. 
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setError("Could not access camera/microphone. Please check permissions.");
      setCallStatus(CallStatus.IDLE);
    }
  };

  const initiateCall = () => {
    if (!remotePeerIdInput) {
      setError("Please enter a Partner ID to call.");
      return;
    }
    if (!peerRef.current || !localStream) {
       setError("Camera must be on to start a call.");
       return;
    }

    console.log(`Calling peer: ${remotePeerIdInput}`);
    const call = peerRef.current.call(remotePeerIdInput, localStream);
    setupCallEventHandlers(call);
  };

  const endCall = useCallback((stopCamera = true) => {
    // Close P2P
    if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
    }

    if (stopCamera && localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    
    // Only go to IDLE if we stopped camera, otherwise we are ready for next call
    if (stopCamera) {
        setCallStatus(CallStatus.ENDED);
        setTimeout(() => setCallStatus(CallStatus.IDLE), 2000);
    } else {
        // Just reset remote
    }
  }, [localStream]);

  const toggleAi = () => {
    setIsAiEnabled(prev => !prev);
  };
  
  const copyToClipboard = () => {
      if (myPeerId) {
          navigator.clipboard.writeText(myPeerId);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
      }
  };

  // Determine UI state
  const isCameraOn = !!localStream;
  const isInCall = !!remoteStream;

  return (
    <div className="h-full flex flex-col p-4 gap-4 max-w-6xl mx-auto">
      
      {/* Main Video Area */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        
        {/* Local User (Self View with AI) */}
        <div className="relative flex flex-col gap-2 h-full">
           <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded shadow">
             You (Local)
           </div>
           <div className="flex-1 h-full min-h-[300px] bg-black rounded-lg overflow-hidden border border-gray-800">
             {localStream ? (
                 <VideoProcessor 
                    stream={localStream} 
                    isActive={isAiEnabled}
                    onStatsUpdate={setLocalStats}
                    isMirrored={true}
                 />
             ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                     <p>Camera is off</p>
                 </div>
             )}
           </div>
           
           {/* Stats Overlay */}
           {isCameraOn && isAiEnabled && (
             <div className="bg-gray-800 p-2 rounded text-xs text-gray-400 flex justify-between font-mono">
                <span>FPS: <span className="text-white">{localStats.fps}</span></span>
                <span>Found: <span className={localStats.detectionsCount > 0 ? "text-red-400 font-bold" : "text-white"}>{localStats.detectionsCount}</span></span>
             </div>
           )}
        </div>

        {/* Remote User (Incoming) */}
        <div className="relative flex flex-col gap-2 h-full">
          <div className="absolute top-2 left-2 z-10 bg-gray-600 text-white text-xs px-2 py-0.5 rounded shadow">
             {remoteStream ? 'Remote User (Live)' : 'Remote User'}
           </div>
           
           <div className="flex-1 rounded-lg overflow-hidden h-full min-h-[300px] border border-gray-700 bg-gray-800 relative">
              {remoteStream ? (
                <VideoProcessor 
                  stream={remoteStream} 
                  isActive={isAiEnabled}
                  onStatsUpdate={setRemoteStats}
                  isMirrored={false} 
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400 bg-gray-900/50">
                    {isCameraOn ? (
                       <div className="flex flex-col items-center w-full max-w-md gap-6">
                           {/* Step 1: My ID */}
                           <div className="w-full bg-gray-800 p-4 rounded-xl border border-gray-700">
                               <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2 block">1. Share Your ID</label>
                               <div className="flex gap-2">
                                   <code className="flex-1 bg-black/50 p-3 rounded font-mono text-sm text-indigo-300 truncate border border-gray-700">
                                       {myPeerId || 'Generating ID...'}
                                   </code>
                                   <button 
                                     onClick={copyToClipboard}
                                     className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-white transition-colors relative"
                                     title="Copy to clipboard"
                                   >
                                       {copySuccess ? (
                                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-400">
                                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                       ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                            </svg>
                                       )}
                                   </button>
                               </div>
                           </div>
                           
                           <div className="w-full flex items-center justify-center">
                               <span className="text-xs text-gray-500 font-bold bg-gray-900 px-2 z-10">OR</span>
                               <div className="absolute w-1/2 border-t border-gray-700 -z-0"></div>
                           </div>

                           {/* Step 2: Connect */}
                           <div className="w-full bg-gray-800 p-4 rounded-xl border border-gray-700">
                               <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2 block">2. Connect to Partner</label>
                               <div className="flex gap-2">
                                   <input 
                                     type="text" 
                                     placeholder="Paste partner's ID here..."
                                     value={remotePeerIdInput}
                                     onChange={(e) => setRemotePeerIdInput(e.target.value)}
                                     className="flex-1 bg-black/50 text-white px-3 py-2 rounded border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm font-mono"
                                   />
                                   <button 
                                      onClick={initiateCall}
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-medium text-sm transition-colors whitespace-nowrap"
                                   >
                                      Connect
                                   </button>
                               </div>
                           </div>
                       </div>
                    ) : (
                       <div className="text-center">
                           <p className="mb-2">Start your camera to enable calling</p>
                       </div>
                    )}
                </div>
              )}
           </div>

           {/* Remote Stats */}
           {remoteStream && isAiEnabled && (
             <div className="bg-gray-800 p-2 rounded text-xs text-gray-400 flex justify-between font-mono">
                <span>FPS: <span className="text-white">{remoteStats.fps}</span></span>
                <span>Found: <span className={remoteStats.detectionsCount > 0 ? "text-red-400 font-bold" : "text-white"}>{remoteStats.detectionsCount}</span></span>
             </div>
           )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex-none bg-gray-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border border-gray-700">
        <div className="flex items-center gap-4 w-full sm:w-auto">
           {!isCameraOn ? (
              <button 
                onClick={startLocalCamera}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-green-500/20 active:scale-95 w-full sm:w-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
                </svg>
                Start Camera
              </button>
           ) : (
              <button 
                onClick={() => endCall(true)}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-red-500/20 active:scale-95 w-full sm:w-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 5.25V4.5z" clipRule="evenodd" />
                </svg>
                {isInCall ? "Hang Up" : "Stop Camera"}
              </button>
           )}
           
           {error && <span className="text-red-400 text-sm font-medium animate-pulse">{error}</span>}
        </div>

        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${isAiEnabled ? 'text-indigo-400' : 'text-gray-500'}`}>
                Sensitive Content Shield
              </span>
              <button 
                onClick={toggleAi}
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none 
                  ${isAiEnabled ? 'bg-indigo-600' : 'bg-gray-700'}
                `}
              >
                <span className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                  ${isAiEnabled ? 'translate-x-5' : 'translate-x-0'}
                `} />
              </button>
           </div>
        </div>
      </div>
      
      <div className="text-center text-gray-500 text-xs pb-2">
         Secure P2P Connection established via PeerJS. <br/>
         Video frames are analyzed by <b>Gemini 2.5 Flash</b> for real-time privacy protection.
      </div>
    </div>
  );
};