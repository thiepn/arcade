/** Test-only component boundary. Not a production entrypoint or gameplay bot. */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameShell } from '../src/components/GameShell';
import { GAMES_REGISTRY } from '../src/data/games';
import { getStoredStats, recordScore } from '../src/lib/storage';
import type { GameComponentProps } from '../src/types';
import '../src/index.css';
const bridge: any = (window as any).scoreFixture = { saved: [] };
function Engine(props: GameComponentProps) {
  useEffect(()=>{
    bridge.emit=props.onScoreUpdate;bridge.finish=props.onGameOver;bridge.mode=props.onModeChange;
  },[props.onScoreUpdate,props.onGameOver,props.onModeChange]);
  return <div data-test-engine>Controlled engine input — integration fixture</div>;
}
const LazyEngine = React.lazy(async () => ({ default: Engine }));
function Harness(){
 const [id,setId]=useState('stack');const [stats,setStats]=useState(getStoredStats);
 useEffect(()=>{bridge.select=setId;},[]);
 const game={...GAMES_REGISTRY.find(g=>g.id===id)!,component:LazyEngine};
 return <div data-fixture-game={id} style={{height:'100dvh'}}><GameShell key={id} game={game} bestScore={stats.highScores[id]||0} soundEnabled={false} onToggleSound={()=>{}} hapticsEnabled={false} onBackToArcade={()=>setId('stack')} onPlayNextRandom={()=>setId('orbit')} onSaveScore={(gameId,points,details)=>{bridge.saved.push({gameId,points,details});const result=recordScore(gameId,points,details);setStats(result.stats);return result;}} /></div>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
