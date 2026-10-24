#!/usr/bin/env node
/**
 * One command that runs the whole product on a local demo network:
 *   1. a local EVM chain (hardhat node, chain id 31337)
 *   2. mock Mezo contracts + the AgentVaultFactory, deployed at fixed addresses
 *   3. the AgentVault agent (watching vaults and sending real protect() txs)
 *   4. the web app
 *
 * Every transaction is real and signed by MetaMask, but funds are free, so the
 * full flow can be recorded without a faucet.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

// Well-known hardhat dev keys. They only ever hold fake funds on this local chain.
const ADMIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // account #0
const AGENT_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // account #1
const FACTORY = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

const children = [];

function log(message) {
  console.log(`\x1b[32m[demo]\x1b[0m ${message}`);
}

function run(name, args, env = {}) {
  const child = spawn("pnpm", args, {
    cwd: root,
    shell: isWin,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${name}] `;
  const pipe = (stream) =>
    stream.on("data", (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line.trim()) process.stdout.write(prefix + line + "\n");
      }
    });
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code) => {
    if (!shuttingDown) {
      log(`${name} exited (${code}). Shutting down.`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    try {
      if (isWin) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
      else child.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
  setTimeout(() => process.exit(code), 300);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function waitForPort(port, label, timeoutMs = 90_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`${label} did not start on :${port}`));
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

async function main() {
  // Fresh demo data every run so the dashboard starts clean.
  const dataDir = path.join(root, "data-demo");
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });

  log("Starting the local chain (chain id 31337)...");
  run("chain", ["--filter", "@agentvault/contracts", "node"]);
  await waitForPort(8545, "chain");

  log("Deploying mock Mezo contracts + AgentVaultFactory...");
  const deploy = spawnSync(
    "pnpm",
    ["--filter", "@agentvault/contracts", "exec", "hardhat", "run", "scripts/deploy-local.ts", "--network", "localhost"],
    { cwd: root, shell: isWin, stdio: "inherit" },
  );
  if (deploy.status !== 0) {
    log("Deploy failed.");
    return shutdown(1);
  }

  const shared = {
    NETWORK: "local",
    NEXT_PUBLIC_NETWORK: "local",
  };

  log("Starting the agent...");
  run("agent", ["--filter", "@agentvault/agent", "dev"], {
    ...shared,
    MEZO_TESTNET_RPC: "http://127.0.0.1:8545",
    AGENT_PRIVATE_KEY: AGENT_KEY,
    DEMO_ADMIN_KEY: ADMIN_KEY,
    FACTORY_ADDRESS: FACTORY,
    // Blank (not unset) so .env values for the real testnet are not picked up.
    PRIVATE_KEY: "",
    VAULT_ADDRESS: "",
    AGENT_VAULTS: "",
    DEMO_VAULT: "",
    AGENT_POLL_MS: "3000",
    DATA_DIR: "../data-demo",
  });
  await waitForPort(8787, "agent");

  log("Starting the web app...");
  run("web", ["--filter", "@agentvault/web", "dev"], {
    ...shared,
    NEXT_PUBLIC_AGENT_URL: "http://localhost:8787",
    NEXT_PUBLIC_FACTORY_ADDRESS: FACTORY,
  });
  await waitForPort(3000, "web", 180_000);

  console.log(`
\x1b[32m=====================================================\x1b[0m
  AgentVault demo is running (all on-chain, free funds)

  App:    http://localhost:3000
  Agent:  http://localhost:8787
  Chain:  http://127.0.0.1:8545  (chain id 31337)

  In MetaMask: click Connect. The app adds the "AgentVault
  Demo Network" for you. Then use "Get demo funds" in the
  wallet menu and follow the dashboard.

  If MetaMask complains about nonces after a restart:
  Settings > Advanced > Clear activity tab data.

  Press Ctrl+C to stop everything.
\x1b[32m=====================================================\x1b[0m
`);
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
