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
if(!results.some(x=>x.status==="fulfilled")&&!publishedRows(lg).length)throw Error("SOURCE_DOWN");
const now=Date.now(),horizon=now+14*86400000;
const seen=new Set();
games=results.filter(x=>x.status==="fulfilled").flatMap(x=>x.value.events||[]).filter(e=>{if(seen.has(e.id)||!e.date||!comp(e).competitors?.length)return false;const t=Date.parse(e.date);if(!Number.isFinite(t)||t<now-2*3600000||t>horizon||e.status?.type?.state==="post")return false;seen.add(e.id);return true}).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
games=appendPublished(games,lg);
renderMatchOptions(lg);
if(games.length){status("找到 "+games.length+" 場賽事。請選擇賽事查看盤口。");loadOdds()}
else{status("此聯賽未來 14 天沒有取得可查詢賽事；部分聯賽尚未提供公開資料。");$detail.innerHTML='<div class="hz-odds-no-data">沒有符合時間範圍的賽事，不代表實際沒有比賽。</div>'}
}catch(e){if(id!==request)return;
games=appendPublished([],lg);if(games.length){renderMatchOptions(lg);status("即時賽程暫不可用，已顯示有來源的公開盤口快照。");loadOdds();return}
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
const lineValue=v=>{if(v===null||v===undefined||v==="")return null;if(typeof v==="object")return lineValue(v.line??v.handicap??v.american??v.alternateDisplayValue??v.displayValue);const n=Number(v);return Number.isFinite(n)?n:null};
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
 const inline=oddsFromEvent(e);if(inline)return inline;
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
 return Promise.any([summaryCall,dailyCall,coreCall].map(requirePrice)).catch(()=>null);
}
const canonical=n=>{const name=String(n||"").trim();return String(window.hzTeamZh?.(name)||name).normalize("NFKC").toLowerCase().replace(/[\s\p{P}]/gu,"")};
const aliases=t=>[t?.displayName,t?.name,t?.shortDisplayName,t?.abbreviation,t?.location&&t?.name?t.location+" "+t.name:null].filter(Boolean).flatMap(n=>[canonical(n),String(n).normalize("NFKC").toLowerCase().replace(/[\s\p{P}]/gu,"")]);
const matched=(source,target)=>{const a=canonical(source);return !!a&&aliases(target).includes(a)};
let snapshotCache=null,snapshotLoadedAt=0,snapshotPromise=null;
const labelMap=Object.fromEntries(leagues.map(x=>[x[2],x[1]]));
const sportMap=Object.fromEntries(leagues.map(x=>[x[2],x[0]]));
const todayTW=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function validateSnapshot(data){if(!data||data.day!==todayTW()||!data.leagues||typeof data.leagues!=="object"||Array.isArray(data.leagues))throw Error("SNAPSHOT_STALE_OR_INVALID");return {...data,status:"ok"}}
async function getSnapshot(force=false){
 const now=Date.now();
 if(!force&&snapshotCache?.day===todayTW()&&now-snapshotLoadedAt<120000)return snapshotCache;
 if(snapshotPromise)return snapshotPromise;
 snapshotPromise=(async()=>{let data;try{data=validateSnapshot(await fetchJSON(snapshotBackend,12000))}catch(err){data=validateSnapshot(await fetchJSON(snapshotRaw,9000))}
 snapshotCache=data;snapshotLoadedAt=Date.now();return data})().finally(()=>{snapshotPromise=null});
 return snapshotPromise;
}
// Individually verified public source snapshots. Never presented as live prices.
// Entries expire from the selectable list at kickoff. No new API quota is used.
const publishedRowsData=[{"league":"soccer/eng.1","start":"2026-11-27T20:00:00Z","away":"Chelsea","home":"Nottingham Forest","away_price":2.82,"home_price":2.7,"draw_price":3.73,"total":2.5,"over_price":1.81,"under_price":2.16,"provider":"OddStorm 公開比較快照（非即時）","captureLabel":"2026/11/24 查閱","source":"https://www.oddstorm.com/odds/league/325-england-premier-league"},{"league":"soccer/eng.1","start":"2026-11-28T15:00:00Z","away":"Coventry City","home":"Leeds United","away_price":7,"home_price":1.54,"draw_price":4.8,"total":2.5,"over_price":1.74,"under_price":2.36,"provider":"OddStorm 公開比較快照（非即時）","captureLabel":"2026/11/24 查閱","source":"https://www.oddstorm.com/odds/league/325-england-premier-league"},{"league":"soccer/eng.1","start":"2026-11-28T15:00:00Z","away":"Brentford","home":"Manchester United","away_price":3.43,"home_price":2.2,"draw_price":4.04,"total":2.5,"over_price":1.61,"under_price":2.51,"provider":"OddStorm 公開比較快照（非即時）","captureLabel":"2026/11/24 查閱","source":"https://www.oddstorm.com/odds/league/325-england-premier-league"},{"league":"soccer/eng.1","start":"2026-11-28T17:30:00Z","away":"Aston Villa","home":"Ipswich Town","away_price":2,"home_price":3.85,"draw_price":4.16,"total":2.5,"over_price":1.55,"under_price":2.58,"provider":"OddStorm 公開比較快照（非即時）","captureLabel":"2026/11/24 查閱","source":"https://www.oddstorm.com/odds/league/325-england-premier-league"},{"league":"soccer/eng.1","start":"2026-11-29T14:05:00Z","away":"Newcastle United","home":"Brighton & Hove Albion","away_price":5.8,"home_price":1.59,"draw_price":4.72,"total":2.5,"over_price":1.55,"under_price":2.56,"provider":"OddStorm 公開比較快照（非即時）","captureLabel":"2026/11/24 查閱","source":"https://www.oddstorm.com/odds/league/325-england-premier-league"},{"league":"soccer/eng.1","start":"2026-11-29T14:05:00Z","away":"Hull City","home":"Crystal Palace","away_price":4.2,"home_price":1.93,"draw_price":4,"total":2.5,"over_price":1.8,"under_price":2.19,"provider":"OddStorm 公開比較快照（非即時）","captureLabel":"2026/11/24 查閱","source":"https://www.oddstorm.com/odds/league/325-england-premier-league"},{"league":"soccer/eng.1","start":"2026-11-29T14:05:00Z","away":"AFC Bournemouth","home":"Fulham","away_price":2.72,"home_price":2.8,"draw_price":3.73,"total":2.5,"over_price":1.81,"under_price":2.15,"provider":"OddStorm 公開比較快照（非即時）","captureLabel":"2026/11/24 查閱","source":"https://www.oddstorm.com/odds/league/325-england-premier-league"},{"league":"soccer/eng.1","start":"2026-11-29T14:05:00Z","away":"Tottenham Hotspur","home":"Sunderland","away_price":2.17,"home_price":3.9,"draw_price":3.67,"total":2.5,"over_price":2.06,"under_price":1.91,"provider":"OddStorm 公開比較快照（非即時）","captureLabel":"2026/11/24 查閱","source":"https://www.oddstorm.com/odds/league/325-england-premier-league"},{"league":"basketball/nba","start":"2026-11-25T00:11:00Z","away":"Detroit Pistons","home":"Orlando Magic","away_price":1.74,"home_price":2.14,"spread":2.5,"spread_home_price":1.9,"total":212.5,"over_price":1.88,"under_price":1.93,"provider":"AgentBets 公開盤口快照（DraftKings；非即時）","captureLabel":"2026/11/24 19:00 台灣時間","source":"https://agentbets.ai/odds/draftkings/nba"},{"league":"basketball/nba","start":"2026-11-25T01:10:00Z","away":"Boston Celtics","home":"Washington Wizards","away_price":1.22,"home_price":4.51,"spread":10.5,"spread_home_price":1.91,"total":217.5,"over_price":1.89,"under_price":1.93,"provider":"AgentBets 公開盤口快照（DraftKings；非即時）","captureLabel":"2026/11/24 19:00 台灣時間","source":"https://agentbets.ai/odds/draftkings/nba"},{"league":"basketball/nba","start":"2026-11-25T03:10:00Z","away":"Dallas Mavericks","home":"Denver Nuggets","away_price":3.61,"home_price":1.31,"spread":-7.5,"spread_home_price":1.85,"total":233.5,"over_price":1.92,"under_price":1.9,"provider":"AgentBets 公開盤口快照（DraftKings；非即時）","captureLabel":"2026/11/24 19:00 台灣時間","source":"https://agentbets.ai/odds/draftkings/nba"},{"league":"basketball/nba","start":"2026-11-25T22:10:00Z","away":"Miami Heat","home":"Philadelphia 76ers","away_price":2.36,"home_price":1.62,"spread":-3.5,"spread_home_price":1.91,"total":238.5,"over_price":1.91,"under_price":1.91,"provider":"AgentBets 公開盤口快照（DraftKings；非即時）","captureLabel":"2026/11/24 19:00 台灣時間","source":"https://agentbets.ai/odds/draftkings/nba"},{"league":"basketball/nba","start":"2026-11-26T00:40:00Z","away":"Cleveland Cavaliers","home":"New York Knicks","away_price":2.86,"home_price":1.45,"spread":-5.5,"spread_home_price":1.87,"total":220.5,"over_price":1.91,"under_price":1.91,"provider":"AgentBets 公開盤口快照（DraftKings；非即時）","captureLabel":"2026/11/24 19:00 台灣時間","source":"https://agentbets.ai/odds/draftkings/nba"},{"league":"basketball/nba","start":"2026-11-26T00:40:00Z","away":"Minnesota Timberwolves","home":"Oklahoma City Thunder","away_price":2.25,"home_price":1.68,"spread":-3.5,"spread_home_price":1.93,"total":224.5,"over_price":1.91,"under_price":1.91,"provider":"AgentBets 公開盤口快照（DraftKings；非即時）","captureLabel":"2026/11/24 19:00 台灣時間","source":"https://agentbets.ai/odds/draftkings/nba"},{"league":"basketball/nba","start":"2026-11-26T01:40:00Z","away":"Phoenix Suns","home":"Houston Rockets","away_price":4.19,"home_price":1.25,"spread":-10.5,"spread_home_price":1.91,"total":223.5,"over_price":1.91,"under_price":1.91,"provider":"AgentBets 公開盤口快照（DraftKings；非即時）","captureLabel":"2026/11/24 19:00 台灣時間","source":"https://agentbets.ai/odds/draftkings/nba"}];
const publishedRows=(lg,now=Date.now())=>publishedRowsData.filter(r=>r.league===lg&&Date.parse(r.start)>now);
function publishedMatch(event,lg,now=Date.now()){
 const cs=comp(event).competitors||[],a=cs.find(x=>x.homeAway==="away")?.team,h=cs.find(x=>x.homeAway==="home")?.team;
 if(!a||!h)return null;
 const rows=publishedRows(lg,now).filter(r=>Math.abs(Date.parse(r.start)-Date.parse(event.date))<=45*60000&&matched(r.away,a)&&matched(r.home,h));
 return rows.length===1?rows[0]:null;
}
function publishedEvent(r){return {id:"public-"+r.league+"-"+r.start+"-"+r.home,date:r.start,sourceRow:r,competitions:[{competitors:[{homeAway:"away",team:{displayName:r.away,name:r.away}},{homeAway:"home",team:{displayName:r.home,name:r.home}}]}]}}
function appendPublished(matches,lg){
 const result=[...matches],known=publishedRows(lg);
 for(const row of known){if(!result.some(e=>publishedMatch(e,lg)===row))result.push(publishedEvent(row))}
 return result.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
}
function renderMatchOptions(lg){
 $match.innerHTML=games.length?games.map((e,i)=>'<option value="'+i+'">'+safe(time(e.date)+"｜"+label(e)+(e.sourceRow?.captureLabel||publishedMatch(e,lg)?"｜有公開快照":""))+'</option>').join(""):'<option value="">近期無可查詢賽事</option>';
 $match.disabled=!games.length;$refresh.disabled=false;
 const available=games.findIndex(e=>e.sourceRow?.captureLabel||publishedMatch(e,lg)||oddsFromEvent(e));
 if(available>=0)$match.value=String(available);
}
const validPrice=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))&&Number(x)>1?Number(x).toFixed(2):null;
function rowValues(row,capturedAt){if(!row)return null;
 const vals={provider:row.provider||"第三方公開賠率快取（非娛樂平台官方）",capturedAt,captureLabel:row.captureLabel,awayML:validPrice(row.away_price),homeML:validPrice(row.home_price),drawML:validPrice(row.draw_price),
 awaySpread:row.spread===null||row.spread===undefined?null:-Number(row.spread),homeSpread:row.spread,
 awaySpreadOdds:validPrice(row.spread_away_price),homeSpreadOdds:validPrice(row.spread_home_price),total:row.total,overOdds:validPrice(row.over_price),underOdds:validPrice(row.under_price)};
 return [vals.awayML,vals.homeML,vals.drawML,vals.awaySpreadOdds,vals.homeSpreadOdds,vals.overOdds,vals.underOdds].some(Boolean)?vals:null;
}
function rowsFor(data,keys){const seen=new Set();return keys.flatMap(k=>Array.isArray(data.leagues[k])?data.leagues[k]:[]).filter(r=>{if(!r?.home||!r?.away||!Number.isFinite(Date.parse(r.start))||!rowValues(r,data.captured_at))return false;const key=[canonical(r.home),canonical(r.away),Date.parse(r.start)].join("|");if(seen.has(key))return false;seen.add(key);return true})}
async function loadSnapshotMatches(id,sport){
 try{const data=await getSnapshot(true);if(id!==request)return;
 const rows=rowsFor(data,[sport,...leagues.filter(x=>x[0]===sport).map(x=>x[1])]).filter(r=>Date.parse(r.start)>Date.now()).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
 games=rows.map((r,i)=>({id:"snapshot-"+i,date:r.start,sourceRow:r,capturedAt:data.captured_at,competitions:[{competitors:[{homeAway:"away",team:{displayName:r.away,name:r.away}},{homeAway:"home",team:{displayName:r.home,name:r.home}}]}]}));
 $match.innerHTML=games.length?games.map((e,i)=>'<option value="'+i+'">'+safe(time(e.date)+"｜"+label(e))+'</option>').join(""):'<option value="">目前無未開賽盤口</option>';
 $match.disabled=!games.length;$refresh.disabled=false;
 if(games.length){status("取得 "+games.length+" 場第三方公開盤口；請選擇賽事。");loadOdds()}
 else{status("快取目前沒有此球類的未開賽有效賠率。");$detail.innerHTML='<div class="hz-odds-no-data">資料來源尚無可核實價格，不代表沒有賽事。</div>'}
 }catch(err){if(id!==request)return;$match.innerHTML='<option value="">賠率快取暫不可用</option>';$refresh.disabled=false;status("第三方快取無法取得或不是今日資料。");$detail.innerHTML='<div class="hz-odds-no-data">目前無法驗證盤口，請稍後重新整理。</div>'}
}
async function snapshotOdds(event,league){
 if(event.sourceRow)return rowValues(event.sourceRow,event.capturedAt);
 const data=await getSnapshot().catch(()=>null);if(!data)return null;
 const cs=comp(event).competitors||[],a=cs.find(x=>x.homeAway==="away")?.team||cs[0]?.team,h=cs.find(x=>x.homeAway==="home")?.team||cs[1]?.team;
 if(!a||!h)return null;
 const rows=rowsFor(data,[labelMap[league],sportMap[league]].filter(Boolean)),stamp=Date.parse(event.date);
 const candidates=rows.filter(x=>Math.abs(Date.parse(x.start)-stamp)<=2*3600000&&matched(x.home,h)&&matched(x.away,a));
 return candidates.length===1?rowValues(candidates[0],data.captured_at):null;
}
function panelRow(title,a,b){return '<div class="hz-odds-market"><b>'+safe(title)+'</b><div>'+a+'</div><div>'+b+'</div></div>'}
async function loadOdds(){const e=games[Number($match.value)];if(!e)return;const id=++oddsRequest,lg=$league.value;
$detail.innerHTML='<div class="hz-odds-no-data">查詢該場實際盤口中…</div>';
const cs=comp(e).competitors||[],a=cs.find(x=>x.homeAway==="away")?.team||cs[0]?.team,h=cs.find(x=>x.homeAway==="home")?.team||cs[1]?.team;
try{const hasPrice=v=>v!==null&&v!==undefined&&v!=="";
let o=e.sourceRow?rowValues(e.sourceRow,e.capturedAt):null;
if(!o){const known=publishedMatch(e,lg);if(known)o=rowValues(known)}
if(!o){const snapshot=snapshotOdds(e,lg);const live=getOdds(e,lg).then(oddsValues).catch(()=>null);
const usable=v=>v&&[v.awayML,v.homeML,v.drawML,v.awaySpreadOdds,v.homeSpreadOdds,v.overOdds,v.underOdds].some(hasPrice);
o=await Promise.any([snapshot.then(v=>{if(!usable(v))throw Error("no snapshot prices");return v}),live.then(v=>{if(!usable(v))throw Error("no live prices");return v})]).catch(()=>null)}
if(id!==oddsRequest)return;
if(!priceCount(o)){
$detail.innerHTML='<div class="hz-odds-no-data">此場尚未取得來源發布的有效賠率。可切換「第三方公開盤口（全部賽事）」查看已取得的其他場次。</div>';status("已載入賽事，但來源目前沒有可核實的價格。");return}
const provider=typeof o.provider==="string"?o.provider:"未標示業者";
const displayPrice=v=>hasPrice(v)?safe(v):"—",spread=v=>hasPrice(v)?safe(v):"—";
const fields=[];
if(hasPrice(o.awayML)||hasPrice(o.homeML)||hasPrice(o.drawML)){
fields.push(panelRow("獨贏（十進位賠率）",'<span>'+safe(cn(a))+'</span><strong>'+displayPrice(o.awayML)+'</strong>','<span>'+safe(cn(h))+'</span><strong>'+displayPrice(o.homeML)+'</strong>'));
if(hasPrice(o.drawML))fields.push('<div class="hz-odds-market"><b>和局</b><div><strong>'+displayPrice(o.drawML)+'</strong></div></div>')}
if(hasPrice(o.awaySpreadOdds)||hasPrice(o.homeSpreadOdds)){
fields.push(panelRow("讓分盤",'<span>客隊讓分 '+spread(o.awaySpread)+'</span><strong>'+displayPrice(o.awaySpreadOdds)+'</strong>','<span>主隊讓分 '+spread(o.homeSpread)+'</span><strong>'+displayPrice(o.homeSpreadOdds)+'</strong>'))}
if(hasPrice(o.overOdds)||hasPrice(o.underOdds)){
fields.push(panelRow("大小分",'<span>大 '+spread(o.total)+'</span><strong>'+displayPrice(o.overOdds)+'</strong>','<span>小 '+spread(o.total)+'</span><strong>'+displayPrice(o.underOdds)+'</strong>'))}
$detail.innerHTML='<div class="hz-odds-provider">賠率來源：'+safe(provider)+(o.captureLabel?"｜快照："+safe(o.captureLabel):o.capturedAt?"｜更新："+safe(new Date(o.capturedAt).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"})):"")+'｜來源可能延遲或變動</div>'+fields.join("")+'<p class="subtle">僅展示核實取得的價格；沒有價格的市場不顯示。本站未串接娛樂平台官方即時盤口。</p>';status(o.captureLabel?"已顯示公開來源賠率快照；並非即時更新。":"已顯示本場可取得的賠率價格。");
}catch(err){if(id!==oddsRequest)return;$detail.innerHTML='<div class="hz-odds-no-data">盤口來源目前無法連線，請稍後重新整理。</div>';status("賽事已載入，但盤口查詢失敗。")}}
$sport.addEventListener("change",fillLeagues);$league.addEventListener("change",loadMatches);$match.addEventListener("change",loadOdds);$refresh.addEventListener("click",loadMatches);
fillLeagues();
})();