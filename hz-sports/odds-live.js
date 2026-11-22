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
async function get(url){const c=new AbortController(),timer=setTimeout(()=>c.abort(),19000);try{const proxy=oddsBackend+"?url="+encodeURIComponent(url);const r=await fetch(proxy,{signal:c.signal,cache:"default"});if(!r.ok)throw Error("HTTP "+r.status);return await r.json()}finally{clearTimeout(timer)}}
let games=[],request=0,oddsRequest=0;
function status(s){$status.textContent=s}
function fillLeagues(){const options=leagues.filter(x=>x[0]===$sport.value);$league.innerHTML=options.map(x=>'<option value="'+safe(x[2])+'">'+safe(x[1])+'</option>').join("");loadMatches()}
function comp(e){return e.competitions?.[0]||{}}
function label(e){const teams=comp(e).competitors||[];const away=teams.find(x=>x.homeAway==="away")?.team||teams[0]?.team,home=teams.find(x=>x.homeAway==="home")?.team||teams[1]?.team;return cn(away)+" VS "+cn(home)}
function monthRange(days){const now=new Date(),dates=new Set();for(let i=0;i<=days;i++){const t=new Date(now.getTime()+i*86400000);dates.add(t.getUTCFullYear()+String(t.getUTCMonth()+1).padStart(2,"0"))}return [...dates]}
async function loadMatches(){const id=++request;oddsRequest++;games=[];$match.disabled=true;$refresh.disabled=true;$match.innerHTML='<option value="">讀取賽事中…</option>';$detail.innerHTML="";status("正在查詢聯賽近期賽程…");
const lg=$league.value;
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
for(const item of (res?.items||[]).slice(0,3)){if(!item.$ref)return item;try{const url=new URL(item.$ref);if(url.protocol!=="https:"||url.hostname!=="sports.core.api.espn.com")continue;const value=await get(url.href);if(value&&typeof value==="object")return value}catch(e){}}
return null}
function oddsValues(o){if(!o)return null;
const away=o.awayTeamOdds||{},home=o.homeTeamOdds||{};
return {provider:o.provider?.name||o.provider?.displayName||o.provider||"未標示業者",details:o.details||null,
awayML:decimalValue(away.moneyLine,away.moneyLineDecimal),homeML:decimalValue(home.moneyLine,home.moneyLineDecimal),
awaySpread:away.spread??o.awaySpread??null,homeSpread:home.spread??o.homeSpread??o.spread??null,
awaySpreadOdds:decimalValue(away.spreadOdds,away.spreadOddsDecimal),homeSpreadOdds:decimalValue(home.spreadOdds,home.spreadOddsDecimal),
total:o.overUnder??o.total??null,overOdds:decimalValue(o.overOdds,o.overOddsDecimal),underOdds:decimalValue(o.underOdds,o.underOddsDecimal)}}
function panelRow(title,a,b){return '<div class="hz-odds-market"><b>'+safe(title)+'</b><div>'+a+'</div><div>'+b+'</div></div>'}
async function loadOdds(){const e=games[Number($match.value)];if(!e)return;const id=++oddsRequest,lg=$league.value;
$detail.innerHTML='<div class="hz-odds-no-data">查詢該場實際盤口中…</div>';
const cs=comp(e).competitors||[],a=cs.find(x=>x.homeAway==="away")?.team||cs[0]?.team,h=cs.find(x=>x.homeAway==="home")?.team||cs[1]?.team;
const heading='<div class="hz-odds-match"><div>'+logo(a)+'<strong>'+safe(cn(a))+'</strong><small>客隊</small></div><span>VS</span><div>'+logo(h)+'<strong>'+safe(cn(h))+'</strong><small>主隊</small></div></div><p class="hz-odds-date">'+safe(time(e.date))+'（台灣時間）｜'+safe($league.selectedOptions[0]?.textContent||"")+'</p>';
try{const raw=await getOdds(e,lg);if(id!==oddsRequest)return;
const o=oddsValues(raw);
if(!o||![o.awayML,o.homeML,o.awaySpread,o.homeSpread,o.total].some(v=>v!==null)){
$detail.innerHTML=heading+'<div class="hz-odds-no-data">此場次目前沒有可核實的公開賠率。請勿將此狀態視為沒有開盤。</div>';status("已載入賽事，但該場未取得可驗證盤口。");return}
const provider=typeof o.provider==="string"?o.provider:"未標示業者";
const spread=v=>v===null?"—":safe(v);const price=v=>v===null?"暫無賠率":safe(v);
const fields=[
panelRow("獨贏（十進位賠率）",'<span>'+safe(cn(a))+'</span><strong>'+price(o.awayML)+'</strong>','<span>'+safe(cn(h))+'</span><strong>'+price(o.homeML)+'</strong>'),
panelRow("讓分盤",'<span>客隊讓分 '+spread(o.awaySpread)+'</span><strong>'+price(o.awaySpreadOdds)+'</strong>','<span>主隊讓分 '+spread(o.homeSpread)+'</span><strong>'+price(o.homeSpreadOdds)+'</strong>'),
panelRow("大小分",'<span>大 '+spread(o.total)+'</span><strong>'+price(o.overOdds)+'</strong>','<span>小 '+spread(o.total)+'</span><strong>'+price(o.underOdds)+'</strong>')
].join("");
$detail.innerHTML=heading+'<div class="hz-odds-provider">盤口來源：'+safe(provider)+'｜資料為來源當前回傳，可能延遲或變動</div>'+fields+'<p class="subtle">僅顯示來源有提供的數值；不同業者、不同地區盤口可能不一致。本站未串接台灣運彩官方盤口。</p>';status("已取得此場賽事可用的盤口資訊。");
}catch(err){if(id!==oddsRequest)return;$detail.innerHTML=heading+'<div class="hz-odds-no-data">盤口來源目前無法連線，請稍後重新整理。</div>';status("賽事已載入，但盤口查詢失敗。")}}
$sport.addEventListener("change",fillLeagues);$league.addEventListener("change",loadMatches);$match.addEventListener("change",loadOdds);$refresh.addEventListener("click",loadMatches);
fillLeagues();
})();