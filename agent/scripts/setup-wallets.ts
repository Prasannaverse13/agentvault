import fs from "node:fs";
import path from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envPath = path.resolve(process.cwd(), "../.env");
const examplePath = path.resolve(process.cwd(), "../.env.example");

const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const base = existing || (fs.existsSync(examplePath) ? fs.readFileSync(examplePath, "utf8") : "");

const lines = base.split(/\r?\n/);
function valueOf(key: string): string {
  const line = lines.find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

let deployerKey = valueOf("PRIVATE_KEY");
let agentKey = valueOf("AGENT_PRIVATE_KEY");

if (!deployerKey) {
  deployerKey = generatePrivateKey();
  const idx = lines.findIndex((l) => l.startsWith("PRIVATE_KEY="));
  const entry = `PRIVATE_KEY=${deployerKey}`;
  if (idx >= 0) lines[idx] = entry;
  else lines.push(entry);
}

if (!agentKey) {
  agentKey = generatePrivateKey();
  const idx = lines.findIndex((l) => l.startsWith("AGENT_PRIVATE_KEY="));
  const entry = `AGENT_PRIVATE_KEY=${agentKey}`;
  if (idx >= 0) lines[idx] = entry;
  else lines.push(entry);
}

fs.writeFileSync(envPath, lines.join("\n"));

const deployer = privateKeyToAccount(deployerKey as `0x${string}`);
const agent = privateKeyToAccount(agentKey as `0x${string}`);

console.log(`Owner/deployer: ${deployer.address}`);
console.log(`Agent:          ${agent.address}`);
console.log(`Faucet:         https://faucet.test.mezo.org`);
