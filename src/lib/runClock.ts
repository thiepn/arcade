/** Captures completion before asynchronous network work. Pauses and background time are excluded. */
export class RunClock {
 readonly startedAt:number;private activeSince:number|null=null;private accumulated=0;private finished:{durationMs:number;activeMs:number}|null=null;
 constructor(private now:()=>number=()=>performance.now()){this.startedAt=now();}
 setActive(active:boolean):void{
  if(this.finished)return;
  const now=this.now();if(this.activeSince!==null){this.accumulated+=Math.max(0,now-this.activeSince);this.activeSince=null;}
  if(active)this.activeSince=now;
 }
 finish():{durationMs:number;activeMs:number}{
  if(this.finished)return this.finished;this.setActive(false);
  const durationMs=Math.max(0,Math.floor(this.now()-this.startedAt));
  return this.finished={durationMs,activeMs:Math.min(durationMs,Math.max(0,Math.floor(this.accumulated)))};
 }
}
