// Trial section placeholder. Provider access must be enabled before adding a player.
(() => {
  if (customElements.get('seth-trial')) return;
  let instanceCount = 0;

  class SethTrial extends HTMLElement {
    constructor() {
      super();
      this._uid = `seth-trial-${++instanceCount}`;
      this._hashFrame = null;
    }

    connectedCallback() {
      if (!this.querySelector('.st-pending-section')) {
        this.innerHTML = `
          <section class="seth-trial-section st-pending-section" aria-labelledby="${this._uid}-title">
            <div class="layout-width st-inner">
              <div class="st-heading">
                <p class="st-eyebrow">SETH TRIAL</p>
                <h2 id="${this._uid}-title">賽特試玩區</h2>
                <p class="st-intro" id="${this._uid}-status">試玩準備中，開放後可在本頁直接開始。</p>
              </div>
              <div class="st-card-grid">
                <article class="st-card st-card--gold" data-trial-game="seth1" aria-labelledby="${this._uid}-seth1">
                  <div class="st-card-top">
                    <span class="st-card-number" aria-hidden="true">01</span>
                    <div class="st-card-copy"><span class="st-card-kicker">一代試玩</span><h3 id="${this._uid}-seth1">戰神賽特（一代）</h3></div>
                  </div>
                  <button class="st-unavailable" type="button" disabled aria-describedby="${this._uid}-status">尚未開放</button>
                  <div class="st-trial-mount" data-trial-mount="seth1" hidden></div>
                </article>
                <article class="st-card st-card--violet" data-trial-game="seth2" aria-labelledby="${this._uid}-seth2">
                  <div class="st-card-top">
                    <span class="st-card-number" aria-hidden="true">02</span>
                    <div class="st-card-copy"><span class="st-card-kicker">二代試玩</span><h3 id="${this._uid}-seth2">戰神賽特2 覺醒之力</h3></div>
                  </div>
                  <button class="st-unavailable" type="button" disabled aria-describedby="${this._uid}-status">尚未開放</button>
                  <div class="st-trial-mount" data-trial-mount="seth2" hidden></div>
                </article>
              </div>
            </div>
          </section>`;
      }
      if (this._hashFrame !== null) cancelAnimationFrame(this._hashFrame);
      if (this.id && location.hash === `#${this.id}`) {
        this._hashFrame = requestAnimationFrame(() => {
          this._hashFrame = null;
          if (this.isConnected && location.hash === `#${this.id}`) {
            this.scrollIntoView({ block: 'start', behavior: 'instant' });
          }
        });
      }
    }

    disconnectedCallback() {
      if (this._hashFrame !== null) cancelAnimationFrame(this._hashFrame);
      this._hashFrame = null;
    }
  }

  customElements.define('seth-trial', SethTrial);
})();
