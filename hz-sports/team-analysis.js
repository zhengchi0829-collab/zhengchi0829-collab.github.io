(function(){
"use strict";
const $=id=>document.getElementById(id);
const src="https://site.api.espn.com/apis/site/v2/sports/";
const leagues=[["足球","英超","soccer/eng.1"],["足球","西甲","soccer/esp.1"],["足球","德甲","soccer/ger.1"],["足球","義甲","soccer/ita.1"],["足球","法甲","soccer/fra.1"],["足球","歐冠","soccer/uefa.champions"],["籃球","NBA","basketball/nba"],["籃球","NCAA","basketball/mens-college-basketball"],["籃球","NBL","basketball/nbl"],["籃球","TPBL","basketball/tpbl"],["棒球","MLB","baseball/mlb"],["棒球","NPB","baseball/npb"],["棒球","KBO","baseball/kbo"],["棒球","CPBL","baseball/cpbl"],["棒球","MiLB","baseball/milb"]];
let epoch=0;
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate=x=>new Date(x).toLocaleDateString("zh-TW",{timeZone:"Asia/Taipei",month:"2-digit",day:"2-digit"});
const notice=(t)=>{$("hz-team-results").innerHTML='<div class="hz-team-status">'+esc(t)+'</div>'};
async function json(url){const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),13000);try{const r=await fetch(url,{signal:ctl.signal,cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);return await r.json()}finally{clearTimeout(timeout)}}
const sport=$("hz-team-sport"),league=$("hz-team-league"),team=$("hz-team-team"),go=$("hz-team-refresh");
if(!sport||!league||!team||!go)return;
function fillLeagues(){league.innerHTML=leagues.filter(a=>a[0]===sport.value).map(a=>'<option value="'+esc(a[2])+'">'+esc(a[1])+'</option>').join("");loadTeams()}
async function loadTeams(){const id=++epoch;team.disabled=true;go.disabled=true;team.innerHTML='<option>載入球隊中…</option>';notice("正在載入聯賽球隊…");try{
const d=await json(src+league.value+"/teams?limit=500");
if(id!==epoch)return;
const groups=d.sports?.flatMap(s=>(s.leagues||[]).flatMap(l=>l.teams||[]))||[];
const teams=groups.map(t=>t.team||t).filter(x=>x?.id).sort((a,b)=>String(a.displayName||a.name).localeCompare(String(b.displayName||b.name),"zh-Hant"));
if(!teams.length)throw Error("未取得球隊清單");
team.innerHTML=teams.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.displayName||t.name||t.id)+'</option>').join("");
team.disabled=false;go.disabled=false;await loadTeam();
}catch(e){if(id!==epoch)return;team.innerHTML='<option value="">來源暫無資料</option>';notice("此聯賽暫時無法取得球隊名單，可能尚未接通或資料來源受限。請選擇其他聯賽。")}}
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
const schedule=await json(src+lg+"/teams/"+encodeURIComponent(tid)+"/schedule?season="+new Date().getFullYear());
if(id!==epoch)return;
let events=(schedule.events||[]).filter(e=>e.status?.type?.state==="post"&&competitors(e).some(c=>String(c.team?.id)===String(tid))).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
if(events.length<5){const prior=await json(src+lg+"/teams/"+encodeURIComponent(tid)+"/schedule?season="+(new Date().getFullYear()-1)).catch(()=>({events:[]}));if(id!==epoch)return;const seen=new Set(events.map(e=>e.id));events.push(...(prior.events||[]).filter(e=>e.status?.type?.state==="post"&&!seen.has(e.id)&&competitors(e).some(c=>String(c.team?.id)===String(tid))));events.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))}
const last=events.slice(0,5).map(e=>teamResult(e,tid)).filter(Boolean);
if(!last.length){notice("目前沒有取得可核對的已完賽賽事，無法計算近五場勝率。");return}
const wins=last.filter(x=>x.result==="勝").length,draws=last.filter(x=>x.result==="和").length,losses=last.filter(x=>x.result==="負").length;
const rate=Math.round(wins/last.length*1000)/10;
const label=kind==="足球"?"進球":kind==="籃球"?"得分":"全壘打";
const fixtureHtml=last.map(x=>'<tr><td>'+fmtDate(x.e.date)+'</td><td>'+esc(x.opp?.team?.displayName||"未知對手")+'</td><td>'+esc(x.t.score??"—")+" : "+esc(x.opp?.score??"—")+'</td><td><b>'+esc(x.result||"未知")+'</b></td></tr>').join("");
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