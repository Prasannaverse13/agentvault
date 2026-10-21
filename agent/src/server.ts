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
    llm: Boolean(config.openaiKey),
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
