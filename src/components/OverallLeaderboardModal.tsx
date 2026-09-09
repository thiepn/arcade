import React,{useEffect,useRef} from 'react';
import { Trophy, X, Sparkles } from 'lucide-react';
import type { UserStats } from '../types';
import { useModalFocus } from '../hooks/useModalFocus';
import { LeaderboardPanel } from './LeaderboardPanel';

export const OverallLeaderboardModal:React.FC<{stats:UserStats;onClose:()=>void}>=({stats,onClose})=>{
 const dialogRef=useRef<HTMLDivElement>(null);useModalFocus(dialogRef);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 return <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Overall leaderboards" className="lb-modal-backdrop">
  <div className="lb-modal-shell">
   <header className="lb-modal-header">
    <div className="lb-modal-title-group">
     <div className="lb-modal-icon"><Trophy aria-hidden="true"/></div>
     <div className="lb-modal-heading-copy">
      <div className="lb-modal-kicker"><Sparkles aria-hidden="true"/> LIVE ARCADE CIRCUIT</div>
      <h2>ARCADE LEADERBOARDS</h2>
      <p>Normalized Arcade Points · global, weekly and per-game rankings</p>
     </div>
    </div>
    <button type="button" className="lb-icon-button" aria-label="Close leaderboards" onClick={onClose}><X aria-hidden="true"/></button>
   </header>
   <div className="lb-modal-body"><LeaderboardPanel stats={stats}/></div>
  </div>
 </div>;
};
