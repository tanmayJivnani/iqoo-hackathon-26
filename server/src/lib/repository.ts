import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config';
import type { Complaint } from './types';

export class ComplaintRepository {
  private db: DatabaseSync;
  constructor(filename = config.databasePath) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS complaints (id TEXT PRIMARY KEY, tracking_id TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL, record TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS complaint_date ON complaints(created_at);
      CREATE TABLE IF NOT EXISTS verifications (id TEXT PRIMARY KEY, complaint_id TEXT NOT NULL REFERENCES complaints(id), record TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS witnesses (complaint_id TEXT NOT NULL REFERENCES complaints(id), witness_key TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(complaint_id, witness_key));
      PRAGMA foreign_keys=ON;`);
  }
  get(id: string): Complaint | undefined {
    const clean = id.startsWith('loc-') ? id.slice(4) : id;
    const row = this.db.prepare('SELECT record FROM complaints WHERE id = ? OR tracking_id = ? OR id = ? OR tracking_id = ? LIMIT 1').get(id, id, clean, clean);
    return row ? JSON.parse(String(row.record)) as Complaint : undefined;
  }
  list(): Complaint[] {
    return this.db.prepare('SELECT record FROM complaints ORDER BY created_at DESC').all().map(row => JSON.parse(String(row.record)) as Complaint);
  }
  save(complaint: Complaint) {
    this.db.prepare('INSERT INTO complaints(id, tracking_id, created_at, record) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET record=excluded.record').run(complaint.id, complaint.tracking_id, complaint.created_at, JSON.stringify(complaint));
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  saveVerification(id: string, complaintId: string, record: unknown) {
    this.db.prepare('INSERT INTO verifications VALUES (?, ?, ?)').run(id, complaintId, JSON.stringify(record));
  }
  addWitness(complaintId: string, key: string, record: unknown) {
    return this.db.prepare('INSERT OR IGNORE INTO witnesses VALUES (?, ?, ?)').run(complaintId, key, JSON.stringify(record)).changes > 0;
  }
  close() { this.db.close(); }
}
// A single connection is reused across development hot reloads; request data lives in SQLite.
const state = globalThis as typeof globalThis & { treeRepository?: ComplaintRepository };
export function repository() { return state.treeRepository ??= new ComplaintRepository(); }
