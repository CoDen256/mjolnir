import { runPublish } from "./pipeline.js";
import { buildGrammarRuleLookup } from "./stabburClient.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// D78: a nightly clock, plus the manual button (server.js). No-op (no
// build_jobs row) if no deck has any newly-eligible note (D91 — no floor) —
// enforced by runPublish itself, not duplicated here.
export function startNightlyClock(pool, config, { intervalMs = ONE_DAY_MS } = {}) {
  const tick = async () => {
    try {
      // D89: fetch stabbur's grammar rules once per run, not once per note.
      const grammarRuleLookup = await buildGrammarRuleLookup({ baseUrl: config.stabburBaseUrl, authToken: config.stabburAuthToken });
      const result = await runPublish(pool, { ...config, grammarRuleLookup });
      if (result.published) {
        console.log(`nightly run published ${result.buildId}: ${JSON.stringify(result.decksMinted)}`);
      } else {
        console.log("nightly run: no newly-eligible notes, nothing published");
      }
    } catch (err) {
      console.error("nightly run failed:", err);
    }
  };
  const timer = setInterval(tick, intervalMs);
  return { stop: () => clearInterval(timer), runNow: tick };
}
