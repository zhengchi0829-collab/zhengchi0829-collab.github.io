/**
 * 沙海戰神Ⅰ / 黃金神殿Ⅱ — original, local-only virtual-point games.
 * These rules are independent and do not model any external game's results.
 * Boards use row-major indices: index = row * 6 + column.
 */

export const BET_OPTIONS = Object.freeze([20, 50, 100, 200, 500]);
export const STARTING_BALANCE = 10000;
export const MAX_CASCADES = 6;
export const MAX_MULTIPLIER = 20;
export const FREE_SPINS_AWARD = 5;
export const FREE_SPINS_COST_MULTIPLIER = 100;

export const GAME_MODES = Object.freeze([
  Object.freeze({
    id: 'classic',
    name: '沙海戰神Ⅰ',
    description: '六欄五列自由連消，每回合抽出一、二、三或五倍，計算當回合獲得的虛擬點數。',
  }),
  Object.freeze({
    id: 'temple',
    name: '黃金神殿Ⅱ',
    description: '連消可讓倍率分裂翻倍，最高二十倍；得分回合結束時有機會鎖定倍率供接下來兩局使用。',
  }),
]);

export const SYMBOLS = Object.freeze([
  Object.freeze({ id: 'sun', name: '曜陽', weight: 21, basePay: 0.3, color: '#f6c365' }),
  Object.freeze({ id: 'moon', name: '月輪', weight: 19, basePay: 0.4, color: '#b3b9ed' }),
  Object.freeze({ id: 'gem', name: '晶石', weight: 17, basePay: 0.6, color: '#65d7c7' }),
  Object.freeze({ id: 'lotus', name: '蓮華', weight: 15, basePay: 0.8, color: '#e7a2c7' }),
  Object.freeze({ id: 'feather', name: '翎羽', weight: 13, basePay: 1, color: '#86bde3' }),
  Object.freeze({ id: 'scarab', name: '金甲', weight: 11, basePay: 1.5, color: '#d4ce7a' }),
  Object.freeze({ id: 'seal', name: '神印', weight: 4, basePay: 0, color: '#f6a46f' }),
]);

const COLUMNS = 6;
const ROWS = 5;
const BOARD_SIZE = COLUMNS * ROWS;
const LOCK_ROUNDS_AWARD = 2;
const SPLIT_CHANCE = 0.2;
const LOCK_CHANCE = 0.15;
const ORDINARY_SYMBOLS = SYMBOLS.filter((symbol) => symbol.id !== 'seal');
const SYMBOL_IDS = new Set(SYMBOLS.map((symbol) => symbol.id));
const MODE_IDS = new Set(GAME_MODES.map((mode) => mode.id));
const WEIGHT_TOTAL = SYMBOLS.reduce((total, symbol) => total + symbol.weight, 0);

function gameError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateState(state) {
  // Missing lock fields from an earlier local session are safely initialized.
  // Supplied invalid values are rejected instead of silently repaired.
  const lockedMultiplier = state?.lockedMultiplier === undefined ? 1 : state.lockedMultiplier;
  const lockedRounds = state?.lockedRounds === undefined ? 0 : state.lockedRounds;
  if (!state || typeof state !== 'object'
    || !MODE_IDS.has(state.mode)
    || !BET_OPTIONS.includes(state.bet)
    || ![state.balance, state.freeSpins, state.totalWin, state.round]
      .every((value) => Number.isSafeInteger(value) && value >= 0)
    || !Array.isArray(state.board)
    || state.board.length !== BOARD_SIZE
    || !Array.from(state.board).every((symbol) => SYMBOL_IDS.has(symbol))
    || !Number.isInteger(lockedMultiplier)
    || lockedMultiplier < 1 || lockedMultiplier > MAX_MULTIPLIER
    || !Number.isInteger(lockedRounds)
    || lockedRounds < 0 || lockedRounds > LOCK_ROUNDS_AWARD
    || (lockedRounds === 0 && lockedMultiplier !== 1)
    || (state.mode === 'classic' && (lockedRounds !== 0 || lockedMultiplier !== 1))) {
    throw gameError('INVALID_STATE', '遊戲狀態無效，請重新開始。');
  }
  return { ...state, lockedMultiplier, lockedRounds };
}

function defaultRandom() {
  try {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      const value = new Uint32Array(1);
      globalThis.crypto.getRandomValues(value);
      return value[0] / 4294967296;
    }
  } catch {
    // Some hosts expose Web Crypto without allowing this operation.
  }
  return Math.random();
}

function checkedRandom(random) {
  if (typeof random !== 'function') {
    throw gameError('INVALID_RANDOM', '隨機來源必須是回傳零至一之間數值的函式。');
  }
  return () => {
    let value;
    try {
      value = random();
    } catch {
      throw gameError('INVALID_RANDOM', '隨機來源無法使用，請重新開始。');
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) {
      throw gameError('INVALID_RANDOM', '隨機來源必須回傳大於等於零且小於一的數值。');
    }
    return value;
  };
}

function drawSymbol(random) {
  const target = random();
  let cumulative = 0;
  for (const symbol of SYMBOLS) {
    cumulative += symbol.weight;
    if (target < cumulative / WEIGHT_TOTAL) return symbol.id;
  }
  // The validated random range and integer weights make this unreachable.
  return SYMBOLS[SYMBOLS.length - 1].id;
}

function drawMultiplier(random) {
  const value = random();
  if (value < 0.65) return 1;
  if (value < 0.85) return 2;
  if (value < 0.95) return 3;
  return 5;
}

function findMatches(board, bet) {
  const matches = [];
  for (const symbol of ORDINARY_SYMBOLS) {
    const cells = [];
    for (let index = 0; index < BOARD_SIZE; index += 1) {
      if (board[index] === symbol.id) cells.push(index);
    }
    if (cells.length < 8) continue;
    const count = cells.length;
    const tier = count >= 12 ? 3.5 : count >= 10 ? 2 : 1;
    matches.push({
      symbol: symbol.id,
      count,
      cells,
      payout: Math.round(symbol.basePay * bet * tier),
    });
  }
  return matches;
}

function refillBoard(board, cleared, random) {
  const removed = new Set(cleared);
  const nextBoard = new Array(BOARD_SIZE);
  for (let column = 0; column < COLUMNS; column += 1) {
    const survivors = [];
    for (let row = 0; row < ROWS; row += 1) {
      const index = row * COLUMNS + column;
      if (!removed.has(index)) survivors.push(board[index]);
    }
    const missing = ROWS - survivors.length;
    for (let row = 0; row < missing; row += 1) {
      nextBoard[row * COLUMNS + column] = drawSymbol(random);
    }
    for (let index = 0; index < survivors.length; index += 1) {
      nextBoard[(missing + index) * COLUMNS + column] = survivors[index];
    }
  }
  return nextBoard;
}

/** A fixed preview with five of each ordinary symbol; no random draw occurs. */
export function createGameState(mode = 'classic') {
  return {
    mode: MODE_IDS.has(mode) ? mode : 'classic',
    balance: STARTING_BALANCE,
    bet: 100,
    freeSpins: 0,
    totalWin: 0,
    round: 0,
    lockedMultiplier: 1,
    lockedRounds: 0,
    board: Array.from({ length: BOARD_SIZE }, (_, index) => (
      ORDINARY_SYMBOLS[(index + Math.floor(index / COLUMNS)) % ORDINARY_SYMBOLS.length].id
    )),
  };
}

/** Return a separate state and board; lock the bet throughout free spins. */
export function setBet(state, bet) {
  const current = validateState(state);
  if (current.freeSpins > 0) {
    throw gameError('FREE_SPINS_ACTIVE', '免費回合進行中，請完成後再調整每回合點數。');
  }
  if (!BET_OPTIONS.includes(bet)) {
    throw gameError('INVALID_BET', '請選擇有效的每回合點數。');
  }
  return { ...current, bet, board: [...current.board] };
}

/** Buy five virtual free rounds once; a purchase is not a played round. */
export function buyFreeSpins(state) {
  const current = validateState(state);
  if (current.freeSpins > 0) {
    throw gameError('FREE_SPINS_ACTIVE', '請先完成目前的免費回合，才能再次取得免費回合。');
  }
  const cost = current.bet * FREE_SPINS_COST_MULTIPLIER;
  if (current.balance < cost) {
    throw gameError('INSUFFICIENT_FUNDS', '虛擬點數不足，無法取得這組免費回合。');
  }
  return {
    ...current,
    balance: current.balance - cost,
    freeSpins: FREE_SPINS_AWARD,
    board: [...current.board],
  };
}

/** Reset virtual points while keeping a recognized mode and legal bet. */
export function resetGame(state) {
  const fresh = createGameState(state?.mode);
  if (BET_OPTIONS.includes(state?.bet)) fresh.bet = state.bet;
  return fresh;
}

/**
 * Resolve one complete round without modifying the supplied state.
 *
 * RNG order: 30 row-major initial symbols; one base multiplier draw unless
 * a temple lock is active; for each scoring cascade, a temple split draw
 * followed by column-major refill draws; finally, one temple lock draw only
 * for a scoring round that did not start with a lock.
 * Match payouts and frame.win are base points; frame.payout is the actual
 * amount credited at that frame's multiplier. Later splits are not retroactive.
 * A terminal frame shows finalBoard with no clears and no additional payout.
 * hitCascadeLimit means a seventh payable cascade was actually left unplayed.
 */
export function resolveSpin(state, { random = defaultRandom } = {}) {
  const current = validateState(state);
  const usedFreeSpin = current.freeSpins > 0;
  const charged = usedFreeSpin ? 0 : current.bet;
  if (current.balance < charged) {
    throw gameError('INSUFFICIENT_FUNDS', '虛擬點數不足，請降低每回合點數或重新開始。');
  }

  const nextRandom = checkedRandom(random);
  const initialBoard = Array.from({ length: BOARD_SIZE }, () => drawSymbol(nextRandom));
  const isTemple = current.mode === 'temple';
  const lockUsed = isTemple && current.lockedRounds > 0;
  const initialMultiplier = lockUsed ? current.lockedMultiplier : drawMultiplier(nextRandom);
  let multiplier = initialMultiplier;
  const sealCount = initialBoard.reduce((count, symbol) => count + (symbol === 'seal' ? 1 : 0), 0);
  const awardedFreeSpins = !usedFreeSpin && sealCount >= 4 ? FREE_SPINS_AWARD : 0;
  const frames = [];
  let board = [...initialBoard];
  let baseWin = 0;
  let totalWin = 0;
  let cascades = 0;

  while (cascades < MAX_CASCADES) {
    const matches = findMatches(board, current.bet);
    if (matches.length === 0) break;
    const cleared = matches.flatMap((match) => match.cells).sort((a, b) => a - b);
    const win = matches.reduce((total, match) => total + match.payout, 0);
    const beforeSplit = multiplier;
    // Draw on every scoring temple cascade, even at the cap, to keep the
    // documented per-cascade random order stable. Only an increase is a split.
    const splitTriggered = isTemple && nextRandom() < SPLIT_CHANCE;
    const splitBoolean = splitTriggered && multiplier < MAX_MULTIPLIER;
    if (splitBoolean) multiplier = Math.min(MAX_MULTIPLIER, multiplier * 2);
    const payout = win * multiplier;
    frames.push({
      board: [...board], matches, cleared, win,
      initialMultiplier: beforeSplit, multiplier, payout, splitBoolean,
    });
    baseWin += win;
    totalWin += payout;
    board = refillBoard(board, cleared, nextRandom);
    cascades += 1;
  }

  const hitCascadeLimit = cascades === MAX_CASCADES && findMatches(board, current.bet).length > 0;
  const finalBoard = [...board];
  frames.push({
    board: [...finalBoard], matches: [], cleared: [], win: 0,
    initialMultiplier: multiplier, multiplier, payout: 0, splitBoolean: false,
  });

  // Every played round consumes one existing lock, including free/no-win
  // rounds. Its in-round splits never alter the multiplier reserved for the
  // next locked round, and an existing lock cannot retrigger itself.
  let lockedRounds = lockUsed ? current.lockedRounds - 1 : 0;
  let lockedMultiplier = lockedRounds > 0 ? current.lockedMultiplier : 1;
  const lockAwarded = isTemple && !lockUsed && totalWin > 0 && nextRandom() < LOCK_CHANCE;
  if (lockAwarded) {
    lockedRounds = LOCK_ROUNDS_AWARD;
    lockedMultiplier = multiplier;
  }

  const balance = current.balance - charged + totalWin;
  const accumulatedWin = current.totalWin + totalWin;
  const round = current.round + 1;
  if (![balance, accumulatedWin, round].every(Number.isSafeInteger)) {
    throw gameError('INVALID_STATE', '虛擬點數已超出可計算範圍，請重新開始。');
  }

  return {
    state: {
      ...current,
      balance,
      freeSpins: current.freeSpins - (usedFreeSpin ? 1 : 0) + awardedFreeSpins,
      totalWin: accumulatedWin,
      round,
      lockedMultiplier,
      lockedRounds,
      board: [...finalBoard],
    },
    initialBoard,
    finalBoard,
    frames,
    charged,
    usedFreeSpin,
    awardedFreeSpins,
    initialMultiplier,
    multiplier,
    baseWin,
    totalWin,
    hitCascadeLimit,
    lockAwarded,
    lockUsed,
    lockedRounds,
  };
}
