import path from "node:path";
import fs from "node:fs";
import os from "node:os";

/**
 * Local data store — pure JSON files, NO native dependencies.
 *
 * The old base used better-sqlite3, whose native `.node` binary is the thing
 * Windows Defender truncates during `npm install` (breaking the app for a
 * non-technical client). This store removes that dependency entirely, so the
 * app installs cleanly on macOS AND Windows on any Node 20+.
 *
 * Layout under DATA_DIR (default ~/.conveyer-ori, override CONVEYER_ORI_DATA_DIR):
 *   store.json               settings · prompts · runs · *_cache (debounced write)
 *   run_logs/<runId>.jsonl   append-only per-run log stream (O(1) appends, scales
 *                            to hour-long videos with tens of thousands of lines)
 *
 * `db` mimics the tiny subset of the better-sqlite3 API the app uses
 * (`prepare(sql).get/all/run`, `exec`, `pragma`) so NO call site had to change.
 * Each known statement has an explicit handler — an unknown statement throws a
 * clear error rather than silently misbehaving.
 */

export const DATA_DIR =
  process.env.CONVEYER_ORI_DATA_DIR ?? path.join(os.homedir(), ".conveyer-ori");
fs.mkdirSync(DATA_DIR, { recursive: true });

const STORE_FILE = path.join(DATA_DIR, "store.json");
const LOGS_DIR = path.join(DATA_DIR, "run_logs");
fs.mkdirSync(LOGS_DIR, { recursive: true });

type Row = Record<string, any>;
interface Store {
  settings: Row[];
  prompts: Row[];
  runs: Row[];
  search_cache: Row[];
  download_cache: Row[];
  vision_cache: Row[];
  run_costs: Row[];
}
function emptyStore(): Store {
  return { settings: [], prompts: [], runs: [], search_cache: [], download_cache: [], vision_cache: [], run_costs: [] };
}

let store: Store;
try {
  store = { ...emptyStore(), ...(JSON.parse(fs.readFileSync(STORE_FILE, "utf-8")) as Partial<Store>) };
} catch {
  store = emptyStore();
}

// Debounced atomic write (tmp file + rename). Coalesces bursts of writes
// (e.g. seeding defaults, vision-cache inserts) into one disk write.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
function persist(): void {
  dirty = false;
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, STORE_FILE);
}
function save(): void {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (dirty) {
      try { persist(); } catch { /* best-effort; retried on next mutation/exit */ }
    }
  }, 200);
}
process.on("exit", () => { if (dirty) { try { persist(); } catch { /* ignore */ } } });

/** SQLite datetime('now') format: UTC "YYYY-MM-DD HH:MM:SS". */
function sqliteNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function upsert(table: Row[], keyField: string, keyVal: any, fields: Row): void {
  const existing = table.find((r) => r[keyField] === keyVal);
  if (existing) Object.assign(existing, fields);
  else table.push({ [keyField]: keyVal, ...fields });
  save();
}

// ── run_logs: append-only JSONL per run ───────────────────────────────────────
const logSeq = new Map<string, number>();
function logFile(runId: string): string {
  const safe = runId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(LOGS_DIR, `${safe}.jsonl`);
}
function nextLogId(runId: string): number {
  let n = logSeq.get(runId);
  if (n === undefined) {
    // initialise from any existing file so ids stay monotonic across reloads
    try {
      const raw = fs.readFileSync(logFile(runId), "utf-8").trim();
      n = raw ? raw.split("\n").length : 0;
    } catch { n = 0; }
  }
  n += 1;
  logSeq.set(runId, n);
  return n;
}
function appendLog(runId: string, ts: string, level: string, stage: string | null, message: string, dataJson: string | null): number {
  const id = nextLogId(runId);
  fs.appendFileSync(logFile(runId), JSON.stringify({ id, run_id: runId, ts, level, stage, message, data_json: dataJson }) + "\n");
  return id;
}
function readLogs(runId: string): Row[] {
  try {
    const raw = fs.readFileSync(logFile(runId), "utf-8").trim();
    return raw ? raw.split("\n").map((l) => JSON.parse(l)) : [];
  } catch { return []; }
}

// ── better-sqlite3-shaped statement API ───────────────────────────────────────
interface Stmt {
  get: (...args: any[]) => any;
  all: (...args: any[]) => any[];
  run: (...args: any[]) => { changes: number; lastInsertRowid: number };
}
const RESULT = (changes = 1, lastInsertRowid = 0) => ({ changes, lastInsertRowid });
const NONE: Pick<Stmt, "get" | "all"> = { get: () => undefined, all: () => [] };
const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();

export function prepare(sql: string): Stmt {
  switch (norm(sql)) {
    // ── settings ──────────────────────────────────────────────────────────────
    case "SELECT value FROM settings WHERE key = ?":
      return { ...NONE, get: (key) => store.settings.find((r) => r.key === key), run: () => RESULT() };
    case "SELECT value FROM settings WHERE key = 'RUNS_OUTPUT_DIR'":
      return { ...NONE, get: () => store.settings.find((r) => r.key === "RUNS_OUTPUT_DIR"), run: () => RESULT() };
    case "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')":
      return { ...NONE, run: (key, value) => { upsert(store.settings, "key", key, { value, updated_at: sqliteNow() }); return RESULT(); } };

    // ── prompts ──────────────────────────────────────────────────────────────
    case "SELECT content FROM prompts WHERE name = ?":
      return { ...NONE, get: (name) => store.prompts.find((r) => r.name === name), run: () => RESULT() };
    case "INSERT INTO prompts (name, content, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(name) DO UPDATE SET content = excluded.content, updated_at = datetime('now')":
      return { ...NONE, run: (name, content) => { upsert(store.prompts, "name", name, { content, updated_at: sqliteNow() }); return RESULT(); } };

    // ── runs ─────────────────────────────────────────────────────────────────
    case "INSERT INTO runs (id, title, folder_name, status, script, config_json) VALUES (?, ?, ?, 'pending', ?, ?)":
      return { ...NONE, run: (id, title, folder_name, script, config_json) => {
        const now = sqliteNow();
        store.runs.push({ id, title: title ?? null, folder_name, status: "pending", script, config_json, created_at: now, updated_at: now, output_path: null });
        save();
        return RESULT();
      } };
    case "SELECT id, title, folder_name, status, created_at, updated_at, output_path FROM runs ORDER BY created_at DESC LIMIT 50":
      return { ...NONE, all: () => [...store.runs]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
        .slice(0, 50)
        .map((r) => ({ id: r.id, title: r.title, folder_name: r.folder_name, status: r.status, created_at: r.created_at, updated_at: r.updated_at, output_path: r.output_path })),
        run: () => RESULT() };
    case "SELECT * FROM runs WHERE id = ?":
      return { ...NONE, get: (id) => store.runs.find((r) => r.id === id), run: () => RESULT() };
    case "SELECT id, status FROM runs WHERE id = ?":
      return { ...NONE, get: (id) => { const r = store.runs.find((x) => x.id === id); return r ? { id: r.id, status: r.status } : undefined; }, run: () => RESULT() };
    case "SELECT id FROM runs WHERE id = ?":
      return { ...NONE, get: (id) => { const r = store.runs.find((x) => x.id === id); return r ? { id: r.id } : undefined; }, run: () => RESULT() };
    case "SELECT folder_name FROM runs WHERE id = ?":
      return { ...NONE, get: (id) => { const r = store.runs.find((x) => x.id === id); return r ? { folder_name: r.folder_name } : undefined; }, run: () => RESULT() };
    case "SELECT title, folder_name FROM runs WHERE id = ?":
      return { ...NONE, get: (id) => { const r = store.runs.find((x) => x.id === id); return r ? { title: r.title, folder_name: r.folder_name } : undefined; }, run: () => RESULT() };
    case "UPDATE runs SET status = ?, updated_at = datetime('now') WHERE id = ?":
      return { ...NONE, run: (status, id) => { const r = store.runs.find((x) => x.id === id); if (r) { r.status = status; r.updated_at = sqliteNow(); save(); } return RESULT(r ? 1 : 0); } };
    case "UPDATE runs SET status = ?, output_path = ?, updated_at = datetime('now') WHERE id = ?":
      return { ...NONE, run: (status, output_path, id) => { const r = store.runs.find((x) => x.id === id); if (r) { r.status = status; r.output_path = output_path; r.updated_at = sqliteNow(); save(); } return RESULT(r ? 1 : 0); } };

    // ── run_logs (append-only JSONL) ───────────────────────────────────────────
    case "INSERT INTO run_logs (run_id, ts, level, stage, message, data_json) VALUES (?, ?, ?, ?, ?, ?)":
      return { ...NONE, run: (run_id, ts, level, stage, message, data_json) => RESULT(1, appendLog(run_id, ts, level, stage ?? null, message, data_json ?? null)) };
    case "SELECT id, ts, level, stage, message, data_json FROM run_logs WHERE run_id = ? ORDER BY id ASC":
      return { ...NONE, all: (run_id) => readLogs(run_id), run: () => RESULT() };
    case "SELECT id, ts, level, stage, message, data_json FROM run_logs WHERE run_id = ? ORDER BY id DESC LIMIT ?":
      return { ...NONE, all: (run_id, limit) => { const rows = readLogs(run_id); return rows.slice(Math.max(0, rows.length - Number(limit))).reverse(); }, run: () => RESULT() };

    // ── search_cache ───────────────────────────────────────────────────────────
    case "SELECT value, created_at FROM search_cache WHERE key = ?":
      return { ...NONE, get: (key) => { const r = store.search_cache.find((x) => x.key === key); return r ? { value: r.value, created_at: r.created_at } : undefined; }, run: () => RESULT() };
    case "INSERT OR REPLACE INTO search_cache (key, value, created_at) VALUES (?, ?, ?)":
      return { ...NONE, run: (key, value, created_at) => { upsert(store.search_cache, "key", key, { value, created_at }); return RESULT(); } };

    // ── download_cache ─────────────────────────────────────────────────────────
    case "SELECT cached_filename FROM download_cache WHERE dedupe_id = ? OR source_url = ?":
      return { ...NONE, get: (dedupe_id, source_url) => { const r = store.download_cache.find((x) => x.dedupe_id === dedupe_id || (!!source_url && x.source_url === source_url)); return r ? { cached_filename: r.cached_filename } : undefined; }, run: () => RESULT() };
    case "INSERT OR REPLACE INTO download_cache (dedupe_id, source_url, cached_filename, created_at) VALUES (?, ?, ?, ?)":
      return { ...NONE, run: (dedupe_id, source_url, cached_filename, created_at) => { upsert(store.download_cache, "dedupe_id", dedupe_id, { source_url, cached_filename, created_at }); return RESULT(); } };

    // ── vision_cache ───────────────────────────────────────────────────────────
    case "SELECT score, created_at FROM vision_cache WHERE key = ?":
      return { ...NONE, get: (key) => { const r = store.vision_cache.find((x) => x.key === key); return r ? { score: r.score, created_at: r.created_at } : undefined; }, run: () => RESULT() };
    case "INSERT OR REPLACE INTO vision_cache (key, score, created_at) VALUES (?, ?, ?)":
      return { ...NONE, run: (key, score, created_at) => { upsert(store.vision_cache, "key", key, { score, created_at }); return RESULT(); } };

    default:
      // Surfaces immediately in testing if a new statement is added without a handler.
      throw new Error(`[db] Unhandled SQL for JSON store: ${norm(sql)}`);
  }
}

const db = {
  prepare,
  exec: (_sql?: string) => {},
  pragma: (_p?: string) => {},
};

export default db;

// ── Cost ledger ───────────────────────────────────────────────────────────────
// A plain append-only array in the JSON store. (Ori's prepare() only knows the
// exact SQL strings above and THROWS on anything else, so the cost ledger is NOT
// modelled as SQL — it's direct array ops sharing the same debounced save().)
export function pushCostRow(row: Row): void {
  store.run_costs.push(row);
  save();
}
export function readCostRows(): Row[] {
  return store.run_costs;
}
