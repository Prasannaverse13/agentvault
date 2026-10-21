import dotenv from "dotenv";
import path from "node:path";
import { CORE, MEZO_TESTNET } from "@agentvault/shared";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

function list(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeAddress(value: string): `0x${string}` {
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new Error(`Invalid address: ${value}`);
  }
  return trimmed as `0x${string}`;
}

const privateKey = (process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY || "").trim();
const vaults = [...new Set([...list(process.env.VAULT_ADDRESS), ...list(process.env.AGENT_VAULTS)])];

export const config = {
  port: Number(process.env.AGENT_PORT || process.env.PORT || 8787),
  rpcUrl: process.env.MEZO_TESTNET_RPC || MEZO_TESTNET.rpc,
  chain: MEZO_TESTNET,
  core: CORE,
  factoryAddress: process.env.FACTORY_ADDRESS
    ? normalizeAddress(process.env.FACTORY_ADDRESS)
    : undefined,
  vaults: vaults.map(normalizeAddress),
  demoVault: process.env.DEMO_VAULT ? normalizeAddress(process.env.DEMO_VAULT) : undefined,
  privateKey: privateKey || undefined,
  execute: (process.env.AGENT_EXECUTE ?? "true") !== "false",
  pollMs: Number(process.env.AGENT_POLL_MS || 20_000),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
  telegramChatId: process.env.TELEGRAM_CHAT_ID || undefined,
  openaiKey: process.env.OPENAI_API_KEY || undefined,
  openaiBaseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  publicUrl: process.env.PUBLIC_APP_URL || "http://localhost:3000",
};

export type Config = typeof config;
