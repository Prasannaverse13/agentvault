import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Address } from "viem";
import { config } from "./config.js";
import { agentAccount, readPrice, readVault } from "./chain.js";
import { decide } from "./rules.js";
import { simulate, type Scenario } from "./simulator.js";
import { snapshotView, decisionView } from "./view.js";
import { runCheck, registerVault } from "./monitor.js";
import { handleChat } from "./chat.js";
import { store } from "./store.js";
import { watchlist } from "./watchlist.js";
import { history } from "./history.js";
import { assessRisk } from "./risk.js";
import { notify } from "./telegram.js";
import { demoEnabled, fundWallet, marketState, resetMarketPrice, setMarketPrice } from "./demo.js";

function isAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/api/health", async () => ({
    ok: true,
    chainId: config.chain.chainId,
    network: config.chain.name,
    agent: agentAccount?.address ?? null,
    execute: config.execute,
    vaults: watchlist.list(),
    telegram: Boolean(config.telegramToken),
    telegramChat: Boolean(config.telegramToken && config.telegramChatId),
    llm: Boolean(config.openaiKey),
    llmModel: config.openaiKey ? config.openaiModel : null,
    demo: demoEnabled,
    pollMs: config.pollMs,
  }));

  app.get("/api/watch", async () => ({ vaults: watchlist.list() }));

  app.post<{ Body: { vault: string } }>("/api/watch", async (request, reply) => {
    const { vault } = request.body ?? {};
    if (!vault || !isAddress(vault)) {
      return reply.code(400).send({ error: "Invalid vault address" });
    }
    try {
      const result = await registerVault(vault);
      if (!result.ok) return reply.code(403).send({ error: result.error });
      await runCheck(vault);
      return { ok: true, vault, vaults: watchlist.list() };
    } catch (error) {
      return reply.code(502).send({
        error: error instanceof Error ? error.message : "Could not watch vault",
      });
    }
  });

  app.delete<{ Params: { vault: string } }>("/api/watch/:vault", async (request) => {
    watchlist.remove(request.params.vault);
    return { ok: true, vaults: watchlist.list() };
  });

  app.get("/api/config", async () => ({
    chain: config.chain,
    core: config.core,
    factory: config.factoryAddress ?? null,
    agent: agentAccount?.address ?? null,
    execute: config.execute,
    demo: demoEnabled,
  }));

  app.get<{ Params: { vault: string } }>("/api/status/:vault", async (request, reply) => {
    const { vault } = request.params;
    if (!isAddress(vault)) return reply.code(400).send({ error: "Invalid vault address" });
    try {
      const snapshot = await readVault(vault);
      const decision = decide(
        {
          coll: snapshot.coll,
          debt: snapshot.debt,
          price: snapshot.price,
          buffer: snapshot.btcBuffer,
          reserve: snapshot.musdReserve,
        },
        {
          triggerICR: snapshot.triggerICR,
          targetICR: snapshot.targetICR,
          autoProtect: snapshot.autoProtect,
        },
      );
      return {
        position: snapshotView(snapshot),
        decision: decisionView(decision),
        events: store.list(vault, 25),
      };
    } catch (error) {
      return reply.code(502).send({
        error: error instanceof Error ? error.message : "Could not read vault",
      });
    }
  });

  app.get<{ Params: { vault: string }; Querystring: { limit?: string } }>(
    "/api/events/:vault",
    async (request) => ({
      events: store.list(request.params.vault, Number(request.query.limit ?? 50)),
    }),
  );

  app.get<{ Params: { vault: string }; Querystring: { limit?: string } }>(
    "/api/history/:vault",
    async (request, reply) => {
      const { vault } = request.params;
      if (!isAddress(vault)) return reply.code(400).send({ error: "Invalid vault address" });
      return { points: history.list(vault, Number(request.query.limit ?? 240)) };
    },
  );

  app.get<{ Params: { vault: string } }>("/api/risk/:vault", async (request, reply) => {
    const { vault } = request.params;
    if (!isAddress(vault)) return reply.code(400).send({ error: "Invalid vault address" });
    try {
      const s = await readVault(vault);
      return assessRisk({
        coll: s.coll,
        debt: s.debt,
        price: s.price,
        buffer: s.btcBuffer,
        reserve: s.musdReserve,
        rules: { triggerICR: s.triggerICR, targetICR: s.targetICR, autoProtect: s.autoProtect },
      });
    } catch (error) {
      return reply.code(502).send({
        error: error instanceof Error ? error.message : "Could not assess risk",
      });
    }
  });

  app.post("/api/notify/test", async () => {
    const configured = Boolean(config.telegramToken && config.telegramChatId);
    const sent = configured
      ? await notify("AgentVault test alert: Telegram notifications are working.")
      : false;
    return { configured, sent };
  });

  // ---- Local demo network only: free funds and a movable BTC price. ----

  app.get("/api/demo/market", async (_request, reply) => {
    if (!demoEnabled) return reply.code(404).send({ error: "Not available on this network" });
    return marketState();
  });

  app.post<{ Body: { price?: number; changePct?: number; reset?: boolean } }>(
    "/api/demo/price",
    async (request, reply) => {
      if (!demoEnabled) return reply.code(404).send({ error: "Not available on this network" });
      const { price, changePct, reset } = request.body ?? {};
      try {
        let market;
        if (reset) {
          market = await resetMarketPrice();
        } else if (typeof price === "number") {
          market = await setMarketPrice(price);
        } else if (typeof changePct === "number") {
          const current = await marketState();
          market = await setMarketPrice(current.price * (1 + changePct / 100));
        } else {
          return reply.code(400).send({ error: "Provide price, changePct or reset" });
        }
        store.add({
          vault: watchlist.list()[0] ?? "system",
          type: "decision",
          title: `Market price set to $${Math.round(market.price).toLocaleString("en-US")}`,
          detail: "Demo network: BTC oracle moved to test the agent",
        });
        // React immediately instead of waiting for the next poll.
        void Promise.all(watchlist.list().map((v) => runCheck(v).catch(() => undefined)));
        return market;
      } catch (error) {
        return reply.code(502).send({
          error: error instanceof Error ? error.message : "Could not move the price",
        });
      }
    },
  );

  app.post<{ Body: { address?: string; amount?: number } }>(
    "/api/demo/faucet",
    async (request, reply) => {
      if (!demoEnabled) return reply.code(404).send({ error: "Not available on this network" });
      const { address, amount } = request.body ?? {};
      if (!address || !isAddress(address)) {
        return reply.code(400).send({ error: "Invalid address" });
      }
      try {
        return await fundWallet(address, Math.min(Number(amount) || 100, 1000));
      } catch (error) {
        return reply.code(502).send({
          error: error instanceof Error ? error.message : "Faucet failed",
        });
      }
    },
  );

  app.post<{
    Body: {
      vault: string;
      scenario?: Scenario;
      crashPct?: number;
      steps?: number;
    };
  }>("/api/simulate", async (request, reply) => {
    const { vault, scenario = "crash", crashPct, steps } = request.body ?? {};
    if (!vault || !isAddress(vault)) {
      return reply.code(400).send({ error: "Invalid vault address" });
    }
    if (!["crash", "dip", "blackswan", "custom"].includes(scenario)) {
      return reply.code(400).send({ error: "Unknown scenario" });
    }
    try {
      const snapshot = await readVault(vault);
      if (snapshot.status !== 1 || snapshot.debt === 0n || snapshot.coll === 0n) {
        return reply.code(400).send({ error: "No active loan to simulate. Open a loan first." });
      }
      const result = simulate({
        coll: snapshot.coll,
        debt: snapshot.debt,
        price: snapshot.price,
        buffer: snapshot.btcBuffer,
        reserve: snapshot.musdReserve,
        rules: {
          triggerICR: snapshot.triggerICR,
          targetICR: snapshot.targetICR,
          autoProtect: snapshot.autoProtect,
        },
        scenario,
        crashPct,
        steps,
      });
      store.add({
        vault,
        type: "simulation",
        kind: scenario,
        title: `${scenario} simulation (-${result.crashPct}% BTC)`,
        detail: result.summary.baselineLiquidated
          ? result.summary.agentLiquidated
            ? "Agent could not save the loan"
            : "Agent saved the loan"
          : "No liquidation in either path",
        data: result.summary,
      });
      return result;
    } catch (error) {
      return reply.code(502).send({
        error: error instanceof Error ? error.message : "Simulation failed",
      });
    }
  });

  app.post<{ Body: { scenario?: Scenario; crashPct?: number } }>(
    "/api/demo/simulate",
    async (request, reply) => {
      const { scenario = "crash", crashPct } = request.body ?? {};
      try {
        const price = await readPrice();
        const ONE = 10n ** 18n;
        const position = {
          coll: ONE,
          debt: 50_000n * ONE,
          price,
          buffer: ONE / 5n,
          reserve: 5_000n * ONE,
          rules: {
            // 166.67% ICR (60% LTV). ICR is stored with 1e18 = 100%.
            triggerICR: 1_666_666_666_666_666_666n,
            targetICR: 2n * ONE,
            autoProtect: true,
          },
        };
        const result = simulate({
          ...position,
          scenario,
          crashPct,
        });
        return {
          demo: true,
          position: {
            coll: 1,
            debt: 50_000,
            price: Number(price) / 1e18,
            icr: Number((position.coll * price) / position.debt) / 1e16,
            ltv: Number((position.debt * ONE) / (position.coll * price)) / 1e16,
            btcBuffer: 0.2,
            musdReserve: 5_000,
            triggerICR: 166.66666666666666,
            targetICR: 200,
          },
          result,
        };
      } catch (error) {
        return reply.code(502).send({
          error: error instanceof Error ? error.message : "Demo failed",
        });
      }
    },
  );

  app.post<{ Body: { vault: string; message: string } }>("/api/chat", async (request, reply) => {
    const { vault, message } = request.body ?? {};
    if (!vault || !isAddress(vault)) {
      return reply.code(400).send({ error: "Invalid vault address" });
    }
    if (!message || typeof message !== "string") {
      return reply.code(400).send({ error: "Message required" });
    }
    try {
      return await handleChat(vault, message);
    } catch (error) {
      return reply.code(502).send({
        error: error instanceof Error ? error.message : "Chat failed",
      });
    }
  });

  app.post<{ Params: { vault: string } }>("/api/check/:vault", async (request, reply) => {
    const { vault } = request.params;
    if (!isAddress(vault)) return reply.code(400).send({ error: "Invalid vault address" });
    try {
      const result = await runCheck(vault, true);
      return {
        position: snapshotView(result.vault),
        decision: decisionView(result.decision),
        executed: result.executed,
        txHash: result.txHash ?? null,
        error: result.error ?? null,
      };
    } catch (error) {
      return reply.code(502).send({
        error: error instanceof Error ? error.message : "Check failed",
      });
    }
  });

  return app;
}
