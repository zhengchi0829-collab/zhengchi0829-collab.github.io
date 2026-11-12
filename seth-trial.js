import {
  BET_OPTIONS, STARTING_BALANCE, MAX_CASCADES, MAX_MULTIPLIER,
  FREE_SPINS_AWARD, FREE_SPINS_COST_MULTIPLIER, GAME_MODES, SYMBOLS,
  createGameState, setBet, resetGame, resolveSpin, buyFreeSpins
} from './seth-game-engine.js?v=20261112originalgames2';

// Original local simulation. No third-party game, assets, requests, or accounts.
const symbolMap = new Map(SYMBOLS.map(symbol => [symbol.id, symbol]));
const number = value => Number(value).toLocaleString('zh-TW');
const presentation = {
  classic: { english: 'SAND WARRIOR', subtitle: '穿越沙海，喚醒神力', tags: ['連消得分', '隨機倍率', '免費回合'] },
  temple: { english: 'GOLDEN TEMPLE', subtitle: '黃金之門，層層覺醒', tags: ['倍率分裂', '跨局鎖定', '免費回合'] }
};
const paths = {
  sun: '<path d="m32 3 6 12 13-2-2 13 12 6-12 6 2 13-13-2-6 12-6-12-13 2 2-13L3 32l12-6-2-13 13 2Z" fill="#b8792b" stroke="#f5d680"/><circle cx="32" cy="32" r="17" fill="#f5bf47"/><circle cx="32" cy="32" r="11" fill="#d98d28" stroke="#ffe9a1"/><path d="m23 23 9-5 9 5-9 9Z" fill="#fff1a6" stroke="none"/>',
  moon: '<path d="M42 7a25 25 0 1 0 15 36A23 23 0 0 1 42 7Z" fill="#979cda" stroke="#e6e5ff"/><path d="M35 12a22 22 0 0 0-13 41A26 26 0 0 1 35 12Z" fill="#e8e5ff" stroke="none"/><path d="m44 19 3 7 8 1-6 5 2 8-7-4-7 4 1-8-5-5 8-1Z" fill="#f4de9e" stroke="#fff0ba"/>',
  gem: '<path d="m18 9-11 16 25 31 25-31L46 9Z" fill="#43b9b5" stroke="#9ff5df"/><path d="M18 9 7 25h25ZM46 9 32 25h25Z" fill="#b0ffe5" stroke="none"/><path d="m18 9 14 16L46 9Z" fill="#6de7d0" stroke="none"/><path d="m7 25 25 31V25Z" fill="#249b9d" stroke="none"/><path d="m32 25 25 0-25 31Z" fill="#54e0c1" stroke="none"/><path d="m18 9 14 47L46 9M7 25h50" fill="none" stroke="#ccfff0" stroke-width="1.4"/>',
  lotus: '<path d="M32 53C11 47 8 29 13 19c12 2 23 16 19 34Z" fill="#bc638d" stroke="#f0b2d7"/><path d="M32 53c21-6 24-24 19-34-12 2-23 16-19 34Z" fill="#d884b4" stroke="#f8c3df"/><path d="M32 7c-16 14-16 30 0 46 16-16 16-32 0-46Z" fill="#e5a1cb" stroke="#ffe0f0"/><path d="M32 13v33l7-16Z" fill="#ffe0f1" stroke="none"/><path d="M9 43c5 12 14 14 23 11 9 3 18 1 23-11" fill="none" stroke="#9dd2ae" stroke-width="4"/>',
  feather: '<path d="M15 49C7 27 27 8 54 8c0 28-16 44-35 40Z" fill="#478cb6" stroke="#b3e5ff"/><path d="M16 44c3-20 18-29 32-30L18 46Z" fill="#c9edff" stroke="none"/><path d="m12 57 35-39M23 42l-2-13m12 3-1-13m-9 23 15-1m-5-9 14-1" fill="none" stroke="#e0f5ff" stroke-width="2"/>',
  scarab: '<path d="M29 29C17 14 7 20 5 34l20 11m10-16C47 14 57 20 59 34L39 45" fill="#a99b3f" stroke="#eee2a1"/><path d="M26 18v-5a6 6 0 0 1 12 0v5" fill="#d4bd59" stroke="#f8e6a1"/><ellipse cx="32" cy="36" rx="13" ry="19" fill="#648b72" stroke="#e7d88b"/><path d="M32 18v36M21 28c7 7 15 7 22 0M21 45l-9 10m31-10 9 10" fill="none" stroke="#f0e6a6"/><path d="m27 23 5-3v10Z" fill="#c4e5b6" stroke="none"/>',
  seal: '<path d="m32 4 24 14v28L32 60 8 46V18Z" fill="#b56a31" stroke="#ffe0a2"/><path d="m32 12 17 10v20L32 52 15 42V22Z" fill="#e6a157" stroke="#ffd99b"/><path d="m32 19 10 13-10 13-10-13Z" fill="#814525" stroke="#ffe4ac"/><path d="m32 22 7 10-7-3-7 3Z" fill="#fff0bb" stroke="none"/><path d="M8 18 32 4l24 14M15 22l17-10 17 10" stroke="#fff1bd" fill="none"/>'
};
const icon = id => `<svg class="st-symbol" viewBox="0 0 64 64" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg>`;
const playIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>';
let instanceCount = 0;

class SethTrial extends HTMLElement {
  constructor() {
    super();
    this._uid = `sand-temple-${++instanceCount}`;
    this._states = Object.fromEntries(GAME_MODES.map(mode => [mode.id, createGameState(mode.id)]));
    this._results = Object.create(null);
    this._state = this._states.classic;
    this._history = [];
    this._recordedResults = new WeakSet();
    this._busy = false;
    this._purchaseOpen = false;
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
    this._closePurchase(false);
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
      const cards = GAME_MODES.map(mode => {
        const copy = presentation[mode.id];
        return `<article class="st-card st-card-${mode.id} st-card--${mode.id === 'temple' ? 'violet' : 'cyan'}" aria-labelledby="${this._uid}-${mode.id}-title">
          <div class="st-card-art" aria-hidden="true"></div><div class="st-card-overlay" aria-hidden="true"></div>
          <div class="st-card-content"><div class="st-card-top"><span class="st-emblem" aria-hidden="true">${mode.id === 'classic' ? 'Ⅰ' : 'Ⅱ'}</span><div class="st-card-copy"><span class="st-card-kicker">${copy.english}</span><h3 id="${this._uid}-${mode.id}-title">${mode.name}</h3><p class="st-card-subtitle">${copy.subtitle}</p></div></div>
          <p class="st-card-description">${mode.id === 'classic' ? '六欄連消與隨機倍率，展開你的沙海冒險。' : '讓倍率分裂、鎖定神力，探索黃金神殿。'}</p>
          <div class="st-card-tags" aria-label="遊戲特色">${copy.tags.map(tag => `<span>${tag}</span>`).join('')}</div>
          <div class="st-card-actions"><button class="st-play-link" type="button" data-action="open" data-mode="${mode.id}" aria-label="開始${mode.name}試玩">${playIcon}<span>開始試玩</span></button></div>
          <span class="st-link-note">站內直接玩 · ${number(STARTING_BALANCE)} 虛擬點數起始</span></div></article>`;
      }).join('');
      this.innerHTML = `<section class="seth-trial-section" aria-labelledby="${this._uid}-title"><div class="layout-width st-inner">
        <div class="st-heading"><div class="st-heading-copy"><p class="st-eyebrow">${playIcon}<span>ORIGINAL GAMES</span></p><h2 id="${this._uid}-title">原創遊戲試玩<span class="st-title-dot">.</span></h2><p class="st-intro">選一段冒險，立即在這裡開始。</p></div><span class="st-feature-tag">免下載 · 免註冊</span></div>
        <div class="st-card-grid">${cards}</div>
        <section class="st-simulator st-simulator--classic" hidden aria-labelledby="${this._uid}-game-title">
          <header class="st-sim-header"><div class="st-sim-heading"><span class="st-sim-eyebrow">SAND WARRIOR</span><h3 class="st-sim-title" id="${this._uid}-game-title" tabindex="-1">沙海戰神Ⅰ</h3></div><div class="st-sim-tools"><button type="button" class="st-icon-button" data-action="sound" aria-pressed="false" aria-label="開啟遊戲音效">音效：關</button><button type="button" class="st-icon-button" data-action="fullscreen" aria-pressed="false">全螢幕</button><button type="button" class="st-icon-button" data-action="close" aria-label="關閉試玩並返回遊戲選擇">關閉</button></div></header>
          <div class="st-game-layout"><div class="st-game-main">
            <div class="st-mode-tabs" role="group" aria-label="切換遊戲">${GAME_MODES.map(mode => `<button type="button" class="st-mode-tab" data-action="mode" data-mode="${mode.id}" aria-pressed="${mode.id === 'classic'}">${mode.name}</button>`).join('')}</div>
            <div class="st-feature-meter"><div class="st-feature-multiplier"><span>本局倍率</span><strong data-stat="multiplier">待轉動</strong></div><div class="st-feature-lock" data-feature-lock>逐局抽出倍率</div><span class="st-round-counter">第 0 局</span></div>
            <div class="st-wallet">${[['balance','虛擬點數'],['win','本局得分'],['free','免費回合'],['total','累積得分']].map(([key,label]) => `<div class="st-stat"><span class="st-stat-label">${label}</span><strong class="st-stat-value" data-stat="${key}">0</strong></div>`).join('')}</div>
            <div class="st-board-shell"><div class="st-board" role="group" aria-label="六欄五列遊戲盤面"></div></div>
            <p class="st-feature-announcement">轉動盤面，展開沙海冒險。</p>
            <div class="st-win-banner"><span class="st-win-label">準備開始</span><strong class="st-win-value">0</strong><span class="st-win-meta">選好每回合點數，按下「轉動」。</span></div>
            <div class="st-spin-controls"><label class="st-bet-control" for="${this._uid}-bet"><span>每回合點數</span><select id="${this._uid}-bet" data-bet>${BET_OPTIONS.map(bet => `<option value="${bet}">${number(bet)} 點</option>`).join('')}</select></label><button type="button" class="st-spin-button" data-action="spin">${playIcon}<span>轉動</span></button><button type="button" class="st-reset-button" data-action="reset">重設 ${number(STARTING_BALANCE)} 點</button></div>
            <p class="st-live-status" role="status" aria-live="polite" aria-atomic="true">已準備好，可以開始試玩。</p>
          </div><aside class="st-game-aside" aria-label="遊戲工具與規則">
            <div class="st-buy-controls"><button type="button" class="st-buy-button" data-action="buy"><span>購買免費回合</span><small class="st-buy-price">${number(100 * FREE_SPINS_COST_MULTIPLIER)} 虛擬點</small></button><p class="st-buy-note">使用遊戲內虛擬點數，換取 ${FREE_SPINS_AWARD} 次免費轉動。</p></div>
            <div class="st-buy-confirm" hidden role="group" aria-labelledby="${this._uid}-buy-title"><h4 id="${this._uid}-buy-title">免費回合確認</h4><p class="st-buy-description"></p><p class="st-buy-disclaimer">只使用本頁的虛擬點數，不涉及金錢交易。</p><div class="st-buy-confirm-actions"><button type="button" class="st-icon-button" data-action="buy-confirm">確認使用點數</button><button type="button" class="st-icon-button" data-action="buy-cancel">取消</button></div></div>
            <section class="st-history" aria-labelledby="${this._uid}-history-title"><h4 id="${this._uid}-history-title">最近 3 局</h4><ol class="st-history-list"><li class="st-history-empty">完成第一局後，這裡會保留最近 3 局結果。</li></ol></section>
            ${this._rulesMarkup()}
          </aside></div>
        </section>
        <div class="st-source-note"><p>本站原創・虛擬點數遊戲</p><p>點數沒有現金價值，不可儲值、提領或兌換。兩款遊戲各自保留本頁進度；重新整理會重設。</p></div>
      </div></section>`;
    }
    const find = selector => this.querySelector(selector);
    this._nodes = {
      player: find('.st-simulator'), title: find('.st-sim-title'), eyebrow: find('.st-sim-eyebrow'), board: find('.st-board'), banner: find('.st-win-banner'), status: find('.st-live-status'), bet: find('[data-bet]'), spin: find('[data-action="spin"]'), sound: find('[data-action="sound"]'), fullscreen: find('[data-action="fullscreen"]'), featureLock: find('[data-feature-lock]'), announcement: find('.st-feature-announcement'), round: find('.st-round-counter'), buy: find('[data-action="buy"]'), buyPrice: find('.st-buy-price'), buyNote: find('.st-buy-note'), confirm: find('.st-buy-confirm'), confirmDescription: find('.st-buy-description'), history: find('.st-history-list')
    };
  }

  _rulesMarkup() {
    return `<details class="st-rules"><summary>玩法與計分規則</summary><p>盤面為 6 欄 × 5 列。任意位置出現 8 個以上相同普通符號即計分並消除，上方符號掉落補位；每局最多 ${MAX_CASCADES} 次連消。達到上限後，最後補位盤面不再追加計分。</p>
      <div class="st-rules-grid">${SYMBOLS.map(symbol => `<div class="st-pay-item" style="--symbol-color:${symbol.color}">${icon(symbol.id)}<span>${symbol.name}</span><strong>${symbol.id === 'seal' ? '免費回合' : `${symbol.basePay}×`}</strong></div>`).join('')}</div>
      <p>符號基礎得分＝每回合點數 × 上表基礎倍數 × 數量級距，四捨五入至整數。8–9 個為 1 倍、10–11 個為 2 倍、12 個以上為 3.5 倍；同盤不同符號分別累加。每次連消以當步有效倍率計分，再累加為本局得分。</p>
      <div class="st-game-rules" data-rules-mode="classic"><h5>沙海戰神Ⅰ</h5><p>每回合抽出 1／2／3／5 倍，出現權重為 65／20／10／5；這個倍率套用於當局每次連消。</p></div>
      <div class="st-game-rules" data-rules-mode="temple" hidden><h5>黃金神殿Ⅱ</h5><p>沒有鎖定時，每回合抽出 1／2／3／5 倍，權重為 65／20／10／5。每次有得分的連消有 20% 機會先將倍率分裂翻倍，再以新倍率計分；倍率沿當局保留，最高 ${MAX_MULTIPLIER} 倍。</p><p>若起局沒有既有鎖定，且當局有得分，結算後有 15% 機會把最終倍率鎖定給接下來 2 局。鎖定期間的每局（含免費回合、未得分回合）都會消耗 1 局；該局仍可分裂，但不改變後續鎖定值，也不會再次觸發鎖定。</p></div>
      <p>使用點數轉動的首盤出現 4 個以上「神印」，獲得 ${FREE_SPINS_AWARD} 次免費轉動。免費回合沿用當時的每回合點數，不可調整，也不會再次觸發免費回合；補位盤面不觸發。神印本身不計分。</p>
      <p>「購買免費回合」使用每回合點數的 ${FREE_SPINS_COST_MULTIPLIER} 倍虛擬點數，換取 ${FREE_SPINS_AWARD} 次免費轉動。確認後才扣點；購買本身不消耗鎖定局數，也不算一局轉動。</p>
      <p>兩款遊戲的點數、免費回合與進度分別保留在本頁。切換或關閉不會清除，重設只影響目前遊戲；重新整理頁面，兩款都回到 ${number(STARTING_BALANCE)} 點。所有點數沒有現金價值。</p></details>`;
  }

  _commit(state) {
    this._state = state;
    this._states[state.mode] = state;
  }

  _onClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !this.contains(button) || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'open') this._open(button.dataset.mode, button);
    if (action === 'mode' && !this._busy && !this._purchaseOpen) this._changeMode(button.dataset.mode);
    if (action === 'spin') this._spin();
    if (action === 'reset' && !this._busy && !this._purchaseOpen) {
      this._commit(resetGame(this._state)); this._lastResult = null; delete this._results[this._state.mode];
      this._history = this._history.filter(item => item.mode !== this._state.mode);
      this._refresh();
      this._winBanner(0, `已重設為 ${number(STARTING_BALANCE)} 虛擬點數。`, '重新開始');
      this._status('目前遊戲已重新開始，另一款遊戲的進度保留。');
    }
    if (action === 'buy') this._openPurchase();
    if (action === 'buy-confirm') this._confirmPurchase();
    if (action === 'buy-cancel') this._closePurchase(true);
    if (action === 'close') this._close();
    if (action === 'sound') this._toggleSound();
    if (action === 'fullscreen') this._toggleFullscreen();
  }

  _onChange(event) {
    if (!event.target.matches('[data-bet]') || this._busy || this._purchaseOpen) return;
    try { this._commit(setBet(this._state, Number(event.target.value))); this._status(`每回合使用 ${number(this._state.bet)} 虛擬點數。`); this._controls(); }
    catch (error) { this._nodes.bet.value = String(this._state.bet); this._status(error.message); }
  }

  _open(mode, button) {
    if (this._busy || this._purchaseOpen) return;
    this._returnFocus = button;
    this._nodes.player.hidden = false;
    if (mode !== this._state.mode) this._changeMode(mode);
    else this._refresh();
    this._nodes.title.focus({ preventScroll: true });
    this._nodes.player.scrollIntoView({ block: 'start', behavior: this._reducedMotion() ? 'instant' : 'smooth' });
  }

  _changeMode(mode) {
    if (!this._states[mode] || mode === this._state.mode || this._busy || this._purchaseOpen) return;
    this._cancelAnimation();
    this._state = this._states[mode]; this._lastResult = this._results[mode] || null;
    this._refresh();
    const name = GAME_MODES.find(item => item.id === mode).name;
    this._status(`已進入${name}，目前有 ${number(this._state.balance)} 虛擬點數。兩款遊戲的進度分別保留。`);
  }

  _close() {
    this._closePurchase(false); this._cancelAnimation(); this._stopAudio(); this._exitFullscreen();
    this._nodes.player.hidden = true;
    if (this._returnFocus?.isConnected) this._returnFocus.focus();
  }

  _refresh() {
    this._renderBoard(this._state.board); this._stats(); this._controls(); this._drawHistory();
    this._nodes.title.textContent = GAME_MODES.find(mode => mode.id === this._state.mode).name;
    this._nodes.eyebrow.textContent = presentation[this._state.mode].english;
    this._nodes.player.classList.toggle('st-simulator--temple', this._state.mode === 'temple');
    this._nodes.player.classList.toggle('st-simulator--classic', this._state.mode === 'classic');
    this.querySelectorAll('.st-mode-tab').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === this._state.mode)));
    this.querySelectorAll('[data-rules-mode]').forEach(panel => { panel.hidden = panel.dataset.rulesMode !== this._state.mode; });
    this._drawAnnouncement(this._lastResult);
    if (this._lastResult) this._winBanner(this._lastResult.totalWin, this._resultDescription(this._lastResult));
    else this._winBanner(0, '選好每回合點數，按下「轉動」開始。', '準備開始');
  }

  _purchasePrice() { return this._state.bet * FREE_SPINS_COST_MULTIPLIER; }

  _openPurchase() {
    if (this._busy || this._purchaseOpen || this._state.freeSpins > 0) return;
    if (this._state.balance < this._purchasePrice()) { this._status('虛擬點數不足，請降低每回合點數或重設點數。'); return; }
    this._purchaseOpen = true;
    this._purchaseSnapshot = { mode: this._state.mode, bet: this._state.bet };
    this._nodes.confirmDescription.textContent = `使用 ${number(this._purchasePrice())} 虛擬點數，換取 ${FREE_SPINS_AWARD} 次免費回合。每回合以 ${number(this._state.bet)} 點計算。`;
    this._nodes.confirm.hidden = false; this._controls();
    this._nodes.confirm.scrollIntoView({ block: 'nearest', behavior: this._reducedMotion() ? 'instant' : 'smooth' });
    this.querySelector('[data-action="buy-cancel"]').focus({ preventScroll: true });
    this._status('請確認免費回合所需的虛擬點數。確認前不會扣點。');
  }

  _closePurchase(restoreFocus) {
    this._purchaseOpen = false; this._purchaseSnapshot = null;
    if (!this._nodes) return;
    this._nodes.confirm.hidden = true; this._controls();
    if (restoreFocus && !this._nodes.buy.disabled) this._nodes.buy.focus();
  }

  _confirmPurchase() {
    if (!this._purchaseOpen || this._busy) return;
    const snapshot = this._purchaseSnapshot;
    if (!snapshot || snapshot.mode !== this._state.mode || snapshot.bet !== this._state.bet) {
      this._closePurchase(false); this._status('遊戲設定已變更，請重新確認所需點數。'); return;
    }
    try {
      const price = this._purchasePrice();
      this._commit(buyFreeSpins(this._state));
      this._closePurchase(false); this._refresh();
      this._winBanner(this._lastResult?.totalWin || 0, `已使用 ${number(price)} 虛擬點，獲得 ${FREE_SPINS_AWARD} 次免費回合。`, '免費回合已準備');
      this._status(`已使用 ${number(price)} 虛擬點數，獲得 ${FREE_SPINS_AWARD} 次免費回合。按下免費轉動即可開始。`);
      this._nodes.spin.focus({ preventScroll: true });
    } catch (error) { this._closePurchase(false); this._status(error.message || '點數不足，無法取得免費回合。'); }
  }

  _winBanner(score, meta, label = '本局得分') {
    this._nodes.banner.classList.toggle('is-counting', score > 0);
    this._nodes.banner.innerHTML = `<span class="st-win-label">${label}</span><strong class="st-win-value">${number(score)}</strong><span class="st-win-meta">${meta}</span>`;
  }

  _resultDescription(result) {
    const charge = result.usedFreeSpin ? '免費回合，未扣點' : `本局使用 ${number(result.charged)} 點`;
    const bonus = result.awardedFreeSpins ? ` · 獲得 ${result.awardedFreeSpins} 次免費轉動` : '';
    const limit = result.hitCascadeLimit ? ` · 已達 ${MAX_CASCADES} 次連消上限` : '';
    return `${charge}${bonus}${limit}`;
  }

  _drawAnnouncement(result) {
    if (!result) {
      this._nodes.announcement.textContent = this._state.mode === 'temple' ? '連消有機會分裂倍率，得分後有機會鎖定神力。' : '每局抽出倍率，連消累積得分。';
      return;
    }
    const splitCount = result.frames.filter(frame => frame.splitBoolean).length;
    const parts = [];
    if (splitCount) parts.push(`倍率分裂 ${splitCount} 次 · 最終 ${result.multiplier}×`);
    if (result.lockAwarded) parts.push(`${result.state.lockedMultiplier}× 倍率鎖定，接下來 ${result.lockedRounds} 局保留`);
    else if (result.lockUsed) parts.push(result.lockedRounds ? `鎖定剩餘 ${result.lockedRounds} 局` : '這次倍率鎖定已完成');
    this._nodes.announcement.textContent = parts.join('；') || `本局倍率 ${result.multiplier}×`;
  }

  _drawHistory() {
    this._nodes.history.innerHTML = this._history.length ? this._history.map(item => `<li class="st-history-item" data-mode="${item.mode}"><span class="st-history-round">第 ${item.round} 局<small>${GAME_MODES.find(mode => mode.id === item.mode).name}</small></span><span class="st-history-used">${item.usedFreeSpin ? '免費回合' : `使用 ${number(item.charged)} 點`}</span><strong class="st-history-win">${number(item.totalWin)} 點</strong></li>`).join('') : '<li class="st-history-empty">完成第一局後，這裡會保留最近 3 局結果。</li>';
  }

  _renderBoard(board) {
    this._nodes.board.innerHTML = board.map((id, index) => {
      const symbol = symbolMap.get(id);
      return `<div class="st-cell" data-cell="${index}" style="--symbol-color:${symbol.color}" role="img" aria-label="第 ${Math.floor(index / 6) + 1} 列第 ${index % 6 + 1} 欄，${symbol.name}">${icon(id)}<span class="st-cell-label">${symbol.name}</span></div>`;
    }).join('');
  }

  _stats(values = {}) {
    const { lockedRounds = this._state.lockedRounds, lockedMultiplier = this._state.lockedMultiplier, ...display } = values;
    const stats = { balance: this._state.balance, win: this._lastResult?.totalWin || 0, free: this._state.freeSpins, total: this._state.totalWin, multiplier: this._lastResult?.multiplier ?? null, ...display };
    for (const [key, value] of Object.entries(stats)) this.querySelector(`[data-stat="${key}"]`).textContent = key === 'multiplier' ? (value == null ? '待轉動' : `${value}×`) : number(value);
    this._nodes.featureLock.textContent = this._state.mode === 'classic' ? '逐局抽出倍率' : lockedRounds > 0 ? `${lockedMultiplier}× 鎖定 · 剩餘 ${lockedRounds} 局` : '倍率鎖定待觸發';
    this._nodes.featureLock.classList.toggle('is-locked', this._state.mode === 'temple' && lockedRounds > 0);
    this._nodes.round.textContent = `第 ${this._state.round} 局`;
  }

  _controls() {
    const insufficient = this._state.freeSpins === 0 && this._state.balance < this._state.bet;
    const waiting = this._busy || this._purchaseOpen;
    this._nodes.player.classList.toggle('is-spinning', this._busy);
    this._nodes.player.setAttribute('aria-busy', String(this._busy));
    this._nodes.bet.value = String(this._state.bet);
    this._nodes.bet.disabled = waiting || this._state.freeSpins > 0;
    this._nodes.spin.disabled = waiting || insufficient;
    const label = this._busy ? '轉動中…' : this._purchaseOpen ? '等待確認' : insufficient ? '點數不足' : this._state.freeSpins > 0 ? `免費轉動（剩餘 ${this._state.freeSpins} 次）` : '轉動';
    this._nodes.spin.innerHTML = `${playIcon}<span>${label}</span>`;
    this.querySelectorAll('[data-action="open"], [data-action="mode"], [data-action="reset"]').forEach(button => { button.disabled = waiting; });
    const buyInsufficient = this._state.balance < this._purchasePrice();
    this._nodes.buy.disabled = waiting || this._state.freeSpins > 0 || buyInsufficient;
    this._nodes.buyPrice.textContent = `${number(this._purchasePrice())} 虛擬點`;
    this._nodes.buyNote.textContent = this._busy ? '本局結算後，即可查看免費回合選項。' : this._state.freeSpins > 0 ? '免費回合進行中，完成後可再次購買。' : buyInsufficient ? '目前點數不足，可降低每回合點數或重設點數。' : `使用遊戲內虛擬點數，換取 ${FREE_SPINS_AWARD} 次免費轉動。`;
    this.querySelector('[data-action="buy-confirm"]').disabled = this._busy || !this._purchaseOpen;
    this.querySelector('[data-action="buy-cancel"]').disabled = !this._purchaseOpen;
    if (!waiting && insufficient) this._status(`虛擬點數不足，請降低每回合點數，或按「重設 ${number(STARTING_BALANCE)} 點」。`);
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
    if (this._busy || this._purchaseOpen) return;
    let result;
    const before = this._state;
    try { result = resolveSpin(before); }
    catch (error) { this._status(error.message || '暫時無法開始，請重設虛擬點數再試。'); this._controls(); return; }
    // Save each game's complete outcome before animating; closing never loses a result.
    this._commit(result.state); this._pending = result; this._busy = true;
    const version = ++this._version;
    const reduced = this._reducedMotion();
    const displayFree = before.freeSpins - Number(result.usedFreeSpin);
    const displayLock = result.lockUsed ? Math.max(0, before.lockedRounds - 1) : before.lockedRounds;
    const progress = earned => ({ balance: before.balance - result.charged + earned, win: earned, total: before.totalWin + earned, free: displayFree, lockedRounds: displayLock, lockedMultiplier: before.lockedMultiplier });
    this._controls();
    this._stats({ ...progress(0), multiplier: result.initialMultiplier });
    const chargeText = result.usedFreeSpin ? '免費回合，未扣點' : `本局使用 ${number(result.charged)} 點`;
    this._winBanner(0, `${chargeText} · 盤面轉動中`, '轉動中');
    this._nodes.announcement.textContent = result.lockUsed ? `沿用 ${result.initialMultiplier}× 鎖定倍率` : `本局起始倍率 ${result.initialMultiplier}×`;
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
      if (frame.splitBoolean) {
        this._nodes.player.classList.add('is-splitting');
        this._nodes.announcement.textContent = `倍率分裂 · ${frame.initialMultiplier}× → ${frame.multiplier}×`;
        this._stats({ ...progress(earned), multiplier: frame.multiplier });
        this._tone('split');
        if (!await this._delay(reduced ? 20 : 250, version)) return;
        this._nodes.player.classList.remove('is-splitting');
      }
      frame.cleared.forEach(cell => this._nodes.board.children[cell].classList.add('is-winning'));
      if (!await this._delay(reduced ? 20 : 160, version)) return;
      frame.cleared.forEach(cell => this._nodes.board.children[cell].classList.add('is-cleared'));
      if (!await this._delay(reduced ? 20 : 140, version)) return;
      // A split changes only the current and later steps. Use each frame's settled payout.
      earned += frame.payout;
      this._stats({ ...progress(earned), multiplier: frame.multiplier });
      this._winBanner(earned, `第 ${cascade} 次連消 · 本步 ${frame.multiplier}× · ${chargeText}`, '本局累計得分');
      this._renderBoard(result.frames[index + 1]?.board || result.finalBoard);
      this._nodes.board.classList.add('is-refilling');
      if (!await this._delay(reduced ? 20 : 180, version)) return;
      this._nodes.board.classList.remove('is-refilling');
    }
    if (result.lockAwarded) {
      this._nodes.player.classList.add('is-locking');
      this._nodes.announcement.textContent = `${result.state.lockedMultiplier}× 倍率鎖定 · 接下來 ${result.lockedRounds} 局保留`;
      this._tone('lock');
      if (!await this._delay(reduced ? 25 : 400, version)) return;
      this._nodes.player.classList.remove('is-locking');
    }
    if (version === this._version) this._finish(result, true);
  }

  _finish(result, sound) {
    this._pending = null; this._lastResult = result; this._results[result.state.mode] = result; this._busy = false;
    this._nodes.board.classList.remove('is-refilling');
    this._nodes.player.classList.remove('is-splitting', 'is-locking');
    if (!this._recordedResults.has(result)) {
      this._recordedResults.add(result);
      this._history.unshift({ mode: result.state.mode, round: result.state.round, charged: result.charged, usedFreeSpin: result.usedFreeSpin, totalWin: result.totalWin });
      this._history = this._history.slice(0, 3);
    }
    this._refresh();
    const message = `${this._resultDescription(result)} · 本局得分 ${number(result.totalWin)} 點`;
    this._status(message + (this._state.freeSpins === 0 && this._state.balance < this._state.bet ? '。點數不足，請降低每回合點數或重設點數。' : '。'));
    if (sound && result.totalWin > 0) this._tone('win');
  }

  _cancelAnimation() {
    this._version += 1;
    for (const [timer, resolve] of this._timers) { clearTimeout(timer); resolve(false); }
    this._timers.clear();
    this._nodes?.player.classList.remove('is-splitting', 'is-locking');
    this._nodes?.board.classList.remove('is-refilling');
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
      const notes = { spin: [330], win: [660, 880, 1320], split: [440, 660, 880], lock: [392, 523, 784] };
      (notes[kind] || notes.spin).forEach((frequency, index) => {
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
    if (event.key === 'Escape' && this._purchaseOpen) {
      event.preventDefault(); this._closePurchase(true); this._status('已取消，沒有扣除虛擬點數。'); return;
    }
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
