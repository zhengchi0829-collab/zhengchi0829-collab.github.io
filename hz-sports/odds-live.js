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
$match.innerHTML=games.length?games.map((e,i)=>'<option value="'+i+'">'+safe(time(e.date)+"｜"+label(e))+'</option>').join(""):'<option value="">近期無可查詢賽事</option>';
$match.disabled=!games.length;$refresh.disabled=false;
if(games.length){status("找到 "+games.length+" 場賽事。請選擇賽事查看盤口。");loadOdds()}
else{status("此聯賽未來 14 天沒有取得可查詢賽事；部分聯賽尚未提供公開資料。");$detail.innerHTML='<div class="hz-odds-no-data">沒有符合時間範圍的賽事，不代表實際沒有比賽。</div>'}
}catch(e){if(id!==request)return;$match.innerHTML='<option value="">來源暫不可用</option>';$refresh.disabled=false;status("賽程來源暫時無法存取，請稍後重試。");$detail.innerHTML='<div class="hz-odds-no-data">無法驗證盤口，沒有使用假資料。</div>'}}
function oddsFromEvent(e){const c=comp(e);return c.odds?.[0]||e.odds?.[0]||null}
async function getOdds(e,lg){const inline=oddsFromEvent(e);if(inline)return inline;
const summary=await get(base+lg+"/summary?event="+encodeURIComponent(e.id)).catch(()=>null);
const inSummary=summary?.header?.competitions?.[0]?.odds?.[0]||summary?.pickcenter?.[0]||summary?.odds?.[0];if(inSummary)return inSummary;
const id=e.id,cid=comp(e).id||id;
const parts=lg.split("/");
const core="https://sports.core.api.espn.com/v2/sports/"+parts[0]+"/leagues/"+parts[1]+"/events/"+encodeURIComponent(id)+"/competitions/"+encodeURIComponent(cid)+"/odds?limit=10";
const res=await get(core).catch(()=>null);
for(const item of (res?.items||[]).slice(0,3)){if(!item.$ref)return item;try{const url=new URL(item.$ref);if(url.hostname!=="sports.core.api.espn.com"||!["http:","https:"].includes(url.protocol)||url.username||url.password)continue;url.protocol="https:";const value=await get(url.href);if(value&&typeof value==="object")return value}catch(e){}}
return null}
function oddsValues(o){if(!o)return null;
const away=o.awayTeamOdds||{},home=o.homeTeamOdds||{};
const money=(team)=>decimalValue(team.moneyLine??team.moneyline??team.money_line,team.moneyLineDecimal??team.decimalMoneyLine??team.moneylineDecimal);
const spreadOdds=(team)=>decimalValue(team.spreadOdds??team.spreadPrice,team.spreadOddsDecimal??team.decimalSpreadOdds);
const overOdds=o.overOdds??o.overTeamOdds?.odds??o.over?.odds??o.overPrice;
const underOdds=o.underOdds??o.underTeamOdds?.odds??o.under?.odds??o.underPrice;
return {provider:o.provider?.name||o.provider?.displayName||o.provider||"未標示業者",details:o.details||null,
awayML:money(away),homeML:money(home),
awaySpread:away.spread??o.awaySpread??null,homeSpread:home.spread??o.homeSpread??o.spread??null,
awaySpreadOdds:spreadOdds(away),homeSpreadOdds:spreadOdds(home),
total:o.overUnder??o.total??null,overOdds:decimalValue(overOdds,o.overOddsDecimal??o.overTeamOdds?.decimalOdds),underOdds:decimalValue(underOdds,o.underOddsDecimal??o.underTeamOdds?.decimalOdds)}}
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
const validPrice=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))&&Number(x)>1?Number(x).toFixed(2):null;
function rowValues(row,capturedAt){if(!row)return null;
 const vals={provider:"第三方公開賠率快取（非娛樂平台官方）",capturedAt,awayML:validPrice(row.away_price),homeML:validPrice(row.home_price),drawML:validPrice(row.draw_price),
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
if(!o){const snapshot=snapshotOdds(e,lg);const live=getOdds(e,lg).then(oddsValues).catch(()=>null);
const usable=v=>v&&[v.awayML,v.homeML,v.drawML,v.awaySpreadOdds,v.homeSpreadOdds,v.overOdds,v.underOdds].some(hasPrice);
o=await Promise.any([snapshot.then(v=>{if(!usable(v))throw Error("no snapshot prices");return v}),live.then(v=>{if(!usable(v))throw Error("no live prices");return v})]).catch(()=>null)}
if(id!==oddsRequest)return;
if(!o||![o.awayML,o.homeML,o.awaySpreadOdds,o.homeSpreadOdds,o.overOdds,o.underOdds].some(hasPrice)){
$detail.innerHTML='<div class="hz-odds-no-data">此場目前未取得可核實的賠率價格，請改查其他場次。</div>';status("已載入賽事，但來源目前沒有可核實的價格。");return}
const provider=typeof o.provider==="string"?o.provider:"未標示業者";
const displayPrice=v=>hasPrice(v)?safe(v):"—",spread=v=>hasPrice(v)?safe(v):"—";
const fields=[];
if(hasPrice(o.awayML)||hasPrice(o.homeML)){
fields.push(panelRow("獨贏（十進位賠率）",'<span>'+safe(cn(a))+'</span><strong>'+displayPrice(o.awayML)+'</strong>','<span>'+safe(cn(h))+'</span><strong>'+displayPrice(o.homeML)+'</strong>'));
if(hasPrice(o.drawML))fields.push('<div class="hz-odds-market"><b>和局</b><div><strong>'+displayPrice(o.drawML)+'</strong></div></div>')}
if(hasPrice(o.awaySpreadOdds)||hasPrice(o.homeSpreadOdds)){
fields.push(panelRow("讓分盤",'<span>客隊讓分 '+spread(o.awaySpread)+'</span><strong>'+displayPrice(o.awaySpreadOdds)+'</strong>','<span>主隊讓分 '+spread(o.homeSpread)+'</span><strong>'+displayPrice(o.homeSpreadOdds)+'</strong>'))}
if(hasPrice(o.overOdds)||hasPrice(o.underOdds)){
fields.push(panelRow("大小分",'<span>大 '+spread(o.total)+'</span><strong>'+displayPrice(o.overOdds)+'</strong>','<span>小 '+spread(o.total)+'</span><strong>'+displayPrice(o.underOdds)+'</strong>'))}
$detail.innerHTML='<div class="hz-odds-provider">賠率來源：'+safe(provider)+(o.capturedAt?"｜更新："+safe(new Date(o.capturedAt).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"})):"")+'｜來源可能延遲或變動</div>'+fields.join("")+'<p class="subtle">僅展示核實取得的價格；沒有價格的市場不顯示。本站未串接娛樂平台官方即時盤口。</p>';status("已顯示本場可取得的賠率價格。");
}catch(err){if(id!==oddsRequest)return;$detail.innerHTML='<div class="hz-odds-no-data">盤口來源目前無法連線，請稍後重新整理。</div>';status("賽事已載入，但盤口查詢失敗。")}}
$sport.addEventListener("change",fillLeagues);$league.addEventListener("change",loadMatches);$match.addEventListener("change",loadOdds);$refresh.addEventListener("click",loadMatches);
fillLeagues();
})();