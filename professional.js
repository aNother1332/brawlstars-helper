// An observed draft is evidence of a particular match, never a global strength vote.
export function casesForMap(data,catalog,mapId) {
 const map=catalog.maps.find(m=>m.id===mapId);
 if(!map)return [];
 return (data.cases||[]).filter(c=>c.mapId===map.id&&c.mode===map.mode&&c.lineupsVerified===true);
}
