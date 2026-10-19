import {recentStrength} from './core.js';

/** Exact map+mode evidence. Same names and historic variants never inherit advice. */
export function indexMapKnowledge(library, catalog, asOf) {
  const sources=new Map(library.sources.map(s=>[s.id,s]));
  const maps=new Map(catalog.maps.map(m=>[m.id,m]));
  const heroes=new Set(catalog.heroes.map(h=>h.id));
  const index=new Map();
  for(const row of library.mapEvidence||[]){
    const map=maps.get(row.mapId),source=sources.get(row.sourceId);
    if(!map||!source?.read||row.mode!==map.mode||row.variantOnly||source.variantOnly)continue;
    const item=index.get(map.id)||{mapId:map.id,mode:map.mode,evidence:[],candidates:new Map(),conditions:[],warnings:[]};
    const fresh=recentStrength(source.dataAsOf||source.publishedAt,asOf);
    const record={...row,source,fresh};
    item.evidence.push(record);
    item.conditions.push(...(row.conditions||[]));
    // Map-fit evidence is independent of current meta strength; new research can opt
    // in old, stable map-role teaching without letting it count as strength data.
    for(const heroId of row.mapCandidateEvidence===true?(row.heroIds||[]):row.currentStrengthEvidence===false?[]:row.heroIds||[]){
      if(!heroes.has(heroId))continue;
      const candidate=item.candidates.get(heroId)||{heroId,references:[],roles:[],fresh:false};
      candidate.references.push(record);candidate.fresh ||= fresh;
      item.candidates.set(heroId,candidate);
    }
    index.set(map.id,item);
  }
  for(const claim of library.claims||[]){
    const item=index.get(claim.mapId),source=sources.get(claim.sourceId);
    if(!item||!source?.read||claim.mode!==item.mode)continue;
    const negative=claim.negative||/negative|counterexample/.test(claim.kind||'');
    if(negative)item.warnings.push({...claim,source});
    for(const heroId of claim.heroIds||[]){
      const candidate=item.candidates.get(heroId);
      if(!candidate)continue;
      // Negative/conditional claims must remain warnings, not become positive roles.
      if(negative){(candidate.warnings??=[]).push({...claim,source});continue;}
      if(claim.role&&!candidate.roles.includes(claim.role))candidate.roles.push(claim.role);
      (candidate.details??=[]).push({...claim,source});
    }
  }
  for(const value of index.values()){
    value.conditions=[...new Set(value.conditions)];
    value.candidates=[...value.candidates.values()];
    value.sourceCount=new Set(value.evidence.map(e=>e.sourceId)).size;
  }
  return index;
}
