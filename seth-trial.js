import { MODES, BET_OPTIONS, STARTING_BALANCE, FREE_BUY_MULTIPLIER, MAX_CASCADES, SYMBOLS, createGameState, setBet, resetGame, restoreGameState, buyFreeSpins, resolveSpin } from './seth-game-engine.js?v=20261112sethsim3';
import { symbolMarkup } from './seth-symbols.js?v=20261112sethsim3';

const STORAGE_KEY = 'seth-trial-progress-v3';
const format = value => Math.round(Number(value) || 0).toLocaleString('zh-TW');
const labels = new Map(SYMBOLS.map(symbol => [symbol.id, symbol.label]));
const spinIcon = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M31 15a13 13 0 1 0 1 10"/><path d="m25 7 7 8 6-8"/></svg>';
let instances = 0;

class SethTrial extends HTMLElement {
  constructor() {
    super();
    this._uid = `seth-play-${++instances}`;
    this._states = Object.fromEntries(MODES.map(mode => [mode.id, createGameState(mode.id)]));
    this._mode = MODES[0].id;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.version === 3) {
        for (const mode of MODES) this._states[mode.id] = restoreGameState(saved.states?.[mode.id], mode.id);
        if (MODES.some(mode => mode.id === saved.mode)) this._mode = saved.mode;
      }
    } catch { /* Storage is optional; fresh in-memory states remain usable. */ }
    this._state = this._states[this._mode];
    this._results = Object.create(null);
    this._busy = false;
    this._buyOpen = false;
    this._fast = false;
    this._sound = false;
    this._autoActive = false;
    this._autoRemaining = 0;
    this._timers = new Map();
    this._oscillators = new Set();
    this._version = 0;
    for (const name of ['_onClick', '_onKey', '_onVisibility', '_onFullscreen']) this[name] = this[name].bind(this);
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this._render(); this._refresh();
    this.addEventListener('click', this._onClick);
    document.addEventListener('keydown', this._onKey);
    document.addEventListener('visibilitychange', this._onVisibility);
    document.addEventListener('fullscreenchange', this._onFullscreen);
    this._atlas = new Image();
    this._atlas.onload = () => { if (this.isConnected && this._atlas.naturalWidth > 0) this.classList.add('st-atlas-ready'); };
    this._atlas.src = new URL('./assets/seth-symbols.webp?v=20261112sethsim3', import.meta.url).href;
    if (this.id && location.hash === `#${this.id}`) {
      this._hashFrame = requestAnimationFrame(() => {
        this._hashFrame = null;
        if (this.isConnected && location.hash === `#${this.id}`) this.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    }
  }

  disconnectedCallback() {
    this._connected = false;
    this._cancelAuto(); this._cancelBuy(false); this._cancelAnimation(); this._stopAudio(); this._exitFullscreen();
    this._audio?.close().catch(() => {}); this._audio = null;
    if (this._atlas) this._atlas.onload = null;
    if (this._hashFrame != null) cancelAnimationFrame(this._hashFrame);
    this.removeEventListener('click', this._onClick);
    document.removeEventListener('keydown', this._onKey);
    document.removeEventListener('visibilitychange', this._onVisibility);
    document.removeEventListener('fullscreenchange', this._onFullscreen);
  }

  _persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, mode: this._mode, states: this._states })); }
    catch { /* Private browsing or full storage must not stop the game. */ }
  }
  _commit(state) { this._state = state; this._states[state.mode] = state; this._persist(); }
  _name() { return MODES.find(mode => mode.id === this._mode).name; }

  _render() {
    if (!this.querySelector('.st-player')) {
      const cards = MODES.map((mode, index) => `<article class="st-card st-card--${index ? 'violet' : 'gold'}"><div class="st-card-copy"><span class="st-card-kicker">${index ? 'AWAKENING' : 'STORM OF SETH'}</span><h3>${mode.name}</h3></div><button type="button" class="st-card-start" data-action="open" data-mode="${mode.id}">開始試玩<span aria-hidden="true">›</span></button></article>`).join('');
      this.innerHTML = `<section class="seth-trial-section" aria-labelledby="${this._uid}-title"><div class="layout-width st-inner">
        <div class="st-heading"><p class="st-eyebrow">SETH TRIAL</p><h2 id="${this._uid}-title">賽特試玩區</h2><p class="st-intro">專屬模擬試玩・虛擬點數</p></div>
        <div class="st-card-grid">${cards}</div>
        <section class="st-player" hidden aria-labelledby="${this._uid}-game-title">
          <div class="st-player-view">
            <header class="st-player-header"><div class="st-mode-tabs" role="group" aria-label="選擇試玩版本">${MODES.map((mode, index) => `<button type="button" class="st-mode-tab" data-action="mode" data-mode="${mode.id}" aria-pressed="${index === 0}">${index ? '賽特二代' : '賽特一代'}</button>`).join('')}</div><div class="st-header-tools"><button type="button" class="st-header-button st-buy-button" data-action="buy" aria-label="使用虛擬點數購買15次免費遊戲">免費遊戲<span class="st-buy-cost"></span></button><button type="button" class="st-header-button" data-action="fullscreen" aria-pressed="false">全螢幕</button><button type="button" class="st-close-button" data-action="close" aria-label="關閉試玩">×</button></div></header>
            <div class="st-stage">
              <div class="st-stage-hud"><div class="st-game-brand"><small>SETH</small><h3 id="${this._uid}-game-title" tabindex="-1">戰神賽特（一代）</h3><span class="st-free-counter" data-hud="free">一般遊戲</span></div><div class="st-multiplier-orb" aria-label="本局倍率"><small>倍數</small><strong data-hud="multiplier">1×</strong></div></div>
              <div class="st-board-wrap"><div class="st-board" role="group" aria-label="六欄五列遊戲盤面"></div><div class="st-win-display" hidden aria-hidden="true"><span>WIN</span><strong>0</strong></div></div>
              <p class="st-feature-message" role="status" aria-live="polite">準備開始</p>
              <p class="st-result-line">選好每轉點數，按下轉動開始。</p>
            </div>
            <footer class="st-controls"><div class="st-balance"><span>虛擬點數</span><strong data-hud="balance">10,000</strong></div><div class="st-bet-control"><span>每轉點數</span><div><button type="button" data-action="bet-down" aria-label="降低每轉點數">−</button><strong data-hud="bet">20</strong><button type="button" data-action="bet-up" aria-label="提高每轉點數">＋</button></div></div><button type="button" class="st-spin-button" data-action="spin" aria-label="轉動">${spinIcon}<span class="st-spin-label">轉動</span></button><div class="st-control-tools"><button type="button" class="st-tool-button" data-action="fast" aria-pressed="false"><span aria-hidden="true">»</span>快轉</button><button type="button" class="st-tool-button st-auto-button" data-action="auto" aria-pressed="false">自動 10 次</button><button type="button" class="st-tool-button" data-action="sound" aria-pressed="false">音效：關</button></div></footer>
            <div class="st-free-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="${this._uid}-free-title"><div class="st-free-glow" aria-hidden="true"></div><div class="st-free-copy"><span class="st-free-eyebrow">FREE SPINS</span><h4 id="${this._uid}-free-title">免費遊戲</h4><strong class="st-free-award">15</strong><p class="st-free-description">次免費轉動</p><button type="button" data-action="continue-free">繼續</button></div></div>
            <div class="st-buy-modal" hidden><section class="st-modal" role="dialog" aria-modal="true" aria-labelledby="${this._uid}-buy-title"><span class="st-modal-kicker">FREE SPINS</span><h4 id="${this._uid}-buy-title">購買 15 次免費遊戲</h4><p class="st-buy-description"></p><strong class="st-confirm-price"></strong><p class="st-buy-note">只使用本機虛擬點數，沒有金錢交易。</p><div class="st-modal-actions"><button type="button" data-action="cancel-buy">取消</button><button type="button" data-action="confirm-buy">確認使用點數</button></div></section></div>
          </div>
          <div class="st-underbar"><span class="st-round-label">第 0 局</span><button type="button" data-action="reset">重設點數</button><button type="button" data-action="rules">遊戲規則</button><span class="st-live-status" role="status" aria-live="polite" aria-atomic="true">已準備好。</span></div>
          ${this._rulesMarkup()}
        </section>
        <p class="st-section-note">遊戲點數沒有現金價值，不提供儲值、提領或兌換。</p>
      </div></section>`;
    }
    const q = selector => this.querySelector(selector);
    this._nodes = { player:q('.st-player'), view:q('.st-player-view'), title:q('.st-game-brand h3'), board:q('.st-board'), win:q('.st-win-display'), feature:q('.st-feature-message'), result:q('.st-result-line'), status:q('.st-live-status'), spin:q('[data-action="spin"]'), auto:q('[data-action="auto"]'), fast:q('[data-action="fast"]'), sound:q('[data-action="sound"]'), buy:q('[data-action="buy"]'), cost:q('.st-buy-cost'), modal:q('.st-buy-modal'), description:q('.st-buy-description'), price:q('.st-confirm-price'), freeOverlay:q('.st-free-overlay'), freeTitle:q('.st-free-copy h4'), freeAward:q('.st-free-award'), freeDescription:q('.st-free-description'), rules:q('.st-rules'), round:q('.st-round-label'), fullscreen:q('[data-action="fullscreen"]') };
  }

  _rulesMarkup() {
    const ordinary = SYMBOLS.filter(symbol => Array.isArray(symbol.pay) && symbol.pay.some(value => value > 0));
    return `<details class="st-rules"><summary>完整遊戲規則</summary><div class="st-rules-content"><p><strong>專屬模擬設定：</strong>本版由本站自行實作，機率與獎勵為本站設定，未接原廠。未包含 JP 與寶箱功能。</p><h4>盤面與連消</h4><p>6 欄 × 5 列盤面。普通符號在任意位置累積 8 個以上即可計分與消除，補位後可繼續連消。每局最多 ${MAX_CASCADES} 次連消；達到上限後，最後補位盤面不再追加得分。</p><div class="st-paytable"><div class="st-paytable-head"><span>符號</span><span>8–9 個</span><span>10–11 個</span><span>12+ 個</span></div>${ordinary.map(symbol => `<div class="st-paytable-row"><span>${symbolMarkup({symbol:symbol.id})}<span>${symbol.label}</span></span>${symbol.pay.map(pay => `<span>${pay}×</span>`).join('')}</div>`).join('')}</div><p>符號基礎得分依每轉點數與上表計算。普通回合的倍數球合計套用於本局連消基礎得分；沒有有效倍數時以 1 倍計算。免費遊戲使用該輪累積倍率，實際結算以畫面顯示為準。</p><h4>免費遊戲與覺醒</h4><p>連消結束盤面出現至少 4 個 SCATTER，可獲得 15 次免費遊戲；免費遊戲的結束盤面有至少 3 個 SCATTER 可追加 5 次，同一輪免費遊戲累計最多 100 次。免費回合沿用原每轉點數，不另扣點，進行中不可改點數或再次購買。</p><p>二代自然觸發免費遊戲時，若結束盤面包含黃金 SCATTER，會進入覺醒。覺醒免費遊戲加入分裂與鎖定：至少 3 個對應人物圖騰可觸發效果：分裂最多追加 2／4／6 顆倍數球，鎖定則保留 2／4／6 次免費回合。本版以連消終盤快照判斷；分裂球只加入可用的非鎖定特殊格。稀有球於免費回合結算後成長，成長值用於後續鎖定回合。</p><h4>虛擬點數與操作</h4><p>購買免費遊戲的價格為每轉點數的 ${FREE_BUY_MULTIPLIER} 倍，確認後換取 15 次免費遊戲。一代為一般免費遊戲；二代的購買有本站設定的 50% 機會啟用覺醒。取消確認不扣點。</p><p>快轉縮短動畫；自動轉動每次執行 10 局，免費回合也計入，可隨時停止。關閉或切到背景會停止自動轉動，已開始的一局仍完整結算。</p><p>兩個版本分別保留點數與免費回合。此瀏覽器允許本機儲存時，重新整理可以接續；重設只影響目前版本。點數不足時可降低每轉點數或重設為 ${format(STARTING_BALANCE)} 點。</p></div></details>`;
  }

  _onClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !this.contains(button) || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'open') this._open(button.dataset.mode, button);
    if (action === 'mode') this._changeMode(button.dataset.mode);
    if (action === 'spin') this._spin(false);
    if (action === 'bet-down') this._adjustBet(-1);
    if (action === 'bet-up') this._adjustBet(1);
    if (action === 'fast') { this._fast = !this._fast; this._controls(); }
    if (action === 'auto') this._autoActive ? this._cancelAuto() : this._startAuto();
    if (action === 'sound') this._toggleSound();
    if (action === 'buy') this._openBuy();
    if (action === 'cancel-buy') this._cancelBuy(true);
    if (action === 'confirm-buy') this._confirmBuy();
    if (action === 'continue-free') this._skipOverlay?.();
    if (action === 'fullscreen') this._toggleFullscreen();
    if (action === 'close') this._close();
    if (action === 'reset' && !this._busy && !this._buyOpen && !this._autoActive) {
      this._commit(resetGame(this._state)); delete this._results[this._mode]; this._refresh();
      this._message(`已重設為 ${format(STARTING_BALANCE)} 虛擬點數，另一版本的進度保留。`);
    }
    if (action === 'rules') { this._cancelAuto(); this._nodes.rules.open = !this._nodes.rules.open; this._nodes.rules.scrollIntoView({block:'nearest'}); }
  }

  _open(mode, button) {
    if (this._busy || this._buyOpen || this._autoActive) return;
    this._returnFocus = button; this._nodes.player.hidden = false;
    this._changeMode(mode); this._refresh();
    this._nodes.title.focus({preventScroll:true});
    this._nodes.player.scrollIntoView({block:'start',behavior:this._reducedMotion() ? 'instant' : 'smooth'});
  }
  _changeMode(mode) {
    if (!this._states[mode] || this._busy || this._buyOpen || this._autoActive) return;
    this._mode = mode; this._state = this._states[mode]; this._persist(); this._refresh();
  }
  _close() {
    this._cancelAuto(); this._cancelBuy(false); this._cancelAnimation(); this._stopAudio(); this._exitFullscreen();
    this._nodes.player.hidden = true; this._nodes.win.hidden = true;
    this._returnFocus?.isConnected && this._returnFocus.focus();
  }
  _refresh() {
    if (!this._nodes) return;
    this._nodes.title.textContent = this._name();
    this._nodes.player.classList.toggle('is-seth2', this._mode === 'seth2');
    this._nodes.player.classList.toggle('is-awakened', Boolean(this._state.awakened));
    this.querySelectorAll('.st-mode-tab').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === this._mode)));
    this._renderBoard(this._state.board); this._hud(); this._controls();
    this._nodes.round.textContent = `第 ${this._state.round} 局`;
    const last = this._results[this._mode];
    const growth = last?.events.find(event => event.type === 'multiplier' && event.text.includes('結算後增長'));
    this._nodes.feature.textContent = growth?.text || (this._state.freeSpins ? `${this._state.awakened ? '覺醒' : '免費'}遊戲 · 剩餘 ${this._state.freeSpins} 次` : '準備開始');
    this._nodes.result.textContent = last ? `${last.usedFreeSpin ? '免費回合' : `使用 ${format(last.charged)} 點`} · 本局得分 ${format(last.totalWin)} 點` : '選好每轉點數，按下轉動開始。';
  }

  _renderBoard(board, locks = this._state.locks) {
    const locked = new Map((locks || []).map(lock => [lock.index, lock.remaining]));
    this._nodes.board.innerHTML = board.map((cell, index) => `<div class="st-cell ${locked.has(index) ? 'is-locked' : ''}" data-cell="${index}" data-symbol="${cell.symbol}" role="img" aria-label="第 ${Math.floor(index/6)+1} 列第 ${index%6+1} 欄，${labels.get(cell.symbol) || cell.symbol}${cell.symbol === 'orb' ? ` ${cell.value} 倍` : ''}">${symbolMarkup(cell)}${cell.symbol === 'scatter' || cell.symbol === 'goldScatter' ? `<span class="st-symbol-tag">${cell.symbol === 'goldScatter' ? '覺醒' : 'SCATTER'}</span>` : ''}${locked.has(index) ? `<span class="st-lock-count" aria-label="鎖定剩餘${locked.get(index)}回合">${locked.get(index)}</span>` : ''}</div>`).join('');
  }
  _hud(values = {}) {
    const last = this._results[this._mode];
    const data = {balance:this._state.balance,bet:this._state.bet,free:this._state.freeSpins,multiplier:last?.multiplier || Math.max(1,this._state.freeMultiplier || 0),...values};
    for (const [key,value] of Object.entries(data)) {
      const el = this.querySelector(`[data-hud="${key}"]`);
      if (key === 'free') el.textContent = value ? `免費剩餘 ${value} 次` : '一般遊戲';
      else el.textContent = key === 'multiplier' ? `${format(value)}×` : format(value);
      if (key === 'multiplier') el.parentElement.classList.toggle('has-large-value', el.textContent.length > 5);
    }
  }
  _controls() {
    if (!this._nodes) return;
    const locked = this._busy || this._buyOpen || this._autoActive;
    const insufficient = !this._state.freeSpins && this._state.balance < this._state.bet;
    const betIndex = BET_OPTIONS.indexOf(this._state.bet);
    this._nodes.player.classList.toggle('is-spinning',this._busy);
    this._nodes.spin.disabled = locked || insufficient;
    this._nodes.spin.querySelector('.st-spin-label').textContent = this._busy ? '轉動中' : this._buyOpen ? '確認中' : this._state.freeSpins ? `免費 ${this._state.freeSpins}` : insufficient ? '點數不足' : '轉動';
    this._nodes.spin.setAttribute('aria-label', this._state.freeSpins ? `免費轉動，剩餘${this._state.freeSpins}次` : '轉動');
    this.querySelector('[data-action="bet-down"]').disabled = locked || this._state.freeSpins > 0 || betIndex <= 0;
    this.querySelector('[data-action="bet-up"]').disabled = locked || this._state.freeSpins > 0 || betIndex >= BET_OPTIONS.length-1;
    this.querySelectorAll('[data-action="open"], [data-action="mode"], [data-action="reset"]').forEach(button => {button.disabled = locked;});
    const cost = this._state.bet * FREE_BUY_MULTIPLIER;
    this._nodes.buy.disabled = locked || this._state.freeSpins > 0 || this._state.balance < cost;
    this._nodes.cost.textContent = `${format(cost)} 點`;
    this._nodes.buy.title = this._state.freeSpins ? '免費遊戲進行中' : this._state.balance < cost ? '虛擬點數不足，可降低每轉點數' : `使用${format(cost)}虛擬點數換15次免費遊戲`;
    this._nodes.auto.disabled = !this._autoActive && (this._busy || this._buyOpen || insufficient);
    this._nodes.auto.textContent = this._autoActive ? `停止自動 ${this._autoRemaining}` : '自動 10 次';
    this._nodes.auto.setAttribute('aria-pressed',String(this._autoActive));
    this._nodes.fast.setAttribute('aria-pressed',String(this._fast));
    this._nodes.sound.textContent = `音效：${this._sound ? '開' : '關'}`;
    this._nodes.sound.setAttribute('aria-pressed',String(this._sound));
    if (!locked && insufficient) this._message('點數不足，請降低每轉點數或重設點數。');
  }
  _message(text) { if (this._nodes) this._nodes.status.textContent = text; }
  _adjustBet(direction) {
    if (this._busy || this._buyOpen || this._autoActive || this._state.freeSpins) return;
    const next = BET_OPTIONS[BET_OPTIONS.indexOf(this._state.bet)+direction];
    if (next === undefined) return;
    try { this._commit(setBet(this._state,next)); this._hud(); this._controls(); }
    catch(error) { this._message(error.message); }
  }

  _reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  _duration(normal) { return this._reducedMotion() ? Math.min(normal,25) : this._fast ? Math.max(25,Math.round(normal*.25)) : normal; }
  _delay(ms,version,skippable=false) {
    return new Promise(resolve => {
      let finished = false;
      const done = result => { if(finished) return; finished=true; clearTimeout(timer); this._timers.delete(timer); if(this._skipOverlay===skip) this._skipOverlay=null; resolve(result); };
      const skip = () => done(version===this._version);
      const timer = setTimeout(() => done(version===this._version),ms);
      this._timers.set(timer,done); if(skippable) this._skipOverlay=skip;
    });
  }

  async _spin(fromAuto=false) {
    if(this._busy || this._buyOpen || (!fromAuto && this._autoActive)) return;
    const before = this._state;
    let result;
    try { result=resolveSpin(before); }
    catch(error) { this._cancelAuto(); this._message(error.message || '無法轉動，請重設點數。'); return; }
    this._commit(result.state); this._pending=result; this._pendingAuto=fromAuto; this._busy=true;
    const version=++this._version;
    this._nodes.win.hidden=true; this._nodes.freeOverlay.hidden=true;
    this._controls(); this._hud({balance:before.balance-result.charged,free:Math.max(0,before.freeSpins-Number(result.usedFreeSpin)),multiplier:1});
    this._nodes.feature.textContent=result.usedFreeSpin ? '免費遊戲進行中' : '轉動中';
    this._nodes.result.textContent=result.usedFreeSpin ? '本局不扣點' : `本局使用 ${format(result.charged)} 點`;
    this._tone('spin');
    const steps=this._reducedMotion() || this._fast ? 1 : 4;
    const lockedIndices=new Set((before.locks || []).map(lock=>lock.index));
    const movingIndices=result.initialBoard.map((cell,index)=>index).filter(index=>!lockedIndices.has(index));
    for(let step=0;step<steps;step++) {
      const animated=[...result.initialBoard];
      movingIndices.forEach((index,offset)=>{animated[index]=result.initialBoard[movingIndices[(offset+step*7)%movingIndices.length]];});
      this._renderBoard(animated,before.locks);
      if(!await this._delay(this._duration(80),version)) return;
    }
    let base=0;
    for(let index=0;index<result.frames.length;index++) {
      const frame=result.frames[index]; this._renderBoard(frame.board,before.locks);
      if(!frame.cleared.length) continue;
      frame.cleared.forEach(cell => this._nodes.board.children[cell].classList.add('is-winning'));
      if(!await this._delay(this._duration(170),version)) return;
      frame.cleared.forEach(cell => this._nodes.board.children[cell].classList.add('is-cleared'));
      if(!await this._delay(this._duration(140),version)) return;
      base+=frame.baseWin;
      this._nodes.result.textContent=`連消基礎得分 ${format(base)} 點`;
      this._renderBoard(result.frames[index+1]?.board || result.finalBoard,before.locks);
      this._nodes.board.classList.add('is-refilling');
      if(!await this._delay(this._duration(170),version)) return;
      this._nodes.board.classList.remove('is-refilling');
    }
    this._renderBoard(result.finalBoard,result.state.locks);
    this._hud({balance:before.balance-result.charged,free:Math.max(0,before.freeSpins-Number(result.usedFreeSpin)),multiplier:result.multiplier});
    for(const event of result.events.filter(event => event.type==='split' || event.type==='lock').slice(0,2)) {
      this._nodes.feature.textContent=event.text; this._nodes.player.classList.add('has-feature'); this._tone('feature');
      if(!await this._delay(this._duration(500),version)) return;
      this._nodes.player.classList.remove('has-feature');
    }
    if(result.awardedFreeSpins>0) {
      if(!await this._showFree(result.awardedFreeSpins,result.state.awakened,version,result.usedFreeSpin)) return;
    }
    if(version===this._version) this._finish(result,true);
  }

  _finish(result,showWin) {
    const wasAuto=this._pendingAuto;
    this._pending=null; this._pendingAuto=false; this._busy=false; this._results[result.state.mode]=result;
    this._nodes.board.classList.remove('is-refilling'); this._nodes.player.classList.remove('has-feature'); this._nodes.freeOverlay.hidden=true;
    this._refresh();
    if(this._nodes.freeOverlay.contains(document.activeElement)) (this._autoActive ? this._nodes.auto : this._nodes.spin).focus({preventScroll:true});
    const growth=result.events.find(event=>event.type==='multiplier' && event.text.includes('結算後增長'));
    this._nodes.feature.textContent=growth?.text || result.events.filter(event => event.type!=='multiplier').map(event=>event.text).join(' · ') || `本局倍率 ${format(result.multiplier)}×`;
    this._message(`${result.usedFreeSpin ? '免費回合' : `使用${format(result.charged)}點`}，本局得分${format(result.totalWin)}點。${result.events.map(event=>event.text).join(' ')}`);
    if(showWin && result.totalWin>0) { this._nodes.win.hidden=false; this._nodes.win.querySelector('strong').textContent=format(result.totalWin); this._tone('win'); }
    if(wasAuto && this._autoActive) {
      this._autoRemaining-=1;
      if(this._autoRemaining<=0 || document.hidden || this._nodes.player.hidden || (!this._state.freeSpins && this._state.balance<this._state.bet)) this._cancelAuto();
      else { this._autoTimer=setTimeout(()=>{this._autoTimer=null;if(this._autoActive) this._spin(true);},this._duration(650)); }
      this._controls();
    }
  }

  async _showFree(count,awakened,version,retrigger=false) {
    this._nodes.freeOverlay.hidden=false;
    this._nodes.freeOverlay.classList.toggle('is-awakened',Boolean(awakened));
    this._nodes.freeTitle.textContent=awakened ? '覺醒免費遊戲' : '免費遊戲';
    this._nodes.freeAward.textContent=`${retrigger ? '+' : ''}${count}`;
    this._nodes.freeDescription.textContent=retrigger ? '追加免費轉動' : '次免費轉動';
    this.querySelector('[data-action="continue-free"]').focus({preventScroll:true}); this._tone('feature');
    const valid=await this._delay(this._duration(1500),version,true);
    this._nodes.freeOverlay.hidden=true;
    return valid;
  }
  _cancelAnimation() {
    this._version+=1;
    for(const [timer,done] of this._timers) {clearTimeout(timer);done(false);}
    this._timers.clear(); this._skipOverlay=null;
    if(this._pending && this._nodes) this._finish(this._pending,false);
    this._busy=false;
    if(this._nodes) {this._nodes.freeOverlay.hidden=true;this._nodes.board.classList.remove('is-refilling');this._nodes.player.classList.remove('has-feature');this._refresh();}
  }
  _startAuto() {
    if(this._busy || this._buyOpen || this._autoActive) return;
    this._autoActive=true;this._autoRemaining=10;this._controls();this._spin(true);
  }
  _cancelAuto() {
    this._autoActive=false;this._autoRemaining=0;
    if(this._autoTimer!=null) clearTimeout(this._autoTimer);
    this._autoTimer=null;this._controls();
  }

  _openBuy() {
    if(this._busy || this._buyOpen || this._autoActive || this._state.freeSpins) return;
    const cost=this._state.bet*FREE_BUY_MULTIPLIER;
    if(this._state.balance<cost) {this._message('虛擬點數不足，請降低每轉點數或重設。');return;}
    this._buyOpen=true;this._buySnapshot={mode:this._mode,bet:this._state.bet};
    this._nodes.description.textContent=`以每轉 ${format(this._state.bet)} 點進入 15 次免費遊戲。${this._mode==='seth2' ? '二代有本站設定的 50% 機會啟用覺醒。' : ''}`;
    this._nodes.price.textContent=`${format(cost)} 虛擬點數`;
    this._nodes.modal.hidden=false;this._controls();this.querySelector('[data-action="cancel-buy"]').focus();
  }
  _cancelBuy(focus) {
    this._buyOpen=false;this._buySnapshot=null;
    if(!this._nodes) return;
    this._nodes.modal.hidden=true;this._controls();
    if(focus && !this._nodes.buy.disabled) this._nodes.buy.focus();
  }
  async _confirmBuy() {
    if(!this._buyOpen || this._busy) return;
    if(this._buySnapshot?.mode!==this._mode || this._buySnapshot?.bet!==this._state.bet) {this._cancelBuy(false);return;}
    try {
      const purchased=buyFreeSpins(this._state);
      this._commit(purchased.state);this._cancelBuy(false);this._busy=true;this._controls();this._hud();
      const version=++this._version;
      this._message(`已使用${format(purchased.cost)}虛擬點數，獲得15次免費遊戲。`);
      if(!await this._showFree(15,purchased.awakened,version)) return;
      this._busy=false;this._refresh();this._nodes.spin.focus({preventScroll:true});
    } catch(error) {this._busy=false;this._cancelBuy(false);this._message(error.message || '目前無法購買免費遊戲。');}
  }

  _toggleSound() {this._sound=!this._sound;this._controls();this._sound ? this._tone('spin') : this._stopAudio();}
  _tone(kind) {
    if(!this._sound || document.hidden || this._nodes.player.hidden) return;
    const Audio=window.AudioContext || window.webkitAudioContext;
    if(!Audio) return;
    try {
      this._audio ||= new Audio();this._audio.resume().catch(()=>{});
      const now=this._audio.currentTime, notes={spin:[220,330],win:[523,659,784,1047],feature:[392,587,784]};
      (notes[kind]||notes.spin).forEach((frequency,index)=>{
        const oscillator=this._audio.createOscillator(),gain=this._audio.createGain(),start=now+index*.09;
        oscillator.type='sine';oscillator.frequency.value=frequency;
        gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.025,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+.16);
        oscillator.connect(gain);gain.connect(this._audio.destination);oscillator.start(start);oscillator.stop(start+.17);this._oscillators.add(oscillator);
        oscillator.onended=()=>{this._oscillators.delete(oscillator);oscillator.disconnect();gain.disconnect();};
      });
    } catch { /* Sound is optional. */ }
  }
  _stopAudio() {this._oscillators.forEach(oscillator=>{try{oscillator.stop();}catch{}});this._oscillators.clear();this._audio?.suspend().catch(()=>{});}
  _onVisibility() {if(document.hidden){this._cancelAuto();this._cancelBuy(false);this._cancelAnimation();this._stopAudio();}}

  async _toggleFullscreen() {
    if(this._fullscreenPending) return;
    if(this._expanded || document.fullscreenElement===this._nodes.player){this._exitFullscreen();return;}
    this._fullscreenPending=true;
    try {
      if(!this._nodes.player.requestFullscreen) throw new Error('Fullscreen unavailable');
      await this._nodes.player.requestFullscreen();
      if(!this.isConnected || this._nodes.player.hidden){if(document.fullscreenElement===this._nodes.player) document.exitFullscreen().catch(()=>{});return;}
    } catch {
      if(!this.isConnected || this._nodes.player.hidden) return;
      this._savedOverflow=document.body.style.overflow;document.body.style.overflow='hidden';this._expanded=true;this._nodes.player.classList.add('is-expanded');
    } finally {this._fullscreenPending=false;this._onFullscreen();}
  }
  _exitFullscreen() {
    if(this._expanded){document.body.style.overflow=this._savedOverflow??'';this._expanded=false;}
    this._nodes?.player.classList.remove('is-expanded');
    if(document.fullscreenElement===this._nodes?.player) document.exitFullscreen().catch(()=>{});
    this._onFullscreen();
  }
  _onFullscreen() {
    if(!this._nodes) return;
    const active=Boolean(this._expanded || document.fullscreenElement===this._nodes.player);
    this._nodes.fullscreen.textContent=active ? '縮小' : '全螢幕';this._nodes.fullscreen.setAttribute('aria-pressed',String(active));
  }
  _onKey(event) {
    if(!this._nodes || this._nodes.player.hidden) return;
    if(event.key==='Escape') {
      event.preventDefault();
      if(this._buyOpen){this._cancelBuy(true);return;}
      if(!this._nodes.freeOverlay.hidden){this._skipOverlay?.();return;}
      if(this._expanded || document.fullscreenElement===this._nodes.player){this._exitFullscreen();this._nodes.fullscreen.focus();return;}
      this._close();return;
    }
    if(event.key!=='Tab') return;
    const scope=this._buyOpen ? this._nodes.modal : !this._nodes.freeOverlay.hidden ? this._nodes.freeOverlay : (this._expanded || document.fullscreenElement===this._nodes.player) ? this._nodes.player : null;
    if(!scope) return;
    const items=[...scope.querySelectorAll('button:not([disabled]),summary,[tabindex="0"]')].filter(node=>node.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey && (document.activeElement===first || !scope.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && (document.activeElement===last || !scope.contains(document.activeElement))){event.preventDefault();first?.focus();}
  }
}
if(!customElements.get('seth-trial')) customElements.define('seth-trial',SethTrial);
