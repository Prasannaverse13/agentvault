import { Bot } from "grammy";
import type { Address } from "viem";
import { config } from "./config.js";
import { readVault } from "./chain.js";
import { decide } from "./rules.js";
import { simulate, type Scenario } from "./simulator.js";
import { snapshotView, decisionView } from "./view.js";
import { handleChat } from "./chat.js";
import { watchlist } from "./watchlist.js";

export const bot = config.telegramToken ? new Bot(config.telegramToken) : null;

export async function notify(text: string): Promise<boolean> {
  if (!bot || !config.telegramChatId) return false;
  try {
    await bot.api.sendMessage(config.telegramChatId, text);
    return true;
  } catch {
    // alerts are best-effort
    return false;
  }
}

function isAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

async function status(address?: Address): Promise<string> {
  const target = address ?? watchlist.list()[0];
  if (!target) return "No vault configured. Set VAULT_ADDRESS in .env.";
  try {
    const vault = await readVault(target);
    const view = snapshotView(vault);
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
    const decisionText = decisionView(decision);
    return [
      `AgentVault ${target.slice(0, 8)}...`,
      `BTC price: $${view.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      `Collateral: ${view.coll.toFixed(4)} BTC`,
      `Debt: ${view.debt.toFixed(2)} MUSD`,
      `ICR: ${view.icr.toFixed(1)}% (LTV ${view.ltv.toFixed(1)}%)`,
      `Liquidation price: $${view.liquidationPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      `Trigger: ${view.triggerICR.toFixed(1)}% | Target: ${view.targetICR.toFixed(1)}%`,
      `Buffer: ${view.btcBuffer.toFixed(4)} BTC | Reserve: ${view.musdReserve.toFixed(2)} MUSD`,
      `Protection: ${view.autoProtect ? "active" : "paused"}`,
      `Agent: ${decisionText.kind === "hold" ? decisionText.reason : `${decisionText.kind} ${decisionText.topUpAmount.toFixed(4)} BTC / ${decisionText.repayAmount.toFixed(2)} MUSD`}`,
    ].join("\n");
  } catch (error) {
    return `Could not read vault: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function simulateFor(address: Address | undefined, scenario: Scenario): Promise<string> {
  const target = address ?? watchlist.list()[0];
  if (!target) return "No vault configured. Set VAULT_ADDRESS in .env.";
  const vault = await readVault(target);
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
    scenario,
  });
  return [
    `${scenario.toUpperCase()} simulation (-${result.crashPct}% BTC)`,
    `Agent actions: ${result.summary.actions}`,
    `Top up: ${result.summary.totalTopUp.toFixed(4)} BTC | Repay: ${result.summary.totalRepay.toFixed(2)} MUSD`,
    `Min ICR with agent: ${result.summary.minICRAgent.toFixed(1)}%`,
    `Min ICR without agent: ${result.summary.minICRBaseline.toFixed(1)}%`,
    result.summary.agentLiquidated
      ? "Result: loan liquidated - increase the buffer or lower the trigger."
      : result.summary.baselineLiquidated
        ? "Result: agent saved the loan."
        : "Result: no liquidation in either path.",
  ].join("\n");
}

export function startTelegram(): void {
  if (!bot) return;

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "AgentVault watches your BTC-backed MUSD loan and tops up collateral or repays debt before liquidation.\n\nCommands:\n/status - live position\n/simulate crash - stress test\n/help - what I can do",
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "I can:",
        "- Read your live loan health (/status)",
        "- Stress test a crash (/simulate crash, /simulate dip, /simulate blackswan)",
        "- Take plain-English rule changes: 'protect my loan at 60% LTV and restore to 50%'",
        "Rule changes still need the owner wallet signature in the dashboard.",
      ].join("\n"),
    );
  });

  bot.command("status", async (ctx) => {
    const arg = ctx.match?.trim();
    await ctx.reply(await status(arg && isAddress(arg) ? arg : undefined));
  });

  bot.command("simulate", async (ctx) => {
    const arg = (ctx.match || "crash").trim() as Scenario;
    const scenario: Scenario = ["crash", "dip", "blackswan"].includes(arg) ? arg : "crash";
    try {
      await ctx.reply(await simulateFor(undefined, scenario));
    } catch (error) {
      await ctx.reply(`Simulation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return;
    const target = watchlist.list()[0];
    if (!target) {
      await ctx.reply("No vault configured yet.");
      return;
    }
    try {
      const response = await handleChat(target, text);
      const lines = [response.reply];
      if (response.rulePatch) {
        lines.push(
          `Proposed rules: act at ${(Number(response.rulePatch.triggerICR) * 100).toFixed(0)}% ICR, restore to ${(Number(response.rulePatch.targetICR) * 100).toFixed(0)}%. Apply in ${config.publicUrl}.`,
        );
      }
      await ctx.reply(lines.join("\n\n"));
    } catch (error) {
      await ctx.reply(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  bot.catch((error) => {
    console.error("Telegram error", error.error);
  });

  void bot.start({
    onStart: (info) => console.log(`Telegram bot @${info.username} is running`),
  });
}
