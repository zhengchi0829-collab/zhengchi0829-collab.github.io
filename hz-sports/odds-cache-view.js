(function(){
"use strict";
const root=document.getElementById("hz-cached-odds");
if(!root)return;
const pick=document.getElementById("hz-cache-league"),matches=document.getElementById("hz-cache-match"),out=document.getElementById("hz-cache-details"),state=document.getElementById("hz-cache-status"),refresh=document.getElementById("hz-cache-refresh");
const text=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const price=n=>{const v=Number(n);return n!==null&&n!==undefined&&n!==""&&Number.isFinite(v)&&v>1?v.toFixed(2):"暫無賠率"};
const number=n=>n!==null&&n!==undefined&&n!==""&&Number.isFinite(Number(n))?String(n):"—";
const time=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?d.toLocaleString("zh-TW",{timeZone:"Asia/Taipei",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}):String(s||"")};
const mapped=n=>window.hzTeamZh?.(n)||n||"待確認";
let data={},selection=[],seq=0;
function leagues(){const all=Object.keys(data).filter(x=>Array.isArray(data[x])&&data[x].length);pick.innerHTML=all.length?all.map(k=>'<option value="'+text(k)+'">'+text(k)+' ('+data[k].length+' 場)</option>').join(""):'<option value="">目前無公開快取</option>';pick.disabled=!all.length;renderList()}
function renderList(){selection=data[pick.value]||[];matches.innerHTML=selection.length?selection.map((m,i)=>'<option value="'+i+'">'+text(time(m.start))+'｜'+text(mapped(m.away))+' VS '+text(mapped(m.home))+'</option>').join(""):'<option value="">暫無賽事</option>';matches.disabled=!selection.length;render()}
function quote(label,value){return '<div class="hz-cache-quote"><span>'+text(label)+'</span><strong>'+text(value)+'</strong></div>'}
function render(){const m=selection[Number(matches.value)];if(!m){out.innerHTML='<div class="hz-odds-no-data">沒有可核對的公開賠率紀錄。</div>';return}
out.innerHTML='<div class="hz-cache-heading"><strong>'+text(mapped(m.away))+'（'+text(m.away)+'）</strong><b>VS</b><strong>'+text(mapped(m.home))+'（'+text(m.home)+'）</strong></div><p class="subtle">'+text(time(m.start))+'｜來源為第三方公開資料快取，非娛樂平台官方即時盤口</p><div class="hz-cache-quotes">'+[
quote("客隊獨贏",price(m.away_price)),quote("主隊獨贏",price(m.home_price)),
quote("和局",price(m.draw_price)),quote("主隊讓分",number(m.spread)),
quote("主隊讓分賠率",price(m.spread_home_price)),quote("客隊讓分賠率",price(m.spread_away_price)),
quote("大小分盤",number(m.total)),quote("大分賠率",price(m.over_price)),quote("小分賠率",price(m.under_price))
].join("")+'</div>'}
async function load(){const id=++seq;refresh.disabled=true;state.textContent="讀取現有賠率快取中…";try{
const r=await fetch("https://hz-sports-odds.onrender.com/api/odds-snapshot",{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);
const result=await r.json();if(id!==seq)return;
data=result.status==="ok"?result.leagues||{}:{};
state.textContent=result.status==="ok"?"資料日期："+text(result.day)+"｜更新："+text(result.captured_at||"未提供")+"｜來源：第三方公開快取（不是娛樂平台官方賠率）":"今日尚未有有效的公開賠率快取，已停止顯示舊日期盤口。";
leagues()}catch(e){if(id!==seq)return;data={};state.textContent="獨立賠率服務暫不可用，請稍後重新整理。";leagues()}finally{if(id===seq)refresh.disabled=false}}
pick.addEventListener("change",renderList);matches.addEventListener("change",render);refresh.addEventListener("click",load);load();
})();