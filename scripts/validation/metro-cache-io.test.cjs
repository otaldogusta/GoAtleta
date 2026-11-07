const test = require('node:test');
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { boundMetroCacheStores } = require('../metro-cache-io.cjs');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const turn = () => new Promise(done => setImmediate(done));
const errorWithCode = code => Object.assign(new Error(code), { code });
const stubStore = (overrides = {}) => ({ get() { return null; }, set() {}, clear() {}, ...overrides });

test('a cache-read burst reproduces EMFILE without a bound and succeeds with eight shared slots', async () => {
  const createStores = () => {
    let active = 0, peak = 0;
    const run = async value => {
      if (active >= 8) throw errorWithCode('EMFILE');
      peak = Math.max(peak, ++active);
      try { await turn(); return value; } finally { active--; }
    };
    return { stores: [0, 1].map(() => stubStore({ get: run, set: run })), peak: () => peak };
  };
  const baseline = createStores();
  const failed = await Promise.allSettled(Array.from({ length: 160 }, (_, index) => baseline.stores[index % 2].get(index)));
  assert.ok(failed.some(result => result.status === 'rejected' && result.reason.code === 'EMFILE'));

  const bounded = createStores(), stores = boundMetroCacheStores(bounded.stores);
  const values = await Promise.all(Array.from({ length: 160 }, (_, index) => stores[index % 2][index % 3 ? 'get' : 'set'](index)));
  assert.deepEqual(values, Array.from({ length: 160 }, (_, index) => index));
  assert.equal(bounded.peak(), 8);
});

test('the shared queue is FIFO and drains after asynchronous and synchronous failures', async () => {
  const starts = [], gates = Array.from({ length: 5 }, deferred), failure = new Error('read failed');
  const [store] = boundMetroCacheStores([stubStore({ get(index) {
    starts.push(index);
    if (index === 2) throw failure;
    return gates[index].promise;
  } })], { concurrency: 2 });
  const results = Array.from({ length: 5 }, (_, index) => store.get(index));
  const settled = Promise.allSettled(results);
  await turn(); assert.deepEqual(starts, [0, 1]);
  gates[0].resolve('first'); await turn(); assert.deepEqual(starts, [0, 1, 2, 3]);
  gates[1].reject(failure); await turn(); assert.deepEqual(starts, [0, 1, 2, 3, 4]);
  gates[3].resolve('fourth'); gates[4].resolve('fifth');
  const values = await settled;
  assert.equal(values[0].value, 'first');
  assert.equal(values[1].reason, failure); assert.equal(values[2].reason, failure);
  assert.equal(values[3].value, 'fourth'); assert.equal(values[4].value, 'fifth');
});

test('get/set preserve Buffer keys, values, misses, original context and explicit names', async () => {
  const key = Buffer.from('key'), buffer = Buffer.from([0, 1, 255]), object = { buffer };
  const original = stubStore({ name: 'Original cache', value: null,
    get(actual) { assert.equal(this, original); assert.equal(actual, key); return this.value; },
    set(actual, value) { assert.equal(this, original); assert.equal(actual, key); this.value = value; },
  });
  const [store] = boundMetroCacheStores([original]);
  assert.equal(store.name, original.name);
  assert.equal(await store.get(key), null);
  for (const value of [undefined, buffer, object, false, 0]) {
    assert.equal(await store.set(key, value), undefined);
    assert.equal(await store.get(key), value);
  }
});

test('clear remains immediate and preserves sync return, Promise, context and errors', async () => {
  const gate = deferred(), marker = {}, failure = new Error('clear failed');
  let clears = 0, result = marker;
  const original = stubStore({ get() { return gate.promise; }, clear(arg) {
    assert.equal(this, original); assert.equal(arg, marker); clears++;
    if (result === failure) throw failure;
    return result;
  } });
  const [store] = boundMetroCacheStores([original], { concurrency: 1 });
  const reading = store.get(Buffer.alloc(1)); await turn();
  assert.equal(store.clear(marker), marker); assert.equal(clears, 1);
  const promise = Promise.resolve(); result = promise; assert.equal(store.clear(marker), promise);
  result = failure; assert.throws(() => store.clear(marker), error => error === failure);
  gate.resolve(null); await reading;
});

test('only handle-exhaustion errors retry, with a finite budget and no slot released during backoff', async () => {
  const starts = [], temporary = errorWithCode('EMFILE'), terminal = errorWithCode('ENFILE');
  let firstAttempts = 0, terminalAttempts = 0;
  const [store] = boundMetroCacheStores([stubStore({ get(key) {
    starts.push(key);
    if (key === 'temporary' && firstAttempts++ < 2) throw temporary;
    if (key === 'terminal') { terminalAttempts++; return Promise.reject(terminal); }
    return key;
  } })], { concurrency: 1 });
  assert.deepEqual(await Promise.all([store.get('temporary'), store.get('next')]), ['temporary', 'next']);
  assert.deepEqual(starts, ['temporary', 'temporary', 'temporary', 'next']);
  await assert.rejects(store.get('terminal'), error => error === terminal);
  assert.equal(terminalAttempts, 4);
  assert.equal(await store.get('after'), 'after');
});

test('ordinary errors propagate once without turning corruption, permissions or misses into successes', async () => {
  for (const code of ['ENOENT', 'EACCES', 'EIO', undefined]) {
    const failure = errorWithCode(code); let calls = 0;
    const [store] = boundMetroCacheStores([stubStore({ get() { calls++; throw failure; } })]);
    await assert.rejects(store.get(Buffer.alloc(1)), error => error === failure);
    assert.equal(calls, 1);
  }
});

test('factory cacheStores retain their call context, arguments, ordering and input array', async () => {
  const owner = {}, argument = {}, first = stubStore(), second = stubStore(), originals = [first, second];
  const factory = boundMetroCacheStores(function (actual) { assert.equal(this, owner); assert.equal(actual, argument); return originals; });
  const stores = factory.call(owner, argument);
  assert.equal(stores.length, 2); assert.deepEqual(originals, [first, second]);
  assert.notEqual(stores[0], first); assert.notEqual(stores[1], second);
  assert.equal(await stores[0].get(Buffer.alloc(1)), null);
});

test('invalid bounds and incompatible stores fail immediately', () => {
  for (const concurrency of [0, -1, NaN, Infinity, 1.5]) assert.throws(() => boundMetroCacheStores([], { concurrency }), TypeError);
  assert.throws(() => boundMetroCacheStores(null), TypeError);
  assert.throws(() => boundMetroCacheStores([{}]), TypeError);
});

test('the installed Expo BinaryFileStore round-trips cache data and misses through the bound', async () => {
  const { FileStore } = require(join(dirname(require.resolve('@expo/metro-config/package.json')), 'build/binary-file-store.js'));
  const root = mkdtempSync(join(tmpdir(), 'goatleta-metro-cache-test-'));
  try {
    const [store] = boundMetroCacheStores([new FileStore({ root })]);
    const values = Array.from({ length: 48 }, (_, index) => ({ key: Buffer.from([index, 1, 2, 3]), value: { path: `fixture-${index}.js`, buffer: Buffer.from([index, 0, 255]), output: [{ data: { code: `module.exports=${index}` } }] } }));
    await Promise.all(values.map(({ key, value }) => store.set(key, value)));
    const loaded = await Promise.all(values.map(({ key }) => store.get(key)));
    assert.deepEqual(loaded, values.map(({ value }) => value));
    assert.equal(await store.get(Buffer.from([255, 255, 255])), null);
    assert.equal(store.name, 'BinaryFileStore');
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});
