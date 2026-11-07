const RETRY_DELAYS_MS = [50, 150, 350];

/** Limit cache I/O in the Metro coordinator, independently of transform workers. */
function boundMetroCacheStores(cacheStores, { concurrency = 8 } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new TypeError('Metro cache concurrency must be a positive integer.');
  }
  let active = 0;
  const queue = [];
  const drain = () => {
    while (active < concurrency && queue.length) {
      const { operation, resolve, reject } = queue.shift();
      active++;
      Promise.resolve().then(async () => {
        for (let attempt = 0; ; attempt++) {
          try {
            return await operation();
          } catch (error) {
            if (!['EMFILE', 'ENFILE'].includes(error?.code) || attempt >= RETRY_DELAYS_MS.length) throw error;
            // Keep the slot while backing off so queued calls cannot create another burst.
            await new Promise(done => setTimeout(done, RETRY_DELAYS_MS[attempt]));
          }
        }
      }).then(resolve, reject).finally(() => {
        active--;
        drain();
      });
    }
  };
  const schedule = operation => new Promise((resolve, reject) => {
    queue.push({ operation, resolve, reject });
    drain();
  });
  const wrap = stores => {
    if (!Array.isArray(stores)) throw new TypeError('Metro cacheStores must be an array.');
    return stores.map(store => {
      if (!store || ['get', 'set', 'clear'].some(method => typeof store[method] !== 'function')) {
        throw new TypeError('Metro cache stores must implement get, set and clear.');
      }
      return {
        name: store.name ?? store.constructor?.name ?? 'CacheStore',
        get(...args) { return schedule(() => store.get(...args)); },
        set(...args) { return schedule(() => store.set(...args)); },
        // Metro calls clear synchronously before starting the graph. Preserve that contract.
        clear(...args) { return store.clear(...args); },
      };
    });
  };
  if (typeof cacheStores === 'function') {
    return function (...args) { return wrap(cacheStores.apply(this, args)); };
  }
  return wrap(cacheStores);
}

module.exports = { boundMetroCacheStores };
