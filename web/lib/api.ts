export const AGENT_URL = (
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8787"
).replace(/\/$/, "");

export type PositionView = {
  address: string;
  owner: string;
  agent: string;
  autoProtect: boolean;
  status: number;
  coll: number;
  debt: number;
  price: number;
  icr: number;
  ltv: number;
  liquidationPrice: number;
  btcBuffer: number;
  musdReserve: number;
  triggerICR: number;
  targetICR: number;
  triggerLTV: number;
  targetLTV: number;
  health: "safe" | "watch" | "danger";
  agentConnected: boolean;
  fetchedAt: number;
};

export type DecisionView = {
  kind: "hold" | "topUp" | "repay" | "both";
  topUpAmount: number;
  repayAmount: number;
  icr: number;
  projectedICR: number;
  reason: string;
};

export type AgentEvent = {
  id: string;
  vault: string;
  at: number;
  type: "boot" | "decision" | "execution" | "alert" | "rules" | "simulation" | "chat";
  title: string;
  detail?: string;
  txHash?: string;
  kind?: string;
};

export type SimStep = {
  t: number;
  price: number;
  icr: number;
  action: "hold" | "topUp" | "repay" | "both" | "liquidated";
  topUp: number;
  repay: number;
  coll: number;
  debt: number;
  buffer: number;
  reserve: number;
  liquidationPrice: number;
  saved: boolean;
};

export type SimResult = {
  scenario: string;
  startPrice: number;
  endPrice: number;
  crashPct: number;
  agentSteps: SimStep[];
  baselineSteps: SimStep[];
  summary: {
    agentLiquidated: boolean;
    baselineLiquidated: boolean;
    minICRAgent: number;
    minICRBaseline: number;
    finalICR: number;
    actions: number;
    totalTopUp: number;
    totalRepay: number;
  };
};

export type StatusResponse = {
  position: PositionView;
  decision: DecisionView;
  events: AgentEvent[];
};

export type AgentHealth = {
  ok: boolean;
  chainId: number;
  network: string;
  agent: string | null;
  execute: boolean;
  vaults: string[];
  telegram: boolean;
  telegramChat?: boolean;
  llm: boolean;
  demo?: boolean;
  pollMs?: number;
};

export type HistoryPoint = {
  t: number;
  price: number;
  icr: number;
  coll: number;
  debt: number;
  buffer: number;
  reserve: number;
};

export type RiskReport = {
  active: boolean;
  score: number;
  band: "low" | "moderate" | "high" | "critical";
  dropToTrigger: number;
  dropToLiquidation: number;
  survivableDropWithAgent: number;
  coveragePct: number;
  safetyFundsUsd: number;
  ltv: number;
};

export type MarketState = { price: number; startPrice: number };

export type AgentConfig = {
  chain: { chainId: number; name: string; explorer: string; faucet: string };
  core: Record<string, string>;
  factory: string | null;
  agent: string | null;
  execute: boolean;
  demo?: boolean;
};

export type ChatResponse = {
  reply: string;
  rulePatch: { triggerICR: string; targetICR: string; autoProtect: boolean } | null;
  simulate: string | null;
  source: "llm" | "rules";
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${AGENT_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error((json as { error?: string }).error || `Request failed (${response.status})`);
  }
  return json as T;
}

export const api = {
  health: () => request<AgentHealth>("/api/health"),
  config: () => request<AgentConfig>("/api/config"),
  status: (vault: string) => request<StatusResponse>(`/api/status/${vault}`),
  events: (vault: string) => request<{ events: AgentEvent[] }>(`/api/events/${vault}`),
  simulate: (vault: string, scenario: string, crashPct?: number) =>
    request<SimResult>("/api/simulate", {
      method: "POST",
      body: JSON.stringify({ vault, scenario, crashPct }),
    }),
  demoSimulate: (scenario: string) =>
    request<{ demo: true; position: Record<string, number>; result: SimResult }>(
      "/api/demo/simulate",
      { method: "POST", body: JSON.stringify({ scenario }) },
    ),
  chat: (vault: string, message: string) =>
    request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ vault, message }),
    }),
  check: (vault: string) =>
    request<{
      position: PositionView;
      decision: DecisionView;
      executed: boolean;
      txHash: string | null;
      error: string | null;
    }>(`/api/check/${vault}`, { method: "POST" }),
  history: (vault: string) => request<{ points: HistoryPoint[] }>(`/api/history/${vault}`),
  risk: (vault: string) => request<RiskReport>(`/api/risk/${vault}`),
  notifyTest: () =>
    request<{ configured: boolean; sent: boolean }>("/api/notify/test", { method: "POST" }),
  demoMarket: () => request<MarketState>("/api/demo/market"),
  demoPrice: (body: { price?: number; changePct?: number; reset?: boolean }) =>
    request<MarketState>("/api/demo/price", { method: "POST", body: JSON.stringify(body) }),
  demoFaucet: (address: string, amount = 100) =>
    request<{ balance: number }>("/api/demo/faucet", {
      method: "POST",
      body: JSON.stringify({ address, amount }),
    }),
  watch: (vault: string) =>
    request<{ ok: boolean; vaults: string[] }>("/api/watch", {
      method: "POST",
      body: JSON.stringify({ vault }),
    }),
};
