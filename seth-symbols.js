// Local symbol atlas positions with independently drawn SVG fallbacks.
const art = {
  gemBlue: '<path d="m17 8-11 17 26 32 26-32L47 8Z" fill="#2889da" stroke="#a9e6ff"/><path d="M6 25h52L32 57Z" fill="#2661b7"/><path d="m17 8 15 17L47 8Z" fill="#c2f3ff" stroke="none"/><path d="m32 25 26 0-26 32Z" fill="#3ab5f3" stroke="none"/><path d="m17 8 15 49L47 8M6 25h52" fill="none" stroke="#a9e6ff"/>',
  gemGreen: '<path d="M19 6h26l13 15v24L45 58H19L6 45V21Z" fill="#268b65" stroke="#bbffca"/><path d="m19 6 5 14h16l5-14ZM6 21l18-1L19 45 6 45Z" fill="#80e798" stroke="none"/><path d="m40 20 18 1-13 37-6-14Z" fill="#41bf78" stroke="none"/><path d="M24 20h16l5 24-26 1Z" fill="#23ad71" stroke="#adf9bb"/>',
  gemPurple: '<path d="M32 4 55 18l4 27-27 16L5 45l4-27Z" fill="#7b41b9" stroke="#e1bbff"/><path d="m32 4 13 22-13 22L19 26Z" fill="#b66dea" stroke="#f0d6ff"/><path d="M9 18 19 26 5 45m50-27L45 26l14 19M5 45l27 3 27-3" fill="none" stroke="#cca0f2"/>',
  gemRed: '<path d="M16 8h32l12 22-28 30L4 30Z" fill="#b32949" stroke="#ffb3af"/><path d="m16 8 16 22L48 8ZM4 30h28L16 8Z" fill="#ff8890" stroke="none"/><path d="m32 30 28 0-28 30Z" fill="#e44461" stroke="none"/><path d="M16 8 32 60 48 8M4 30h56" fill="none" stroke="#ffc0b9"/>',
  ring: '<ellipse cx="32" cy="38" rx="20" ry="17" fill="#946323" stroke="#ffdf80" stroke-width="5"/><ellipse cx="32" cy="38" rx="12" ry="10" fill="#142039" stroke="#d9ab48"/><path d="m21 5 22 0 8 12-19 14L13 17Z" fill="#418eaf" stroke="#ffe194"/><path d="m21 5 11 12L43 5m-30 12h38L32 31Z" fill="none" stroke="#c7f3ed"/>',
  chalice: '<path d="M17 7h30v16c0 12-5 20-15 20s-15-8-15-20Z" fill="#c08b30" stroke="#ffe3a2"/><path d="M17 12H8v10c0 9 8 13 14 11m25-21h9v10c0 9-8 13-14 11M32 43v11M20 58h24" fill="none" stroke="#f0c866" stroke-width="5"/><path d="M23 10h8v27c-6-1-8-6-8-14Z" fill="#ffe7a0" stroke="none"/><path d="m26 18 6-5 6 5-6 9Z" fill="#d64c63" stroke="#ffe3a2"/>',
  ankh: '<path d="M22 17C22 1 42 1 42 17c0 8-10 14-10 14s-10-6-10-14Z" fill="#ba7e30" stroke="#ffe4a3" stroke-width="5"/><path d="M32 31v28M13 36h38" fill="none" stroke="#a66925" stroke-width="11"/><path d="M32 31v28M13 36h38" fill="none" stroke="#f5cf72" stroke-width="6"/>',
  wings: '<path d="M31 38C18 34 9 23 3 9c-1 25 6 42 28 44m2-15C46 34 55 23 61 9c1 25-6 42-28 44" fill="#b7873a" stroke="#ffe3a3"/><path d="m9 23 20 22M9 34l19 14m27-25L35 45m20-11L36 48" fill="none" stroke="#f8d981" stroke-width="2.5"/><path d="m32 26 10 13-10 19-10-19Z" fill="#248d9d" stroke="#ffe4a3"/>',
  scatter: '<path d="M29 27C15 13 4 22 3 37l22 10m10-20C49 13 60 22 61 37L39 47" fill="#a78131" stroke="#f9dc87"/><ellipse cx="32" cy="36" rx="14" ry="21" fill="#258b87" stroke="#ffe3a0" stroke-width="3"/><path d="M26 15V9h12v6M32 16v39M20 28c8 7 16 7 24 0" fill="none" stroke="#ffe6a6"/><path d="m25 22 7-3v12Z" fill="#b4f9e1" stroke="none"/>',
  seth: '<path d="m17 27 2-19 13-5 13 5 2 19-8 30H25Z" fill="#b56d2a" stroke="#f6d99b"/><path d="M23 24h18v19L32 54l-9-11Z" fill="#cf9a68" stroke="#f5d2a1"/><path d="m21 11 11 13 11-13M19 19h26M26 32h3m6 0h3M29 42h6" fill="none" stroke="#382522" stroke-width="2.4"/><path d="m28 7 4-5 4 5-4 11Z" fill="#e44e43" stroke="#ffcf76"/>',
  nephthys: '<path d="M16 27 21 9l11-7 11 7 5 18-6 29H22Z" fill="#69408f" stroke="#eed0ff"/><path d="M23 23h18v19l-9 12-9-12Z" fill="#c9977e" stroke="#f3d1b6"/><path d="M18 21h28M26 31h3m6 0h3M29 43h6" stroke="#35233e" fill="none"/><path d="m19 10 13 10 13-10M32 2v18" stroke="#e8c682" fill="none" stroke-width="3"/><circle cx="32" cy="19" r="4" fill="#65d8d4" stroke="#fff0b1"/>'
};
const positions = {
  gemBlue: [0, 0], gemGreen: [50, 0], gemPurple: [100, 0],
  gemRed: [0, 50], ring: [50, 50], chalice: [100, 50],
  ankh: [0, 100], wings: [50, 100], scatter: [100, 100]
};
export function symbolMarkup(cell) {
  if (cell.symbol === 'orb') {
    const value = Number(cell.value) || 1;
    return `<span class="st-orb ${cell.rare ? 'is-rare' : ''} ${value >= 1000 ? 'has-large-value' : ''}"><span class="st-orb-value">${value}×</span></span>`;
  }
  const id = cell.symbol === 'goldScatter' ? 'scatter' : cell.symbol;
  const sprite = positions[id];
  return `<span class="st-symbol-visual ${cell.symbol === 'goldScatter' ? 'is-awakened' : ''}">${sprite ? `<span class="st-symbol-sprite" style="--sprite-x:${sprite[0]}%;--sprite-y:${sprite[1]}%" aria-hidden="true"></span>` : ''}<svg class="st-symbol-fallback ${sprite ? 'has-sprite' : ''}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${art[id] || art.gemBlue}</svg></span>`;
}
