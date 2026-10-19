import {eligibleObservation, recentStrength, normalize, metaByHero} from './core.js';

// A source's original ordinal order and letter groups are different data types.
export function rankingSources(library) {
  const ids=new Set([...(library.metaObservations||[]),...(library.rankObservations||[])].map(r=>r.sourceId));
  return library.sources.filter(s=>s.read&&ids.has(s.id))
    .sort((a,b)=>(b.dataAsOf||b.publishedAt||'').localeCompare(a.dataAsOf||a.publishedAt||''));
}
export function defaultRankingSource(library) {
 const sources=rankingSources(library);
 const tiers=sources.filter(s=>(library.metaObservations||[]).some(r=>r.sourceId===s.id));
 const preferred=tiers.find(s=>s.id===library.mainRankingSourceId);
 if(preferred)return preferred.id;
 const coverage=s=>new Set((library.metaObservations||[]).filter(r=>r.sourceId===s.id).map(r=>r.heroId)).size;
 return tiers.sort((a,b)=>Number(Boolean(b.hasCompleteTierBoard))-Number(Boolean(a.hasCompleteTierBoard))||coverage(b)-coverage(a))[0]?.id||sources[0]?.id||null;
}
export function rankingSourceLabel(source) {
 const author=source.rankingAuthor||source.author;
 return author+(source.rankingAuthor&&source.rankingAuthor!==source.author&&source.platform==='bilibili'?' · 中文讲解：'+source.author:'');
}
export function rankingView(library,catalog,sourceId,asOf,{query='',heroClass=''}={}) {
  const heroes=new Map(catalog.heroes.map(h=>[h.id,h]));
  const matches=h=>h&&(!heroClass||h.class===heroClass)&&(!query||[h.name,h.en,...(h.aliases||[])].some(n=>normalize(n).includes(normalize(query))));
  if(sourceId==='comparison')return {kind:'comparison',rows:[...metaByHero({...library,asOf})].filter(([id])=>matches(heroes.get(id)))
    .map(([id,info])=>({hero:heroes.get(id),...info})).sort((a,b)=>a.hero.name.localeCompare(b.hero.name,'zh-CN'))};
  const source=library.sources.find(s=>s.id===sourceId);
  if(!source?.read)return {kind:'empty',rows:[]};
  const ranks=(library.rankObservations||[]).filter(r=>r.sourceId===sourceId);
  const kind=ranks.length?'ordinal':'tiers';
  const sourceRows=ranks.length?ranks:(library.metaObservations||[]).filter(r=>r.sourceId===sourceId);
  const covered=new Set(sourceRows.filter(r=>heroes.has(r.heroId)).map(r=>r.heroId));
  const rows=sourceRows
    .filter(r=>matches(heroes.get(r.heroId))).map(r=>({...r,hero:heroes.get(r.heroId),
      eligible:eligibleObservation(kind==='ordinal'?{...r,strength:0}:r,source,asOf),
      superseded:(library.metaRevocations||[]).some(v=>{const s=library.sources.find(s=>s.id===v.sourceId);return v.heroId===r.heroId&&s?.read&&s.author===source.author&&(s.dataAsOf||s.publishedAt)>(source.dataAsOf||source.publishedAt)&&recentStrength(s.dataAsOf||s.publishedAt,asOf);})}));
  rows.sort(kind==='ordinal'?(a,b)=>a.rank-b.rank:(a,b)=>b.strength-a.strength||(source.tierOrderKnown&&Number.isInteger(a.tierOrder)&&Number.isInteger(b.tierOrder)?a.tierOrder-b.tierOrder:0)||a.hero.name.localeCompare(b.hero.name,'zh-CN'));
  return {kind,source,rows,totalRanked:covered.size,totalHeroes:heroes.size,
    unranked:kind==='tiers'?catalog.heroes.filter(h=>matches(h)&&!covered.has(h.id)).map(hero=>({hero,unranked:true})):[],
    fresh:recentStrength(source.dataAsOf||source.publishedAt,asOf)};
}
