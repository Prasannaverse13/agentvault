import { buildServer } from "./server.js";
import { config } from "./config.js";
import { startTelegram, notify } from "./telegram.js";
import { runCheck } from "./monitor.js";
import { store } from "./store.js";
import { watchlist } from "./watchlist.js";
import { history } from "./history.js";

async function main() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });

  const initialVaults = watchlist.list();
  store.add({
    vault: initialVaults[0] ?? "system",
    type: "boot",
    title: "AgentVault agent online",
    detail: initialVaults.length
      ? `Watching ${initialVaults.length} vault(s) on ${config.chain.name}`
      : "No vault configured yet",
  });

  startTelegram();

  // Free hosts (Render) sleep after ~15 minutes without inbound traffic. While awake, the
  // agent pings its own public URL so it keeps watching vaults. RENDER_EXTERNAL_URL is set by Render.
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    setInterval(() => {
      void fetch(`${selfUrl.replace(/\/$/, "")}/api/health`).catch(() => undefined);
    }, 8 * 60 * 1000);
  }

  const tick = async () => {
    for (const vault of watchlist.list()) {
      try {
        const result = await runCheck(vault);
        const v = result.vault;
        if (v.debt > 0n) history.record(vault, {
          t: Date.now(),
          price: Number(v.price) / 1e18,
          icr: Number(v.icr) / 1e16,
          coll: Number(v.coll) / 1e18,
          debt: Number(v.debt) / 1e18,
          buffer: Number(v.btcBuffer) / 1e18,
          reserve: Number(v.musdReserve) / 1e18,
        });
        if (result.executed) {
          console.log(`Protected ${vault}: ${result.txHash}`);
        }
      } catch (error) {
        console.error(`Check failed for ${vault}`, error);
      }
    }
  };

  await tick();
  setInterval(tick, config.pollMs);

  if (initialVaults.length > 0) {
    await notify(
      `AgentVault is online.\nWatching ${initialVaults.join(", ")}\nDashboard: ${config.publicUrl}`,
    );
  }

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
