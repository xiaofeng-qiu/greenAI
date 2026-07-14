const POLL_INTERVAL_MS = 5000;
const jobs = new Map();
let timer = null;
let tickInFlight = false;

async function tick() {
  if (tickInFlight || jobs.size === 0) return;
  if (typeof document !== "undefined" && document.hidden) return;
  tickInFlight = true;
  try {
    await Promise.allSettled(
      Array.from(jobs.values()).map((job) => Promise.resolve().then(job))
    );
  } finally {
    tickInFlight = false;
  }
}

function ensureTimer() {
  if (timer != null || jobs.size === 0) return;
  timer = setInterval(tick, POLL_INTERVAL_MS);
}

export function startSensorPolling(key, job, immediate = true) {
  jobs.set(key, job);
  ensureTimer();
  if (immediate) void tick();
}

export function stopSensorPolling(key) {
  jobs.delete(key);
  if (jobs.size === 0 && timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
