(function(){
"use strict";
const $=id=>document.getElementById(id);
const src="https://site.api.espn.com/apis/site/v2/sports/";
const leagues=[["足球","英超","soccer/eng.1"],["足球","西甲","soccer/esp.1"],["足球","德甲","soccer/ger.1"],["足球","義甲","soccer/ita.1"],["足球","法甲","soccer/fra.1"],["足球","歐冠","soccer/uefa.champions"],["籃球","NBA","basketball/nba"],["籃球","NCAA","basketball/mens-college-basketball"],["籃球","NBL","basketball/nbl"],["籃球","TPBL","basketball/tpbl"],["棒球","MLB","baseball/mlb"],["棒球","NPB","baseball/npb"],["棒球","KBO","baseball/kbo"],["棒球","CPBL","baseball/cpbl"],["棒球","MiLB","baseball/milb"]];
let epoch=0;const leagueCache=new Map();const knownTeams=new Map();
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate=x=>new Date(x).toLocaleDateString("zh-TW",{timeZone:"Asia/Taipei",month:"2-digit",day:"2-digit"});
const notice=(t)=>{$("hz-team-results").innerHTML='<div class="hz-team-status">'+esc(t)+'</div>'};
async function json(url){const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),13000);try{const r=await fetch(url,{signal:ctl.signal,cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);return await r.json()}finally{clearTimeout(timeout)}}
function monthCodes(count){const a=[];const d=new Date();d.setUTCDate(1);for(let i=0;i<count;i++){a.push(d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,"0"));d.setUTCMonth(d.getUTCMonth()-1)}return a}
async function leagueEvents(lg,count=6){const key=lg+":"+count;if(leagueCache.has(key))return leagueCache.get(key);const queries=monthCodes(count).map(m=>json(src+lg+"/scoreboard?dates="+m+"&limit=500").then(x=>x.events||[]));const answers=await Promise.allSettled(queries);const valid=answers.filter(x=>x.status==="fulfilled");if(!valid.length)throw Error("賽程來源無法存取");const events=[...new Map(valid.flatMap(x=>x.value).map(e=>[String(e.id),e])).values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));leagueCache.set(key,events);return events}
function discoverTeams(events){const map=new Map();for(const e of events)for(const c of e.competitions?.[0]?.competitors||[]){const t=c.team;if(t?.id)map.set(String(t.id),t)}return [...map.values()].sort((a,b)=>String(a.displayName||a.name).localeCompare(String(b.displayName||b.name),"zh-Hant"))}
const sport=$("hz-team-sport"),league=$("hz-team-league"),team=$("hz-team-team"),go=$("hz-team-refresh");
if(!sport||!league||!team||!go)return;
function fillLeagues(){league.innerHTML=leagues.filter(a=>a[0]===sport.value).map(a=>'<option value="'+esc(a[2])+'">'+esc(a[1])+'</option>').join("");loadTeams()}
async function loadTeams(){const id=++epoch,lg=league.value;team.disabled=true;go.disabled=true;team.innerHTML='<option>載入球隊中…</option>';notice("正在載入聯賽球隊…");
try{
let teams=[];let source="球隊名單";
try{const d=await json(src+lg+"/teams?limit=500");const groups=d.sports?.flatMap(s=>(s.leagues||[]).flatMap(l=>l.teams||[]))||d.teams||[];teams=groups.map(t=>t.team||t).filter(x=>x?.id)}catch(e){}
if(!teams.length){source="近期公開賽程";teams=discoverTeams(await leagueEvents(lg,8))}
if(id!==epoch)return;
const unique=[...new Map(teams.map(t=>[String(t.id),t])).values()].sort((a,b)=>String(a.displayName||a.name).localeCompare(String(b.displayName||b.name),"zh-Hant"));
if(!unique.length)throw Error("近期賽程尚無可辨識球隊");
knownTeams.set(lg,unique);
team.innerHTML=unique.map(t=>'<option value="'+esc(t.id)+'">'+esc(window.hzLocalizedTeam?.(t)||t.displayName||t.name||t.id)+'</option>').join("");
team.disabled=false;go.disabled=false;await loadTeam();
}catch(e){if(id!==epoch)return;team.innerHTML='<option value="">此聯賽資料暫不可用</option>';notice("球隊清單與備用賽程來源均無法取得資料。這不代表聯賽沒有比賽；請切換其他聯賽或稍後再試。");go.disabled=false}}
function competitors(e){return e.competitions?.[0]?.competitors||[]}
function teamResult(e,id){const t=competitors(e).find(x=>String(x.team?.id)===String(id));if(!t)return null;const opp=competitors(e).find(x=>x!==t);let result=t.winner===true?"勝":opp?.winner===true?"負":null;if(!result){const a=Number(t.score),b=Number(opp?.score);if(Number.isFinite(a)&&Number.isFinite(b))result=a>b?"勝":a<b?"負":"和"}return {e,t,opp,result}}
function findPlayerRows(data,type){
const boxes=data.boxscore?.players||[];
const list=[];
for(const group of boxes)for(const stat of group.statistics||[]){
const labels=stat.labels||stat.names||[];
let index=-1;
const keywords=type==="足球"?["G","GL","GOALS"]:type==="籃球"?["PTS","POINTS"]:["HR","HOME RUNS"];
index=labels.findIndex(v=>keywords.includes(String(v).toUpperCase().replace(/\s+/g," ")));
if(index<0)continue;
for(const a of stat.athletes||[]){const val=Number(a.stats?.[index]);if(!Number.isFinite(val)||val<0)continue;
list.push({id:String(a.athlete?.id||a.athlete?.displayName||""),name:a.athlete?.displayName||a.athlete?.shortName||"未知球員",value:val,teamId:String(group.team?.id||"")})}}
if(type==="足球"&&!list.length){
for(const ev of data.keyEvents||[]){
const description=String(ev.type?.text||ev.type?.name||ev.type||"").toLowerCase();
if(!/goal|進球/.test(description)||/own goal|烏龍/.test(description))continue;
const athlete=ev.athletes?.[0]?.athlete||ev.athletes?.[0]||ev.athlete;
if(athlete?.displayName)list.push({id:String(athlete.id||athlete.displayName),name:athlete.displayName,value:1,teamId:String(ev.team?.id||"")})
}}
return list}
async function loadTeam(){if(!team.value)return;const id=++epoch,lg=league.value,tid=team.value,kind=sport.value,teamName=team.selectedOptions[0]?.textContent||"球隊";go.disabled=true;notice("正在取得 "+teamName+" 最近五場已完賽資料…");
try{
let events=[];try{const schedule=await json(src+lg+"/teams/"+encodeURIComponent(tid)+"/schedule?season="+new Date().getFullYear());events=schedule.events||[]}catch(e){}
events=events.filter(e=>e.status?.type?.state==="post"&&competitors(e).some(c=>String(c.team?.id)===String(tid)));
if(events.length<5){try{const backup=await leagueEvents(lg,8);const seen=new Set(events.map(e=>String(e.id)));events.push(...backup.filter(e=>e.status?.type?.state==="post"&&!seen.has(String(e.id))&&competitors(e).some(c=>String(c.team?.id)===String(tid))))}catch(e){}}
if(id!==epoch)return;events.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))
const last=events.slice(0,5).map(e=>teamResult(e,tid)).filter(Boolean);
if(!last.length){notice("目前沒有取得可核對的已完賽賽事，無法計算近五場勝率。");return}
const wins=last.filter(x=>x.result==="勝").length,draws=last.filter(x=>x.result==="和").length,losses=last.filter(x=>x.result==="負").length;
const rate=Math.round(wins/last.length*1000)/10;
const label=kind==="足球"?"進球":kind==="籃球"?"得分":"全壘打";
const fixtureHtml=last.map(x=>'<tr><td>'+fmtDate(x.e.date)+'</td><td>'+esc(window.hzLocalizedTeam?.(x.opp?.team)||x.opp?.team?.displayName||"未知對手")+'</td><td>'+esc(x.t.score??"—")+" : "+esc(x.opp?.score??"—")+'</td><td><b>'+esc(x.result||"未知")+'</b></td></tr>').join("");
$("hz-team-results").innerHTML='<div class="hz-team-tiles"><div class="hz-team-tile"><small>最近已完賽場次</small><strong>'+last.length+' / 5</strong></div><div class="hz-team-tile"><small>近五場勝率</small><strong>'+rate+'%</strong></div><div class="hz-team-tile"><small>勝 / 和 / 負</small><strong>'+wins+' / '+draws+' / '+losses+'</strong></div></div><h3>'+esc(teamName)+'｜近期戰績</h3><div class="table-wrap"><table><thead><tr><th>日期</th><th>對手</th><th>比分（本隊：對手）</th><th>結果</th></tr></thead><tbody>'+fixtureHtml+'</tbody></table></div><h3>主力球員｜最近 '+last.length+' 場'+label+'數</h3><div id="hz-player-scoring" class="hz-team-status">正在取得公開賽事技術統計…</div><p class="subtle">資料來源：ESPN 公開賽程與比賽技術統計。勝率以取得的最近最多五場已完賽為分母；和局不計勝場。球員表現只統計有核實技術統計的比賽，不代表完整賽季數據。</p>';
const replies=await Promise.allSettled(last.map(x=>json(src+lg+"/summary?event="+encodeURIComponent(x.e.id))));
if(id!==epoch)return;
const sums=new Map(),games=new Set();
replies.forEach((r,i)=>{if(r.status!=="fulfilled")return;const rows=findPlayerRows(r.value,kind).filter(x=>x.teamId===String(tid));if(!rows.length)return;games.add(last[i].e.id);for(const p of rows){const old=sums.get(p.id)||{name:p.name,value:0};old.value+=p.value;sums.set(p.id,old)}});
const target=$("hz-player-scoring");if(!target)return;
const top=[...sums.values()].sort((a,b)=>b.value-a.value).slice(0,5);
target.innerHTML=top.length?'<p class="subtle">已核實 '+games.size+' / '+last.length+' 場比賽球員技術統計</p><div class="hz-player-grid">'+top.map((p,i)=>'<div class="hz-player-row"><span>'+(i+1)+'. '+esc(p.name)+'</span><strong>'+p.value+' '+label+'</strong></div>').join("")+'</div>':'<div class="hz-team-status">此聯賽／球隊的公開摘要未提供可核對的個人'+label+'數，目前無法顯示，不會使用推測數據。</div>';
}catch(e){if(id!==epoch)return;notice("目前無法取得此隊的完整近期戰績（公開來源可能限制讀取或尚未提供）。請稍後再試或改查其他球隊。")}finally{if(id===epoch)go.disabled=false}}
sport.addEventListener("change",fillLeagues);league.addEventListener("change",loadTeams);team.addEventListener("change",loadTeam);go.addEventListener("click",loadTeam);
fillLeagues();
})();