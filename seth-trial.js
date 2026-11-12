/*
 * Seth trial directory.
 * External links are the default: this site's domain is not enabled for SPINLAB embedding.
 * Set data-embed="enabled" on <seth-trial> only after SPINLAB approves the site's domain.
 * The optional player uses SPINLAB's published embed script without proxying game requests.
 */
(() => {
  'use strict';

  if (customElements.get('seth-trial')) return;

  const games = {
    seth2: {
      title: '戰神賽特 II',
      subtitle: '覺醒之力',
      version: 'II',
      url: 'https://www.spinlab.tw/atg-seth-2',
      description: '探索二代主題，熟悉遊戲畫面與操作。',
      tone: 'violet'
    },
    seth1: {
      title: '戰神賽特',
      subtitle: '一代',
      version: 'I',
      url: 'https://www.spinlab.tw/atg-seth-1',
      description: '從一代開始，體驗盤面與遊戲操作。',
      tone: 'cyan'
    }
  };

  const arrow = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10v10M7 17 17 7"/></svg>';
  const play = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 11 7-11 7V5Z"/></svg>';
  let instanceCount = 0;
  let embedScriptPromise;

  function loadEmbedScript() {
    if (window.SpinlabEmbed && typeof window.SpinlabEmbed.init === 'function') {
      return Promise.resolve(window.SpinlabEmbed);
    }
    if (embedScriptPromise) return embedScriptPromise;

    embedScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = window.setTimeout(() => finish(new Error('Script load timed out')), 15000);
      let finished = false;

      function finish(error) {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (error || !window.SpinlabEmbed || typeof window.SpinlabEmbed.init !== 'function') {
          script.remove();
          reject(error || new Error('Embed script unavailable'));
          return;
        }
        resolve(window.SpinlabEmbed);
      }

      script.src = 'https://www.spinlab.tw/embed.js';
      script.async = true;
      script.onload = () => finish();
      script.onerror = () => finish(new Error('Embed script unavailable'));
      document.head.appendChild(script);
    }).catch(error => {
      embedScriptPromise = undefined;
      throw error;
    });

    return embedScriptPromise;
  }

  class SethTrial extends HTMLElement {
    static get observedAttributes() { return ['data-embed']; }

    constructor() {
      super();
      this._uid = `seth-trial-${++instanceCount}`;
      this._handleClick = this._handleClick.bind(this);
      this._request = 0;
      this._connected = false;
      this._hashFrame = null;
    }

    connectedCallback() {
      if (this._connected) return;
      this._connected = true;
      this._render();
      this.addEventListener('click', this._handleClick);
      this._updateEmbedAvailability();
      if (this.id && window.location.hash === `#${this.id}`) {
        this._hashFrame = requestAnimationFrame(() => {
          this._hashFrame = null;
          if (this.isConnected && window.location.hash === `#${this.id}`) {
            this.scrollIntoView({ block: 'start', behavior: 'instant' });
          }
        });
      }
    }

    disconnectedCallback() {
      this._connected = false;
      this._request += 1;
      if (this._hashFrame !== null) cancelAnimationFrame(this._hashFrame);
      this._hashFrame = null;
      this.removeEventListener('click', this._handleClick);
      this._stopPlayers();
    }

    attributeChangedCallback() {
      if (this._connected) this._updateEmbedAvailability();
    }

    _render() {
      if (this.querySelector('.seth-trial-section')) return;
      const cards = Object.entries(games).map(([key, game]) => `
        <article class="st-card st-card--${game.tone}" aria-labelledby="${this._uid}-${key}">
          <div class="st-card-top">
            <div class="st-emblem" aria-hidden="true"><span>${game.version}</span></div>
            <div class="st-card-copy">
              <span class="st-card-kicker">模擬試玩</span>
              <h3 id="${this._uid}-${key}">${game.title}</h3>
              <p class="st-card-subtitle">${game.subtitle}</p>
            </div>
          </div>
          <p class="st-card-description">${game.description}</p>
          <div class="st-card-actions">
            <button class="st-embed-button" type="button" data-st-play="${key}" hidden>${play}<span>在本站試玩</span></button>
            <a class="st-play-link" href="${game.url}" target="_blank" rel="noopener noreferrer" aria-label="${game.title} ${game.subtitle}，前往 SPINLAB 免費試玩，於新分頁開啟"><span>前往免費試玩</span>${arrow}</a>
          </div>
          <span class="st-link-note">於新分頁開啟 SPINLAB 試玩頁</span>
        </article>`).join('');

      this.innerHTML = `
        <section class="seth-trial-section" aria-labelledby="${this._uid}-title">
          <div class="layout-width st-inner">
            <div class="st-heading">
              <div class="st-heading-copy">
                <p class="st-eyebrow">${play}<span>FREE PLAY</span></p>
                <h2 id="${this._uid}-title">賽特免費試玩<span class="st-title-dot">.</span></h2>
                <p class="st-intro">選擇一代或二代，用虛擬點數熟悉遊戲。</p>
              </div>
              <span class="st-feature-tag">免下載 · 免註冊</span>
            </div>
            <div class="st-card-grid">${cards}</div>
            <div class="st-player" hidden>
              <div class="st-player-heading">
                <h3 class="st-player-title" tabindex="-1"></h3>
                <button class="st-close-player" type="button" data-st-close>結束試玩</button>
              </div>
              <p class="st-player-status" role="status" aria-live="polite"></p>
              <div class="st-player-mount"></div>
              <a class="st-player-fallback" target="_blank" rel="noopener noreferrer">改至 SPINLAB 試玩頁開啟 ${arrow}</a>
            </div>
            <div class="st-source-note">
              <p><a href="https://www.spinlab.tw/" target="_blank" rel="noopener noreferrer" aria-label="SPINLAB 轉動實驗室，於新分頁開啟">SPINLAB 模擬試玩</a><span aria-hidden="true"> · </span>虛擬點數<span aria-hidden="true"> · </span>非 ATG 官方 demo</p>
              <p>虛擬點數不可兌換，試玩結果不代表正式遊戲。</p>
            </div>
          </div>
        </section>`;
    }

    _updateEmbedAvailability() {
      const enabled = this.getAttribute('data-embed') === 'enabled';
      this.querySelectorAll('[data-st-play]').forEach(button => { button.hidden = !enabled; });
      this.classList.toggle('st-embed-enabled', enabled);
      if (!enabled) this._closePlayer(false);
    }

    _handleClick(event) {
      const button = event.target.closest('[data-st-play], [data-st-close]');
      if (!button || !this.contains(button)) return;
      if (button.hasAttribute('data-st-close')) this._closePlayer(true);
      else if (this.getAttribute('data-embed') === 'enabled') this._openPlayer(button.dataset.stPlay, button);
    }

    _stopPlayers() {
      this.querySelectorAll('.st-player-mount [data-act="stop"]').forEach(button => button.click());
    }

    _closePlayer(restoreFocus) {
      this._request += 1;
      this._stopPlayers();
      const player = this.querySelector('.st-player');
      if (player) player.hidden = true;
      if (restoreFocus && this._launchButton && this._launchButton.isConnected) this._launchButton.focus();
    }

    async _openPlayer(key, launchButton) {
      const game = games[key];
      if (!game) return;
      this._stopPlayers();
      const request = ++this._request;
      const player = this.querySelector('.st-player');
      const title = player.querySelector('.st-player-title');
      const status = player.querySelector('.st-player-status');
      const mount = player.querySelector('.st-player-mount');
      this._launchButton = launchButton;
      title.textContent = `${game.title} ${game.subtitle}`;
      player.querySelector('.st-player-fallback').href = game.url;
      player.hidden = false;
      title.focus({ preventScroll: true });
      player.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      status.textContent = '正在準備試玩入口，請稍候。';

      // Keep mounted provider widgets so switching games does not duplicate their listeners.
      mount.querySelectorAll('[data-spinlab-game]').forEach(host => { host.hidden = host.dataset.spinlabGame !== key; });
      let host = mount.querySelector(`[data-spinlab-game="${key}"]`);
      if (!host) {
        host = document.createElement('div');
        host.dataset.spinlabGame = key;
        mount.appendChild(host);
      }
      host.hidden = false;

      try {
        const embed = await loadEmbedScript();
        if (!this.isConnected || request !== this._request) return;
        embed.init();
        status.textContent = '按下遊戲框內的「開始試玩」即可載入。';
      } catch {
        if (!this.isConnected || request !== this._request) return;
        status.textContent = '暫時無法載入試玩入口，請使用下方連結開啟 SPINLAB 試玩頁。';
      }
    }
  }

  customElements.define('seth-trial', SethTrial);
})();
