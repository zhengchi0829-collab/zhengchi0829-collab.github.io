(function(){
"use strict";
const $=id=>document.getElementById(id), root=$("hz-live-odds");
if(!root)return;
const leagues=[
["足球","英超","soccer/eng.1"],["足球","西甲","soccer/esp.1"],["足球","德甲","soccer/ger.1"],["足球","義甲","soccer/ita.1"],["足球","法甲","soccer/fra.1"],["足球","歐冠","soccer/uefa.champions"],
["籃球","NBA","basketball/nba"],["籃球","NCAA","basketball/mens-college-basketball"],["籃球","NBL","basketball/nbl"],["籃球","TPBL","basketball/tpbl"],
["棒球","MLB","baseball/mlb"],["棒球","NPB","baseball/npb"],["棒球","KBO","baseball/kbo"],["棒球","CPBL","baseball/cpbl"],["棒球","MiLB","baseball/milb"]];
const base="https://site.api.espn.com/apis/site/v2/sports/";
const $sport=$("hz-odds-sport"),$league=$("hz-odds-league"),$match=$("hz-odds-match"),$detail=$("hz-odds-detail"),$status=$("hz-odds-status"),$refresh=$("hz-odds-refresh");
const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cn=t=>window.hzTeamBilingual?.(t)||t?.displayName||t?.name||"待確認";
const time=d=>new Date(d).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});
const logo=t=>{const url=window.hzTeamLogo?.(t);return url?'<img loading="lazy" alt="" src="'+safe(url)+'" onerror="this.hidden=true">':'<span aria-hidden="true">🏅</span>'};
const num=n=>{const v=Number(n);return Number.isFinite(v)?v:null};
const show=v=>v===null||v===undefined||v===""?"暫無賠率":safe(v);
function ml(value){if(value===null||value===undefined||value==="")return null;const v=Number(value);if(!Number.isFinite(v))return null;const dec=v>0?1+v/100:v<0?1+100/Math.abs(v):null;return dec?dec.toFixed(2):null}
const decimalValue=(raw,decimal)=>{if(decimal!==undefined&&decimal!==null&&decimal!==""){const v=Number(decimal);if(v>1&&Number.isFinite(v))return v.toFixed(2)}return ml(raw)};
const oddsBackend="https://hz-sports-odds.onrender.com/api/espn";
const snapshotBackend="https://hz-sports-odds.onrender.com/api/odds-snapshot";
const snapshotRaw="https://raw.githubusercontent.com/zhengchi0829-collab/line-sports-ai-/odds-cache/tw_third_party_odds.json";
async function fetchJSON(url,ms=15000){const c=new AbortController(),timer=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal,cache:"no-store",credentials:"omit"});if(!r.ok)throw Error("HTTP "+r.status);return await r.json()}finally{clearTimeout(timer)}}
async function get(url){try{return await fetchJSON(oddsBackend+"?url="+encodeURIComponent(url),15000)}catch(err){return fetchJSON(url,9000)}}
let games=[],request=0,oddsRequest=0;
function status(s){$status.textContent=s}
function fillLeagues(){const options=leagues.filter(x=>x[0]===$sport.value);$league.innerHTML=options.map(x=>'<option value="'+safe(x[2])+'">'+safe(x[1])+'</option>').join("")+'<option value="snapshot">第三方公開盤口（全部賽事）</option>';loadMatches()}
function comp(e){return e.competitions?.[0]||{}}
function label(e){const teams=comp(e).competitors||[];const away=teams.find(x=>x.homeAway==="away")?.team||teams[0]?.team,home=teams.find(x=>x.homeAway==="home")?.team||teams[1]?.team;return cn(away)+" VS "+cn(home)}
function monthRange(days){const now=new Date(),dates=new Set();for(let i=0;i<=days;i++){const t=new Date(now.getTime()+i*86400000);dates.add(t.getUTCFullYear()+String(t.getUTCMonth()+1).padStart(2,"0"))}return [...dates]}
async function loadMatches(){const id=++request;oddsRequest++;games=[];$match.disabled=true;$refresh.disabled=true;$match.innerHTML='<option value="">讀取賽事中…</option>';$detail.innerHTML="";status("正在查詢聯賽近期賽程…");
const lg=$league.value;
if(lg==="snapshot"){await loadSnapshotMatches(id,$sport.value);return}
try{const dates=monthRange(14),calls=dates.map(m=>get(base+lg+"/scoreboard?dates="+m+"&limit=300"+(lg==="basketball/mens-college-basketball"?"&groups=50":"")));
const results=await Promise.allSettled(calls);if(id!==request)return;
if(!results.some(x=>x.status==="fulfilled"))throw Error("SOURCE_DOWN");
const now=Date.now(),horizon=now+14*86400000;
const seen=new Set();
games=results.filter(x=>x.status==="fulfilled").flatMap(x=>x.value.events||[]).filter(e=>{if(seen.has(e.id)||!e.date||!comp(e).competitors?.length)return false;const t=Date.parse(e.date);if(!Number.isFinite(t)||t<now-2*3600000||t>horizon||e.status?.type?.state==="post")return false;seen.add(e.id);return true}).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
renderMatchOptions();
if(games.length){status("找到 "+games.length+" 場賽事。請選擇賽事查看盤口。");loadOdds()}
else{status("此聯賽未來 14 天沒有取得可查詢賽事；部分聯賽尚未提供公開資料。");$detail.innerHTML='<div class="hz-odds-no-data">沒有符合時間範圍的賽事，不代表實際沒有比賽。</div>'}
}catch(e){if(id!==request)return;
const data=await getSnapshot().catch(()=>null);if(id!==request)return;
games=data?rowsFor(data,[labelMap[lg]]).filter(r=>Date.parse(r.start)>Date.now()).map((r,i)=>snapshotEvent(r,data,i,lg)):[];
if(games.length){renderMatchOptions();status("賽程接口無法存取，已讀取此聯賽來源快取。");loadOdds();return}
$match.innerHTML='<option value="">來源暫不可用</option>';$refresh.disabled=false;status("賽程來源暫時無法存取，請稍後重試。");$detail.innerHTML='<div class="hz-odds-no-data">無法驗證盤口，沒有使用假資料。</div>'}}
// Parse both legacy prices and current ESPN market objects. Never infer a missing price.
function priceValue(value,decimal){
 const dec=Number(decimal);
 if(decimal!==null&&decimal!==undefined&&decimal!==""&&Number.isFinite(dec)&&dec>1)return dec.toFixed(2);
 if(value===null||value===undefined||value==="")return null;
 if(typeof value==="object"){
   const d=value.decimal??value.decimalOdds??value.value;
   const a=value.american??value.alternateDisplayValue??value.odds;
   return priceValue(a,d);
 }
 if(typeof value!=="string"&&typeof value!=="number")return null;
 const v=Number(value);
 if(!Number.isFinite(v))return null;
 // A signed American line must be at least 100 in magnitude. Unsigned
 // values greater than 1 and below 100 may be provider decimal prices.
 if(Math.abs(v)>=100)return ml(v);
 if(v>1&&v<100&&!String(value).trim().startsWith("+"))return v.toFixed(2);
 return null;
}
const firstPrice=(...values)=>values.map(v=>priceValue(v)).find(v=>v!==null)??null;
const priceCount=o=>o?[o.awayML,o.homeML,o.drawML,o.awaySpreadOdds,o.homeSpreadOdds,o.overOdds,o.underOdds].filter(v=>v!==null&&v!==undefined&&v!=="").length:0;
const lineValue=v=>{if(v===null||v===undefined||v==="")return null;if(typeof v==="object")return lineValue(v.line??v.handicap??v.displayValue);const n=Number(v);return Number.isFinite(n)?n:null};
const firstLine=(...vs)=>vs.map(lineValue).find(v=>v!==null)??null;
function oddsValues(o){if(!o||typeof o!=="object")return null;
 const away=o.awayTeamOdds||{},home=o.homeTeamOdds||{},draw=o.drawTeamOdds||{};
 const money=(team,side)=>firstPrice(
  team.current?.moneyLine,team.current?.moneyline,
  priceValue(team.moneyLine??team.moneyline??team.money_line,team.moneyLineDecimal??team.decimalMoneyLine??team.moneylineDecimal),
  o.moneyline?.[side]?.current?.odds,o.moneyline?.[side]?.current,
  o.moneyLine?.[side]?.current?.odds,o.moneyLine?.[side]?.current,
  o.moneyline?.[side]?.close?.odds,o.moneyline?.[side]?.close,
  o.moneyLine?.[side]?.close?.odds,o.moneyLine?.[side]?.close,
  team.close?.moneyLine,team.close?.moneyline);
 const spreadPrice=(team,side)=>firstPrice(
  team.current?.spreadPrice,priceValue(team.spreadOdds??team.spreadPrice,team.spreadOddsDecimal??team.decimalSpreadOdds),
  o.pointSpread?.[side]?.current?.odds,o.pointSpread?.[side]?.close?.odds,
  o.spread?.[side]?.current?.odds,o.spread?.[side]?.close?.odds,team.close?.spreadPrice);
 const totals=o.total||{},totalCurrent=o.current||{},totalClose=o.close||{};
 const totalPrice=side=>firstPrice(
  totalCurrent[side],priceValue(o[side+"Odds"]??o[side+"TeamOdds"]?.odds??o[side]?.odds??o[side+"Price"],o[side+"OddsDecimal"]??o[side+"TeamOdds"]?.decimalOdds),
  totals[side]?.current?.odds,totals[side]?.current,
  totals[side]?.close?.odds,totals[side]?.close,totalClose[side]);
 const h=firstLine(home.current?.pointSpread,home.spread,o.homeSpread,o.spread,o.pointSpread?.home?.current?.line,o.pointSpread?.home?.close?.line,home.close?.pointSpread);
 const a=firstLine(away.current?.pointSpread,away.spread,o.awaySpread,o.pointSpread?.away?.current?.line,o.pointSpread?.away?.close?.line,away.close?.pointSpread);
 return {provider:o.provider?.name||o.provider?.displayName||(typeof o.provider==="string"?o.provider:"ESPN 公開來源"),details:o.details||null,
 awayML:money(away,"away"),homeML:money(home,"home"),drawML:firstPrice(money(draw,"draw"),priceValue(o.drawOdds??o.drawMoneyLine??o.drawMoneyline,o.drawOddsDecimal??o.drawMoneyLineDecimal)),
 awaySpread:a,homeSpread:h,
 awaySpreadOdds:spreadPrice(away,"away"),homeSpreadOdds:spreadPrice(home,"home"),
 total:firstLine(totalCurrent.total,o.overUnder,o.total,totals.over?.current?.line,totals.under?.current?.line,totals.over?.close?.line,totals.under?.close?.line,totalClose.total),
 overOdds:totalPrice("over"),underOdds:totalPrice("under")};
}
function bestOdds(...groups){const rows=groups.flatMap(g=>Array.isArray(g)?g:(g&&typeof g==="object"?[g]:[]));return rows.filter(o=>priceCount(oddsValues(o))>0).sort((a,b)=>priceCount(oddsValues(b))-priceCount(oddsValues(a)))[0]||null}
function oddsFromEvent(e){return bestOdds(comp(e).odds,e.odds)}
async function getOdds(e,lg){
 const inline=oddsFromEvent(e);const parsed=oddsValues(inline);
 const complete=o=>!!o&&!!o.homeML&&!!o.awayML&&o.total!==null&&o.total!==undefined&&!!o.overOdds&&!!o.underOdds&&!!o.homeSpreadOdds&&!!o.awaySpreadOdds;
 if(complete(parsed))return inline;
 const eventId=String(e.id);
 const date=new Date(e.date);
 const day=Number.isFinite(date.getTime())?date.toISOString().slice(0,10).replace(/-/g,""):"";
 const query=lg==="basketball/mens-college-basketball"?"&groups=50":"";
 const summaryCall=get(base+lg+"/summary?event="+encodeURIComponent(eventId)).then(d=>bestOdds(d?.header?.competitions?.[0]?.odds,d?.pickcenter,d?.odds));
 const dailyCall=day?get(base+lg+"/scoreboard?dates="+day+"&limit=300"+query).then(d=>{const match=(d?.events||[]).find(x=>String(x.id)===eventId);return match?oddsFromEvent(match):null}):Promise.resolve(null);
 const cid=comp(e).id||eventId,parts=lg.split("/");
 const core="https://sports.core.api.espn.com/v2/sports/"+parts[0]+"/leagues/"+parts[1]+"/events/"+encodeURIComponent(eventId)+"/competitions/"+encodeURIComponent(cid)+"/odds?limit=10";
 const coreCall=get(core).then(async res=>{
   const items=Array.isArray(res?.items)?res.items:[];
   const candidates=await Promise.allSettled(items.slice(0,5).map(async item=>{
    if(!item?.$ref)return item;
    const url=new URL(item.$ref);
    if(url.hostname!=="sports.core.api.espn.com"||!["http:","https:"].includes(url.protocol)||url.username||url.password)return null;
    url.protocol="https:";return get(url.href);
   }));
   return bestOdds(candidates.filter(x=>x.status==="fulfilled").map(x=>x.value));
 });
 const requirePrice=p=>p.then(o=>{if(!o||!priceCount(oddsValues(o)))throw Error("NO_VERIFIED_PRICES");return o});
 const candidates=await Promise.allSettled([summaryCall,dailyCall,coreCall].map(requirePrice));
 return bestOdds(inline,...candidates.filter(x=>x.status==="fulfilled").map(x=>x.value));
}
const canonical=n=>{const name=String(n||"").trim();return String(window.hzTeamZh?.(name)||name).normalize("NFKC").toLowerCase().replace(/[\s\p{P}]/gu,"")};
const aliases=t=>[t?.displayName,t?.name,t?.shortDisplayName,t?.abbreviation,t?.location&&t?.name?t.location+" "+t.name:null].filter(Boolean).flatMap(n=>[canonical(n),String(n).normalize("NFKC").toLowerCase().replace(/[\s\p{P}]/gu,"")]);
const matched=(source,target)=>{const a=canonical(source);return !!a&&aliases(target).includes(a)};
let snapshotCache=null,snapshotLoadedAt=0,snapshotPromise=null;
const labelMap=Object.fromEntries(leagues.map(x=>[x[2],x[1]]));
const sportMap=Object.fromEntries(leagues.map(x=>[x[2],x[0]]));
const todayTW=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function validateSnapshot(data){
 const captured=Date.parse(data?.captured_at);
 if(!data||data.day!==todayTW()||!data.leagues||typeof data.leagues!=="object"||Array.isArray(data.leagues)||!Number.isFinite(captured)||captured>Date.now()+300000)throw Error("SNAPSHOT_STALE_OR_INVALID");
 return {...data,status:"ok"};
}
async function getSnapshot(force=false){
 const now=Date.now();
 if(!force&&snapshotCache?.day===todayTW()&&now-snapshotLoadedAt<120000)return snapshotCache;
 if(snapshotPromise)return snapshotPromise;
 snapshotPromise=(async()=>{let data;
 try{data=validateSnapshot(await fetchJSON(snapshotRaw,9000))}catch(err){data=validateSnapshot(await fetchJSON(snapshotBackend,12000))}
 snapshotCache=data;snapshotLoadedAt=Date.now();return data})().finally(()=>{snapshotPromise=null});
 return snapshotPromise;
}
// All displayed records are read at runtime from a source. No embedded odds.
function renderMatchOptions(){
 $match.innerHTML=games.length?games.map((e,i)=>'<option value="'+i+'">'+safe(time(e.date)+"｜"+label(e)+(e.sourceRow?"｜有來源資料":""))+'</option>').join(""):'<option value="">近期無可查詢賽事</option>';
 $match.disabled=!games.length;$refresh.disabled=false;
 const available=games.findIndex(e=>e.sourceRow||oddsFromEvent(e));
 if(available>=0)$match.value=String(available);
}
const validPrice=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))&&Number(x)>1?Number(x).toFixed(Number(x)<1.005?4:2):null;
function rowValues(row,capturedAt){if(!row)return null;
 const vals={provider:row.provider||"第三方來源快取（非官方即時賠率）",capturedAt,sourceUrl:row.source,awayML:validPrice(row.away_price),homeML:validPrice(row.home_price),drawML:validPrice(row.draw_price),
 awaySpread:row.spread===null||row.spread===undefined?null:-Number(row.spread),homeSpread:row.spread,
 awaySpreadOdds:validPrice(row.spread_away_price),homeSpreadOdds:validPrice(row.spread_home_price),total:row.total,overOdds:validPrice(row.over_price),underOdds:validPrice(row.under_price)};
 return [vals.awayML,vals.homeML,vals.drawML,vals.awaySpreadOdds,vals.homeSpreadOdds,vals.overOdds,vals.underOdds].some(Boolean)?vals:null;
}
function rowsFor(data,keys){const seen=new Set();return keys.flatMap(k=>Array.isArray(data.leagues[k])?data.leagues[k]:[]).filter(r=>{if(!r?.home||!r?.away||!Number.isFinite(Date.parse(r.start))||!rowValues(r,data.captured_at))return false;const key=[canonical(r.home),canonical(r.away),Date.parse(r.start)].join("|");if(seen.has(key))return false;seen.add(key);return true})}
function sourceRow(row,data,league){
 return {...row,league:league||undefined,provider:data.capture_method==="third_party_playsport"?"PlaySport 第三方運彩參考（非官方）":"第三方來源快取（非官方）",source:data.source_url};
}
function snapshotEvent(row,data,index,league){
 const r=sourceRow(row,data,league);
 return {id:"source-"+String(r.event_id||index),date:r.start,sourceRow:r,capturedAt:data.captured_at,competitions:[{competitors:[{homeAway:"away",team:{displayName:r.away,name:r.away}},{homeAway:"home",team:{displayName:r.home,name:r.home}}]}]};
}
async function loadSnapshotMatches(id,sport){
 try{
 const data=await getSnapshot(true);if(id!==request)return;
 const activeLeagues=leagues.filter(x=>x[0]===sport);
 const cached=rowsFor(data,[sport,...activeLeagues.map(x=>x[1])]).filter(r=>Date.parse(r.start)>Date.now());
 games=cached.map((r,i)=>snapshotEvent(r,data,i,activeLeagues.find(x=>Array.isArray(data.leagues[x[1]])&&data.leagues[x[1]].includes(r))?.[2])).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 renderMatchOptions();
 if(games.length){status("已從來源讀取 "+games.length+" 場未開賽盤口。");loadOdds()}
 else{status("來源沒有此球類未開賽的有效價格。");$detail.innerHTML='<div class="hz-odds-no-data">本次來源未提供盤口，不代表實際沒有比賽。</div>'}
 }catch(err){if(id!==request)return;$match.innerHTML='<option value="">賠率來源無法讀取</option>';$refresh.disabled=false;status("第三方來源連線失敗或資料不是今日更新。");$detail.innerHTML='<div class="hz-odds-no-data">無法取得來源資料。</div>'}
}
async function snapshotOdds(event,league){
 if(event.sourceRow)return rowValues(event.sourceRow,event.capturedAt);
 const data=await getSnapshot().catch(()=>null);if(!data)return null;
 const {away:a,home:h}=matchTeams(event);
 if(!a||!h)return null;
 const rows=rowsFor(data,[labelMap[league],sportMap[league]].filter(Boolean)),stamp=Date.parse(event.date);
 const candidates=rows.filter(x=>Math.abs(Date.parse(x.start)-stamp)<=45*60000&&matched(x.home,h)&&matched(x.away,a));
 return candidates.length===1?rowValues(sourceRow(candidates[0],data,league),data.captured_at):null;
}
function panelRow(title,a,b){return '<div class="hz-odds-market"><b>'+safe(title)+'</b><div>'+a+'</div><div>'+b+'</div></div>'}
const hasPrice=v=>v!==null&&v!==undefined&&v!=="";
const hasLine=v=>hasPrice(v)&&Number.isFinite(Number(v));
function matchTeams(e){const cs=comp(e).competitors||[];return {away:cs.find(x=>x.homeAway==="away")?.team||cs[0]?.team,home:cs.find(x=>x.homeAway==="home")?.team||cs[1]?.team}}
function marketHTML(o,e,reference=false){
 if(!priceCount(o))return "";
 const {away:a,home:h}=matchTeams(e);
 const isSoccer=(e.sourceRow?.league||$league.value).startsWith("soccer/")||($league.value==="snapshot"&&$sport.value==="足球");
 const price=v=>hasPrice(v)?safe(v):"—";
 const signed=v=>!hasLine(v)?"—":Number(v)>0?"+"+safe(v):safe(v);
 const fields=[];
 if(hasPrice(o.awayML)||hasPrice(o.homeML)||hasPrice(o.drawML)){
 fields.push(panelRow("獨贏（十進位賠率）",'<span>'+safe(cn(a))+'</span><strong>'+price(o.awayML)+'</strong>','<span>'+safe(cn(h))+'</span><strong>'+price(o.homeML)+'</strong>'));
 if(hasPrice(o.drawML))fields.push('<div class="hz-odds-market"><b>和局</b><div><strong>'+price(o.drawML)+'</strong></div></div>')}
 if((hasPrice(o.awaySpreadOdds)&&hasLine(o.awaySpread))||(hasPrice(o.homeSpreadOdds)&&hasLine(o.homeSpread))){
 fields.push(panelRow(isSoccer?"讓球盤":"讓分盤",'<span>客隊 '+signed(o.awaySpread)+'</span><strong>'+price(o.awaySpreadOdds)+'</strong>','<span>主隊 '+signed(o.homeSpread)+'</span><strong>'+price(o.homeSpreadOdds)+'</strong>'))}
 if(hasLine(o.total)&&(hasPrice(o.overOdds)||hasPrice(o.underOdds))){
 const title=isSoccer?"大小球（來源盤口）":"大小分（來源盤口）";
 fields.push(panelRow(title,'<span>大 '+safe(o.total)+'</span><strong>'+price(o.overOdds)+'</strong>','<span>小 '+safe(o.total)+'</span><strong>'+price(o.underOdds)+'</strong>'));
 }
 if(!fields.length)return "";
 const provider=typeof o.provider==="string"?o.provider:"未標示業者";
 return '<div class="hz-odds-provider">'+(reference?'參考盤口來源：':'賠率來源：')+safe(provider)+(o.captureLabel?'｜快照：'+safe(o.captureLabel):o.capturedAt?'｜更新：'+safe(new Date(o.capturedAt).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"})):'')+'｜來源可能延遲或變動</div>'+fields.join("")+'<p class="subtle">'+(o.sourceUrl&&o.sourceUrl.startsWith("https://")?' <a href="'+safe(o.sourceUrl)+'" target="_blank" rel="noopener noreferrer">資料來源</a>':'')+(o.spreadSourceUrl&&o.spreadSourceUrl.startsWith("https://")?' · <a href="'+safe(o.spreadSourceUrl)+'" target="_blank" rel="noopener noreferrer">讓球來源</a>':'')+'</p>';
}
async function liveEventFor(e,lg){
 if(!e.sourceRow)return lg!=="snapshot"?{event:e,league:lg}:null;
 const league=e.sourceRow.league||(lg!=="snapshot"?lg:null);
 if(!league||!leagues.some(x=>x[2]===league))return null;
 const date=new Date(e.date);if(!Number.isFinite(date.getTime()))return null;
 const day=date.toISOString().slice(0,10).replace(/-/g,"");
 const query=league==="basketball/mens-college-basketball"?"&groups=50":"";
 const scoreboard=await get(base+league+"/scoreboard?dates="+day+"&limit=300"+query).catch(()=>null);
 const row=e.sourceRow,stamp=Date.parse(e.date);
 const found=(scoreboard?.events||[]).filter(event=>{
   const {home,away}=matchTeams(event);
   return Math.abs(Date.parse(event.date)-stamp)<=45*60000&&matched(row.home,home)&&matched(row.away,away);
 });
 return found.length===1?{event:found[0],league}:null;
}
async function loadOdds(){
 const id=++oddsRequest,lg=$league.value;
 const selected=$match.value;
 const e=selected!==""?games[Number(selected)]:null;
 if(!e){$detail.innerHTML="";return}
 const fixture='<div class="hz-odds-provider"><strong>'+safe(time(e.date)+"｜"+label(e))+'</strong></div>';
 const disclaimer='<p class="subtle">各場依日期與主客隊核對來源；快取與來源報價分開呈現，不推算缺少的價格。</p>';
 const stillSelected=()=>id===oddsRequest&&$league.value===lg&&$match.value===selected;
 $detail.innerHTML=fixture+'<div class="hz-odds-no-data">查詢該場來源盤口中…</div>';
 status("正在查詢："+label(e));
 try{
 let fallback=e.sourceRow?rowValues(e.sourceRow,e.capturedAt):null;
 const drawFallback=()=>{
   if(!stillSelected()||!priceCount(fallback))return;
   $detail.innerHTML=fixture+marketHTML(fallback,e,true)+disclaimer;
   status("已顯示公開快照，正在查詢本場獨立盤口。");
 };
 if(fallback)drawFallback();
 // Always check the original event, even when a static fallback exists.
 // Never combine different bookmaker prices and lines in one market.
 const lookup=liveEventFor(e,lg).then(x=>x?getOdds(x.event,x.league):null).then(oddsValues).catch(()=>null);
 const cache=fallback?Promise.resolve(null):snapshotOdds(e,lg).catch(()=>null);
 const cacheDraw=cache.then(v=>{if(!fallback&&priceCount(v)){fallback=v;drawFallback()}return v});
 const [live]=await Promise.all([lookup,cacheDraw]);
 if(!stillSelected())return;
 const primary=marketHTML(live,e),ref=marketHTML(fallback,e,true);
 if(primary){
   $detail.innerHTML=fixture+primary+(ref?'<div style="margin-top:16px"><strong>公開參考快照（非即時）</strong>'+ref+'</div>':'')+disclaimer;
   status("已取得本場來源盤口；不同來源分開顯示。");
 }else if(ref){
   $detail.innerHTML=fixture+ref+disclaimer;
   status("目前顯示自動讀取的來源快取；尚未取得新的來源盤口。");
 }else{
   $detail.innerHTML=fixture+'<div class="hz-odds-no-data">本場尚未取得可核對的盤口或價格。</div>';
   status("賽事已載入，但未取得有效賠率。");
 }
 }catch(err){if(!stillSelected())return;$detail.innerHTML=fixture+'<div class="hz-odds-no-data">盤口來源目前無法連線，請稍後重新整理。</div>';status("賽事已載入，但盤口查詢失敗。")}
}
$sport.addEventListener("change",fillLeagues);$league.addEventListener("change",loadMatches);$match.addEventListener("change",loadOdds);$refresh.addEventListener("click",loadMatches);
fillLeagues();
})();