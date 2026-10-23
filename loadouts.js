import {recentStrength} from './core.js';

export function loadoutName(data,heroId,slot,optionEn){
 return (data.localizedNames||[]).find(n=>n.heroId===heroId&&n.slot===slot&&n.optionEn===optionEn)?.nameZh||optionEn;
}

// Slot decisions stay independent. Unknown, stale and unreviewed observations fail closed.
export function resolveLoadout(data,hero,map,asOf){
 const sources=new Map((data?.sources||[]).map(s=>[s.id,s]));
 const resolve=slot=>{
  const options=hero[slot==='gadget'?'gadgets':'starPowers']||[];
  const rows=(data?.observations||[]).filter(r=>{
   const s=sources.get(r.sourceId);
   return r.heroId===hero.id&&r.slot===slot&&(r.mapId==null||r.mapId===map.id)&&(!r.mode||r.mode===map.mode)&&!(r.excludedModes||[]).includes(map.mode)&&r.reviewed===true&&r.patchStatus!=='invalidated'&&s?.read===true&&recentStrength(s.publishedAt,asOf)&&recentStrength(s.originalPublishedAt||s.publishedAt,asOf)&&options.some(o=>o.name===r.optionEn);
  }).map(r=>({...r,source:sources.get(r.sourceId),name:loadoutName(data,hero.id,slot,r.optionEn)}));
  const scope=r=>r.mapId!=null?2:r.mode?1:0;
  const preferred=rows.filter(r=>r.preference==='default').sort((a,b)=>scope(b)-scope(a)||b.source.publishedAt.localeCompare(a.source.publishedAt));
  if(!preferred.length)return {status:'unknown',selected:null,alternatives:rows};
  const selected=preferred[0];
  const peers=preferred.filter(r=>scope(r)===scope(selected));
  const disagreements=peers.filter(r=>r.optionEn!==selected.optionEn);
  return {status:disagreements.length?'disputed':'supported',selected,alternatives:rows.filter(r=>r.id!==selected.id),disagreements};
 };
 return {gadget:resolve('gadget'),starPower:resolve('starPower')};
}
