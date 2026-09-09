import React,{useEffect,useRef} from 'react';
import type { UserStats } from '../types';
import { useModalFocus } from '../hooks/useModalFocus';
import { LeaderboardPanel } from './LeaderboardPanel';
export const OverallLeaderboardModal:React.FC<{stats:UserStats;onClose:()=>void}>=({stats,onClose})=>{
 const ref=useRef<HTMLDivElement>(null);useModalFocus(ref);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 return <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Overall leaderboards" className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 outline-none">
  <div className="w-full max-w-3xl max-h-[92dvh] rounded-2xl border border-zinc-700 bg-[#0A0A0B] shadow-2xl flex flex-col overflow-hidden">
   <header className="flex items-center justify-between gap-3 p-4 border-b border-zinc-700"><h2 className="text-lg font-bold text-white">Arcade leaderboards</h2><button type="button" className="lb-button" aria-label="Close leaderboards" onClick={onClose}>Close</button></header>
   <div className="min-h-0 overflow-y-auto p-3 sm:p-5"><LeaderboardPanel stats={stats}/></div>
  </div>
 </div>;
};
