import React from 'react';
import { WebRTCContainer } from './components/WebRTCContainer';

const App: React.FC = () => {
  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="flex-none p-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur z-10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.745 3.745 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">SafeStream <span className="text-indigo-400 font-light">AI Shield</span></h1>
        </div>
        <div className="text-xs text-gray-500 hidden sm:block">
          Powered by Gemini 2.5 Flash • Real-time Privacy Protection
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <WebRTCContainer />
      </main>
    </div>
  );
};

export default App;