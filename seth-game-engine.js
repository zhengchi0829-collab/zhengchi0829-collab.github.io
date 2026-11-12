// Independent, virtual-point simulation. These weights and payouts are custom;
// they are not a provider's implementation, certified RTP, or prediction model.
export const MODES = Object.freeze([
  Object.freeze({ id: 'seth1', name: '戰神賽特（一代）' }),
  Object.freeze({ id: 'seth2', name: '戰神賽特2 覺醒之力' })
]);
export const BET_OPTIONS = Object.freeze([10, 20, 50, 100, 200, 500]);
export const STARTING_BALANCE = 10000;
export const FREE_BUY_MULTIPLIER = 100;
export const MAX_CASCADES = 12;
export const FREE_SPINS_AWARD = 15;
export const FREE_RETRIGGER_AWARD = 5;
export const MAX_FREE_SPINS = 100;
export const ORB_VALUES = Object.freeze([2, 3, 5, 10, 20, 50, 100, 500]);
export const ORB_WEIGHTS = Object.freeze([500, 220, 140, 75, 40, 18, 6, 1]);

// pay contains the custom multiples for counts 8–9, 10–11, and 12+.
export const SYMBOLS = Object.freeze([
  ['gemBlue', '藍寶石', [0.1, 0.25, 0.5], 20],
  ['gemGreen', '綠寶石', [0.15, 0.35, 0.75], 18],
  ['gemPurple', '紫寶石', [0.2, 0.5, 1], 16],
  ['gemRed', '紅寶石', [0.3, 0.75, 1.5], 14],
  ['ring', '黃金戒環', [0.5, 1.25, 2.5], 10],
  ['chalice', '聖杯', [0.75, 1.75, 3.5], 8],
  ['ankh', '生命之符', [1, 2.5, 5], 6],
  ['wings', '神聖羽翼', [1.5, 3.5, 7.5], 4],
  ['scatter', '聖甲蟲', [0, 0, 0], 2],
  ['goldScatter', '覺醒聖甲蟲', [0, 0, 0], 1],
  ['orb', '倍數球', [0, 0, 0], 3],
  ['seth', '賽特', [0, 0, 0], 2],
  ['nephthys', '奈芙蒂斯', [0, 0, 0], 2]
].map(([id, label, pay, weight]) => Object.freeze({ id, label, pay: Object.freeze(pay), weight })));

const ROWS = 5;
const COLS = 6;
const SIZE = ROWS * COLS;
const symbolMap = new Map(SYMBOLS.map(symbol => [symbol.id, symbol]));
const ordinaryIds = new Set(SYMBOLS.slice(0, 8).map(symbol => symbol.id));
const effectLengths = [2, 4, 6];
const MAX_FREE_MULTIPLIER = SIZE * ORB_VALUES.at(-1) * (MAX_FREE_SPINS + 1) * MAX_FREE_SPINS;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function assert(condition, message) {
  if (!condition) fail('INVALID_STATE', message);
}

function isInteger(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function checked(value, message = '點數超出可安全計算的範圍。') {
  assert(isInteger(value), message);
  return value;
}

function cloneBoard(board) { return board.map(cell => ({ ...cell })); }

function normalizeCell(raw) {
  assert(raw && typeof raw === 'object' && !Array.isArray(raw), '盤面格子格式錯誤。');
  assert(typeof raw.uid === 'string' && /^[a-zA-Z0-9:_-]{1,96}$/.test(raw.uid), '盤面格子的識別碼無效。');
  assert(symbolMap.has(raw.symbol), '盤面含有未知符號。');
  const cell = { uid: raw.uid, symbol: raw.symbol };
  if (raw.symbol === 'orb') {
    assert(raw.rare === undefined || typeof raw.rare === 'boolean', '稀有球設定無效。');
    const rare = raw.rare === true;
    const baseValue = raw.baseValue ?? (rare ? null : raw.value);
    assert(ORB_VALUES.includes(baseValue), '倍數球基礎值無效。');
    assert(isInteger(raw.value, baseValue, baseValue * (MAX_FREE_SPINS + 1)), '倍數球數值無效。');
    assert(rare ? raw.value % baseValue === 0 : raw.value === baseValue, '倍數球增長值無效。');
    Object.assign(cell, { value: raw.value, rare, baseValue });
  } else {
    assert(raw.value === undefined && raw.baseValue === undefined && raw.rare === undefined, '普通符號不能帶有倍數球數值。');
  }
  return cell;
}

function normalizeState(raw) {
  assert(raw && typeof raw === 'object' && !Array.isArray(raw), '遊戲狀態無效。');
  assert(MODES.some(mode => mode.id === raw.mode), '遊戲模式無效。');
  assert(isInteger(raw.balance) && isInteger(raw.totalWin) && isInteger(raw.round), '點數或局數無效。');
  assert(BET_OPTIONS.includes(raw.bet), '每回合點數無效。');
  assert(isInteger(raw.freeSpins, 0, MAX_FREE_SPINS), '免費回合數無效。');
  assert(isInteger(raw.freeAwarded, 0, MAX_FREE_SPINS) && raw.freeAwarded >= raw.freeSpins, '免費回合累計數無效。');
  assert(isInteger(raw.freeMultiplier, 0, MAX_FREE_MULTIPLIER), '免費回合累積倍率無效。');
  assert(typeof raw.awakened === 'boolean', '覺醒狀態無效。');
  assert(Array.isArray(raw.board) && raw.board.length === SIZE, '盤面必須為六欄五列。');
  const board = Array.from(raw.board, normalizeCell);
  assert(new Set(board.map(cell => cell.uid)).size === SIZE, '盤面識別碼不可重複。');
  if (raw.mode === 'seth1') {
    assert(!raw.awakened && board.every(cell => !cell.rare && !['goldScatter', 'seth', 'nephthys'].includes(cell.symbol)), '一代模式含有不適用的符號或功能。');
  }
  assert(Array.isArray(raw.locks) && raw.locks.length <= SIZE, '鎖球狀態無效。');
  const lockedIndices = new Set();
  const locks = Array.from(raw.locks, lock => {
    assert(lock && typeof lock === 'object' && !Array.isArray(lock), '鎖球格式無效。');
    assert(isInteger(lock.index, 0, SIZE - 1) && !lockedIndices.has(lock.index), '鎖球位置無效或重複。');
    assert(isInteger(lock.remaining, 1, 6), '鎖球剩餘局數無效。');
    const cell = normalizeCell(lock.cell);
    const onBoard = board[lock.index];
    assert(cell.symbol === 'orb' && JSON.stringify(cell) === JSON.stringify(onBoard), '鎖球與盤面不一致。');
    lockedIndices.add(lock.index);
    return { index: lock.index, cell, remaining: lock.remaining };
  });
  assert(!locks.length || (raw.mode === 'seth2' && raw.awakened && raw.freeSpins > 0), '只有覺醒免費回合可保留鎖球。');
  if (raw.freeSpins === 0) {
    assert(raw.freeAwarded === 0 && raw.freeMultiplier === 0 && !raw.awakened && !locks.length, '免費遊戲結束後的暫存狀態必須清除。');
  } else {
    assert(raw.freeAwarded >= FREE_SPINS_AWARD, '免費遊戲累計數低於起始獎勵。');
  }
  return {
    mode: raw.mode, balance: raw.balance, bet: raw.bet, board,
    freeSpins: raw.freeSpins, freeAwarded: raw.freeAwarded,
    totalWin: raw.totalWin, round: raw.round, freeMultiplier: raw.freeMultiplier,
    awakened: raw.awakened, locks
  };
}

export function createGameState(mode = 'seth1') {
  const id = MODES.some(item => item.id === mode) ? mode : 'seth1';
  return {
    mode: id, balance: STARTING_BALANCE, bet: 20,
    board: Array.from({ length: SIZE }, (_, index) => ({ uid: `${id}:preview:${index}`, symbol: SYMBOLS[index % 8].id })),
    freeSpins: 0, freeAwarded: 0, totalWin: 0, round: 0,
    freeMultiplier: 0, awakened: false, locks: []
  };
}

export function restoreGameState(raw, mode = 'seth1') {
  const fallback = createGameState(mode);
  try {
    const state = normalizeState(raw);
    return state.mode === fallback.mode ? state : fallback;
  } catch { return fallback; }
}

export function setBet(state, bet) {
  const current = normalizeState(state);
  if (current.freeSpins > 0) fail('FREE_SPINS_ACTIVE', '免費回合完成前不可調整每回合點數。');
  if (!BET_OPTIONS.includes(bet)) fail('INVALID_BET', '請選擇有效的每回合點數。');
  return { ...current, bet };
}

export function resetGame(state) {
  const current = normalizeState(state);
  return { ...createGameState(current.mode), bet: current.bet };
}

function defaultRandom() {
  try {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    }
  } catch { /* A browser may expose crypto but refuse the operation. */ }
  return Math.random();
}

function randomReader(random) {
  if (typeof random !== 'function') fail('INVALID_RANDOM', '亂數來源無效。');
  return () => {
    let value;
    try { value = random(); } catch { fail('INVALID_RANDOM', '亂數來源無法使用。'); }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) {
      fail('INVALID_RANDOM', '亂數必須介於 0（含）與 1（不含）之間。');
    }
    return value;
  };
}

function pickWeighted(items, random) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let target = random() * total;
  for (const item of items) {
    if (target < item.weight) return item;
    target -= item.weight;
  }
  return items.at(-1);
}

function pick(items, random) { return items[Math.floor(random() * items.length)]; }

export function buyFreeSpins(state, { random = defaultRandom } = {}) {
  const current = normalizeState(state);
  if (current.freeSpins > 0) fail('FREE_SPINS_ACTIVE', '請先完成現有免費回合。');
  const cost = current.bet * FREE_BUY_MULTIPLIER;
  if (current.balance < cost) fail('INSUFFICIENT_FUNDS', '虛擬點數不足。');
  const rng = randomReader(random);
  const awakened = current.mode === 'seth2' && rng() < 0.5;
  return {
    state: { ...current, balance: current.balance - cost, freeSpins: FREE_SPINS_AWARD, freeAwarded: FREE_SPINS_AWARD, freeMultiplier: 0, awakened, locks: [] },
    cost, awakened
  };
}

function matchesFor(board, bet) {
  const counts = new Map();
  board.forEach((cell, index) => {
    if (!ordinaryIds.has(cell.symbol)) return;
    if (!counts.has(cell.symbol)) counts.set(cell.symbol, []);
    counts.get(cell.symbol).push(index);
  });
  return [...counts].filter(([, indices]) => indices.length >= 8).map(([symbol, indices]) => ({
    symbol, count: indices.length,
    pay: Math.round(bet * symbolMap.get(symbol).pay[indices.length >= 12 ? 2 : indices.length >= 10 ? 1 : 0]),
    indices
  }));
}

// Fixed locks divide each column into independent gravity segments. No symbol
// can move a locked ball or fall through its fixed position.
function refill(board, cleared, lockedIndices, draw) {
  const removed = new Set(cleared);
  const next = cloneBoard(board);
  for (let col = 0; col < COLS; col++) {
    let start = 0;
    for (let row = 0; row <= ROWS; row++) {
      if (row < ROWS && !lockedIndices.has(row * COLS + col)) continue;
      const positions = [];
      for (let part = start; part < row; part++) positions.push(part * COLS + col);
      const survivors = positions.filter(index => !removed.has(index)).map(index => board[index]);
      const missing = positions.length - survivors.length;
      positions.forEach((index, offset) => { next[index] = offset < missing ? draw() : { ...survivors[offset - missing] }; });
      start = row + 1;
    }
  }
  return next;
}

export function resolveSpin(state, { random = defaultRandom } = {}) {
  const current = normalizeState(state);
  const usedFreeSpin = current.freeSpins > 0;
  const charged = usedFreeSpin ? 0 : current.bet;
  if (current.balance < charged) fail('INSUFFICIENT_FUNDS', '虛擬點數不足。');
  const round = checked(current.round + 1, '局數超出可安全計算的範圍。');
  const rng = randomReader(random);
  const awakenedSpin = usedFreeSpin && current.mode === 'seth2' && current.awakened;
  const eligible = SYMBOLS.filter(symbol => {
    if (symbol.id === 'goldScatter') return current.mode === 'seth2';
    if (symbol.id === 'seth' || symbol.id === 'nephthys') return awakenedSpin;
    return true;
  });
  const orbOptions = ORB_VALUES.map((value, index) => ({ value, weight: ORB_WEIGHTS[index] }));
  const usedIds = new Set(current.board.map(cell => cell.uid));
  let serial = 0;
  const uid = () => {
    let candidate;
    do { candidate = `${current.mode}:${round}:${serial++}`; } while (usedIds.has(candidate));
    usedIds.add(candidate);
    return candidate;
  };
  const draw = () => {
    const symbol = pickWeighted(eligible, rng).id;
    const cell = { uid: uid(), symbol };
    if (symbol === 'orb') {
      const value = pickWeighted(orbOptions, rng).value;
      Object.assign(cell, { value, baseValue: value, rare: awakenedSpin && rng() < 0.03 });
    }
    return cell;
  };
  const lockedIndices = new Set(current.locks.map(lock => lock.index));
  const startingLockedIds = new Set(current.locks.map(lock => lock.cell.uid));
  const lockedCells = new Map(current.locks.map(lock => [lock.index, lock.cell]));
  let board = Array.from({ length: SIZE }, (_, index) => lockedCells.has(index) ? { ...lockedCells.get(index) } : draw());
  const initialBoard = cloneBoard(board);
  const collectedOrbs = new Map();
  const collect = () => board.forEach(cell => { if (cell.symbol === 'orb' && !collectedOrbs.has(cell.uid)) collectedOrbs.set(cell.uid, cell.value); });
  collect();
  const frames = [];
  let baseWin = 0;
  for (let step = 0; step < MAX_CASCADES; step++) {
    const matches = matchesFor(board, current.bet);
    if (!matches.length) break;
    const cleared = matches.flatMap(match => match.indices).sort((a, b) => a - b);
    const win = checked(matches.reduce((sum, match) => sum + match.pay, 0));
    frames.push({ board: cloneBoard(board), cleared, matches: matches.map(({ symbol, count, pay }) => ({ symbol, count, pay })), baseWin: win });
    baseWin = checked(baseWin + win);
    board = refill(board, cleared, lockedIndices, draw);
    collect();
  }
  const hitCascadeLimit = frames.length === MAX_CASCADES && matchesFor(board, current.bet).length > 0;

  // Trigger counts use the single post-cascade snapshot, before special-symbol
  // replacements. This explicit simplification avoids repeated cascade awards.
  const counts = new Map();
  board.forEach(cell => counts.set(cell.symbol, (counts.get(cell.symbol) || 0) + 1));
  const scatters = (counts.get('scatter') || 0) + (counts.get('goldScatter') || 0);
  const events = [];
  const lockSpecs = current.locks.filter(lock => lock.remaining > 1).map(lock => ({ index: lock.index, remaining: lock.remaining - 1 }));

  if (awakenedSpin && (counts.get('seth') || 0) >= 3) {
    const orbs = board.filter(cell => cell.symbol === 'orb');
    if (orbs.length) {
      const source = pick(orbs, rng);
      const wanted = pick(effectLengths, rng);
      const spaces = board.map((cell, index) => ({ cell, index })).filter(({ cell, index }) => !lockedIndices.has(index) && cell.symbol !== 'orb' && !ordinaryIds.has(cell.symbol));
      // Keep the stated 2/4/6 outcomes even when there are too few special
      // spaces: reduce to the largest allowed count that fits, never 3 or 5.
      const count = effectLengths.filter(length => length <= Math.min(wanted, spaces.length)).at(-1) || 0;
      const targets = spaces.slice(0, count);
      for (const { index } of targets) board[index] = { ...source, uid: uid() };
      collect();
      if (targets.length) events.push({ type: 'split', text: `賽特分裂：新增 ${targets.length} 顆 ${source.value}× 倍數球。` });
    }
  }
  if (awakenedSpin && (counts.get('nephthys') || 0) >= 3) {
    const candidates = board.map((cell, index) => ({ cell, index })).filter(({ cell }) => cell.symbol === 'orb' && !startingLockedIds.has(cell.uid));
    if (candidates.length) {
      const { cell, index } = pick(candidates, rng);
      const remaining = pick(effectLengths, rng);
      lockSpecs.push({ index, remaining });
      events.push({ type: 'lock', text: `奈芙蒂斯鎖球：${cell.value}× 保留於接下來 ${remaining} 次免費回合。` });
    }
  }

  const orbTotal = checked([...collectedOrbs.values()].reduce((sum, value) => sum + value, 0));
  let freeMultiplier = usedFreeSpin ? checked(current.freeMultiplier + orbTotal) : 0;
  const multiplier = Math.max(1, usedFreeSpin ? freeMultiplier : orbTotal);
  const totalWin = checked(baseWin * multiplier);
  let freeSpins = usedFreeSpin ? current.freeSpins - 1 : 0;
  let freeAwarded = current.freeAwarded;
  let awakened = current.awakened;
  let awardedFreeSpins = 0;

  if (usedFreeSpin && scatters >= 3) {
    awardedFreeSpins = Math.min(FREE_RETRIGGER_AWARD, MAX_FREE_SPINS - freeAwarded);
    freeSpins += awardedFreeSpins;
    freeAwarded += awardedFreeSpins;
  } else if (!usedFreeSpin && scatters >= 4) {
    awardedFreeSpins = FREE_SPINS_AWARD;
    freeSpins = FREE_SPINS_AWARD;
    freeAwarded = FREE_SPINS_AWARD;
    awakened = current.mode === 'seth2' && (counts.get('goldScatter') || 0) > 0;
  }
  if (awardedFreeSpins) events.push({ type: 'free', text: `${usedFreeSpin ? '追加' : '獲得'} ${awardedFreeSpins} 次免費回合。` });
  if (!usedFreeSpin && awakened) events.push({ type: 'awakening', text: '黃金聖典觸發覺醒免費遊戲。' });
  if (orbTotal > 0) events.push({ type: 'multiplier', text: `本局倍數球合計 ${orbTotal}×${usedFreeSpin ? `，免費遊戲累積倍率 ${multiplier}×` : ''}。` });

  const growing = usedFreeSpin ? board.filter(cell => cell.symbol === 'orb' && cell.rare).length : 0;
  if (growing) {
    board = board.map(cell => cell.symbol === 'orb' && cell.rare ? { ...cell, value: checked(cell.value + cell.baseValue) } : cell);
    events.push({ type: 'multiplier', text: `${growing} 顆稀有球於結算後增長；若鎖定續留，下回合使用新值。` });
  }
  let locks = lockSpecs.map(lock => ({ ...lock, cell: { ...board[lock.index] } }));
  if (freeSpins === 0) {
    freeMultiplier = 0;
    freeAwarded = 0;
    awakened = false;
    locks = [];
    if (usedFreeSpin) events.push({ type: 'free', text: '免費遊戲結束，累積倍率與鎖球已清除。' });
  }
  const finalBoard = cloneBoard(board);
  frames.push({ board: cloneBoard(board), cleared: [], matches: [], baseWin: 0 });
  const nextState = {
    ...current, board: cloneBoard(board), balance: checked(current.balance - charged + totalWin),
    freeSpins, freeAwarded, totalWin: checked(current.totalWin + totalWin), round,
    freeMultiplier, awakened, locks
  };
  // Validate internally produced state too; no partially committed state escapes.
  normalizeState(nextState);
  return { state: nextState, initialBoard, finalBoard, frames, baseWin, totalWin, multiplier, orbTotal, usedFreeSpin, charged, awardedFreeSpins, events, hitCascadeLimit };
}
