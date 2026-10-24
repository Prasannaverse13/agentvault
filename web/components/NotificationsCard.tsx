"use client";

import { useState } from "react";
import { api, type AgentHealth } from "@/lib/api";
import { Badge, Card, SectionTitle, Spinner } from "./ui";

/** Telegram alert status with a real test message. */
export function NotificationsCard({
  agent,
  agentOnline,
  notify,
}: {
  agent: AgentHealth | null;
  agentOnline: boolean;
  notify: (message: string, kind?: "ok" | "err") => void;
}) {
  const [sending, setSending] = useState(false);
  const configured = Boolean(agent?.telegramChat);

  const test = async () => {
    setSending(true);
    try {
      const result = await api.notifyTest();
      if (result.sent) notify("Test alert sent. Check Telegram.");
      else if (!result.configured) notify("Telegram is not configured on the agent yet.", "err");
      else notify("Telegram rejected the message. Check the bot token and chat id.", "err");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not reach the agent", "err");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card id="alerts">
      <SectionTitle
        title="Alerts"
        subtitle="Know the moment the agent acts or your loan is at risk."
        action={
          <Badge tone={configured ? "good" : "warn"}>{configured ? "Telegram on" : "Telegram off"}</Badge>
        }
      />

      <ul className="space-y-2.5 text-[14px] text-charcoal">
        <Item on>In-app toast when the agent protects your loan</Item>
        <Item on={configured}>Telegram message with the transaction hash</Item>
        <Item on={configured}>Telegram warning when safety funds run out</Item>
        <Item on={configured}>Ask the bot for /status or /simulate any time</Item>
      </ul>

      {configured ? (
        <button className="btn mt-5 w-full" onClick={test} disabled={sending || !agentOnline}>
          {sending ? <Spinner /> : null}
          Send a test alert
        </button>
      ) : (
        <div className="mt-5 rounded-panel bg-fog/70 p-4 text-[13px] leading-relaxed text-slate">
          <p className="font-semibold text-obsidian">Enable Telegram in two steps</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li>
              Create a bot with @BotFather and set <code className="font-mono text-forest">TELEGRAM_BOT_TOKEN</code> and{" "}
              <code className="font-mono text-forest">TELEGRAM_CHAT_ID</code> in <code className="font-mono text-forest">.env</code>.
            </li>
            <li>Restart the agent, then send a test alert from here.</li>
          </ol>
        </div>
      )}
    </Card>
  );
}

function Item({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={
          on
            ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-black text-lime"
            : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fog text-[11px] font-black text-slate"
        }
      >
        {on ? "✓" : "–"}
      </span>
      <span className={on ? "" : "text-slate"}>{children}</span>
    </li>
  );
}
