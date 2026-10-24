import fs from "node:fs";
import path from "node:path";
import type { Address } from "viem";
import { config } from "./config.js";

const file = path.join(config.dataDir, "vaults.json");

class Watchlist {
  private vaults = new Set<string>();

  constructor(seed: string[]) {
    for (const vault of seed) this.vaults.add(vault.toLowerCase());
    try {
      if (fs.existsSync(file)) {
        const stored = JSON.parse(fs.readFileSync(file, "utf8")) as string[];
        for (const vault of stored) this.vaults.add(vault.toLowerCase());
      }
    } catch {
      // ignore corrupt file
    }
    this.flush();
  }

  add(vault: string): void {
    this.vaults.add(vault.toLowerCase());
    this.flush();
  }

  remove(vault: string): void {
    this.vaults.delete(vault.toLowerCase());
    this.flush();
  }

  list(): Address[] {
    return [...this.vaults] as Address[];
  }

  private flush(): void {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(this.list(), null, 2));
    } catch {
      // best effort
    }
  }
}

export const watchlist = new Watchlist(config.vaults);
