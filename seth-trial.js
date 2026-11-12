import {
  BET_OPTIONS, STARTING_BALANCE, MAX_CASCADES, GAME_MODES, SYMBOLS,
  createGameState, setBet, resetGame, resolveSpin
} from './seth-game-engine.js?v=20261112localtrial1';

// Original local simulation. No third-party game, assets, requests, or accounts.
const symbolMap = new Map(SYMBOLS.map(symbol => [symbol.id, symbol]));
const number = value => Number(value).toLocaleString('zh-TW');
const paths = {
  sun: '<circle cx="32" cy="32" r="12"/><circle cx="32" cy="32" r="5" fill="currentColor" stroke="none"/><path d="M32 5v7m0 40v7M5 32h7m40 0h7M13 13l5 5m28 28 5 5M13 51l5-5m28-28 5-5"/>',
  moon: '<path d="M42 8a24 24 0 1 0 14 34A22 22 0 0 1 42 8Z"/><path d="m42 20 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  gem: '<path d="m19 10-11 15 24 30 24-30-11-15H19Z"/><path d="M8 25h48M19 10l13 45L45 10M19 10l13 15 13-15"/>',
  lotus: '<path d="M32 52C12 43 13 25 16 17c11 4 17 15 16 35Zm0 0c20-9 19-27 16-35-11 4-17 15-16 35Z"/><path d="M32 8c-12 13-12 25 0 44 12-19 12-31 0-44ZM8 33c0 15 9 21 24 21 15 0 24-6 24-21"/>',
  feather: '<path d="M15 49C8 29 26 10 53 9c0 25-15 41-33 39L10 58"/><path d="m18 47 27-29M23 42l-2-13m12 3-1-13m-9 23 15-1m-5-9 14-1"/>',
  scarab: '<ellipse cx="32" cy="36" rx="13" ry="18"/><path d="M32 18v36M21 26l-10-8m8 18H7m14 10-10 9m32-29 10-8M45 36h12M43 46l10 9M26 17v-5a6 6 0 0 1 12 0v5"/><path d="M23 28c6 6 12 6 18 0"/>',
  seal: '<path d="m32 5 23 13v28L32 59 9 46V18L32 5Z"/><path d="m32 15 13 8v17l-13 9-13-9V23l13-8Z"/><path d="m24 32 6 6 11-13"/>'
};
const icon = id => `<svg class="st-symbol" viewBox="0 0 64 64" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg>`;
const playIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>';
let instanceCount = 0;

class SethTrial extends HTMLElement {
  constructor() {
    super();
    this._uid = `sand-temple-${++instanceCount}`;
    this._state = createGameState('classic');
    this._busy = false;
    this._timers = new Map();
    this._version = 0;
    this._sound = false;
    this._oscillators = new Set();
    this._onClick = this._onClick.bind(this);
    this._onChange = this._onChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onFullscreen = this._onFullscreen.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this._render();
    this.addEventListener('click', this._onClick);
    this.addEventListener('change', this._onChange);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('fullscreenchange', this._onFullscreen);
    document.addEventListener('visibilitychange', this._onVisibility);
    this._refresh();
    if (this.id && location.hash === `#${this.id}`) {
      this._hashFrame = requestAnimationFrame(() => {
        this._hashFrame = null;
        if (this.isConnected && location.hash === `#${this.id}`) this.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    }
  }

  disconnectedCallback() {
    this._connected = false;
    this._cancelAnimation(); this._stopAudio();
    this._audio?.close().catch(() => {}); this._audio = null;
    this._exitFullscreen();
    if (this._hashFrame != null) cancelAnimationFrame(this._hashFrame);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('change', this._onChange);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('fullscreenchange', this._onFullscreen);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  _render() {
    if (!this.querySelector('.st-simulator')) {
      const cards = GAME_MODES.map(mode => `<article class="st-card st-card--${mode.id === 'temple' ? 'violet' : 'cyan'}">
        <div class="st-card-top"><div class="st-emblem" aria-hidden="true">${icon(mode.id === 'temple' ? 'seal' : 'sun')}</div><div class="st-card-copy"><span class="st-card-kicker">本站原創模擬</span><h3>${mode.name}</h3><p class="st-card-subtitle">${mode.id === 'classic' ? '固定 1 倍 · 熟悉連消' : '隨機倍率 · 神殿探索'}</p></div></div>
        <p class="st-card-description">${mode.id === 'classic' ? '相同符號累積 8 個即可連消，每回合固定 1 倍。' : '每回合隨機抽出 1、2、3 或 5 倍，套用於本局得分。'}</p>
        <div class="st-card-actions"><button class="st-play-link" type="button" data-action="open" data-mode="${mode.id}" aria-label="開始${mode.name}試玩">${playIcon}<span>開始試玩</span></button></div>
        <span class="st-link-note">站內直接玩 · ${number(STARTING_BALANCE)} 虛擬點數起始</span></article>`).join('');
      this.innerHTML = `<section class="seth-trial-section" aria-labelledby="${this._uid}-title"><div class="layout-width st-inner">
        <div class="st-heading"><div class="st-heading-copy"><p class="st-eyebrow">${playIcon}<span>站內模擬試玩</span></p><h2 id="${this._uid}-title">沙海神殿<span class="st-title-dot">.</span></h2><p class="st-intro">本站自製虛擬點數遊戲，非《戰神賽特》原版；規則與機率由本站模擬設定。</p></div><span class="st-feature-tag">免下載 · 免註冊</span></div>
        <div class="st-card-grid">${cards}</div>
        <section class="st-simulator st-simulator--classic" hidden aria-labelledby="${this._uid}-game-title">
          <header class="st-sim-header"><h3 class="st-sim-title" id="${this._uid}-game-title" tabindex="-1">沙海神殿 · 經典模式</h3><div class="st-sim-tools"><button type="button" class="st-icon-button" data-action="sound" aria-pressed="false" aria-label="開啟遊戲音效">音效：關</button><button type="button" class="st-icon-button" data-action="fullscreen" aria-pressed="false">全螢幕</button><button type="button" class="st-icon-button" data-action="close" aria-label="關閉試玩並返回模式選擇">關閉</button></div></header>
          <div class="st-mode-tabs" role="group" aria-label="選擇遊戲模式">${GAME_MODES.map(mode => `<button type="button" class="st-mode-tab" data-action="mode" data-mode="${mode.id}" aria-pressed="${mode.id === 'classic'}">${mode.name}</button>`).join('')}</div>
          <div class="st-wallet">${[['balance','虛擬點數'],['win','本局得分'],['free','免費回合'],['multiplier','回合倍率']].map(([key,label]) => `<div class="st-stat"><span class="st-stat-label">${label}</span><strong class="st-stat-value" data-stat="${key}">0</strong></div>`).join('')}</div>
          <div class="st-board-shell"><div class="st-board" role="group" aria-label="六欄五列遊戲盤面"></div></div>
          <div class="st-win-banner">選好每回合點數，按下「轉動」開始。</div>
          <div class="st-spin-controls"><label class="st-bet-control" for="${this._uid}-bet"><span>每回合點數</span><select id="${this._uid}-bet" data-bet>${BET_OPTIONS.map(bet => `<option value="${bet}">${number(bet)} 點</option>`).join('')}</select></label><button type="button" class="st-spin-button" data-action="spin">${playIcon}<span>轉動</span></button><button type="button" class="st-reset-button" data-action="reset">重設 ${number(STARTING_BALANCE)} 點</button></div>
          <details class="st-rules"><summary>玩法與計分規則</summary><p>盤面為 6 欄 × 5 列。任意位置出現 8 個以上相同普通符號即計分並消除，上方符號掉落補位；每局最多 ${MAX_CASCADES} 次連消。達到上限後，最後補位盤面不再追加計分。</p><div class="st-rules-grid">${SYMBOLS.map(symbol => `<div class="st-pay-item" style="--symbol-color:${symbol.color}">${icon(symbol.id)}<span>${symbol.name}</span><strong>${symbol.id === 'seal' ? '免費回合' : `${symbol.basePay}×`}</strong></div>`).join('')}</div><p>每種符號得分＝每回合點數 × 上表基礎倍數 × 數量級距，四捨五入至整數。8–9 個為 1 倍、10–11 個為 2 倍、12 個以上為 3.5 倍；同盤不同符號分別累加。連消總分再乘本局回合倍率。</p><p>付費回合的首盤出現 4 個以上「神印」，獲得 5 次免費轉動。免費回合沿用當時點數，不能調整，也不會再次觸發免費回合。神印本身不計分。</p><p>經典模式固定 1 倍；神殿模式每回合的 1／2／3／5 倍出現權重為 65／20／10／5。這些是本站自訂規則，與原版遊戲無關。</p><p>切換模式會重新開始。關閉後重開同一模式保留本頁進度；重新整理頁面會回到 ${number(STARTING_BALANCE)} 點。虛擬點數不可儲值、提領或兌換。</p></details>
          <p class="st-live-status" role="status" aria-live="polite" aria-atomic="true">已準備好，可以開始試玩。</p>
        </section>
        <div class="st-source-note"><p>本站原創模擬 · 虛擬點數 · 非《戰神賽特》原版</p><p>點數不可兌換，試玩結果不能用來預測任何正式遊戲。重新整理頁面會重設進度。</p></div>
      </div></section>`;
    }
    const find = selector => this.querySelector(selector);
    this._nodes = { player: find('.st-simulator'), title: find('.st-sim-title'), board: find('.st-board'), banner: find('.st-win-banner'), status: find('.st-live-status'), bet: find('[data-bet]'), spin: find('[data-action="spin"]'), sound: find('[data-action="sound"]'), fullscreen: find('[data-action="fullscreen"]') };
  }

  _onClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !this.contains(button) || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'open') this._open(button.dataset.mode, button);
    if (action === 'mode' && !this._busy) this._changeMode(button.dataset.mode);
    if (action === 'spin') this._spin();
    if (action === 'reset' && !this._busy) {
      this._state = resetGame(this._state); this._lastResult = null; this._refresh();
      this._nodes.banner.textContent = `已重設為 ${number(STARTING_BALANCE)} 虛擬點數。`;
      this._status('已重新開始，點數僅供本頁遊戲使用。');
    }
    if (action === 'close') this._close();
    if (action === 'sound') this._toggleSound();
    if (action === 'fullscreen') this._toggleFullscreen();
  }

  _onChange(event) {
    if (!event.target.matches('[data-bet]') || this._busy) return;
    try { this._state = setBet(this._state, Number(event.target.value)); this._status(`每回合使用 ${number(this._state.bet)} 虛擬點數。`); this._controls(); }
    catch (error) { this._nodes.bet.value = String(this._state.bet); this._status(error.message); }
  }

  _open(mode, button) {
    if (this._busy) return;
    this._returnFocus = button;
    this._nodes.player.hidden = false;
    if (mode !== this._state.mode) this._changeMode(mode);
    else this._refresh();
    this._nodes.title.focus({ preventScroll: true });
    this._nodes.player.scrollIntoView({ block: 'start', behavior: this._reducedMotion() ? 'instant' : 'smooth' });
  }

  _changeMode(mode) {
    if (!GAME_MODES.some(item => item.id === mode) || mode === this._state.mode) return;
    this._cancelAnimation();
    this._state = createGameState(mode); this._lastResult = null;
    this._refresh();
    const name = GAME_MODES.find(item => item.id === mode).name;
    this._nodes.banner.textContent = `${name} · 從 ${number(STARTING_BALANCE)} 虛擬點數開始。`;
    this._status(`已切換${name}並重設進度。`);
  }

  _close() {
    this._cancelAnimation(); this._stopAudio(); this._exitFullscreen();
    this._nodes.player.hidden = true;
    if (this._returnFocus?.isConnected) this._returnFocus.focus();
  }

  _refresh() {
    this._renderBoard(this._state.board); this._stats(); this._controls();
    this._nodes.title.textContent = `沙海神殿 · ${GAME_MODES.find(mode => mode.id === this._state.mode).name}`;
    this._nodes.player.classList.toggle('st-simulator--temple', this._state.mode === 'temple');
    this._nodes.player.classList.toggle('st-simulator--classic', this._state.mode === 'classic');
    this.querySelectorAll('.st-mode-tab').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === this._state.mode)));
  }

  _renderBoard(board) {
    this._nodes.board.innerHTML = board.map((id, index) => {
      const symbol = symbolMap.get(id);
      return `<div class="st-cell" data-cell="${index}" style="--symbol-color:${symbol.color}" role="img" aria-label="第 ${Math.floor(index / 6) + 1} 列第 ${index % 6 + 1} 欄，${symbol.name}">${icon(id)}<span class="st-cell-label">${symbol.name}</span></div>`;
    }).join('');
  }

  _stats(values = {}) {
    const stats = { balance: this._state.balance, win: this._lastResult?.totalWin || 0, free: this._state.freeSpins, multiplier: this._lastResult?.multiplier ?? (this._state.mode === 'classic' ? 1 : null), ...values };
    for (const [key, value] of Object.entries(stats)) this.querySelector(`[data-stat="${key}"]`).textContent = key === 'multiplier' ? (value == null ? '待轉動' : `${value}×`) : number(value);
  }

  _controls() {
    const insufficient = this._state.freeSpins === 0 && this._state.balance < this._state.bet;
    this._nodes.player.classList.toggle('is-spinning', this._busy);
    this._nodes.player.setAttribute('aria-busy', String(this._busy));
    this._nodes.bet.value = String(this._state.bet);
    this._nodes.bet.disabled = this._busy || this._state.freeSpins > 0;
    this._nodes.spin.disabled = this._busy || insufficient;
    const label = this._busy ? '轉動中…' : insufficient ? '點數不足' : this._state.freeSpins > 0 ? `免費轉動（剩餘 ${this._state.freeSpins} 次）` : '轉動';
    this._nodes.spin.innerHTML = `${playIcon}<span>${label}</span>`;
    this.querySelectorAll('[data-action="open"], [data-action="mode"], [data-action="reset"]').forEach(button => { button.disabled = this._busy; });
    if (!this._busy && insufficient) this._status('虛擬點數不足，請降低每回合點數，或按「重設 10,000 點」。');
  }

  _status(text) { this._nodes.status.textContent = text; }
  _reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  _delay(milliseconds, version) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { this._timers.delete(timer); resolve(version === this._version); }, milliseconds);
      this._timers.set(timer, resolve);
    });
  }

  async _spin() {
    if (this._busy) return;
    let result;
    const before = this._state;
    try { result = resolveSpin(before); }
    catch (error) { this._status(error.message || '暫時無法開始，請重設虛擬點數再試。'); this._controls(); return; }
    // Commit the complete outcome first. Closing never leaves a partially charged round.
    this._state = result.state; this._pending = result; this._busy = true;
    const version = ++this._version;
    const reduced = this._reducedMotion();
    this._controls();
    this._stats({ balance: before.balance - result.charged, win: 0, free: before.freeSpins - Number(result.usedFreeSpin), multiplier: result.multiplier });
    const chargeText = result.usedFreeSpin ? '免費回合，未扣點' : `本局使用 ${number(result.charged)} 點`;
    this._nodes.banner.textContent = `${chargeText} · 轉動中…`;
    this._status(`${chargeText}，正在轉動。`); this._tone('spin');
    const ordinary = SYMBOLS.filter(symbol => symbol.id !== 'seal');
    for (let step = 0; step < (reduced ? 1 : 4); step++) {
      this._renderBoard(result.initialBoard.map((id, index) => ordinary[(index + step * 3 + this._state.round) % ordinary.length].id));
      if (!await this._delay(reduced ? 25 : 80, version)) return;
    }
    let earned = 0, cascade = 0;
    for (let index = 0; index < result.frames.length; index++) {
      const frame = result.frames[index]; this._renderBoard(frame.board);
      if (!frame.cleared.length) continue;
      cascade += 1;
      frame.cleared.forEach(cell => this._nodes.board.children[cell].classList.add('is-winning'));
      if (!await this._delay(reduced ? 20 : 160, version)) return;
      frame.cleared.forEach(cell => this._nodes.board.children[cell].classList.add('is-cleared'));
      if (!await this._delay(reduced ? 20 : 140, version)) return;
      earned += frame.win * result.multiplier;
      this._stats({ balance: before.balance - result.charged + earned, win: earned, multiplier: result.multiplier });
      this._nodes.banner.textContent = `第 ${cascade} 次連消 · 本局累計 ${number(earned)} 點 · ${chargeText}`;
      this._renderBoard(result.frames[index + 1]?.board || result.finalBoard);
      this._nodes.board.classList.add('is-refilling');
      if (!await this._delay(reduced ? 20 : 180, version)) return;
      this._nodes.board.classList.remove('is-refilling');
    }
    if (version === this._version) this._finish(result, true);
  }

  _finish(result, sound) {
    this._pending = null; this._lastResult = result; this._busy = false;
    this._nodes.board.classList.remove('is-refilling'); this._refresh();
    const chargeText = result.usedFreeSpin ? '免費回合，未扣點' : `本局使用 ${number(result.charged)} 點`;
    const bonus = result.awardedFreeSpins ? ` · 獲得 ${result.awardedFreeSpins} 次免費轉動` : '';
    const limit = result.hitCascadeLimit ? ` · 已達 ${MAX_CASCADES} 次連消上限` : '';
    const message = `${chargeText} · 本局得分 ${number(result.totalWin)} 點${bonus}${limit}`;
    this._nodes.banner.textContent = message;
    this._status(message + (this._state.freeSpins === 0 && this._state.balance < this._state.bet ? '。點數不足，請降低每回合點數或重設點數。' : '。'));
    if (sound && result.totalWin > 0) this._tone('win');
  }

  _cancelAnimation() {
    this._version += 1;
    for (const [timer, resolve] of this._timers) { clearTimeout(timer); resolve(false); }
    this._timers.clear();
    if (this._pending && this._nodes) this._finish(this._pending, false);
    this._busy = false;
  }

  _toggleSound() {
    this._sound = !this._sound;
    this._nodes.sound.textContent = `音效：${this._sound ? '開' : '關'}`;
    this._nodes.sound.setAttribute('aria-pressed', String(this._sound));
    this._nodes.sound.setAttribute('aria-label', this._sound ? '關閉遊戲音效' : '開啟遊戲音效');
    if (this._sound) this._tone('spin'); else this._stopAudio();
  }

  _tone(kind) {
    if (!this._sound || document.hidden || this._nodes.player.hidden) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { this._status('此瀏覽器不支援遊戲音效，仍可繼續試玩。'); return; }
    try {
      this._audio ||= new Audio(); this._audio.resume().catch(() => {});
      const now = this._audio.currentTime;
      (kind === 'win' ? [660, 880] : [330]).forEach((frequency, index) => {
        const oscillator = this._audio.createOscillator(), gain = this._audio.createGain(), start = now + index * .1;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.035, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + .13);
        oscillator.connect(gain); gain.connect(this._audio.destination); oscillator.start(start); oscillator.stop(start + .14);
        this._oscillators.add(oscillator);
        oscillator.onended = () => { this._oscillators.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { this._status('音效暫時無法播放，仍可繼續試玩。'); }
  }

  _stopAudio() {
    this._oscillators.forEach(oscillator => { try { oscillator.stop(); } catch {} });
    this._oscillators.clear(); this._audio?.suspend().catch(() => {});
  }

  _onVisibility() { if (document.hidden) { this._stopAudio(); this._cancelAnimation(); } }

  async _toggleFullscreen() {
    if (this._fullscreenPending) return;
    if (this._expanded || document.fullscreenElement === this._nodes.player) { this._exitFullscreen(); return; }
    this._fullscreenPending = true;
    try {
      if (!this._nodes.player.requestFullscreen) throw new Error('Fullscreen unavailable');
      await this._nodes.player.requestFullscreen();
      if (!this.isConnected || this._nodes.player.hidden) {
        if (document.fullscreenElement === this._nodes.player) document.exitFullscreen().catch(() => {});
        return;
      }
    } catch {
      if (!this.isConnected || this._nodes.player.hidden) return;
      this._bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden'; this._expanded = true;
      this._nodes.player.classList.add('is-expanded');
    } finally {
      this._fullscreenPending = false;
      this._onFullscreen();
    }
  }

  _exitFullscreen() {
    if (this._expanded) { document.body.style.overflow = this._bodyOverflow ?? ''; this._expanded = false; }
    this._nodes?.player.classList.remove('is-expanded');
    if (document.fullscreenElement === this._nodes?.player) document.exitFullscreen().catch(() => {});
    this._onFullscreen();
  }

  _onFullscreen() {
    if (!this._nodes) return;
    const active = Boolean(this._expanded || document.fullscreenElement === this._nodes.player);
    this._nodes.fullscreen.textContent = active ? '退出全螢幕' : '全螢幕';
    this._nodes.fullscreen.setAttribute('aria-pressed', String(active));
    this._nodes.player.setAttribute('role', active ? 'dialog' : 'region');
    if (active) this._nodes.player.setAttribute('aria-modal', 'true'); else this._nodes.player.removeAttribute('aria-modal');
  }

  _onKeyDown(event) {
    const expanded = this._expanded || document.fullscreenElement === this._nodes?.player;
    if (!expanded) return;
    if (event.key === 'Escape') { event.preventDefault(); this._exitFullscreen(); this._nodes.fullscreen.focus(); }
    if (event.key === 'Tab') {
      const focusable = [...this._nodes.player.querySelectorAll('button:not([disabled]), select:not([disabled]), summary')].filter(node => node.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
}

if (!customElements.get('seth-trial')) customElements.define('seth-trial', SethTrial);
