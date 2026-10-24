import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

export type AgentEvent = {
  id: string;
  vault: string;
  at: number;
  type: "boot" | "decision" | "execution" | "alert" | "rules" | "simulation" | "chat";
  title: string;
  detail?: string;
  txHash?: string;
  kind?: string;
  data?: Record<string, unknown>;
};

const file = path.join(config.dataDir, "events.json");

class EventStore {
  private events: AgentEvent[] = [];

  constructor() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file)) {
        this.events = JSON.parse(fs.readFileSync(file, "utf8")) as AgentEvent[];
      }
    } catch {
      this.events = [];
    }
  }

  add(event: Omit<AgentEvent, "id" | "at"> & { at?: number }): AgentEvent {
    const full: AgentEvent = {
      id: crypto.randomUUID(),
      at: event.at ?? Date.now(),
      ...event,
    };
    this.events.push(full);
    this.events = this.events.slice(-500);
    this.flush();
    return full;
  }

  list(vault?: string, limit = 50): AgentEvent[] {
    const filtered = vault
      ? this.events.filter((e) => e.vault.toLowerCase() === vault.toLowerCase())
      : this.events;
    return filtered.slice(-limit).reverse();
  }

  private flush() {
    try {
      fs.writeFileSync(file, JSON.stringify(this.events, null, 2));
    } catch {
      // best-effort persistence
    }
  }
}

export const store = new EventStore();
