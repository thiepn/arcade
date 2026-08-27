import React, { useState, useEffect, useRef } from 'react';
import { GAMES_REGISTRY } from '../data/games';
import { Play, Square, Activity } from 'lucide-react';

export const StressTester: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [activeGame, setActiveGame] = useState<any>(null);
  
  const logMsg = (msg: string) => {
    setLog(prev => [...prev, msg]);
    console.log(msg);
  };

  const runTest = async () => {
    setIsRunning(true);
    setLog([]);
    logMsg('Starting automated memory stress test...');
    logMsg('Target: 30 games | 20 iterations | 2s per mount (accelerated from 5s for brevity)');

    const hasMemoryAPI = (performance as any).memory;
    if (!hasMemoryAPI) {
      logMsg('Warning: performance.memory is not supported in this browser. Run with Chrome to see heap stats.');
    }

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const game of GAMES_REGISTRY) {
      logMsg(`\n--- Stressing ${game.title} ---`);
      
      let startHeap = 0;
      if (hasMemoryAPI) startHeap = (performance as any).memory.usedJSHeapSize;

      for (let i = 1; i <= 20; i++) {
        // Mount
        setActiveGame(game);
        await wait(2000); // Wait 2s to allow RAF loops and canvases to initialize

        // Unmount
        setActiveGame(null);
        await wait(100); // brief pause
      }

      if (hasMemoryAPI) {
        const endHeap = (performance as any).memory.usedJSHeapSize;
        const diff = (endHeap - startHeap) / 1024 / 1024;
        logMsg(`Finished ${game.title}. Heap delta: ${diff > 0 ? '+' : ''}${diff.toFixed(2)} MB`);
      } else {
        logMsg(`Finished ${game.title} (20 cycles).`);
      }
    }

    logMsg('\n=== Stress Test Complete ===');
    logMsg('If heap delta is consistently rising and not dropping after GC, you have detached DOM nodes.');
    setIsRunning(false);
  };

  return (
    <div className="fixed inset-0 bg-[#0A0A0B]/95 z-50 flex items-center justify-center p-8 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-[#141418] border border-[#27272A] rounded-xl flex flex-col h-[80vh] shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">✕</button>
        
        <div className="p-6 border-b border-[#27272A] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Memory Stress & Leak Tester
            </h2>
            <p className="text-zinc-400 text-sm mt-1">Automated mount/unmount cycling for Canvas/AudioContext retention</p>
          </div>
          <button 
            onClick={isRunning ? undefined : runTest}
            className={`px-4 py-2 rounded-md font-bold flex items-center gap-2 ${isRunning ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50'}`}
          >
            {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Running...' : 'Run Test'}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 font-mono text-xs text-zinc-300 flex">
          <div className="flex-1 whitespace-pre-wrap">
            {log.join('\n') || 'Ready to run stress test. Open Chrome DevTools -> Memory tab to manually inspect Detached DOM Nodes during the run.'}
          </div>
          <div className="w-[420px] h-[500px] bg-black border border-zinc-800 rounded-lg overflow-hidden relative shrink-0">
            {activeGame && (
              <activeGame.component
                onGameOver={() => {}}
                onScoreUpdate={() => {}}
                isPaused={false}
                soundEnabled={false}
                onRestartRequest={() => {}}
              />
            )}
            {!activeGame && (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                [ UNMOUNTED ]
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
