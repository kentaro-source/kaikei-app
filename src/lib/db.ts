import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "db.sqlite");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initTables(db);
  }
  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('bankbook', 'rent_statement', 'salary_slip', 'receipt', 'other')),
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT NOT NULL DEFAULT 'uploaded' CHECK(status IN ('uploaded', 'ocr_done', 'confirmed', 'exported')),
      memo TEXT
    );

    CREATE TABLE IF NOT EXISTS ocr_results (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      raw_text TEXT,
      parsed_data TEXT,
      template_id TEXT REFERENCES templates(id),
      confirmed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      ocr_result_id TEXT REFERENCES ocr_results(id),
      source TEXT DEFAULT 'other',
      date TEXT NOT NULL,
      debit_account TEXT NOT NULL,
      debit_sub_account TEXT,
      credit_account TEXT NOT NULL,
      credit_sub_account TEXT,
      amount INTEGER NOT NULL,
      description TEXT,
      exported INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      document_type TEXT NOT NULL DEFAULT 'rent_statement',
      regions TEXT NOT NULL DEFAULT '[]',
      sample_image_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);
}

export type DocumentType = "rent_statement" | "salary_slip" | "receipt" | "other";
export type DocumentStatus = "uploaded" | "ocr_done" | "confirmed" | "exported";

export interface Document {
  id: string;
  type: DocumentType;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  status: DocumentStatus;
  memo: string | null;
}

export interface OcrResult {
  id: string;
  document_id: string;
  raw_text: string | null;
  parsed_data: string | null;
  template_id: string | null;
  confirmed: number;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  ocr_result_id: string | null;
  date: string;
  debit_account: string;
  debit_sub_account: string | null;
  credit_account: string;
  credit_sub_account: string | null;
  amount: number;
  description: string | null;
  exported: number;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  document_type: string;
  regions: string;
  sample_image_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateRegion {
  id: string;
  label: string;
  field_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
