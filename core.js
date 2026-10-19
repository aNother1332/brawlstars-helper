export const normalize = text => String(text ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s\-_’']/g, '');
export function searchMaps(maps, query, { mode = '', includeRetired = false, pilotOnly = false, pilotIds = new Set() } = {}) {
  const q = normalize(query);
  return maps.filter(m => (!mode || m.mode === mode) && (includeRetired || !m.disabled) && (!pilotOnly || pilotIds.has(m.id)))
    .map(m => {
      const labels = [m.name, m.en, ...m.aliases].map(normalize);
      const score = !q ? 0 : labels.some(v => v === q) ? 100 : labels.some(v => v.startsWith(q)) ? 60 : labels.some(v => v.includes(q)) ? 30 : normalize(m.modeName).includes(q) ? 10 : -1;
      return { m, score };
    }).filter(x => x.score >= 0)
    .sort((a,b) => b.score - a.score || Number(pilotIds.has(b.m.id)) - Number(pilotIds.has(a.m.id)) || Number(a.m.disabled) - Number(b.m.disabled) || a.m.id - b.m.id)
    .map(x => x.m);
}
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : '#'; } catch { return '#'; }
}
export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function loadSaved(storage, key, fallback) {
  try { const value = JSON.parse(storage.getItem(key)); return value ?? fallback; } catch { return fallback; }
}
export function imageUrl(value) {
  if (value?.startsWith('assets/')) return value;
  return safeUrl(value).replace('https://cdn.brawlify.com/', 'https://raw.githubusercontent.com/Brawlify/CDN/master/');
}
// Three calendar months, not an approximate 90-day interval. Future/unknown dates fail closed.
export function recentStrength(date, asOf, months=3) {
  if(!date||!/^\d{4}-\d{2}-\d{2}/.test(date))return false;
  const end=new Date(asOf.slice(0,10)+'T23:59:59Z'), value=new Date(date);
  if(Number.isNaN(value.valueOf())||Number.isNaN(end.valueOf()))return false;
  if(new Date(date.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==date.slice(0,10))return false;
  const cutoff=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-months,1));
  const lastDay=new Date(Date.UTC(cutoff.getUTCFullYear(),cutoff.getUTCMonth()+1,0)).getUTCDate();
  cutoff.setUTCDate(Math.min(end.getUTCDate(),lastDay));
  return value>=cutoff&&value<=end;
}
export function eligibleObservation(row, source, asOf) {
  return Boolean(source?.read && source.qualityDecision!=='exclude-from-strength-weighting' && recentStrength(source.dataAsOf||source.publishedAt,asOf) && !row.prediction && !row.disputed && row.confidence==='high' && Number.isFinite(row.strength)&&row.strength>=0&&row.strength<=1);
}
// Keep only the latest readable observation per author; one prolific creator is not a consensus.
export function metaByHero(library) {
  const sources=new Map(library.sources.map(s=>[s.id,s]));
  const grouped=new Map();
  for(const row of library.metaObservations){
    const source=sources.get(row.sourceId);
    if(!eligibleObservation(row,source,library.asOf))continue;
    const superseded=(library.metaRevocations||[]).some(r=>{const newer=sources.get(r.sourceId);return r.heroId===row.heroId&&newer?.read&&newer.author===source.author&&(newer.dataAsOf||newer.publishedAt)>(source.dataAsOf||source.publishedAt)&&recentStrength(newer.dataAsOf||newer.publishedAt,library.asOf);});
    if(superseded)continue;
    const authors=grouped.get(row.heroId)||new Map();
    const author=source.independenceGroup||source.author||source.id, previous=authors.get(author);
    const effective=source.dataAsOf||source.publishedAt;
    if(!previous||effective>(previous.source.dataAsOf||previous.source.publishedAt))authors.set(author,{...row,source});
    grouped.set(row.heroId,authors);
  }
  const result=new Map([...grouped].map(([heroId,authors])=>{const evidence=[...authors.values()];return [heroId,{strength:evidence.reduce((sum,r)=>sum+r.strength,0)/evidence.length,evidence,rankSignal:0,rankEvidence:[]}];}));
  const ranks=new Map();
  for(const row of library.rankObservations||[]){
    const source=sources.get(row.sourceId);
    if(!eligibleObservation({...row,strength:0},source,library.asOf)||!Number.isInteger(row.rank)||!Number.isInteger(row.total)||row.rank<1||row.rank>row.total||row.total!==10)continue;
    if((library.metaRevocations||[]).some(r=>{const newer=sources.get(r.sourceId);return r.heroId===row.heroId&&newer?.read&&newer.author===source.author&&(newer.dataAsOf||newer.publishedAt)>(source.dataAsOf||source.publishedAt)&&recentStrength(newer.dataAsOf||newer.publishedAt,library.asOf);}))continue;
    const authors=ranks.get(row.heroId)||new Map(),key=source.independenceGroup||source.author||source.id;
    const previous=authors.get(key);
    if(!previous||(source.dataAsOf||source.publishedAt)>(previous.source.dataAsOf||previous.source.publishedAt))authors.set(key,{...row,source});
    ranks.set(row.heroId,authors);
  }
  for(const [heroId,authors]of ranks){
    const info=result.get(heroId)||{strength:0,evidence:[],rankSignal:0,rankEvidence:[]};
    info.rankEvidence=[...authors.values()];
    info.rankSignal=info.rankEvidence.reduce((sum,r)=>sum+(r.total-r.rank+1)/r.total,0)/info.rankEvidence.length;
    result.set(heroId,info);
  }
  return result;
}
export function orderTeams(teams, meta) {
  // Ordinal Top10 lists remain ordinal: a separate <=.005 signal, never a fabricated letter grade.
  const bonus=team=>team.members.reduce((n,m)=>{const info=meta.get(m.heroId);return n+(info?.strength||0)*.045+(info?.rankSignal||0)*.005;},0)/team.members.length;
  // Lexicographic constraints: no amount of tier-list evidence can bridge a worse map or cooperation band.
  return teams.map((team,index)=>({...team,metaBonus:bonus(team),originalIndex:index}))
    .sort((a,b)=>(b.mapFitBand||0)-(a.mapFitBand||0)||(b.cooperationBand||0)-(a.cooperationBand||0)||b.metaBonus-a.metaBonus||a.originalIndex-b.originalIndex);
}
