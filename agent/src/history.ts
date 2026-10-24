import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export type HistoryPoint = {
  t: number;
  price: number;
  icr: number;
  coll: number;
  debt: number;
  buffer: number;
  reserve: number;
};

const file = path.join(config.dataDir, "history.json");
const MAX_POINTS = 720;
const MIN_GAP_MS = config.local ? 2_000 : 10_000;

class HistoryStore {
  private points: Record<string, HistoryPoint[]> = {};

  constructor() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (fs.existsSync(file)) {
        this.points = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, HistoryPoint[]>;
      }
    } catch {
      this.points = {};
    }
  }

  record(vault: string, point: HistoryPoint): void {
    const key = vault.toLowerCase();
    const list = (this.points[key] ??= []);
    const last = list[list.length - 1];
    if (last && point.t - last.t < MIN_GAP_MS) return;
    list.push(point);
    if (list.length > MAX_POINTS) list.splice(0, list.length - MAX_POINTS);
    this.flush();
  }

  list(vault: string, limit = 240): HistoryPoint[] {
    return (this.points[vault.toLowerCase()] ?? []).slice(-limit);
  }

  private flush(): void {
    try {
      fs.writeFileSync(file, JSON.stringify(this.points));
    } catch {
      // best effort
    }
  }
}

export const history = new HistoryStore();
