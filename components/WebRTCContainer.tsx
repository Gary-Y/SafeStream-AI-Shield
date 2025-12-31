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
  // Ref to always access current localStream in callbacks (避免闭包陷阱)
  const localStreamRef = useRef<MediaStream | null>(null);

  // Separate stats for local and remote for debugging
  const [localStats, setLocalStats] = useState<ProcessingStats>({ fps: 0, latencyMs: 0, detectionsCount: 0 });
  const [remoteStats, setRemoteStats] = useState<ProcessingStats>({ fps: 0, latencyMs: 0, detectionsCount: 0 });
  
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // 同步 localStream 到 ref，确保回调中总能访问最新值
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Initialize PeerJS on mount (仅初始化一次，不依赖 localStream)
  useEffect(() => {
    const initPeer = async () => {
      try {
        const peer = new Peer();

        peer.on('open', (id) => {
          console.log('My peer ID is: ' + id);
          setMyPeerId(id);
        });

        peer.on('call', (call) => {
          // 使用 ref 获取当前流，避免闭包陷阱
          const currentStream = localStreamRef.current;
          if (currentStream) {
            console.log("Answering incoming call with existing stream...");
            call.answer(currentStream);
            setupCallEventHandlers(call);
          } else {
            console.log("No local stream, requesting camera access...");
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
              .then((stream) => {
                setLocalStream(stream);
                localStreamRef.current = stream;
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
  }, []); // 空依赖数组：仅在组件挂载时初始化一次

  const setupCallEventHandlers = (call: MediaConnection) => {
    setCallStatus(CallStatus.CONNECTED);
    connectionRef.current = call;

    call.on('stream', (remoteStream) => {
      console.log("Received remote stream");
      setRemoteStream(remoteStream);
    });

    call.on('close', () => {
      console.log("Call closed");
      endCall(false);
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
    if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
    }

    if (stopCamera && localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    
    if (stopCamera) {
        setCallStatus(CallStatus.ENDED);
        setTimeout(() => setCallStatus(CallStatus.IDLE), 2000);
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

  const isCameraOn = !!localStream;
  const isInCall = !!remoteStream;

  return (
    <div className="h-full flex flex-col p-2 md:p-4 gap-3 max-w-6xl mx-auto w-full">
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col md:flex-row gap-3 min-h-0 ${isInCall ? '' : 'overflow-y-auto'}`}>
        
        {/* Local User Wrapper */}
        <div className={`relative flex flex-col gap-1 md:gap-2 transition-all duration-300 ${isInCall ? 'flex-1 h-1/2 md:h-auto' : 'flex-none h-[45vh] md:h-full md:flex-1'}`}>
           <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow">
             You
           </div>
           <div className="flex-1 bg-black rounded-lg overflow-hidden border border-gray-800 relative w-full h-full shadow-lg">
             {localStream ? (
                 <VideoProcessor 
                    stream={localStream} 
                    isActive={isAiEnabled}
                    onStatsUpdate={setLocalStats}
                    isMirrored={true}
                 />
             ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900/40">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-2 opacity-50">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                     </svg>
                     <p className="text-sm">Camera Off</p>
                 </div>
             )}
             
             {/* Local Stats Overlay */}
             {isCameraOn && isAiEnabled && (
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] md:text-xs text-gray-300 font-mono flex gap-3 pointer-events-none">
                    <span>FPS: <span className="text-white">{localStats.fps}</span></span>
                    <span>AI: <span className={localStats.detectionsCount > 0 ? "text-red-400 font-bold" : "text-emerald-400"}>{localStats.detectionsCount > 0 ? 'DETECTED' : 'SAFE'}</span></span>
                </div>
             )}
           </div>
        </div>

        {/* Remote User Wrapper */}
        <div className={`relative flex flex-col gap-1 md:gap-2 transition-all duration-300 ${isInCall ? 'flex-1 h-1/2 md:h-auto' : 'flex-none md:flex-1'}`}>
          {remoteStream && (
             <div className="absolute top-2 left-2 z-10 bg-gray-600 text-white text-[10px] md:text-xs px-2 py-0.5 rounded shadow">
               Remote
             </div>
           )}
           
           <div className={`rounded-lg overflow-hidden border border-gray-700 bg-gray-800 relative w-full ${isInCall ? 'h-full' : 'min-h-[300px] flex items-center justify-center'}`}>
              {remoteStream ? (
                <>
                  <VideoProcessor 
                    stream={remoteStream} 
                    isActive={isAiEnabled}
                    onStatsUpdate={setRemoteStats}
                    isMirrored={false} 
                  />
                  {/* Remote Stats Overlay */}
                  {isAiEnabled && (
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] md:text-xs text-gray-300 font-mono flex gap-3 pointer-events-none">
                        <span>FPS: <span className="text-white">{remoteStats.fps}</span></span>
                        <span>AI: <span className={remoteStats.detectionsCount > 0 ? "text-red-400 font-bold" : "text-emerald-400"}>{remoteStats.detectionsCount > 0 ? 'DETECTED' : 'SAFE'}</span></span>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full p-4 flex flex-col items-center justify-center text-center">
                    {isCameraOn ? (
                       <div className="flex flex-col items-center w-full max-w-sm gap-4 md:gap-6 animate-in fade-in duration-500">
                           {/* Step 1: My ID */}
                           <div className="w-full bg-gray-900/50 p-3 md:p-4 rounded-xl border border-gray-700/50">
                               <label className="text-[10px] md:text-xs text-gray-400 uppercase font-bold tracking-wider mb-2 block">1. Share Your ID</label>
                               <div className="flex gap-2">
                                   <div className="flex-1 bg-black/40 p-2 md:p-3 rounded font-mono text-xs md:text-sm text-indigo-300 truncate border border-gray-700/50 select-all">
                                       {myPeerId || 'Generating...'}
                                   </div>
                                   <button 
                                     onClick={copyToClipboard}
                                     className="bg-gray-700 hover:bg-gray-600 px-3 md:px-4 rounded text-white transition-colors flex items-center justify-center"
                                     title="Copy to clipboard"
                                   >
                                       {copySuccess ? (
                                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 md:w-5 md:h-5 text-green-400">
                                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                       ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 md:w-5 md:h-5">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                            </svg>
                                       )}
                                   </button>
                               </div>
                           </div>
                           
                           <div className="w-full flex items-center justify-center relative my-1">
                               <span className="text-[10px] text-gray-500 font-bold bg-gray-800 px-2 z-10">OR</span>
                               <div className="absolute w-1/2 border-t border-gray-700 z-0"></div>
                           </div>

                           {/* Step 2: Connect */}
                           <div className="w-full bg-gray-900/50 p-3 md:p-4 rounded-xl border border-gray-700/50">
                               <label className="text-[10px] md:text-xs text-gray-400 uppercase font-bold tracking-wider mb-2 block">2. Connect to Partner</label>
                               <div className="flex gap-2">
                                   <input 
                                     type="text" 
                                     placeholder="Partner's ID"
                                     value={remotePeerIdInput}
                                     onChange={(e) => setRemotePeerIdInput(e.target.value)}
                                     className="flex-1 bg-black/40 text-white px-3 py-2 rounded border border-gray-600 focus:border-indigo-500 focus:outline-none text-xs md:text-sm font-mono min-w-0"
                                   />
                                   <button 
                                      onClick={initiateCall}
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 md:px-4 py-2 rounded font-medium text-xs md:text-sm transition-colors whitespace-nowrap shadow-lg shadow-indigo-500/20"
                                   >
                                      Connect
                                   </button>
                               </div>
                           </div>
                       </div>
                    ) : (
                       <div className="text-center p-4">
                           <div className="w-16 h-16 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                              </svg>
                           </div>
                           <p className="text-gray-400 text-sm">Start your camera to<br/>enable connections</p>
                       </div>
                    )}
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex-none bg-gray-800/90 backdrop-blur rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xl border border-gray-700 z-30">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
           {!isCameraOn ? (
              <button 
                onClick={startLocalCamera}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 md:py-2.5 rounded-lg font-semibold transition-all shadow-lg hover:shadow-green-500/20 active:scale-95 text-sm md:text-base"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
                </svg>
                Start Camera
              </button>
           ) : (
              <button 
                onClick={() => endCall(true)}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 md:py-2.5 rounded-lg font-semibold transition-all shadow-lg hover:shadow-red-500/20 active:scale-95 text-sm md:text-base"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 5.25V4.5z" clipRule="evenodd" />
                </svg>
                {isInCall ? "Hang Up" : "Stop Camera"}
              </button>
           )}
           
           {error && <span className="text-red-400 text-xs md:text-sm font-medium animate-pulse text-center">{error}</span>}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end bg-gray-900/50 p-2 md:p-0 rounded-lg md:bg-transparent">
           <span className={`text-xs md:text-sm font-medium ${isAiEnabled ? 'text-indigo-400' : 'text-gray-500'}`}>
              Content Shield
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
  );
};