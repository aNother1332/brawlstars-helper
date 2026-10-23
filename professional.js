// An observed draft is evidence of a particular match, never a global strength vote.
export function casesForMap(data,catalog,mapId) {
 const map=catalog.maps.find(m=>m.id===mapId);
 if(!map)return [];
 return (data.cases||[]).filter(c=>c.mapId===map.id&&c.mode===map.mode&&c.lineupsVerified===true);
}

export function professionalReferenceForTeam(team,data,catalog,mapId,caseId=null) {
 const refs=[team.professionalReference,...team.additionalProfessionalReferences||[]].filter(Boolean);
 for(const ref of refs){
  if(caseId&&ref.caseId!==caseId)continue;
  const c=casesForMap(data,catalog,mapId).find(c=>c.id===ref.caseId&&c.verification?.finalTeams==='visual_verified');
  if(!c)continue;
  const side=c.teams.find(t=>t.name===ref.teamName);
  const selected=team.members.map(m=>m.heroId);
  if(!side||selected.length!==3||new Set(selected).size!==3||side.heroIds.length!==3||new Set(side.heroIds).size!==3||!selected.every(id=>side.heroIds.includes(id)))continue;
  return {case:c,side,opponent:c.teams.find(t=>t.name!==side.name)};
 }
 return null;
}
