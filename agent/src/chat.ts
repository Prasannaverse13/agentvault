import type { Address } from "viem";
import { config } from "./config.js";
import { readVault } from "./chain.js";
import { decide } from "./rules.js";
import { simulate, type Scenario } from "./simulator.js";
import { snapshotView, decisionView } from "./view.js";
import { store } from "./store.js";

export type RulePatch = {
  triggerICR: string;
  targetICR: string;
  autoProtect: boolean;
};

export type ChatResponse = {
  reply: string;
  rulePatch: RulePatch | null;
  simulate: Scenario | null;
  source: "llm" | "rules";
};

const SCENARIOS: Scenario[] = ["crash", "dip", "blackswan"];

function toICR(ltv: number): number {
  return 100 / ltv;
}

function validICR(value: number): boolean {
  return Number.isFinite(value) && value > 1.1 && value <= 10;
}

function normalizePatch(input: unknown): RulePatch | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const trigger = Number(raw.triggerICR);
  const target = Number(raw.targetICR ?? raw.triggerICR);
  if (!validICR(trigger) || !validICR(target) || target < trigger) return null;
  return {
    triggerICR: trigger.toFixed(4),
    targetICR: target.toFixed(4),
    autoProtect: raw.autoProtect === undefined ? true : Boolean(raw.autoProtect),
  };
}

async function callLLM(
  message: string,
  context: Record<string, unknown>,
): Promise<ChatResponse | null> {
  if (!config.openaiKey) return null;
  const system = [
    "You are AgentVault, an assistant for a BTC-backed MUSD loan on Mezo.",
    "You help the owner understand risk and configure the autonomous safety agent.",
    "Live position and rules:",
    JSON.stringify(context),
    "",
    "Return ONLY valid JSON with this shape:",
    '{"reply": string, "rulePatch": {"triggerICR": "1.54", "targetICR": "1.82", "autoProtect": true} | null, "simulate": "crash" | "dip" | "blackswan" | null}',
    "",
    "Rules:",
    "- triggerICR and targetICR are decimal ratios: 1.5 means 150% ICR. 1.1 is the liquidation threshold.",
    "- LTV percent = 100 / ICR. 60% LTV becomes ICR 1.667. Always convert LTV to ICR in rulePatch.",
    "- targetICR must be >= triggerICR and above 1.1.",
    "- Only return rulePatch when the user asks to change protection rules.",
    "- Only return simulate when the user asks to run, show, or simulate a crash/scenario.",
    "- reply must be under 70 words, concrete, no markdown tables.",
  ].join("\n");

  try {
    const response = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.openaiKey}`,
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim()) as {
      reply?: string;
      rulePatch?: unknown;
      simulate?: string;
    };
    const simulateValue =
      parsed.simulate && SCENARIOS.includes(parsed.simulate as Scenario)
        ? (parsed.simulate as Scenario)
        : null;
    return {
      reply:
        typeof parsed.reply === "string" && parsed.reply.trim()
          ? parsed.reply.trim()
          : "I am watching the position and will protect it when your rules are hit.",
      rulePatch: normalizePatch(parsed.rulePatch),
      simulate: simulateValue,
      source: "llm",
    };
  } catch {
    return null;
  }
}

function fallback(message: string, context: Record<string, unknown>): ChatResponse {
  const text = message.toLowerCase();
  const view = context.position as ReturnType<typeof snapshotView>;

  if (/(pause|stop|disable|turn off)/.test(text)) {
    return {
      reply: "Protection paused. Sign the rule update to disable the agent. Your loan will not be defended until you resume.",
      rulePatch: {
        triggerICR: (view.triggerICR / 100).toFixed(4),
        targetICR: (view.targetICR / 100).toFixed(4),
        autoProtect: false,
      },
      simulate: null,
      source: "rules",
    };
  }

  if (/(resume|start|enable|turn on)/.test(text)) {
    return {
      reply: "Protection resumed. The agent will defend the loan again at the current trigger.",
      rulePatch: {
        triggerICR: (view.triggerICR / 100).toFixed(4),
        targetICR: (view.targetICR / 100).toFixed(4),
        autoProtect: true,
      },
      simulate: null,
      source: "rules",
    };
  }

  const wantsSim = /(simulate|simulation|crash|scenario|what if|stress test)/.test(text);
  const scenario: Scenario = /black\s*swan|50|55/.test(text)
    ? "blackswan"
    : /dip|recover/.test(text)
      ? "dip"
      : "crash";

  const triggerMatch = text.match(
    /(?:max(?:imum)?|when|if|above|over|trigger|protect|top up|at)\D{0,16}(\d+(?:\.\d+)?)\s*%/,
  );
  const targetMatch = text.match(
    /(?:target|restore|back to|keep|bring|to)\D{0,16}(\d+(?:\.\d+)?)\s*%/,
  );

  let triggerICR: number | undefined;
  let targetICR: number | undefined;

  if (triggerMatch || targetMatch) {
    const isLTV = /ltv|loan[- ]to[- ]value/.test(text);
    const triggerValue = triggerMatch ? Number(triggerMatch[1]) : undefined;
    const targetValue = targetMatch ? Number(targetMatch[1]) : undefined;

    if (isLTV) {
      if (triggerValue) triggerICR = toICR(triggerValue);
      if (targetValue) targetICR = toICR(targetValue);
      if (triggerICR && !targetICR) targetICR = toICR(Math.max(10, (triggerValue ?? 60) - 5));
      if (targetICR && !triggerICR) triggerICR = toICR((targetValue ?? 60) + 5);
    } else {
      if (triggerValue) triggerICR = triggerValue / 100;
      if (targetValue) targetICR = targetValue / 100;
      if (triggerICR && !targetICR) targetICR = triggerICR + 0.2;
      if (targetICR && !triggerICR) triggerICR = Math.max(1.15, targetICR - 0.2);
    }
  }

  if (wantsSim) {
    return {
      reply: `Running a ${scenario} simulation against your live position. Watch the agent top up or repay before the liquidation line.`,
      rulePatch: null,
      simulate: scenario,
      source: "rules",
    };
  }

  if (triggerICR || targetICR) {
    const safeTrigger = triggerICR ?? (targetICR ? Math.max(1.15, targetICR - 0.2) : 1.5);
    const safeTarget = Math.max(safeTrigger, targetICR ?? safeTrigger + 0.2);
    if (!validICR(safeTrigger) || !validICR(safeTarget)) {
      return {
        reply: `That target is outside the safe range. Use an LTV between 15% and 85%.`,
        rulePatch: null,
        simulate: null,
        source: "rules",
      };
    }
    return {
      reply: `Got it: act at ${(safeTrigger * 100).toFixed(0)}% ICR (${(100 / safeTrigger).toFixed(0)}% LTV) and restore to ${(safeTarget * 100).toFixed(0)}%. Sign the rule update to activate it.`,
      rulePatch: {
        triggerICR: safeTrigger.toFixed(4),
        targetICR: safeTarget.toFixed(4),
        autoProtect: true,
      },
      simulate: null,
      source: "rules",
    };
  }

  const decision = context.decision as ReturnType<typeof decisionView>;
  return {
    reply: `ICR ${view.icr.toFixed(1)}% (${view.ltv.toFixed(1)}% LTV). ${decision.reason}. You can ask me to set a trigger, pause protection, or run a crash simulation.`,
    rulePatch: null,
    simulate: null,
    source: "rules",
  };
}

export async function handleChat(vaultAddress: Address, message: string): Promise<ChatResponse> {
  const vault = await readVault(vaultAddress);
  const decision = decide(
    {
      coll: vault.coll,
      debt: vault.debt,
      price: vault.price,
      buffer: vault.btcBuffer,
      reserve: vault.musdReserve,
    },
    {
      triggerICR: vault.triggerICR,
      targetICR: vault.targetICR,
      autoProtect: vault.autoProtect,
    },
  );

  const context = {
    position: snapshotView(vault),
    decision: decisionView(decision),
    capabilities: ["set rules", "pause/resume", "simulate crash", "explain risk"],
  };

  const fromLLM = await callLLM(message, context);
  const response = fromLLM ?? fallback(message, context);

  store.add({
    vault: vaultAddress,
    type: "chat",
    title: message.slice(0, 120),
    detail: response.reply,
  });

  if (response.simulate) {
    const result = simulate({
      coll: vault.coll,
      debt: vault.debt,
      price: vault.price,
      buffer: vault.btcBuffer,
      reserve: vault.musdReserve,
      rules: {
        triggerICR: vault.triggerICR,
        targetICR: vault.targetICR,
        autoProtect: vault.autoProtect,
      },
      scenario: response.simulate,
    });
    store.add({
      vault: vaultAddress,
      type: "simulation",
      kind: response.simulate,
      title: `${response.simulate} scenario simulated`,
      detail: result.summary.agentLiquidated
        ? "Agent could not save the loan"
        : result.summary.baselineLiquidated
          ? "Agent saved the loan"
          : "No liquidation in either path",
    });
  }

  return response;
}
