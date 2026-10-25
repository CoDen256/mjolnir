import { runPublish } from "./pipeline.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// D78: a nightly clock, plus the manual button (server.js). No-op (no
// build_jobs row) if no deck has crossed the floor — enforced by runPublish
// itself, not duplicated here.
export function startNightlyClock(pool, config, { intervalMs = ONE_DAY_MS } = {}) {
  const tick = async () => {
    try {
      const result = await runPublish(pool, config);
      if (result.published) {
        console.log(`nightly run published ${result.buildId}: ${JSON.stringify(result.decksMinted)}`);
      } else {
        console.log("nightly run: no deck crossed the floor, nothing published");
      }
    } catch (err) {
      console.error("nightly run failed:", err);
    }
  };
  const timer = setInterval(tick, intervalMs);
  return { stop: () => clearInterval(timer), runNow: tick };
}
