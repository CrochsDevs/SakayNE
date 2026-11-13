// Keep only one loader running, including across blur/refocus and manual refreshes.
export function createPoller({ load, onData, onError, onSettled, delay = 5000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const normalizeDelay = value => Math.max(250, Number.isFinite(value) ? value : 5000);
  let interval = normalizeDelay(delay);
  let active = false, generation = 0, timer = null, flight = null, queued = null, failures = 0;
  const clear = () => { if (timer !== null) clearTimer(timer); timer = null; };
  function schedule() {
    if (!active || queued || timer !== null) return;
    timer = setTimer(() => { timer = null; void run(); }, Math.min(Math.max(30000, interval), interval * 2 ** Math.min(failures, 8)));
  }
  function run() {
    if (!active) return Promise.resolve();
    if (flight) return flight;
    const started = generation;
    const current = () => active && started === generation;
    const task = Promise.resolve().then(load).then(value => {
      if (current()) { failures = 0; onData(value); }
    }).catch(error => {
      if (current()) { failures++; onError(error); }
    }).finally(() => {
      if (flight === task) flight = null;
      if (current()) { onSettled(); schedule(); }
    });
    flight = task;
    return task;
  }
  function refresh() {
    if (!active) return Promise.resolve();
    clear();
    if (!flight) return run();
    // A mutation's refresh must load after the older request, not silently skip it.
    if (!queued) queued = flight.then(() => { queued = null; return run(); });
    return queued;
  }
  return {
    setDelay(value) { interval = normalizeDelay(value); if (active && !flight) { clear(); schedule(); } },
    start() { if (active) return flight || Promise.resolve(); active = true; generation++; failures = 0; return refresh(); },
    stop() { active = false; generation++; clear(); },
    refresh,
  };
}
