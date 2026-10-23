import { searchMaps, safeUrl, escapeHtml as e, loadSaved, imageUrl, metaByHero, orderTeams, recentStrength } from './core.js';
import { indexMapKnowledge } from './knowledge.js';
import { rankingSources, rankingView, defaultRankingSource, rankingSourceLabel } from './rankings.js';
import { casesForMap, professionalReferenceForTeam } from './professional.js';

const $ = s => document.querySelector(s);
let storage;
try { storage=globalThis.localStorage; } catch { storage={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}}; }
const state = { catalog:null, data:null, patches:null, library:null, meta:new Map(), knowledge:new Map(), researchOnly:false, evaluationDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()), mapId:15000007, team:0, pilotOnly:true, favoritesOnly:false,
  favorites:new Set(loadSaved(storage,'brawl-favorites',[]).filter?.(x=>Number.isInteger(x)) ?? []) };
let heroById, pilotById, sourceById;
let rankingSource, rankingQuery='', rankingClass='';
const glyph = {'Gem Grab':'◆','Bounty':'✦','Brawl Ball':'◉','Heist':'▣','Hot Zone':'◎','Knockout':'◇','Wipeout':'✧'};
const modeHints = {'Gem Grab':'持宝 · 控线 · 创造空间','Bounty':'远程 · 交换 · 生存','Brawl Ball':'控场 · 推进 · 射门','Heist':'守家 · 施压 · 金库输出','Hot Zone':'占区 · 控场 · 持续压制','Knockout':'生存 · 配合 · 淘汰','Wipeout':'击杀 · 生存 · 交换'};
const statusText = {historical_pending_current_patch_review:'近期历史资料 · 待当前版本复核',old_pending_review:'旧版资料 · 待复核',undated_mechanism_reference:'无日期 Wiki · 仅机制参考',local_asr_pending_visual_date_review:'本地转写 · 日期与画面待核验','map statistics and scope read':'统计口径已读取 · 仅作地图候选','ranked map candidates and trio read; trio sample count undisclosed on overview':'排位地图与组合已读取 · 组合样本未公开','ranked map candidates, layout and recent trios read':'近期排位地图与三人组合已读取'};
const save = (key,value) => { try {storage.setItem(key,JSON.stringify(value));return true;} catch {toast('浏览器无法保存本地记录，请导出备份');return false;} };
function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),2600); }
function picture(url, alt, cls='', loading='lazy') { return `<img class="${cls}" src="${e(imageUrl(url))}" alt="${e(alt)}" loading="${e(loading)}">`; }
function attachImageFallbacks(root=document) {
  root.querySelectorAll('img').forEach(img => {
    img.addEventListener('error',()=> {
      const node = document.createElement('span');
      node.className = img.closest('.hero-card,.rank-hero') ? 'hero-placeholder' : 'image-fallback';
      node.textContent = img.closest('.hero-card,.rank-hero') ? img.alt.slice(0,1) : `${img.alt}暂时无法加载。可打开原始资料查看。`;
      img.replaceWith(node);
    },{once:true});
  });
}
function renderList() {
  const searching=Boolean($('#search').value.trim());
  const scopeIds=state.researchOnly?new Set([...pilotById.keys(),...state.knowledge.keys()]):new Set(pilotById.keys());
  let results=searchMaps(state.catalog.maps,$('#search').value,{mode:$('#mode').value,includeRetired:$('#retired').checked,pilotOnly:!searching&&(state.pilotOnly||state.researchOnly),pilotIds:scopeIds});
  if(state.favoritesOnly)results=results.filter(m=>state.favorites.has(m.id));
  $('#result-count').textContent=`${results.length} 张地图${searching?' · 全库搜索':state.pilotOnly?' · 有阵容':state.researchOnly?' · 有攻略':''}`;
  $('#map-list').innerHTML=results.length ? results.map(m=>`<button class="map-item ${m.id===state.mapId?'selected':''}" data-map="${m.id}" aria-current="${m.id===state.mapId?'true':'false'}"><span class="map-glyph" aria-hidden="true">${glyph[m.mode]||'◇'}</span><span><strong>${e(m.name)}${m.disabled?'<span class="tiny-label">停用</span>':''}${state.favorites.has(m.id)?'<span class="tiny-label">★</span>':''}</strong><small>${e(m.modeName)} · ${e(m.en)}</small></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('') : '<p class="empty-list">没有匹配的地图。<br>试试其他名称，或切换“全部地图”。</p>';
  $('#map-list').querySelectorAll('[data-map]').forEach(button=>button.addEventListener('click',()=>selectMap(Number(button.dataset.map))));
  $('#map-list').querySelectorAll('[data-map]').forEach(button=>{const row=state.catalog.maps.find(m=>m.id===Number(button.dataset.map));if(state.catalog.maps.filter(m=>m.en===row.en&&m.mode===row.mode&&!m.disabled).length>1){button.querySelector('small').textContent+=` · #${row.id}`;}});
  $('#map-list').querySelectorAll('[data-map]').forEach(button=>{const id=Number(button.dataset.map),label=pilotById.has(id)?'阵容':state.knowledge.has(id)?'攻略':null;if(label){const badge=document.createElement('span');badge.className='coverage-badge';badge.textContent=label;button.querySelector('strong').append(badge);}});
}
function selectMap(id, updateUrl=true) {
  if(!state.catalog.maps.some(m=>m.id===id))return;
  state.mapId=id;state.team=0;
  if(updateUrl){const url=new URL(location.href);url.searchParams.set('map',id);history.replaceState(null,'',url);}
  renderList();renderContent();renderRankingRows();
}
function renderRankings(){
 const sources=rankingSources(state.library),mainId=defaultRankingSource(state.library);
 rankingSource??=mainId;
 const choices=[...sources.filter(s=>s.id===mainId),...sources.filter(s=>s.id!==mainId)];
 $('#rankings').innerHTML=`<div class="section-heading"><div><span class="eyebrow">THE COMPLETE TIER BOARD</span><h3>英雄强度排行<small>地图与配合优先</small></h3><p>完整分级一览。点英雄查看地图职责，按定位筛选适合你的选择。</p></div></div><div class="ranking-navigation"><button class="action ranking-main-button" id="ranking-main" aria-pressed="true">★ 主榜 · 完整分级</button><details class="ranking-secondary"><summary>其他榜单与对照</summary><label for="ranking-source">切换参考来源</label><select id="ranking-source">${choices.map(s=>`<option value="${e(s.id)}">${s.id===mainId?'主榜 · ':''}${e(rankingSourceLabel(s))} · ${e((s.dataAsOf||s.publishedAt||'日期未知').slice(0,10))}${(state.library.rankObservations||[]).some(r=>r.sourceId===s.id)?' · Top 10':' · 分档'}</option>`).join('')}<option value="comparison">跨作者对照 · 按中文名排列</option></select><p class="form-note">各来源保留自己的分档和名次；同源中文讲解不重复算作独立支持。</p></details></div><div class="ranking-controls"><label>搜索英雄<input id="ranking-search" type="search" placeholder="中文 / English" value="${e(rankingQuery)}"></label><label>英雄定位<select id="ranking-class"><option value="">全部定位</option>${[...new Set(state.catalog.heroes.map(h=>h.class))].map(c=>`<option value="${e(c)}">${e({'Tank':'坦克','Marksman':'射手','Support':'支援','Controller':'控场','Assassin':'刺客','Artillery':'投掷','Damage Dealer':'输出'}[c]||c)}</option>`).join('')}</select></label></div><div id="ranking-results" aria-live="polite"></div>`;
 $('#ranking-source').value=rankingSource;$('#ranking-class').value=rankingClass;
 $('#ranking-main').addEventListener('click',()=>{rankingSource=mainId;$('#ranking-source').value=mainId;$('.ranking-secondary').open=false;renderRankingRows();});
 $('#ranking-source').addEventListener('change',event=>{rankingSource=event.target.value;renderRankingRows();});
 $('#ranking-search').addEventListener('input',event=>{rankingQuery=event.target.value;renderRankingRows();});
 $('#ranking-class').addEventListener('change',event=>{rankingClass=event.target.value;renderRankingRows();});
 renderRankingRows();
}
function renderRankingRows(){
 if(!$('#ranking-results'))return;
 const view=rankingView(state.library,state.catalog,rankingSource,state.evaluationDate,{query:rankingQuery,heroClass:rankingClass});
 const isMain=rankingSource===defaultRankingSource(state.library);
 $('#ranking-main').setAttribute('aria-pressed',String(isMain));
 const candidates=new Set((state.knowledge.get(state.mapId)?.candidates||[]).map(c=>c.heroId));
 const chip=(r,label)=>`<button class="rank-hero ${candidates.has(r.hero.id)?'map-candidate':''} ${r.unranked?'rank-unranked':''}" data-ranking-hero="${r.hero.id}" title="${e(r.hero.name)} · ${e(r.hero.en)}">${picture(r.hero.image,r.hero.name)}<span><strong>${label?e(label)+' · ':''}${e(r.hero.name)}</strong><small>${e(r.hero.en)}${candidates.has(r.hero.id)?' · 本图教学候选':''}</small>${r.unranked||r.prediction||r.disputed||r.superseded||r.eligible===false?`<em>${r.unranked?'原榜未收录':r.prediction?'预测 · 不加权':r.disputed?'中文讲解有异议':r.superseded?'后续观点已撤回':'旧资料／不加权'}</em>`:''}</span></button>`;
 let html='';
 if(view.kind==='comparison'){
  html='<p class="form-note">只对照近三个月可用观点。同作者保留最近观点；分档与 Top 10 各自呈现，不合成为总排名。按中文名排列。</p><div class="ranking-comparison">'+view.rows.map(r=>`<div>${chip(r)}<p>${r.evidence.map(v=>`${e(rankingSourceLabel(v.source))}：${e(v.tier)}`).concat(r.rankEvidence.map(v=>`${e(rankingSourceLabel(v.source))}：第${v.rank}名`)).join('<br>')}</p></div>`).join('')+'</div>';
 }else if(view.source){
  const s=view.source;
  const originalUrl=s.originalUrl||s.url;
  const translationUrl=s.translationUrl||(s.platform==='bilibili'?s.url:null);
  const translationPublisher=s.translationPublisher||(s.platform==='bilibili'?s.author:null);
  const orderNote=view.kind==='ordinal'?'保留原作者 Top 10 顺序；榜外不等于弱势。':s.tierOrderKnown?'同档保留原图排列，不额外生成精确名次。':'同档按中文名排列，不表示名次。';
  html=`<div class="ranking-provenance"><span class="ranking-edition">${isMain?'主榜':'参考榜'}${s.versionLabel?' · '+e(s.versionLabel):''}</span><h4>${e(s.rankingAuthor||s.author)}</h4><p>榜单日期 ${e((s.dataAsOf||s.publishedAt||'未知').slice(0,10))}${s.dataAsOf&&s.dataAsOf!==s.publishedAt?.slice(0,10)?' · 视频发布 '+e(s.publishedAt.slice(0,10)):''} · ${view.fresh?'近三个月资料':'历史榜单，仅供回看'}${view.kind==='tiers'?' · '+view.totalRanked+' 位已分级 / '+view.totalHeroes+' 位资料':''}</p><div class="ranking-source-links"><a href="${e(safeUrl(originalUrl))}" target="_blank" rel="noopener noreferrer">${s.originalUrl||s.rankingAuthor?'原始榜单':'来源视频'} ↗</a>${translationUrl?`<a href="${e(safeUrl(translationUrl))}" target="_blank" rel="noopener noreferrer">中文讲解：${e(translationPublisher)} ↗</a>`:''}</div><p class="form-note ranking-source-note">${s.visualChecked?'分级关键画面已核对。':'已读取内容片段。'}${e(orderNote)} 分级是该版本的综合参考，选择阵容仍优先看地图与配合。</p></div>`;
  if(view.kind==='ordinal')html+='<div class="rank-grid">'+view.rows.map(r=>chip(r,'#'+r.rank)).join('')+'</div>';
  else{
   const order=['S','A','B','C','D','F'];
   const tiers=[...new Set(view.rows.map(r=>r.tier))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
   html+=`<div class="tier-board" aria-label="${isMain?'主榜完整英雄分级':'参考来源英雄分级'}">${tiers.map(t=>{const rows=view.rows.filter(r=>r.tier===t);return `<section class="rank-tier" data-tier="${e(t)}" aria-label="${e(t)}档 ${rows.length}位英雄"><div class="tier-label"><strong>${e(t)}</strong><span>${rows.length} 位</span></div><div class="rank-grid">${rows.map(r=>chip(r)).join('')}</div></section>`;}).join('')}</div>`;
   if(view.unranked.length)html+=`<section class="rank-tier unranked-tier" aria-label="原榜未收录"><div class="tier-label"><strong>未收录</strong><span>${view.unranked.length} 位</span></div><div><p class="form-note">当前资料库中有这些英雄，但原榜没有给出分级；保持未收录，不归入最低档。</p><div class="rank-grid">${view.unranked.map(r=>chip(r)).join('')}</div></div></section>`;
  }
 }
 if(!view.rows.length&&!view.unranked?.length)html+='<p class="empty-list">没有匹配的英雄或可用榜单。</p>';
 $('#ranking-results').innerHTML=html;
 $('#ranking-results').querySelectorAll('[data-ranking-hero]').forEach(b=>b.addEventListener('click',()=>showHero(Number(b.dataset.rankingHero))));attachImageFallbacks($('#ranking-results'));
}

function renderContent() {
  const m=state.catalog.maps.find(m=>m.id===state.mapId), p=pilotById.get(m.id), knowledge=state.knowledge.get(m.id);
  $('#content').innerHTML=`<div class="breadcrumb">选定你的主场 <span>/</span> ${e(m.modeName)} <span>/</span><span>${e(m.name)}</span></div>
  <div class="map-title-row"><div><div class="mode-overline">${e(m.mode.toUpperCase())} / CLASSIC 3V3</div><h2>${e(m.name)}</h2><span class="en">${e(m.en)}</span></div><div class="map-actions"><button id="favorite-map" class="action" aria-pressed="${state.favorites.has(m.id)}">${state.favorites.has(m.id)?'★ 已收藏':'☆ 收藏'}</button><button id="share-map" class="action" aria-label="复制当前地图链接">↗ 分享</button></div></div>
  <div class="battle-stage"><section class="map-overview" aria-label="地图分析"><div class="map-card-label"><span>战术地图</span><small>THE BATTLEGROUND</small></div><div class="map-visual">${picture(m.image,m.name+'地图画面')}<span class="map-caption">点击放大地图 ⤢</span></div><div class="map-explanation"><span class="mode-chip">${glyph[m.mode]} ${e(m.modeName)}</span><h3>${e(modeHints[m.mode]||'地图与模式分析')}</h3><details class="map-intel" ${matchMedia('(min-width: 701px)').matches?'open':''}><summary>地图特点与打法 <span aria-hidden="true">＋</span></summary><p>${e(p?.terrain||'这张地图已收录基础资料。阵容分析仍在整理，请根据模式目标核对地图特点。')}</p><div class="tags">${(p?.tags||[m.disabled?'资料标记为停用':'非停用资料','排位轮换未核实']).map(t=>`<span class="tag">${e(t)}</span>`).join('')}</div><p class="objective">${e(p?.objective||'当前没有经过复核的三人阵容，不从其他同名地图套用推荐。')}</p></details></div></section>
  ${p ? `<section class="squads-section" aria-label="三人阵容"><div class="section-heading"><div><h3>三个人，一套配合<small>BUILD YOUR SQUAD</small></h3><p>先看职责，再选英雄。配合，才是关键。</p></div><span class="section-number">01</span></div><div class="team-tabs" role="tablist" aria-label="阵容方案">${p.teams.map((t,i)=>`<button role="tab" id="tab-${i}" aria-selected="${i===state.team}" aria-controls="team-panel" tabindex="${i===state.team?0:-1}" class="team-tab ${i===state.team?'active':''}" data-team="${i}"><span>0${i+1}</span>${e(t.title)}</button>`).join('')}</div><div id="team-container"></div></section>`:
  `<div class="empty"><span class="eyebrow">IN THE LIBRARY</span><h3>地图已收录，阵容仍在研究</h3><p>尚无这张地图的已整理阵容。我们不会把缺少依据的组合当成推荐。</p><p><a href="${e(safeUrl(m.source))}" target="_blank" rel="noopener noreferrer">查看原始地图资料 ↗</a></p><button class="action primary back-to-pilots" id="back-pilots">查看已有阵容的地图 →</button></div>`}</div>
  ${m.disabled?'<div class="version-note"><strong>历史地图资料</strong>数据源将这张地图标记为停用；请勿据此判断当前排位可选地图。</div>':''}
  ${p ? `<div class="version-note"><strong>◷ 阵容研究试点</strong><span>以下队伍均为机制推导，尚未完成国服当前版本与三人实战验证。来源包括旧版攻略和无日期资料，不代表当前强度排名；国服同步与当前排位轮换尚未核实。</span></div><section class="evidence-section"><div class="section-heading"><div><h3>推荐从哪里来<small>SOURCES & REASONING</small></h3><p>保留条件，也保留分歧。把每个观点放回它的来源。</p></div><span class="section-number">02</span></div>${renderSources(p)}${renderCandidates(p)}</section>`:''}`;
  if(!p&&knowledge){$('.empty').remove();$('.map-intel>p').textContent=knowledge.evidence[0].summary;}
  if(p){const summary=document.createElement('p');summary.className='coverage-summary';summary.textContent=`${p.teams.length} 套阵容推导 · ${knowledge?.sourceCount||0} 个已读地图来源${p.overallStatus?.includes('仅Wiki')?' · 仅无日期Wiki候选，作为实验方案':''} · 不代表当前排位轮换`;$('.map-overview').append(summary);}
  attachImageFallbacks($('#content'));
  if(state.catalog.maps.filter(row=>row.en===m.en&&row.mode===m.mode&&!row.disabled).length>1){$('.map-title-row .en').textContent+=` · 地图 ID ${m.id}`;}
  $('#favorite-map').addEventListener('click',()=>{state.favorites.has(m.id)?state.favorites.delete(m.id):state.favorites.add(m.id);save('brawl-favorites',[...state.favorites]);renderList();renderContent();});
  $('#share-map').addEventListener('click',()=>copy(location.href,'地图链接已复制'));
  $('.map-visual img')?.addEventListener('click',()=>showDialog(`<div class="dialog-copy"><h2>${e(m.name)}</h2><p>${e(m.modeName)} · ${e(m.en)}</p>${picture(m.image,m.name+'地图','dialog-map')}<p><a href="${e(safeUrl(m.source))}" target="_blank" rel="noopener noreferrer">原始地图资料 ↗</a></p></div>`));
  $('#back-pilots')?.addEventListener('click',()=>{state.pilotOnly=true;state.researchOnly=false;$('#search').value='';$('#mode').value='';state.favoritesOnly=false;updateFilters();selectMap(15000007);});
  if(p){renderTeam(p);document.querySelectorAll('[data-team]').forEach(button=>{
    button.addEventListener('click',event=>changeTeam(Number(button.dataset.team),p,event.detail>0));
    button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();let index=event.key==='Home'?0:event.key==='End'?p.teams.length-1:(state.team+(event.key==='ArrowRight'?1:-1)+p.teams.length)%p.teams.length;changeTeam(index,p);$(`#tab-${index}`).focus();}});
  });}
  if(p)renderRecentContext(p);
  renderProCases(m);
  if(knowledge)renderKnowledge(m,knowledge);
}
function renderDraftObservations(c){
 return `<details><summary>已确认的局部选禁信息（完整顺序仍未知）</summary>${(c.partialDraftObservations||[]).map(o=>`<p>${e(o.statement)} <a href="${e(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer">${formatTime(o.startSeconds)} ↗</a></p>`).join('')}<p class="form-note">系列全局禁用、地图禁用、后手补选分别记录，不从最终三人站位反推逐手顺序。</p></details>`;
}
function renderTactics(ref){
 if(!ref.trigger&&!ref.roles?.length)return '';
 return `<div class="tactics-note"><p><strong>触发条件：</strong>${e(ref.trigger)}</p><p><strong>协作分工：</strong>${e((ref.roles||[]).join('；'))}</p>${ref.alternativeSupportHeroIds?.length?`<p>辅助中路备选（选一位）：${ref.alternativeSupportHeroIds.map(id=>e(heroById.get(id)?.name||id)).join(' / ')}；不是同时上场要求。</p>`:''}${ref.counterplay?.length?`<p class="review-alert"><strong>机制推导的应对提醒：</strong>${e(ref.counterplay.join('；'))}（工具分析，不作作者原话）</p>`:''}</div>`;
}
function proCaseCard(c){
 const heroNames=team=>team.heroIds.map(id=>e(heroById.get(id)?.name||id)).join(' / ');
 const templates=(pilotById.get(c.mapId)?.teams||[]).map((t,index)=>({t,index})).filter(({t})=>t.professionalReference?.caseId===c.id);
 const actions=templates.map(({t,index})=>`<button class="action pro-template-link" data-pro-team="${index}">选择 ${e(t.professionalReference.teamName)} 职业模板 ↑</button>`).join('');
 return `<article class="pro-card"><span class="eyebrow">${e(c.event)} · ${e(c.eventDate)}</span><h4>${e(c.stage)} · ${e(c.mapName||state.catalog.maps.find(m=>m.id===c.mapId)?.name)}</h4><div class="pro-sides">${c.teams.map(team=>`<div class="pro-side"><strong>${e(team.name)}</strong>${heroNames(team)}</div>`).join('')}</div><p><strong>已核验：</strong>${e(c.verifiedFields.join('；'))}</p><p class="review-alert"><strong>未核验：</strong>${e(c.unknownFields.join('；')||'无额外字段')}。未确认的选禁信息不补猜。</p>${c.bans?.length?`<p>已确认禁用：${c.bans.map(b=>e(typeof b==='string'?b:JSON.stringify(b))).join(' / ')}</p>`:''}<p><strong>解说观点与协作启发：</strong></p><ul>${c.lessons.map(text=>`<li>${e(text)}</li>`).join('')}</ul>${renderDraftObservations(c)}<p><strong>应用条件：</strong>${e(c.conditions.join('；'))}</p><p class="form-note">画面核对的是这场比赛的最终阵容；配合启发是解说观点或工具整理，职业模板保留对手条件，比赛结果不作为阵容因果证明。</p>${actions}<a href="${e(timestampUrl(c.url,c.startSeconds))}" target="_blank" rel="noopener noreferrer">官方回放 · ${formatTime(c.startSeconds)} ↗</a></article>`;
}
function renderProCases(map){
 const cases=casesForMap(state.pro,state.catalog,map.id);if(!cases.length)return;
 const section=document.createElement('section');section.className='pro-section';
 section.innerHTML=`<div class="section-heading"><div><h3>从职业选禁学习配合<small>PRO DRAFT STUDIES</small></h3><p>看职责如何衔接，也看对手会怎样拆解。职业队伍选择不是通用强度结论。</p></div></div>${cases.map(proCaseCard).join('')}`;
 $('#content').append(section);
 section.querySelectorAll('[data-pro-team]').forEach(button=>button.addEventListener('click',()=>{
  changeTeam(Number(button.dataset.proTeam),pilotById.get(map.id),true);
  $('#team-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 }));
}
function renderProHub(){
 const cases=state.pro.cases.filter(c=>casesForMap(state.pro,state.catalog,c.mapId).includes(c));
 $('#pro-hub').innerHTML=`<details class="pro-hub"><summary>职业选禁研究 · ${cases.length} 个已核验阵容案例 · ${[...pilotById.values()].reduce((sum,m)=>sum+m.teams.filter(t=>professionalReferenceForTeam(t,state.pro,state.catalog,m.mapId)).length,0)} 套职业模板 · 2026 LCQ</summary><p class="form-note">${e(state.pro.notice)}</p>${cases.map(c=>`<p><button class="map-link" data-pro-map="${c.mapId}">${e(state.catalog.maps.find(m=>m.id===c.mapId)?.name)} · ${e(c.teams.map(t=>t.name).join(' vs '))} →</button></p>`).join('')}</details>`;
 $('#pro-hub').querySelectorAll('[data-pro-map]').forEach(b=>b.addEventListener('click',()=>{selectMap(Number(b.dataset.proMap));$('.pro-section')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}));
}
function renderKnowledge(map,knowledge){
 const block=document.createElement('section');block.className='knowledge-section';
 const candidates=knowledge.candidates;
 block.innerHTML=`<div class="section-heading"><div><h3>地图教学与候选职责<small>MAP KNOWLEDGE</small></h3><p>${knowledge.sourceCount} 个已读来源 · ${candidates.length} 位明确点名候选。候选不等于已验证三人阵容。</p></div></div><div class="knowledge-candidates">${candidates.map(c=>{const h=heroById.get(c.heroId),hasStats=c.references.some(r=>r.source.platform==='web');return `<button class="knowledge-hero" data-knowledge-hero="${h.id}">${picture(h.image,h.name)}<span><strong>${e(h.name)}</strong><small>${e(c.roles.join(' / ')||'地图候选 · 查看来源条件')}</small><em>${hasStats?'地图统计候选 · 不作强度排名':c.fresh?'近三月观点 · 版本待核':'历史候选 · 不作当前强度依据'}</em></span></button>`;}).join('')}</div>${knowledge.evidence.map(ref=>`<div class="source-card"><span class="source-icon">${ref.source.evidenceType==='map_statistics'?'数':ref.source.platform==='bilibili'?'B':ref.source.evidenceType==='community_wiki'?'W':'▶'}</span><div class="source-body"><a href="${e(safeUrl(ref.url))}" target="_blank" rel="noopener noreferrer">${e(ref.source.author||ref.source.title)} · ${ref.source.evidenceType==='map_statistics'?'读取于 '+e(ref.source.retrievedAt||ref.source.dataAsOf||'日期未知'):e(ref.source.publishedAt?.slice(0,10)||'日期未知')} ${ref.startSeconds!==undefined?'· '+formatTime(ref.startSeconds):''} ↗</a><p>${e(ref.summary)}</p>${renderTactics(ref)}<small>${e(ref.source.evidenceType==='map_statistics'?'近期地图样本用于候选筛选，混合排位与普通3v3，不是当前强度榜或三人阵容胜率。':(ref.conditions||[]).join('；')||'保留原教学适用条件；地图是否改动和当前国服版本仍需核对。')}</small></div></div>`).join('')}<details class="candidates"><summary>展开每位候选的使用条件与反例</summary>${candidates.map(c=>`<div class="candidate-row"><strong>${e(heroById.get(c.heroId).name)}</strong><div>${(c.details||[]).map(d=>`<p>${e(d.role||d.summary)}：${e(d.condition||(d.conditions||[]).join('；'))} <a href="${e(safeUrl(d.url))}" target="_blank" rel="noopener noreferrer">${formatTime(d.startSeconds)} ↗</a></p>`).join('')||'<p>仅从已读地图章节确认被点名；具体职责与配置仍待补充。</p>'}${(c.warnings||[]).map(d=>`<p class="review-alert">△ ${e(d.summary)}</p>`).join('')}</div></div>`).join('')}</details><button class="action knowledge-source-button">查看这张图的资料 ↗</button>`;
 for(const warning of knowledge.warnings||[]){const note=document.createElement('div');note.className='risk-box';note.innerHTML=`<strong>反例与使用边界</strong><p>${e(warning.summary)} <a href="${e(safeUrl(warning.url))}" target="_blank" rel="noopener noreferrer">原文 ${formatTime(warning.startSeconds)} ↗</a></p>`;block.insertBefore(note,block.querySelector('.candidates'));}
 $('#content').append(block);attachImageFallbacks(block);
 block.querySelectorAll('[data-knowledge-hero]').forEach(button=>button.addEventListener('click',()=>showHero(Number(button.dataset.knowledgeHero))));
 block.querySelector('.knowledge-source-button').addEventListener('click',()=>showLibrary({mapId:map.id}));
}
function renderRecentContext(p){
 const members=new Set(p.teams.flatMap(t=>t.members.map(m=>m.heroId)));
 const sources=new Map(state.library.sources.map(s=>[s.id,s]));
 const relevant=state.library.claims.filter(c=>c.heroIds?.some(id=>members.has(id))&&recentStrength(sources.get(c.sourceId)?.dataAsOf||sources.get(c.sourceId)?.publishedAt,state.evaluationDate))
  .sort((a,b)=>(sources.get(b.sourceId)?.publishedAt||'').localeCompare(sources.get(a.sourceId)?.publishedAt||'')).slice(0,5);
 if(!relevant.length)return;
 const block=document.createElement('details');block.className='candidates recent-context';
 block.innerHTML=`<summary>近期英雄与配合观点 · ${relevant.length} 条（综合观点，不代替地图判断）</summary>${relevant.map(c=>{const s=sources.get(c.sourceId);return `<div class="source-card"><span class="source-icon">${s.platform==='bilibili'?'B':'▶'}</span><div class="source-body"><a href="${e(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">${e(s.author)} · ${e(s.publishedAt.slice(0,10))} · ${formatTime(c.startSeconds)} ↗</a><p>${e(c.summary)}</p><small>${e(c.condition||'保留原视频的适用条件。')}</small></div></div>`;}).join('')}`;
 $('.evidence-section').append(block);
}
function changeTeam(index,p,animate=false){state.team=index;document.querySelectorAll('[data-team]').forEach(b=>{const active=Number(b.dataset.team)===index;b.classList.toggle('active',active);b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;});renderTeam(p);if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)$('#team-panel').animate([{opacity:.35,transform:'translateY(7px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:200,easing:'cubic-bezier(0.23,1,0.32,1)'});}
function renderProfessionalTeamEvidence(ref){
 const c=ref.case;
 const names=side=>side.heroIds.map(id=>heroById.get(id)?.name||id).join(' / ');
 return `<div class="team-evidence professional-team-evidence"><strong>职业三人选角 · ${e(ref.side.name)} · ${e(c.eventDate)}</strong><span>${e(c.stage)}</span><p><b>当时对手：</b>${e(ref.opponent.name)} · ${e(names(ref.opponent))}</p><p><b>选手对应：</b>${ref.side.players.map(p=>`${e(p.player)} → ${e(state.catalog.heroes.find(h=>h.en===p.heroEn)?.name||p.heroEn)}`).join('；')}</p><small>最终三英雄已核对官方画面；下方配合方案由工具整理。完整选禁与职业配装未核验，不把一次选角当作当前最佳阵容。</small><a href="${e(safeUrl(c.finalRosterUrl))}" target="_blank" rel="noopener noreferrer">看最终选角画面 · ${formatTime(c.finalRosterFrameSeconds)} ↗</a></div>`;
}
function renderTeam(p) {
  const t=p.teams[state.team];
  const proRef=professionalReferenceForTeam(t,state.pro,state.catalog,state.mapId);
  const observedStats=t.teamStats;
  const teamEvidence=proRef?renderProfessionalTeamEvidence(proRef):observedStats?`<div class="team-evidence"><strong>${observedStats.indexedSnapshot?'地图排位组合样本 · 索引快照':'近期排位三人组记录'}</strong><span>${observedStats.indexedSnapshot?'来源记录 ':''}${(observedStats.winRate*100).toFixed(1)}% ${observedStats.games===null?'· 组合场数未公开':`· ${observedStats.games} 场 / ${observedStats.players} 名玩家 / ${observedStats.indexedSnapshot?'来源标注':'近 '}${observedStats.periodDays} 天${observedStats.indexedSnapshot?'窗口':''}`}</span><small>${e(observedStats.note||'群体描述数据，不代表你们的预期胜率。')}</small></div>`:'';
  $('#team-container').innerHTML=`<article class="team-panel" id="team-panel" role="tabpanel" aria-labelledby="tab-${state.team}"><div class="team-header"><div><h4>${e(t.title)}</h4><p>三人组队 · 基本沟通 · 中等偏上水平</p></div><span class="inference-badge">${proRef?'职业实选 · 配合为推导':observedStats?(observedStats.indexedSnapshot?'组合样本快照 · 配合为推导':'排位实测组合 · 配合解释为推导'):'机制推导 · 待验证'}</span></div><div class="hero-grid">${t.members.map(member=>{const h=heroById.get(member.heroId);return `<button class="hero-card" data-hero="${h.id}" aria-label="查看${e(h.name)}资料"><span class="hero-info-hint">↗</span>${picture(h.image,h.name,'','eager')}<strong>${e(h.name)}</strong><span class="hero-en">${e(h.en)}</span><span class="role">${e(member.role)}</span></button>`;}).join('')}</div><div class="team-body">${teamEvidence}<div class="detail-label">↗ 怎么配合<span class="line"></span></div><p>${e(t.synergy)}</p><div class="risk-box"><strong>△ 需要注意</strong><p>${e(t.risk)}</p></div><details><summary>关键配置与使用条件</summary><p>${e(t.loadout)}</p><p>技能数值与具体配装尚未完成当前版本校验；不提供未经核实的数值。</p></details>${t.substitutions.length?`<details><summary>可选替补 · 替换会改变什么</summary>${t.substitutions.map(s=>`<p>${e(heroById.get(t.members[s.position].heroId).name)} → ${e(heroById.get(s.heroId).name)}：${e(s.tradeoff)}</p>`).join('')}</details>`:''}<div class="team-bottom"><button class="action" id="copy-team">⧉ 复制阵容</button><button class="action" id="feedback-button">＋ 记录实战反馈</button><span>整理于 ${e(state.data.updatedAt)} · 尚未验证当前版本</span></div></div></article>`;
  attachImageFallbacks($('#team-container'));
  if(t.coordination){
   const plan=document.createElement('div');plan.className='coordination';
   plan.innerHTML=`<div class="detail-label">三人协作流程<span class="line"></span></div><div class="coordination-plan">${t.coordination.steps.map((text,i)=>`<div class="coordination-step"><strong>${['01 / 建立站位','02 / 配合触发','03 / 失败与回撤'][i]}</strong><p>${e(text)}</p></div>`).join('')}</div><p class="coordination-note">${e(t.coordination.notice)}</p>`;
   $('.team-body').insertBefore(plan,$('.risk-box'));
  }
  const metadetails=document.createElement('details');metadetails.className='meta-reference';
  metadetails.innerHTML=`<summary>近三个月综合强度参考 · 地图与配合适配优先</summary><p>只在相同地图适配、相同配合要求的候选方案内微调顺序。综合榜无法弥补地图不适配；不展示虚构胜率。资料截至 ${e(state.library.asOf)}。</p>${t.members.map(member=>{const hero=heroById.get(member.heroId),info=state.meta.get(member.heroId);return `<div class="meta-hero"><strong>${e(hero.name)}</strong>${info?info.evidence.map(row=>`<a href="${e(safeUrl(row.url||row.source.url))}" target="_blank" rel="noopener noreferrer">${e(row.tier)} · ${e(rankingSourceLabel(row.source))} · ${e(row.source.publishedAt.slice(0,10))} ↗</a>`).join('')+(info.rankEvidence||[]).map(row=>`<a href="${e(safeUrl(row.url))}" target="_blank" rel="noopener noreferrer">Top 10 第${row.rank}名 · ${e(rankingSourceLabel(row.source))} · ${e(row.source.publishedAt.slice(0,10))} ↗</a>`).join(''):'<span>暂无可参与加权的近期明确分档</span>'}</div>`;}).join('')}<p>作者口播质疑的分档、预测、日期不明、未读取和三个月前的强度观点均不参与加权。不同作者分歧保留；同一作者仅采用最近一条可用观点。</p>`;
  $('.team-body').insertBefore(metadetails,$('.team-bottom'));
  const affected=state.patches.changes.filter(change=>t.members.some(member=>heroById.get(member.heroId).en===change.heroEn));
  if(affected.length){const details=document.createElement('details');details.innerHTML=`<summary>来源发布后的平衡调整 · ${affected.length} 位英雄需复核</summary>${affected.map(change=>`<p><strong>${e(state.catalog.heroes.find(h=>h.en===change.heroEn)?.name||change.heroEn)}</strong>：${e(change.note)}</p>`).join('')}<p><a href="${e(safeUrl(state.patches.url))}" target="_blank" rel="noopener noreferrer">${e(state.patches.title)} ↗</a></p><p>这里只核对到部分维护记录，尚未证实完整补丁历史或国服同步情况。</p>`;$('.team-body').insertBefore(details,$('.team-bottom'));}
  document.querySelectorAll('[data-hero]').forEach(b=>b.addEventListener('click',()=>showHero(Number(b.dataset.hero))));
  $('#copy-team').addEventListener('click',()=>{const m=state.catalog.maps.find(m=>m.id===state.mapId);copy(`${m.name} · ${m.modeName}\n${t.title}\n${t.members.map(v=>`${heroById.get(v.heroId).name}：${v.role}`).join('\n')}\n配合：${t.synergy}\n风险：${t.risk}\n注意：${proRef?'职业三英雄已核验，配合解释为推导；原对手为 '+proRef.opponent.name+'（'+proRef.opponent.heroIds.map(id=>heroById.get(id).name).join(' / ')+'），回放 '+proRef.case.finalRosterUrl+'。':'机制推导。'}当前版本与国服适用性待验证。\n${location.href}`,'阵容说明已复制');});
  $('#feedback-button').addEventListener('click',()=>showFeedback(p,t));
}
function renderSources(p){return p.mechanismEvidence.map(ref=>{const s=sourceById.get(ref.sourceId);const type=s.evidenceType==='ranked_map_statistics'?'排位单英雄与三人组合样本':s.evidenceType==='map_statistics'?'地图统计候选，样本混合排位与普通3v3':s.evidenceType==='professional_visual_roster'?'职业最终阵容画面已核验':s.evidenceType==='automatic_captions'?'已读取自动字幕':s.evidenceType==='local_asr'?'已读取本地音频转写':s.evidenceType==='community_wiki'?'已读取 Wiki 资料':'已读取网页资料';return `<div class="source-card"><span class="source-icon">${s.evidenceType==='ranked_map_statistics'?'排':s.evidenceType==='map_statistics'?'数':s.evidenceType==='community_wiki'?'W':s.platform==='bilibili'?'B':'▶'}</span><div class="source-body"><a href="${e(safeUrl(ref.url||s.url))}" target="_blank" rel="noopener noreferrer">${e(s.author||s.title)} · ${ref.startSeconds!==undefined?formatTime(ref.startSeconds):e(ref.section||'地图说明')} ↗</a><p>${e(ref.claim)}</p><small>${e(['map_statistics','ranked_map_statistics'].includes(s.evidenceType)?'读取于 '+(s.retrievedAt||s.dataAsOf||'日期未知'):s.publishedAt||'无发布日期')} · ${e(type)} · ${ref.completeTeamObserved?'包含完整三人阵容':'未观察到完整三人阵容'}</small></div><span class="source-status">${e(statusText[s.status]||'待复核')}</span></div>`;}).join('');}
function renderCandidates(p){return `<details class="candidates"><summary>查看 ${p.candidates.length} 位候选英雄的原始依据与条件${p.negativeEvidence?.length?'，含不推荐的条件':''}</summary>${p.candidates.map(c=>{const s=sourceById.get(c.sourceId),h=state.catalog.heroes.find(h=>h.en===c.heroEn);return `<div class="candidate-row"><strong>${e(h?.name||c.heroEn)}</strong><div><p>${e(c.role)} · ${e(c.condition)}</p><a href="${e(timestampUrl(s.url,c.startSeconds))}" target="_blank" rel="noopener noreferrer">${e(s.author||'Wiki')} ${c.startSeconds!==undefined?formatTime(c.startSeconds):e(c.section||'')} ↗</a><p>${e(c.status)}</p></div></div>`;}).join('')}${(p.negativeEvidence||[]).map(c=>`<div class="candidate-row"><strong>△ ${e(state.catalog.heroes.find(h=>h.en===c.heroEn)?.name||c.heroEn)}</strong><p>${e(c.claim)} <a href="${e(timestampUrl(sourceById.get(c.sourceId).url,c.startSeconds))}" target="_blank" rel="noopener noreferrer">原文 ${formatTime(c.startSeconds)} ↗</a></p></div>`).join('')}</details>`;}
function formatTime(seconds){seconds=Math.floor(Number(seconds)||0);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function timestampUrl(value,seconds){const safe=safeUrl(value);if(safe==='#'||seconds===undefined)return safe;const url=new URL(safe);url.searchParams.set('t',String(seconds));return url.href;}
function showDialog(html){$('#detail-dialog').classList.remove('library-dialog');$('#dialog-content').innerHTML=html;if(!$('#detail-dialog').open)$('#detail-dialog').showModal();attachImageFallbacks($('#detail-dialog'));}
function showLibrary(options={}){
 const sources=state.library.sources,read=sources.filter(s=>s.read),videos=sources.filter(s=>['bilibili','youtube'].includes(s.platform)),webSources=sources.filter(s=>s.platform==='web'),mapped=new Set(state.library.metaObservations.map(row=>row.heroId));
 showDialog(`<div class="dialog-copy"><span class="eyebrow">RESEARCH LIBRARY</span><h2>把观点放回它的版本里。</h2><p>地图结构可参考旧教学，并核对是否改图；具体英雄强度、选人和配装优先近三个月。综合榜只在地图与配合适配相同的候选中微调。</p><div class="method-stat"><div><strong>${videos.length}</strong>已发现视频</div><div><strong>${webSources.length}</strong>网页数据来源</div><div><strong>${mapped.size}</strong>有分档记录的英雄</div></div><p class="form-note">发现、读取和视觉核验分别记录。地图统计候选与英雄强度排名分开；网页样本可能混合排位与普通3v3。数据截至 ${e(state.library.asOf)}，强度筛选按使用当天滚动计算三个月；当前判断日期 ${e(state.evaluationDate)}。</p><div class="library-filters"><input id="library-search" type="search" placeholder="搜索标题、作者或英雄" aria-label="搜索资料"><select id="library-platform" aria-label="资料平台"><option value="">全部来源</option><option value="bilibili">B站</option><option value="youtube">YouTube</option><option value="web">网页统计</option></select></div><div class="library-checks"><label class="check"><input id="library-read" type="checkbox">只看已读取内容</label><label class="check"><input id="library-recent" type="checkbox">只看近三个月数据</label></div><p class="form-note" id="library-count" role="status"></p><div id="library-results"></div></div>`);
 $('#detail-dialog').classList.add('library-dialog');
 const mapSelect=document.createElement('select');mapSelect.id='library-map';mapSelect.setAttribute('aria-label','按地图筛选视频');mapSelect.innerHTML='<option value="">全部地图主题</option>'+[...state.knowledge.keys()].map(id=>{const m=state.catalog.maps.find(m=>m.id===id);return `<option value="${id}">${e(m.name)} · ${e(m.modeName)}</option>`;}).join('');$('.library-filters').append(mapSelect);mapSelect.value=options.mapId?String(options.mapId):'';
 const render=()=>{
  const q=$('#library-search').value.trim().toLocaleLowerCase();
  const relevantIds=$('#library-map').value?new Set((state.knowledge.get(Number($('#library-map').value))?.evidence||[]).map(r=>r.sourceId)):null;
  const rows=sources.filter(s=>(!relevantIds||relevantIds.has(s.id))&&(!$('#library-platform').value||s.platform===$('#library-platform').value)&&(!$('#library-read').checked||s.read)&&(!$('#library-recent').checked||recentStrength(s.dataAsOf||s.publishedAt,state.evaluationDate))).filter(s=>{
   if(!q)return true;
   const heroes=state.library.claims.filter(c=>c.sourceId===s.id).flatMap(c=>c.heroIds||[]).map(id=>heroById.get(id)?.name||'');
   const tierHeroes=state.library.metaObservations.filter(c=>c.sourceId===s.id).map(c=>heroById.get(c.heroId)?.name||'');
   const mapNames=state.library.mapEvidence.filter(r=>r.sourceId===s.id).flatMap(r=>{const map=state.catalog.maps.find(m=>m.id===r.mapId);return map?[map.name,map.en,...map.aliases]:[];});
   return [s.title,s.author,...heroes,...tierHeroes,...mapNames].join(' ').toLocaleLowerCase().includes(q);
  });
  $('#library-count').textContent=`${rows.length} 条结果 · 已读取内容 ${rows.filter(s=>s.read).length} 条`;
  $('#library-results').innerHTML=rows.length?rows.map(s=>{
   const selectedMap=Number($('#library-map').value)||null;
   const notes=state.library.claims.filter(c=>c.sourceId===s.id&&(!selectedMap||c.mapId===selectedMap)),mapNotes=state.library.mapEvidence.filter(c=>c.sourceId===s.id&&(!selectedMap||c.mapId===selectedMap)),tierRows=selectedMap?[]:state.library.metaObservations.filter(c=>c.sourceId===s.id);
   const tiers=[...new Set(tierRows.map(c=>c.tier))];
   const isWeb=s.platform==='web';
   return `<article class="library-card"><div class="library-card-top"><span class="platform-label">${isWeb?'网页统计':s.platform==='bilibili'?'B站':'YouTube'}</span><span class="read-state ${s.read?'read':''}">${s.read?(isWeb?'已读取数据与范围':'已读取内容片段'):s.visualChecked?'已看关键画面 · 无语音转写':s.status==='subtitle_download_failed_429'?'字幕请求受限 · 未读取':'已发现 · 尚未读取'}</span></div><a class="library-title" href="${e(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.title)} ↗</a><p class="library-meta">${e(s.author)} · ${isWeb?'读取于 '+e(s.retrievedAt||'日期未核实'):'发布 '+e(s.publishedAt?.slice(0,10)||'日期未核实')}${s.dataAsOf?' · 内容数据截至 '+e(s.dataAsOf.slice(0,10)):''} · ${isWeb?'地图候选数据，不参与英雄强度排名':recentStrength(s.dataAsOf||s.publishedAt,state.evaluationDate)?'近三个月':'旧资料／日期未知，仅审慎参考地形机制'}</p>${s.read?`<details><summary>查看已整理观点、范围与分档（${notes.length+mapNotes.length} 条观点${tierRows.length?' / '+tierRows.length+' 条分档':''}）</summary>${s.reviewedRangesSeconds?.length?`<p class="form-note">已读范围：${s.reviewedRangesSeconds.map(r=>Array.isArray(r)?formatTime(r[0])+'–'+formatTime(r[1]):e(String(r))).join('、')}</p>`:''}${notes.map(c=>`<div class="library-claim"><a href="${e(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">${formatTime(c.startSeconds)} ↗</a><p>${e(c.summary)}</p><small>${e(c.condition||'保留原视频适用条件。')}${c.confidence==='medium'?' · 自动转写专名待复核，不用于强度加权':''}</small></div>`).join('')}${mapNotes.map(c=>{const m=state.catalog.maps.find(m=>m.id===c.mapId);return `<div class="library-claim"><a href="${e(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">${e(m?.name||(c.variantOnly?'活动变体':c.mapId??'地图未匹配'))}${c.startSeconds!==undefined?' · '+formatTime(c.startSeconds):''} ↗</a><p>${e(c.summary)}</p><small>地图样本混合排位与普通3v3；用于地图候选筛选，不是强度排名或完整阵容胜率。</small></div>`;}).join('')}${tiers.length?`<div class="tier-records">${tiers.map(tier=>`<div><strong>${e(tier)}</strong><p>${tierRows.filter(row=>row.tier===tier).map(row=>`${e(heroById.get(row.heroId)?.name||row.heroId)}${row.prediction?'（预测，不加权）':row.disputed?'（口播有分歧，不加权）':''}`).join(' · ')}</p></div>`).join('')}</div>`:''}${!notes.length&&!mapNotes.length&&!tierRows.length?'<p class="form-note">已读内容的机制与条件保留在地图卡片中，未额外生成当前强度分档。</p>':''}</details>`:'<p class="form-note">尚未读取实际内容，不参与推荐或强度加权。</p>'}</article>`;
  }).join(''):'<p class="empty-list">没有符合筛选条件的视频。</p>';
  rows.forEach((source,index)=>{const card=$('#library-results').children[index];const notes=[...(source.validityNotes||[]),...(source.possibleSharedUpstream?['可能与其他榜单共享上游资料，不能当作独立统计共识。']:[])];if(notes.length){const note=document.createElement('p');note.className='form-note review-alert';note.textContent='来源条件：'+notes.join(' ');card.append(note);}if(source.status==='audio-transcription-empty-visual-review-required')card.querySelector('.read-state').textContent='转写未获语音 · 待看画面';});
 };
 for(const id of ['library-search','library-platform','library-read','library-recent','library-map'])$('#'+id).addEventListener(id==='library-search'?'input':'change',render);
 render();
}
function showHero(id){
 const h=heroById.get(id),meta=state.meta.get(id);
 const notes=[...state.knowledge.values()].flatMap(k=>{const c=k.candidates.find(c=>c.heroId===id);if(!c)return [];const m=state.catalog.maps.find(m=>m.id===k.mapId);return [{map:m,candidate:c}];});
 const covered=new Set(notes.map(n=>n.map.id));
 for(const p of state.data.maps){const c=p.candidates.find(c=>c.heroEn===h.en);if(c&&!covered.has(p.mapId))notes.push({map:state.catalog.maps.find(m=>m.id===p.mapId),candidate:{roles:[c.role],fresh:recentStrength(sourceById.get(c.sourceId)?.publishedAt,state.evaluationDate),details:[{condition:c.condition}]}});}
 const classes={'Damage Dealer':'输出','Tank':'坦克','Marksman':'射手','Artillery':'投掷','Controller':'控场','Assassin':'刺客','Support':'支援'};
 showDialog(`<div class="dialog-copy">${picture(h.image,h.name,'hero-portrait')}<span class="eyebrow">BRAWLER PROFILE</span><h2>${e(h.name)} <small>${e(h.en)}</small></h2><p>${e(classes[h.class]||h.class)} · ${e(h.rarity)}</p><h3>已整理的地图职责</h3>${notes.length?notes.map(n=>`<p><strong>${e(n.map.name)} · ${e(n.candidate.roles.join(' / ')||'地图候选')}</strong><br>${n.candidate.fresh?'近三个月点名，具体版本与阵容仍待复核。':'历史教学候选，仅保留机制参考。'}<br>${(n.candidate.details||[]).slice(0,2).map(d=>e(d.condition||(d.conditions||[]).join('；'))).join('<br>')}</p>`).join(''):'<p>暂无明确点名的地图职责，不能从综合榜直接推断地图适配。</p>'}<h3>近三个月综合强度参考</h3>${meta?meta.evidence.map(row=>`<p><a href="${e(safeUrl(row.url||row.source.url))}" target="_blank" rel="noopener noreferrer">${e(row.tier)} · ${e(rankingSourceLabel(row.source))} · ${e(row.source.publishedAt.slice(0,10))} ↗</a><br>${e(row.note||'保留原作者判断与条件。')}</p>`).join(''):'<p>暂无可参与加权的近期明确分档。</p>'}${meta?.rankEvidence?.length?`<h3>作者 Top 10 名次（不转换为S/A档）</h3>${meta.rankEvidence.map(r=>`<p><a href="${e(safeUrl(r.url))}" target="_blank" rel="noopener noreferrer">第${r.rank}名 · ${e(r.source.author)} · ${e(r.source.publishedAt.slice(0,10))} ↗</a><br>${e(r.note)}</p>`).join('')}`:''}<h3>英雄介绍 · 原始英文资料</h3><p>${e(h.description)}</p><p class="meta">技能数值尚未校验，不从占位符生成数值。下列名称用于查阅原始资料。</p><h3>妙具</h3><p>${h.gadgets.map(g=>e(g.name)).join(' / ')||'暂无资料'}</p><h3>星辉之力</h3><p>${h.starPowers.map(g=>e(g.name)).join(' / ')||'暂无资料'}</p><p><a href="${e(safeUrl(h.source))}" target="_blank" rel="noopener noreferrer">查看英雄原始资料 ↗</a></p></div>`);
}
function showFeedback(p,t){const records=loadSaved(storage,'brawl-feedback',[]);showDialog(`<div class="dialog-copy"><span class="eyebrow">PLAYTEST NOTES</span><h2>记录你们的实战反馈</h2><p>${e(p.nameZh)} · ${e(t.title)}</p><p class="form-note">只保存在这台设备的浏览器中，不会上传。对手阵容、版本和具体问题比单场胜负更有帮助。</p><form class="feedback-form" id="feedback-form"><label for="feedback-type">这次发现了什么？</label><select id="feedback-type"><option>配合顺畅，职责明确</option><option>存在明显阵容弱点</option><option>地图／英雄资料有误</option><option>当前版本可能已不适用</option><option>其他观察</option></select><label for="feedback-text">具体记录</label><textarea id="feedback-text" maxlength="2000" required placeholder="例如：对方阵容、我们使用的配置、哪一条路线难以处理…"></textarea><button class="action primary" type="submit">保存到本机</button> <button class="action" type="button" id="export-feedback">导出全部记录（${Array.isArray(records)?records.length:0}）</button></form></div>`);$('#feedback-form').addEventListener('submit',event=>{event.preventDefault();const existing=loadSaved(storage,'brawl-feedback',[]);const list=Array.isArray(existing)?existing:[];list.push({mapId:p.mapId,teamId:t.id,type:$('#feedback-type').value,text:$('#feedback-text').value.trim(),createdAt:new Date().toISOString()});if(save('brawl-feedback',list)){$('#detail-dialog').close();toast('反馈已保存在本机，可随时导出');}});$('#export-feedback').addEventListener('click',()=>downloadJson('brawl-playtest-notes.json',loadSaved(storage,'brawl-feedback',[])));}
function downloadJson(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function copy(text,message){try{await navigator.clipboard.writeText(text);toast(message);}catch{showDialog(`<div class="dialog-copy"><h2>复制内容</h2><p>浏览器未开放剪贴板，可选中下面内容复制。</p><textarea aria-label="待复制内容" style="width:100%;min-height:180px;font-size:16px">${e(text)}</textarea></div>`);}}
function updateFilters(){for(const [selector,active]of[['#pilot-toggle',state.pilotOnly],['#research-toggle',state.researchOnly],['#all-toggle',!state.pilotOnly&&!state.researchOnly],['#favorites-toggle',state.favoritesOnly]]){const b=$(selector);b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);}renderList();}
function showAbout(){
 const count=state.data.maps.reduce((n,m)=>n+m.teams.length,0),read=state.library.sources.filter(s=>s.read),videos=state.library.sources.filter(s=>['bilibili','youtube'].includes(s.platform)),web=state.library.sources.filter(s=>s.platform==='web');
 showDialog(`<div class="dialog-copy"><span class="eyebrow">ABOUT THE LAB</span><h2>先看依据，再看阵容。</h2><p>为中等偏上玩家的三人组队设计。以攻略证据、地图结构和职责互补整理方案，不提供交互式 BP；职业选禁作为配合案例学习，不声称已经算出当前最强阵容。</p><div class="method-stat"><div><strong>${state.knowledge.size}</strong>有资料的地图</div><div><strong>${state.data.maps.length}</strong>有阵容的地图</div><div><strong>${count}</strong>机制推导阵容</div></div><h3>证据与验证状态</h3><p>${e(state.data.notice)}</p><p>资料库有 ${videos.length} 条视频来源（已读取 ${read.filter(s=>['bilibili','youtube'].includes(s.platform)).length} 条）和 ${web.length} 条网页来源。只有明确标记的来源核对过关键画面；自动字幕、音频转写可能误认专名。网页地图样本用于候选筛选，不当作英雄综合强度排名或三人队胜率。</p><h3>时效、分歧与地图变体</h3><p>英雄强度按使用当天滚动筛选三个月；地图结构可以参考旧资料，但仍需核对是否改动。超级猪猪等变体不自动套用到普通地图。综合榜只在地图和配合适配相同的方案内微调，作者分歧保留。</p><h3>资料更新与名称</h3><p>基础游戏数据生成于 ${e(state.catalog.generatedAt.slice(0,10))}，抓取于 ${e(state.catalog.fetchedOn)}。${e(state.catalog.localeNote)} 当前排位轮换与国服完整补丁同步仍需单独核实。</p><h3>隐私与反馈</h3><p>收藏和实战反馈只存本机浏览器，支持导出。清除网站数据会删除记录。无账号、无分析追踪。</p><h3>素材来源</h3><p>地图和头像来自Brawlify公开仓库，素材归Supercell及相关权利人所有。本工具与Supercell无隶属关系。</p><p><a href="https://brawlapi.com/api" target="_blank" rel="noopener noreferrer">BrawlAPI ↗</a> · <a href="https://github.com/Brawlify/CDN" target="_blank" rel="noopener noreferrer">Brawlify CDN ↗</a></p></div>`);
}

async function init(){
  try{
    const responses=await Promise.all([fetch('data/catalog.json'),fetch('data/recommendations.json'),fetch('data/patch-review.json'),fetch('data/library.json'),fetch('data/pro-drafts.json')]);
    if(responses.some(r=>!r.ok))throw new Error('数据文件无法载入');
    [state.catalog,state.data,state.patches,state.library,state.pro]=await Promise.all(responses.map(r=>r.json()));
    state.knowledge=indexMapKnowledge(state.library,state.catalog,state.evaluationDate);
    state.meta=metaByHero({...state.library,asOf:state.evaluationDate});state.data.maps.forEach(m=>{m.teams=orderTeams(m.teams,state.meta);});
    heroById=new Map(state.catalog.heroes.map(h=>[h.id,h]));pilotById=new Map(state.data.maps.map(m=>[m.mapId,m]));sourceById=new Map(state.data.sources.map(s=>[s.id,s]));
    const modes=[...new Map(state.catalog.maps.map(m=>[m.mode,m.modeName]))];
    for(const [value,label]of modes){const option=document.createElement('option');option.value=value;option.textContent=label;$('#mode').append(option);}
    const requested=Number(new URL(location.href).searchParams.get('map'));if(state.catalog.maps.some(m=>m.id===requested)){state.mapId=requested;state.pilotOnly=pilotById.has(requested);if(state.catalog.maps.find(m=>m.id===requested).disabled)$('#retired').checked=true;}
    $('#search').addEventListener('input',renderList);$('#mode').addEventListener('change',renderList);$('#retired').addEventListener('change',renderList);
    $('#pilot-toggle').addEventListener('click',()=>{state.pilotOnly=true;state.researchOnly=false;updateFilters();});$('#research-toggle').addEventListener('click',()=>{state.researchOnly=true;state.pilotOnly=false;updateFilters();});$('#all-toggle').addEventListener('click',()=>{state.pilotOnly=false;state.researchOnly=false;updateFilters();});$('#favorites-toggle').addEventListener('click',()=>{state.favoritesOnly=!state.favoritesOnly;updateFilters();});
    $('#about-button').addEventListener('click',showAbout);$('#catalog-date').textContent=`资料整理：${state.data.updatedAt} · ${state.data.version}`;
    $('#library-button').addEventListener('click',showLibrary);
    updateFilters();renderContent();renderRankings();renderProHub();
  }catch(error){$('#content').innerHTML=`<div class="error-banner"><strong>资料暂时无法打开</strong><p>${e(error.message)}。请刷新重试；本地运行请使用 npm run dev 打开网页。</p><button class="action" onclick="location.reload()">重新载入</button></div>`;$('#result-count').textContent='载入失败';}
}
$('#close-dialog').addEventListener('click',()=>$('#detail-dialog').close());
document.querySelectorAll('.top-nav a').forEach(link=>link.addEventListener('click',()=>{document.querySelectorAll('.top-nav a').forEach(item=>item.classList.toggle('nav-current',item===link));}));
$('#detail-dialog').addEventListener('click',event=>{if(event.target===$('#detail-dialog')){const box=event.target.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)event.target.close();}});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#detail-dialog').open){event.preventDefault();$('#search').focus();}});
init();
