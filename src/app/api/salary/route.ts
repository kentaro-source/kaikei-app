import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// 給与データ用テーブル（初回作成）
function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS salary_entries (
      id TEXT PRIMARY KEY,
      employer TEXT NOT NULL,
      date TEXT NOT NULL,
      taxable_salary INTEGER NOT NULL,
      income_tax INTEGER NOT NULL DEFAULT 0,
      health_insurance INTEGER NOT NULL DEFAULT 0,
      pension INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);
  return db;
}

export async function GET() {
  try {
    const db = ensureTable();
    const entries = db.prepare("SELECT * FROM salary_entries ORDER BY date").all();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Salary fetch error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = ensureTable();
    const { employer, date, taxable_salary, income_tax } = await request.json();

    if (!employer || !date || !taxable_salary) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const id = uuidv4();
    db.prepare(
      "INSERT INTO salary_entries (id, employer, date, taxable_salary, income_tax, health_insurance, pension) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, employer, date, taxable_salary, income_tax || 0, body.health_insurance || 0, body.pension || 0);

    const entry = db.prepare("SELECT * FROM salary_entries WHERE id = ?").get(id);
    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Salary save error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = ensureTable();
    const { id } = await request.json();
    db.prepare("DELETE FROM salary_entries WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Salary delete error:", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
