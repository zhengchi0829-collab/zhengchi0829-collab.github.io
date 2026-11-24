(function(){
"use strict";
// Preserve the one odds panel. The retired pages are retained only for
// initialization of the legacy inline script, not exposed in navigation.
document.getElementById("hz-cached-odds")?.remove();
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const defs=[
 ["足球","英超","soccer/eng.1"],["足球","西甲","soccer/esp.1"],["足球","德甲","soccer/ger.1"],["足球","義甲","soccer/ita.1"],["足球","法甲","soccer/fra.1"],["足球","歐冠","soccer/uefa.champions"],
 ["籃球","NBA","basketball/nba"],["籃球","NCAA","basketball/mens-college-basketball"],["籃球","NBL","basketball/nbl"],["籃球","TPBL","basketball/tpbl"],
 ["棒球","MLB","baseball/mlb"],["棒球","NPB","baseball/npb"],["棒球","KBO","baseball/kbo"],["棒球","CPBL","baseball/cpbl"],["棒球","MiLB","baseball/milb"]
];
const base="https://site.api.espn.com/apis/site/v2/sports/";
const proxy="https://hz-sports-odds.onrender.com/api/espn?url=";
const icons={"足球":"⚽","籃球":"🏀","棒球":"⚾"};
const main=document.querySelector("main.content"),side=$("sidebar");
if(!main||!side||$("injuries")||$("prediction-performance"))return;
const old=["history","calculators","settings"];
const names={"injuries":"球員傷停資訊","prediction-performance":"AI 歷史預測績效"};
const navHTML=(id,icon)=>'<a href="#'+id+'" class="side-item" data-target="'+id+'"><span>'+icon+'</span>'+names[id]+'<small>›</small></a>';
const oldAnchor=side.querySelector('[data-target="history"]');
if(oldAnchor)oldAnchor.insertAdjacentHTML("beforebegin",navHTML("injuries","✚")+navHTML("prediction-performance","▥"));
else side.querySelector(".sidebar-note")?.insertAdjacentHTML("beforebegin",navHTML("injuries","✚")+navHTML("prediction-performance","▥"));
const homeLink=(id,icon,copy)=>'<a class="home-tool" href="#'+id+'"><span>'+icon+'</span><div><strong>'+names[id]+'</strong><p>'+copy+'</p></div><b>↗</b></a>';
const homeHistory=document.querySelector('#home a[href="#history"]');
if(homeHistory)homeHistory.insertAdjacentHTML("beforebegin",homeLink("injuries","✚","查詢球員傷病、出賽狀態與來源更新資訊")+homeLink("prediction-performance","▥","檢視賽前預測紀錄與歷史模型回測"));
const mobile=document.querySelector(".mobile-nav");
const mobileOld=mobile?.querySelector('a[href="#calculators"]');
if(mobileOld)mobileOld.insertAdjacentHTML("beforebegin",'<a href="#injuries"><b>✚</b>傷停</a><a href="#prediction-performance"><b>▥</b>績效</a>');
for(const id of old){
 document.querySelectorAll('a[href="#'+id+'"]').forEach(a=>a.remove());
 const section=$(id);if(section){section.hidden=true;section.setAttribute("aria-hidden","true")}
}
const sportsOptions=Object.keys(icons).map(k=>'<option value="'+k+'"'+(k==="籃球"?" selected":"")+'>'+icons[k]+" "+k+'</option>').join("");
const selector=(prefix)=>'<label>球類<select id="'+prefix+'-sport">'+sportsOptions+'</select></label><label>聯賽<select id="'+prefix+'-league"></select></label>';
const metric=(title,value,sub)=>'<div class="hz-r-metric"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></div>';
const info=(t)=>'<div class="hz-r-empty">'+esc(t)+'</div>';
main.insertAdjacentHTML("beforeend",'<section class="page" id="injuries"><div class="title-row"><div><h1>球員傷停資訊</h1><p>按球類、聯賽及球隊查詢公開傷病報告與出賽狀態</p></div><span class="tag">Hz SPORTS · 傷停資訊</span></div><div class="surface padded"><div class="hz-r-controls">'+selector("hz-injury")+'<label>球隊<select id="hz-injury-team"><option value="">全部球隊</option></select></label><label>搜尋球員<input id="hz-injury-search" placeholder="輸入姓名、隊伍或狀態"></label><button type="button" class="primary" id="hz-injury-refresh">↻ 更新傷停</button></div><p id="hz-injury-status" class="subtle" role="status" aria-live="polite">選擇聯賽查詢傷停報告。</p></div><div id="hz-injury-kpis" class="hz-r-metrics"></div><div id="hz-injury-results" class="surface padded" aria-live="polite">'+info("尚未讀取資料")+'</div></section>'+
 '<section class="page" id="prediction-performance"><div class="title-row"><div><h1>AI 歷史預測績效</h1><p>封存賽前預測、核對終場賽果及獨立歷史基準回測</p></div><span class="tag">Hz SPORTS · 績效驗證</span></div><div class="surface padded"><div class="hz-r-controls">'+selector("hz-perf")+'<label>統計期間<select id="hz-perf-days"><option value="30">近 30 天</option><option value="60" selected>近 60 天</option><option value="90">近 90 天</option></select></label><button type="button" class="primary" id="hz-perf-refresh">↻ 查詢績效</button></div><p id="hz-perf-status" class="subtle" role="status" aria-live="polite">選擇聯賽及期間後讀取資料。</p></div><div class="surface padded"><h2>賽前封存 AI 預測實績</h2><p class="subtle">只計入已在開賽前封存、隊伍及賽事相符且能取得終場比分的預測；未核對不列入命中率。</p><div id="hz-perf-kpis" class="hz-r-metrics"></div><div id="hz-perf-results">'+info("尚未取得賽前封存紀錄。")+'</div></div><div class="surface padded"><h2>歷史戰力基準回測（非 AI 實績）</h2><p class="subtle">以真實歷史比分測試 Elo 戰力基準，僅使用當場開賽至少 24 小時前已開始的歷史賽事，前半期間作暖身，後半期間評估。這不是已封存的 AI 預測紀錄。</p><div id="hz-backtest-kpis" class="hz-r-metrics"></div><div id="hz-backtest-results">'+info("等待歷史賽果來源")+'</div></div></section>');
const style=document.createElement("style");
style.id="hz-research-tools-style";
style.textContent="#injuries .hz-r-controls,#prediction-performance .hz-r-controls{display:flex;gap:12px;align-items:end;flex-wrap:wrap}.hz-r-controls label{flex:1 1 140px;min-width:120px;color:var(--muted);font-size:13px}.hz-r-controls input,.hz-r-controls select{display:block;width:100%;margin-top:7px;padding:11px 12px;border-radius:8px;background:#102731;border:1px solid #315766;color:var(--text);min-height:44px}.hz-r-controls .primary{min-height:44px}.hz-r-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:12px;margin:0 0 18px}.hz-r-metric{padding:16px;border:1px solid #315766;border-radius:10px;background:#10232e;display:grid;gap:6px}.hz-r-metric span,.hz-r-metric small{color:var(--muted);font-size:12px}.hz-r-metric strong{font-size:26px;line-height:1.2;color:#c6f66b;font-variant-numeric:tabular-nums}.hz-r-empty{padding:22px 16px;color:var(--muted);border:1px dashed #365765;border-radius:9px;text-align:center}.hz-r-table{width:100%;border-collapse:collapse;min-width:570px}.hz-r-table th,.hz-r-table td{text-align:left;padding:12px 10px;border-bottom:1px solid #274451;vertical-align:top;white-space:normal}.hz-r-table th{color:var(--muted);font-size:12px;white-space:nowrap}.hz-r-table td{font-size:14px}.hz-r-scroll{overflow-x:auto}.hz-r-status{display:inline-block;padding:4px 9px;border-radius:6px;border:1px solid #446475;white-space:nowrap;color:#c4d9e3}.hz-r-status.out{color:#ffc4c0;border-color:#885451;background:#492a2b}.hz-r-status.warn{color:#ffdfa4;border-color:#806942;background:#423720}.hz-r-status.ok{color:#c5efb0;border-color:#547b52;background:#28482f}.hz-r-source{color:var(--muted);font-size:12px;margin-top:14px;overflow-wrap:anywhere}.hz-r-source a{text-decoration:underline}.hz-r-note{display:block;color:var(--muted);font-size:12px;margin-top:5px}.hz-r-player{font-weight:700}.hz-r-team{color:var(--muted);font-size:12px;margin-top:4px}@media(max-width:600px){.hz-r-controls label{flex:1 1 calc(50% - 12px);min-width:100px}.hz-r-controls .primary{width:100%}.hz-r-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.hz-r-metric strong{font-size:22px}.mobile-nav a{min-width:0;flex:1;text-align:center}}";
document.head.appendChild(style);
const textValue=(x)=>typeof x==="string"||typeof x==="number"?String(x):"";
const nameOf=(t)=>window.hzTeamBilingual?.(t)||t?.displayName||t?.name||t?.shortDisplayName||"未標示球隊";
const fmtTime=v=>{const t=new Date(v);return v&&Number.isFinite(t.getTime())?t.toLocaleString("zh-TW",{timeZone:"Asia/Taipei",hour12:false}):"未標示"};
const dateKey=t=>new Date(t).toISOString().slice(0,10).replace(/-/g,"");
const statusMap={"out":"缺陣","doubtful":"出賽成疑（偏低）","questionable":"出賽成疑","probable":"可能出賽","day-to-day":"每日評估","day to day":"每日評估","injured reserve":"傷病名單","injured list":"傷病名單","injured":"傷病","suspended":"禁賽","available":"可出賽","active":"可出賽","game time decision":"賽前決定","game-time decision":"賽前決定","10-day il":"10 天傷病名單","15-day il":"15 天傷病名單","60-day il":"60 天傷病名單"};
function injuryStatus(v){
 const raw=textValue(v)||"來源未標示";
 const key=raw.trim().toLowerCase();
 return {raw,label:statusMap[key]||raw,kind:/^(out|injured reserve|injured list|suspended|[0-9]+-day il)$/.test(key)?"out":/questionable|doubtful|day.to.day|probable|decision/.test(key)?"warn":/^(active|available)$/.test(key)?"ok":""};
}
function injuryRows(data){
 if(!data||typeof data!=="object")throw Error("INVALID_INJURY_RESPONSE");
 const top=Array.isArray(data)?data:Array.isArray(data.injuries)?data.injuries:null;
 if(!top)throw Error("INJURY_DATA_NOT_EXPOSED");
 const rows=[],seen=new Set();
 let recognized=top.length===0;
 const walk=(entry,team,athlete,depth)=>{
   if(!entry||typeof entry!=="object"||depth>3)return;
   const a=entry.athlete||entry.player||athlete;
   if(Array.isArray(entry.injuries)){
     recognized=true;
     const groupTeam=entry.team||(a?team:entry.displayName||entry.name?{id:entry.id,displayName:entry.displayName||entry.name}:team);
     for(const child of entry.injuries)walk(child,groupTeam,a,depth+1);
     return;
   }
   const player=a||((entry.fullName||entry.displayName)&&(entry.status||entry.details||entry.shortComment)?entry:null);
   if(!player)return;
   const playerName=textValue(player.displayName||player.fullName||player.name);
   if(!playerName)return;
   recognized=true;
   const t=entry.team||player.team||team;
   const teamName=t?nameOf(t):"未標示球隊";
   const details=entry.details||{};
   const st=injuryStatus(entry.status?.name||entry.status?.description||entry.status||entry.type?.description||entry.type?.name);
   const id=[textValue(t?.id)||teamName,textValue(player.id)||playerName,textValue(entry.id)||st.raw,textValue(entry.date)].join("|");
   if(seen.has(id))return;seen.add(id);
   const injury=[textValue(details.type),textValue(details.location),textValue(details.side)].filter(Boolean).join(" · ");
   const comment=textValue(entry.shortComment||entry.longComment||entry.description||injury);
   rows.push({id,player:playerName,team:teamName,status:st,injury,comment,date:textValue(entry.date||entry.updated),returnDate:textValue(details.returnDate||entry.returnDate)});
 };
 for(const entry of top)walk(entry,null,null,0);
 if(!recognized||top.length>0&&!rows.length&&top.some(x=>!Array.isArray(x?.injuries)||x.injuries.length>0))throw Error("UNKNOWN_INJURY_FORMAT");
 return rows;
}
async function json(url,ms=8500){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);
 try{const r=await fetch(url,{signal:c.signal,cache:"no-store",credentials:"omit"});if(!r.ok)throw Error("HTTP "+r.status);return await r.json()}finally{clearTimeout(timer)}
}
async function source(resource){
 const url=base+resource;
 try{return await json(url)}catch(e){return json(proxy+encodeURIComponent(url),16000)}
}
function fillLeagues(prefix){
 const sport=$(prefix+"-sport").value,select=$(prefix+"-league"),old=select.value;
 select.innerHTML=defs.filter(x=>x[0]===sport).map(x=>'<option value="'+esc(x[2])+'">'+esc(x[1])+'</option>').join("");
 if([...select.options].some(x=>x.value===old))select.value=old;
}
function table(head,body){
 return '<div class="hz-r-scroll"><table class="hz-r-table"><thead><tr>'+head.map(x=>'<th>'+esc(x)+'</th>').join("")+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}
let injuryReq=0,injuryData=[],injuryReady=false,injuryReadAt=null,injurySource="";
function showInjuries(){
 const q=$("hz-injury-search").value.trim().toLowerCase(),team=$("hz-injury-team").value;
 const rows=injuryData.filter(r=>(!team||r.team===team)&&(!q||[r.player,r.team,r.status.label,r.status.raw,r.injury,r.comment].join(" ").toLowerCase().includes(q)));
 $("hz-injury-kpis").innerHTML=metric("傷停／出賽紀錄",rows.length,"來源列出的人次")+metric("缺陣／傷病名單",rows.filter(r=>r.status.kind==="out").length,"含來源列出的禁賽")+metric("出賽待定",rows.filter(r=>r.status.kind==="warn").length,"含可能出賽、賽前決定");
 const sourceNote='<div class="hz-r-source">資料來源：<a target="_blank" rel="noopener noreferrer" href="'+esc(injurySource)+'">ESPN 公開傷停報告</a>｜讀取時間：'+esc(fmtTime(injuryReadAt))+'（不等於官方發布時間）</div>';
 if(!rows.length){$("hz-injury-results").innerHTML=info(injuryData.length?"沒有符合篩選條件的球員。":"來源本次未列出傷停紀錄，不代表全員健康。")+sourceNote;return}
 $("hz-injury-results").innerHTML=table(["球員／球隊","出賽狀態","傷病原因／來源原文","紀錄日期","預計回歸（來源）"],rows.map(r=>'<tr><td><div class="hz-r-player">'+esc(r.player)+'</div><div class="hz-r-team">'+esc(r.team)+'</div></td><td><span class="hz-r-status '+r.status.kind+'">'+esc(r.status.label)+'</span><small class="hz-r-note">'+esc(r.status.raw)+'</small></td><td>'+esc(r.injury||r.comment||"來源未標示")+(r.injury&&r.comment&&r.injury!==r.comment?'<small class="hz-r-note">'+esc(r.comment)+'</small>':'')+'</td><td>'+esc(fmtTime(r.date))+'</td><td>'+esc(fmtTime(r.returnDate))+'</td></tr>').join(""))+sourceNote;
}
async function loadInjuries(){
 const id=++injuryReq,lg=$("hz-injury-league").value,btn=$("hz-injury-refresh");
 injuryReady=true;injuryData=[];btn.disabled=true;btn.textContent="更新中…";
 $("hz-injury-status").textContent="正在讀取 "+(defs.find(x=>x[2]===lg)?.[1]||"聯賽")+" 傷停報告…";
 $("hz-injury-team").innerHTML='<option value="">全部球隊</option>';
 $("hz-injury-kpis").innerHTML="";
 $("hz-injury-results").innerHTML=info("查詢來源資料中…");
 try{
 const data=await source(lg+"/injuries");if(id!==injuryReq)return;
 injuryData=injuryRows(data);injuryReadAt=new Date().toISOString();injurySource=base+lg+"/injuries";
 const teams=[...new Set(injuryData.map(r=>r.team))].sort((a,b)=>a.localeCompare(b,"zh-Hant"));
 $("hz-injury-team").innerHTML='<option value="">全部球隊</option>'+teams.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join("");
 $("hz-injury-status").textContent="來源回傳 "+injuryData.length+" 筆傷停／出賽狀態紀錄。";
 showInjuries();
 }catch(e){if(id!==injuryReq)return;$("hz-injury-status").textContent="此聯賽目前無法取得有效傷停報告。";
 $("hz-injury-results").innerHTML=info("來源未提供此聯賽的傷停欄位，或連線暫時失敗。這不代表沒有傷病。")+'<p class="hz-r-source"><a href="'+esc(base+lg+"/injuries")+'" target="_blank" rel="noopener noreferrer">檢查 ESPN 原始來源</a></p>';
 }finally{if(id===injuryReq){btn.disabled=false;btn.textContent="↻ 更新傷停"}}
}
function finalMatch(e){
 const c=e?.competitions?.[0],st=c?.status?.type||e?.status?.type;
 if(!c||!st||st.state!=="post"||/cancel|postpon|abandon|suspend|forfeit/i.test([st.name,st.description,st.detail].join(" "))||!(st.completed===true||/final|complete|full.time/i.test([st.name,st.description].join(" "))))return null;
 const hs=c.competitors?.find(t=>t.homeAway==="home"),as=c.competitors?.find(t=>t.homeAway==="away");
 if(!hs||!as||hs.score===undefined||hs.score===null||hs.score===""||as.score===undefined||as.score===null||as.score==="")return null;
 const h=Number(hs.score),a=Number(as.score),start=Date.parse(e.date||c.date);
 const homeId=textValue(hs.team?.id||hs.id),awayId=textValue(as.team?.id||as.id),eventId=textValue(e.id);
 if(!eventId||!homeId||!awayId||homeId===awayId||!Number.isFinite(start)||!Number.isFinite(h)||!Number.isFinite(a)||h<0||a<0)return null;
 return {eventId,homeId,awayId,start,home:nameOf(hs.team),away:nameOf(as.team),h,a,actual:h>a?"home":h<a?"away":"draw"};
}
function dedupFinals(events,from,to){
 const seen=new Set(),out=[];
 for(const e of events){const m=finalMatch(e);if(!m||m.start<from||m.start>to||seen.has(m.eventId))continue;seen.add(m.eventId);out.push(m)}
 return out.sort((a,b)=>a.start-b.start||a.eventId.localeCompare(b.eventId));
}
function backtest(matches,split,soccer){
 const elo=new Map(),counts=new Map(),pending=[],results=[],K=24,advantage=soccer?60:50;
 const rating=id=>elo.get(id)??1500;
 const count=id=>counts.get(id)||0;
 const settle=m=>{
   const rh=rating(m.homeId),ra=rating(m.awayId),expected=1/(1+Math.pow(10,-(rh-ra+advantage)/400));
   const actual=m.actual==="home"?1:m.actual==="away"?0:0.5;
   elo.set(m.homeId,rh+K*(actual-expected));elo.set(m.awayId,ra-K*(actual-expected));
   counts.set(m.homeId,count(m.homeId)+1);counts.set(m.awayId,count(m.awayId)+1);
 };
 for(const m of [...matches].sort((a,b)=>a.start-b.start)){
   while(pending.length&&pending[0].start+86400000<=m.start)settle(pending.shift());
   if(m.start>=split&&count(m.homeId)>=3&&count(m.awayId)>=3){
     const diff=rating(m.homeId)-rating(m.awayId)+advantage;
     const predicted=soccer&&Math.abs(diff)<35?"draw":diff>=0?"home":"away";
     results.push({...m,predicted,correct:predicted===m.actual});
   }
   pending.push(m);
 }
 return results;
}
function auditRecords(records,matches,league,from,to){
 const byId=new Map(matches.map(m=>[m.eventId,m])),seen=new Set(),out=[];
 const valid=records.filter(r=>{
   const p=Date.parse(r?.publishedAt),k=Date.parse(r?.kickoff);
   return r&&r.league===league&&textValue(r.eventId)&&textValue(r.homeId)&&textValue(r.awayId)&&r.homeId!==r.awayId&&textValue(r.modelVersion)&&["home","away","draw"].includes(r.pick)&&Number.isFinite(p)&&Number.isFinite(k)&&p<k&&k>=from&&k<=to;
 }).sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt));
 for(const r of valid){
   const key=String(r.eventId);if(seen.has(key))continue;seen.add(key);
   const m=byId.get(key),p=Date.parse(r.publishedAt);
   const verified=!!m&&p<m.start&&String(r.homeId)===m.homeId&&String(r.awayId)===m.awayId&&Math.abs(Date.parse(r.kickoff)-m.start)<=86400000;
   out.push({record:r,match:verified?m:null,correct:verified?r.pick===m.actual:null});
 }
 return out;
}
let perfReq=0,perfReady=false;
async function historyScores(league,from,to,onProgress){
 const chunks=[],day=86400000;
 const begin=new Date(from);begin.setUTCHours(0,0,0,0);
 for(let t=begin.getTime();t<=to;t+=7*day)chunks.push(dateKey(t)+"-"+dateKey(Math.min(t+6*day,to)));
 const all=[],failed=[],capped=[];
 for(let i=0;i<chunks.length;i+=3){
   const part=chunks.slice(i,i+3);
   const results=await Promise.allSettled(part.map(d=>source(league+"/scoreboard?dates="+d+"&limit=500"+(league==="basketball/mens-college-basketball"?"&groups=50":""))));
   results.forEach((r,j)=>{if(r.status!=="fulfilled"||!Array.isArray(r.value?.events))failed.push(part[j]);else{all.push(...r.value.events);if(r.value.events.length>=500)capped.push(part[j])}});
   onProgress(Math.min(i+3,chunks.length),chunks.length);
 }
 return {matches:dedupFinals(all,from,to),failed,capped,chunks:chunks.length};
}
const outcome=(v,m)=>v==="draw"?"和局":v==="home"?(m?.home||"主隊"):v==="away"?(m?.away||"客隊"):"—";
const ratio=(n,d)=>d?(100*n/d).toFixed(1)+"%":"—";
function resultPill(correct){return correct===null?'<span class="hz-r-status">待核對</span>':correct?'<span class="hz-r-status ok">命中</span>':'<span class="hz-r-status out">未命中</span>'}
function renderAudit(rows,archiveOK){
 const settled=rows.filter(r=>r.correct!==null),hits=settled.filter(r=>r.correct===true).length;
 $("hz-perf-kpis").innerHTML=metric("封存預測",archiveOK?rows.length:"—","本聯賽及期間")+metric("已核對",archiveOK?settled.length:"—","排除未完賽與無法核對")+metric("命中場次",archiveOK?hits:"—","終場比分勝負／和局")+metric("實績命中率",ratio(hits,settled.length),"分母為已核對樣本");
 if(!archiveOK){$("hz-perf-results").innerHTML=info("封存紀錄來源暫不可用，不能計算 AI 歷史績效。");return}
 if(!rows.length){$("hz-perf-results").innerHTML=info("目前沒有經賽前封存的 AI 預測紀錄。網站尚未串接具可驗證歷史的預測模型，不產生虛構命中率。");return}
 $("hz-perf-results").innerHTML=table(["開賽時間","賽事","賽前預測","模型","終場比分","核對"],rows.slice().reverse().slice(0,100).map(x=>{
   const r=x.record,m=x.match;
   return '<tr><td>'+esc(fmtTime(r.kickoff))+'</td><td>'+esc(m?m.away+" VS "+m.home:r.awayId+" VS "+r.homeId)+'</td><td>'+esc(outcome(r.pick,m))+'<small class="hz-r-note">封存：'+esc(fmtTime(r.publishedAt))+'</small></td><td>'+esc(r.modelVersion)+'</td><td>'+esc(m?m.a+" : "+m.h:"待核對")+'</td><td>'+resultPill(x.correct)+'</td></tr>';
 }).join(""));
}
function renderBacktest(rows,matchCount,coverage){
 const hits=rows.filter(r=>r.correct).length;
 $("hz-backtest-kpis").innerHTML=metric("來源已完賽",matchCount,"有效終場比分")+metric("回測樣本",rows.length,"暖身後且雙方至少 3 場")+metric("回測命中",hits,"基準模型，不是 AI 實績")+metric("回測命中率",ratio(hits,rows.length),"只統計有效樣本");
 if(!rows.length){$("hz-backtest-results").innerHTML=info("來源尚無足夠的歷史賽果進行有效回測。");return}
 $("hz-backtest-results").innerHTML=table(["時間","賽事","基準預測","終場比分（客：主）","結果"],rows.slice().reverse().slice(0,100).map(m=>'<tr><td>'+esc(fmtTime(new Date(m.start).toISOString()))+'</td><td>'+esc(m.away+" VS "+m.home)+'</td><td>'+esc(outcome(m.predicted,m))+'</td><td>'+esc(m.a+" : "+m.h)+'</td><td>'+resultPill(m.correct)+'</td></tr>').join(""))+'<p class="hz-r-source">資料來源：ESPN 歷史賽果。'+esc(coverage)+'｜每隊至少有 3 場可用歷史才納入測試；足球以來源比分判定勝負／和局。最多顯示最新 100 筆，統計包含全部有效樣本。</p>';
}
async function loadPerformance(){
 const id=++perfReq,lg=$("hz-perf-league").value,days=Number($("hz-perf-days").value),btn=$("hz-perf-refresh");
 perfReady=true;btn.disabled=true;btn.textContent="查詢中…";
 const now=Date.now(),from=now-days*86400000;
 $("hz-perf-kpis").innerHTML="";$("hz-backtest-kpis").innerHTML="";
 $("hz-perf-results").innerHTML=info("讀取賽前封存紀錄…");$("hz-backtest-results").innerHTML=info("查詢真實歷史賽果…");
 $("hz-perf-status").textContent="正在查詢 "+days+" 天內的歷史賽果及模型紀錄。";
 const archive=await json("./prediction-history.json",7000).then(d=>Array.isArray(d?.records)?d.records:null).catch(()=>null);
 if(id!==perfReq)return;
 // Show genuine empty state immediately while history is being fetched.
 if(!archive||!archive.length)renderAudit([],!!archive);
 try{
 const history=await historyScores(lg,from,now,(n,total)=>{if(id===perfReq)$("hz-perf-status").textContent="正在讀取歷史賽果 "+n+"/"+total+" 個日期區間…"});
 if(id!==perfReq)return;
 const coverage="成功 "+(history.chunks-history.failed.length)+"/"+history.chunks+" 個日期區間"+(history.failed.length?"，部分資料未取得":"")+(history.capped.length?"，部分區間達回傳上限":"");
 renderAudit(auditRecords(archive||[],history.matches,lg,from,now),!!archive);
 if(history.failed.length===history.chunks){
 $("hz-backtest-results").innerHTML=info("歷史賽果來源暫時無法存取，未計算回測結果。");
 $("hz-perf-status").textContent="歷史賽果來源連線失敗。";
 }else{
 const rows=backtest(history.matches,from+(now-from)/2,lg.startsWith("soccer/"));
 renderBacktest(rows,history.matches.length,coverage);
 $("hz-perf-status").textContent=coverage+"｜已讀取 "+history.matches.length+" 場有效終場比分。";
 }
 }catch(e){if(id!==perfReq)return;renderAudit(auditRecords(archive||[],[],lg,from,now),!!archive);$("hz-backtest-results").innerHTML=info("歷史賽果讀取失敗，未產生回測數字。");$("hz-perf-status").textContent="來源暫不可用。";}
 finally{if(id===perfReq){btn.disabled=false;btn.textContent="↻ 查詢績效"}}
}
fillLeagues("hz-injury");fillLeagues("hz-perf");
$("hz-injury-sport").addEventListener("change",()=>{fillLeagues("hz-injury");loadInjuries()});
$("hz-injury-league").addEventListener("change",loadInjuries);
$("hz-injury-team").addEventListener("change",showInjuries);
$("hz-injury-search").addEventListener("input",showInjuries);
$("hz-injury-refresh").addEventListener("click",loadInjuries);
$("hz-perf-sport").addEventListener("change",()=>{fillLeagues("hz-perf");loadPerformance()});
$("hz-perf-league").addEventListener("change",loadPerformance);
$("hz-perf-days").addEventListener("change",loadPerformance);
$("hz-perf-refresh").addEventListener("click",loadPerformance);
function route(){
 const id=location.hash.slice(1);
 if(old.includes(id)){location.replace("#home");return}
 if(!names[id])return;
 const crumb=$("current-page");if(crumb)crumb.textContent=names[id];
 side.querySelectorAll(".side-item").forEach(a=>a.classList.toggle("active",a.dataset.target===id));
 if(id==="injuries"&&!injuryReady)loadInjuries();
 if(id==="prediction-performance"&&!perfReady)loadPerformance();
}
window.addEventListener("hashchange",route);route();
})();