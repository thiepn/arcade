import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function sha256(value){
  return createHash('sha256').update(value).digest('hex');
}

export function buildControlPlaneManifest(root,paths){
  const files=[...paths].sort().map(path=>{
    const absolute=join(root,path);
    if(!existsSync(absolute)) return {path,exists:false,sha256:null,size:null};
    const content=readFileSync(absolute);
    return {path,exists:true,sha256:sha256(content),size:content.byteLength};
  });
  const missing=files.filter(file=>!file.exists).map(file=>file.path);
  const canonical=files.map(file=>[file.path,file.exists,file.sha256,file.size].join('|')).join('\n');
  return {
    algorithm:'sha256',
    fingerprint:sha256(canonical),
    files,
    missing,
  };
}

export function diffControlPlaneManifests(expected,current){
  const before=new Map((expected?.files||[]).map(file=>[file.path,file]));
  const after=new Map((current?.files||[]).map(file=>[file.path,file]));
  const paths=[...new Set([...before.keys(),...after.keys()])].sort();
  return paths.flatMap(path=>{
    const a=before.get(path)||null;
    const b=after.get(path)||null;
    if(a?.exists===b?.exists&&a?.sha256===b?.sha256&&a?.size===b?.size)return [];
    return [{path,before:a,after:b}];
  });
}

export function checkpointChain(checkpoints,expectedFingerprint){
  const ordered=[...(checkpoints||[])].sort((a,b)=>{
    const day=String(a.day).localeCompare(String(b.day));
    if(day!==0)return day;
    return String(a.createdAt||'').localeCompare(String(b.createdAt||''));
  });
  let previous='GENESIS';
  const links=ordered.map(item=>{
    const payload=[
      previous,
      item.epochId||'',
      item.day||'',
      item.createdAt||'',
      item.controlPlaneFingerprint||'',
      item.p33RunId||'',
      item.p34RunId||'',
    ].join('|');
    const hash=sha256(payload);
    const link={...item,previousHash:previous,hash,fingerprintMatches:item.controlPlaneFingerprint===expectedFingerprint};
    previous=hash;
    return link;
  });
  return {
    algorithm:'sha256',
    count:links.length,
    head:links.length?links[links.length-1].hash:'GENESIS',
    valid:links.every(link=>link.fingerprintMatches),
    links,
  };
}
