import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../seth-game-engine.js', import.meta.url), 'utf8');
const engine = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { BET_OPTIONS, STARTING_BALANCE, MAX_CASCADES, MAX_MULTIPLIER,
  FREE_SPINS_AWARD, FREE_SPINS_COST_MULTIPLIER, GAME_MODES, SYMBOLS,
  createGameState, setBet, resetGame, buyFreeSpins, resolveSpin } = engine;

const centers = { sun: 0.1, moon: 0.3, gem: 0.48, lotus: 0.64, feather: 0.78, scarab: 0.9, seal: 0.98 };
const ordinary = ['sun', 'moon', 'gem', 'lotus', 'feather', 'scarab'];
const quiet = Array.from({ length: 30 }, (_, index) => ordinary[index % 6]);
const asDraws = (board) => board.map((id) => centers[id]);
const classicSequence = (initial, refill = []) => sequence([...asDraws(initial), 0, ...asDraws(refill)]);
const terminal = (board, multiplier = 1) => ({
  board, matches: [], cleared: [], win: 0,
  initialMultiplier: multiplier, multiplier, payout: 0, splitBoolean: false,
});
function sequence(values) {
  let used = 0;
  const random = () => {
    assert.ok(used < values.length, `unexpected random draw ${used + 1}`);
    return values[used++];
  };
  random.used = () => used;
  return random;
}
function frozenState(overrides = {}) {
  const state = { ...createGameState(), ...overrides };
  Object.freeze(state.board);
  return Object.freeze(state);
}

test('constants and fixed preview fulfill the public UI contract', () => {
  assert.deepEqual([...BET_OPTIONS], [20, 50, 100, 200, 500]);
  assert.equal(STARTING_BALANCE, 10000);
  assert.equal(MAX_CASCADES, 6);
  assert.equal(MAX_MULTIPLIER, 20);
  assert.equal(FREE_SPINS_AWARD, 5);
  assert.equal(FREE_SPINS_COST_MULTIPLIER, 100);
  assert.deepEqual(GAME_MODES.map((mode) => mode.id), ['classic', 'temple']);
  assert.deepEqual(GAME_MODES.map((mode) => mode.name), ['沙海戰神Ⅰ', '黃金神殿Ⅱ']);
  assert.equal(SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0), 100);
  const state = createGameState('unknown');
  assert.equal(state.mode, 'classic');
  assert.equal(state.lockedMultiplier, 1);
  assert.equal(state.lockedRounds, 0);
  assert.equal(state.board.length, 30);
  for (const id of ordinary) assert.equal(state.board.filter((cell) => cell === id).length, 5);
  assert.deepEqual(state, createGameState());
  assert.notStrictEqual(state.board, createGameState().board);
});

test('bet changes and reset are pure, with an enforced free-spin bet lock', () => {
  const state = frozenState();
  const next = setBet(state, 500);
  assert.equal(next.bet, 500);
  assert.equal(state.bet, 100);
  assert.notStrictEqual(next.board, state.board);
  assert.throws(() => setBet(state, 10), { code: 'INVALID_BET' });
  assert.throws(() => setBet(frozenState({ freeSpins: 1 }), 200), { code: 'FREE_SPINS_ACTIVE' });
  const reset = resetGame({ ...state, mode: 'temple', bet: 200, balance: 0, freeSpins: 4, round: 9,
    lockedMultiplier: 8, lockedRounds: 2 });
  assert.deepEqual(reset, { ...createGameState('temple'), bet: 200 });
  assert.equal(resetGame({ mode: 'bad', bet: 30 }).bet, 100);
});

test('a no-win paid round charges once and still returns a terminal frame', () => {
  const state = frozenState({ totalWin: 25, round: 2 });
  const random = classicSequence(quiet);
  const result = resolveSpin(state, { random });
  assert.equal(result.charged, 100);
  assert.equal(result.state.balance, 9900);
  assert.equal(result.usedFreeSpin, false);
  assert.equal(result.totalWin, 0);
  assert.equal(result.state.totalWin, 25);
  assert.equal(result.state.round, 3);
  assert.equal(random.used(), 31);
  assert.deepEqual(result.frames, [terminal(quiet)]);
  assert.deepEqual(result.finalBoard, quiet);
  assert.notStrictEqual(result.state.board, result.finalBoard);
  assert.notStrictEqual(result.frames[0].board, result.finalBoard);
  assert.equal(state.balance, 10000);
});

test('free rounds work at zero balance; insufficient paid funds fail before RNG', () => {
  const result = resolveSpin(frozenState({ freeSpins: 2, balance: 0 }), { random: classicSequence(quiet) });
  assert.equal(result.usedFreeSpin, true);
  assert.equal(result.charged, 0);
  assert.equal(result.state.freeSpins, 1);
  assert.equal(result.state.balance, 0);
  let called = false;
  assert.throws(() => resolveSpin(frozenState({ balance: 99 }), { random: () => { called = true; return 0; } }),
    { code: 'INSUFFICIENT_FUNDS' });
  assert.equal(called, false);
});

test('four initial seals award five free spins once; free rounds do not retrigger', () => {
  const initial = ['seal', 'seal', 'seal', 'seal', ...quiet.slice(0, 26)];
  const paid = resolveSpin(frozenState(), { random: classicSequence(initial) });
  assert.equal(paid.awardedFreeSpins, 5);
  assert.equal(paid.state.freeSpins, 5);
  const free = resolveSpin(frozenState({ freeSpins: 1 }), { random: () => centers.seal });
  assert.equal(free.awardedFreeSpins, 0);
  assert.equal(free.state.freeSpins, 0);
  assert.equal(free.charged, 0);
  const afterRefill = resolveSpin(frozenState(), {
    random: classicSequence(Array(30).fill('sun'), Array(30).fill('seal')),
  });
  assert.equal(afterRefill.awardedFreeSpins, 0);
  assert.equal(afterRefill.state.freeSpins, 0);
});

const tripleMatch = [
  ...Array(8).fill('sun'), ...Array(8).fill('moon'), ...Array(8).fill('gem'),
  'lotus', 'lotus', 'feather', 'feather', 'scarab', 'scarab',
];
const evenRefill = Array.from({ length: 24 }, (_, index) => ordinary[index % 6]);

test('three simultaneous symbol wins are added without duplicate clears or state mutation', () => {
  const state = frozenState();
  const result = resolveSpin(state, { random: classicSequence(tripleMatch, evenRefill) });
  assert.equal(result.frames.length, 2);
  assert.deepEqual(result.frames[0].matches.map(({ symbol, count, payout }) => ({ symbol, count, payout })), [
    { symbol: 'sun', count: 8, payout: 30 },
    { symbol: 'moon', count: 8, payout: 40 },
    { symbol: 'gem', count: 8, payout: 60 },
  ]);
  assert.equal(new Set(result.frames[0].cleared).size, 24);
  assert.equal(result.baseWin, 130);
  assert.equal(result.totalWin, 130);
  assert.equal(result.state.balance, 10030);
  assert.notStrictEqual(result.frames[0].board, result.initialBoard);
  assert.equal(state.balance, 10000);
});

test('10-symbol and 12-symbol tiers pay the documented rounded amounts', () => {
  for (const [count, id, expected] of [[10, 'sun', 60], [12, 'scarab', 525]]) {
    const initial = [...Array(count).fill(id), ...Array(30 - count).fill('seal')];
    const refill = Array.from({ length: count }, (_, index) => ordinary[index % 6]);
    const result = resolveSpin(frozenState(), { random: classicSequence(initial, refill) });
    assert.equal(result.frames[0].matches[0].payout, expected);
    assert.equal(result.baseWin, expected);
  }
  const rounded = resolveSpin(frozenState({ bet: 50 }), {
    random: classicSequence([...Array(12).fill('sun'), ...Array(18).fill('seal')], [...ordinary, ...ordinary]),
  });
  assert.equal(rounded.baseWin, 53); // 0.3 * 50 * 3.5 = 52.5.
});

test('gravity preserves the top-to-bottom order of every column survivor', () => {
  const removed = new Set([0, 6, 12, 18, 24, 1, 14, 27]);
  let cursor = 0;
  const nonSun = ordinary.slice(1);
  const initial = Array.from({ length: 30 }, (_, index) => removed.has(index) ? 'sun' : nonSun[cursor++ % 5]);
  const refill = ['moon', 'gem', 'lotus', 'feather', 'scarab', 'moon', 'gem', 'lotus'];
  const result = resolveSpin(frozenState(), { random: classicSequence(initial, refill) });
  assert.equal(result.frames.length, 2);
  assert.deepEqual(result.frames[0].cleared, [...removed].sort((a, b) => a - b));
  for (let column = 0; column < 6; column += 1) {
    const survivors = Array.from({ length: 5 }, (_, row) => row * 6 + column)
      .filter((index) => !removed.has(index)).map((index) => initial[index]);
    const finalColumn = Array.from({ length: 5 }, (_, row) => result.finalBoard[row * 6 + column]);
    if (survivors.length > 0) assert.deepEqual(finalColumn.slice(-survivors.length), survivors);
  }
});

test('a fixed RNG cannot cause an unbounded cascade; terminal matches are unpaid', () => {
  let calls = 0;
  const result = resolveSpin(frozenState(), { random: () => { calls += 1; return 0; } });
  assert.equal(calls, 211);
  assert.equal(result.frames.length, 7);
  assert.equal(result.frames.filter((frame) => frame.win > 0).length, 6);
  assert.equal(result.baseWin, 630);
  assert.equal(result.state.balance, 10530);
  assert.equal(result.hitCascadeLimit, true);
  assert.deepEqual(result.frames.at(-1), terminal(Array(30).fill('sun')));
  const endedNaturally = resolveSpin(frozenState(), {
    random: classicSequence(Array(30).fill('sun'), [...Array(150).fill('sun'), ...quiet]),
  });
  assert.equal(endedNaturally.baseWin, 630);
  assert.equal(endedNaturally.hitCascadeLimit, false);
});

test('both games use the documented base-multiplier probability boundaries', () => {
  for (const mode of ['classic', 'temple']) {
    for (const [draw, multiplier] of [[0, 1], [0.649999, 1], [0.65, 2], [0.849999, 2], [0.85, 3], [0.949999, 3], [0.95, 5], [0.999999, 5]]) {
      const draws = [...asDraws(tripleMatch), draw];
      if (mode === 'temple') draws.push(0.99); // No split.
      draws.push(...asDraws(evenRefill));
      if (mode === 'temple') draws.push(0.99); // No lock.
      const result = resolveSpin(frozenState({ mode }), { random: sequence(draws) });
      assert.equal(result.initialMultiplier, multiplier);
      assert.equal(result.multiplier, multiplier);
      assert.equal(result.baseWin, 130);
      assert.equal(result.frames[0].win, 130);
      assert.equal(result.frames[0].payout, 130 * multiplier);
      assert.equal(result.totalWin, 130 * multiplier);
      assert.equal(result.state.balance, 9900 + 130 * multiplier);
      assert.equal(result.lockAwarded, false);
      assert.equal(result.state.lockedRounds, 0);
    }
  }
});

test('symbol-weight boundaries and invalid RNG results are deterministic', () => {
  for (const [draw, id] of [[0, 'sun'], [0.21, 'moon'], [0.4, 'gem'], [0.57, 'lotus'], [0.72, 'feather'], [0.85, 'scarab'], [0.96, 'seal']]) {
    const result = resolveSpin(frozenState(), { random: () => draw });
    assert.equal(result.initialBoard[0], id);
  }
  for (const value of [-1, 1, NaN, Infinity, '0', null]) {
    assert.throws(() => resolveSpin(frozenState(), { random: () => value }), { code: 'INVALID_RANDOM' });
  }
  assert.throws(() => resolveSpin(frozenState(), { random: null }), { code: 'INVALID_RANDOM' });
});

test('invalid states are rejected instead of producing negative or nonfinite points', () => {
  for (const patch of [{ balance: -1 }, { balance: Infinity }, { freeSpins: -1 }, { bet: 1 },
    { board: [] }, { board: new Array(30) }, { lockedMultiplier: 21 },
    { lockedRounds: 3 }, { lockedMultiplier: 2 }, { lockedRounds: 1, lockedMultiplier: 2 }]) {
    assert.throws(() => resolveSpin({ ...createGameState(), ...patch }), { code: 'INVALID_STATE' });
  }
});

test('temple splits affect their own frame and later frames, never earlier payouts', () => {
  const random = sequence([
    ...Array(30).fill(centers.sun), 0.7, // Start at 2x.
    0.2, ...Array(30).fill(centers.moon), // Exactly 20% does not split.
    0.199999, ...asDraws(quiet), // This frame splits to 4x.
    0.99, // Do not award a lock.
  ]);
  const result = resolveSpin(frozenState({ mode: 'temple' }), { random });
  assert.deepEqual(result.frames.slice(0, -1).map(({ win, initialMultiplier, multiplier, payout, splitBoolean }) =>
    ({ win, initialMultiplier, multiplier, payout, splitBoolean })), [
    { win: 105, initialMultiplier: 2, multiplier: 2, payout: 210, splitBoolean: false },
    { win: 140, initialMultiplier: 2, multiplier: 4, payout: 560, splitBoolean: true },
  ]);
  assert.equal(result.baseWin, 245);
  assert.equal(result.totalWin, 770);
  assert.notEqual(result.totalWin, result.baseWin * result.multiplier);
  assert.equal(result.totalWin, result.frames.reduce((sum, frame) => sum + frame.payout, 0));
  assert.equal(result.state.balance, 10670);
});

test('temple split multiplier is capped at 20 and never reports a fake increase at the cap', () => {
  const draws = [...Array(30).fill(centers.sun), 0.96]; // Base 5x.
  for (let index = 0; index < 6; index += 1) {
    draws.push(0.1, ...(index === 5 ? asDraws(quiet) : Array(30).fill(centers.sun)));
  }
  draws.push(0.99);
  const result = resolveSpin(frozenState({ mode: 'temple' }), { random: sequence(draws) });
  assert.deepEqual(result.frames.slice(0, -1).map((frame) => frame.multiplier), [10, 20, 20, 20, 20, 20]);
  assert.deepEqual(result.frames.slice(0, -1).map((frame) => frame.splitBoolean), [true, true, false, false, false, false]);
  assert.equal(result.multiplier, 20);
  assert.equal(result.totalWin, 11550);
  assert.equal(result.hitCascadeLimit, false);
});

test('a scoring unlocked temple round can lock its final multiplier for the next two rounds', () => {
  for (const [lockRoll, expected] of [[0.149999, true], [0.15, false]]) {
    const result = resolveSpin(frozenState({ mode: 'temple' }), {
      random: sequence([...asDraws(tripleMatch), 0.85, 0.1, ...asDraws(evenRefill), lockRoll]),
    });
    assert.equal(result.initialMultiplier, 3);
    assert.equal(result.multiplier, 6);
    assert.equal(result.lockUsed, false);
    assert.equal(result.lockAwarded, expected);
    assert.equal(result.lockedRounds, expected ? 2 : 0);
    assert.equal(result.state.lockedMultiplier, expected ? 6 : 1);
    assert.equal(result.state.lockedRounds, expected ? 2 : 0);
  }
  // No scoring means no split or lock draw at all.
  const quietRound = resolveSpin(frozenState({ mode: 'temple' }), {
    random: sequence([...asDraws(quiet), 0.95]),
  });
  assert.equal(quietRound.lockAwarded, false);
});

test('two existing locked rounds are consumed by free/no-win rounds and cannot refresh themselves', () => {
  const state = frozenState({ mode: 'temple', lockedMultiplier: 3, lockedRounds: 2,
    freeSpins: 2, balance: 0 });
  const first = resolveSpin(state, { random: sequence(asDraws(quiet)) });
  assert.equal(first.lockUsed, true);
  assert.equal(first.initialMultiplier, 3);
  assert.equal(first.charged, 0);
  assert.equal(first.state.lockedRounds, 1);
  assert.equal(first.state.lockedMultiplier, 3);
  assert.equal(first.state.freeSpins, 1);
  const second = resolveSpin(first.state, {
    random: sequence([...asDraws(tripleMatch), 0.1, ...asDraws(evenRefill)]),
  });
  assert.equal(second.initialMultiplier, 3);
  assert.equal(second.multiplier, 6);
  assert.equal(second.totalWin, 780);
  assert.equal(second.charged, 0);
  assert.equal(second.lockAwarded, false);
  assert.equal(second.state.lockedRounds, 0);
  assert.equal(second.state.lockedMultiplier, 1);
  assert.equal(second.state.freeSpins, 0);
  const third = resolveSpin(second.state, { random: sequence([...asDraws(quiet), 0.95]) });
  assert.equal(third.lockUsed, false);
  assert.equal(third.initialMultiplier, 5);
  assert.equal(state.lockedRounds, 2);
  assert.equal(state.freeSpins, 2);
});

test('splitting an active lock does not overwrite the multiplier reserved for its remaining round', () => {
  const result = resolveSpin(frozenState({ mode: 'temple', lockedMultiplier: 4, lockedRounds: 2 }), {
    random: sequence([...asDraws(tripleMatch), 0.1, ...asDraws(evenRefill)]),
  });
  assert.equal(result.initialMultiplier, 4);
  assert.equal(result.multiplier, 8);
  assert.equal(result.totalWin, 1040);
  assert.equal(result.state.lockedRounds, 1);
  assert.equal(result.state.lockedMultiplier, 4);
  assert.equal(result.lockAwarded, false);
});

test('buying five free rounds charges exactly once without consuming an existing lock or round', () => {
  const state = frozenState({ mode: 'temple', lockedMultiplier: 4, lockedRounds: 2,
    round: 7, totalWin: 250 });
  const purchased = buyFreeSpins(state);
  assert.equal(purchased.balance, 0);
  assert.equal(purchased.freeSpins, 5);
  assert.equal(purchased.round, 7);
  assert.equal(purchased.totalWin, 250);
  assert.equal(purchased.lockedRounds, 2);
  assert.equal(purchased.lockedMultiplier, 4);
  assert.notStrictEqual(purchased.board, state.board);
  assert.equal(state.balance, 10000);
  assert.throws(() => buyFreeSpins(purchased), { code: 'FREE_SPINS_ACTIVE' });
  assert.throws(() => setBet(purchased, 20), { code: 'FREE_SPINS_ACTIVE' });
  let current = purchased;
  for (let index = 0; index < 5; index += 1) {
    const draws = [...asDraws(quiet)];
    if (index >= 2) draws.push(0);
    const result = resolveSpin(current, { random: sequence(draws) });
    assert.equal(result.charged, 0);
    assert.equal(result.state.balance, 0);
    current = result.state;
  }
  assert.equal(current.freeSpins, 0);
  assert.equal(current.round, 12);
  assert.equal(current.lockedRounds, 0);
  assert.throws(() => resolveSpin(current), { code: 'INSUFFICIENT_FUNDS' });
});

test('buying requires full funds and cannot stack with naturally awarded free rounds', () => {
  const state = frozenState({ bet: 200, balance: 19999 });
  assert.throws(() => buyFreeSpins(state), { code: 'INSUFFICIENT_FUNDS' });
  assert.equal(state.balance, 19999);
  assert.equal(buyFreeSpins(frozenState({ bet: 20 })).balance, 8000);
  const natural = resolveSpin(frozenState(), { random: () => centers.seal });
  assert.equal(natural.state.freeSpins, 5);
  assert.throws(() => buyFreeSpins(natural.state), { code: 'FREE_SPINS_ACTIVE' });
});

test('legacy local states receive safe lock defaults without mutation and explicit invalid locks are rejected', () => {
  const legacy = createGameState();
  delete legacy.lockedMultiplier;
  delete legacy.lockedRounds;
  Object.freeze(legacy.board);
  Object.freeze(legacy);
  const result = resolveSpin(legacy, { random: classicSequence(quiet) });
  assert.equal(result.state.lockedRounds, 0);
  assert.equal(result.state.lockedMultiplier, 1);
  assert.equal('lockedRounds' in legacy, false);
  for (const patch of [
    { lockedMultiplier: 0, lockedRounds: 1 }, { lockedMultiplier: 1.5, lockedRounds: 1 },
    { lockedMultiplier: 21, lockedRounds: 1 }, { lockedMultiplier: 2, lockedRounds: 3 },
    { lockedMultiplier: 2, lockedRounds: 0 }, { lockedMultiplier: null, lockedRounds: 1 },
  ]) {
    assert.throws(() => buyFreeSpins({ ...createGameState('temple'), ...patch }), { code: 'INVALID_STATE' });
  }
});

test('default RNG uses Web Crypto and falls back safely if unavailable or throwing', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalRandom = Math.random;
  try {
    for (const scenario of ['crypto', 'missing', 'throwing']) {
      let mathCalls = 0;
      Math.random = () => { mathCalls += 1; return 0.99; };
      const crypto = scenario === 'missing' ? undefined : {
        getRandomValues(array) {
          if (scenario === 'throwing') throw new Error('unavailable');
          array[0] = 0xffffffff;
          return array;
        },
      };
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: crypto });
      const state = frozenState();
      const result = resolveSpin(state);
      assert.ok(result.initialBoard.every((id) => id === 'seal'));
      assert.equal(result.multiplier, 5);
      assert.equal(result.state.balance, 9900);
      assert.equal(mathCalls, scenario === 'crypto' ? 0 : 31);
      assert.equal(state.balance, 10000);
    }
  } finally {
    Math.random = originalRandom;
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});
