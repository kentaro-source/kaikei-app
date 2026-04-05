import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS tax_sim_data (
      id TEXT PRIMARY KEY DEFAULT 'current',
      year INTEGER NOT NULL,
      real_estate_profit INTEGER NOT NULL DEFAULT 0,
      social_insurance INTEGER NOT NULL DEFAULT 0,
      life_insurance INTEGER NOT NULL DEFAULT 0,
      earthquake_insurance INTEGER NOT NULL DEFAULT 0,
      medical_expense INTEGER NOT NULL DEFAULT 0,
      ideco INTEGER NOT NULL DEFAULT 0,
      housing_loan INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);
  return db;
}

export async function GET() {
  try {
    const db = ensureTable();
    const data = db.prepare("SELECT * FROM tax_sim_data WHERE id = 'current'").get();
    return NextResponse.json({ data: data || null });
  } catch (error) {
    console.error("Tax sim fetch error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = ensureTable();
    const body = await request.json();

    db.prepare(`
      INSERT INTO tax_sim_data (id, year, real_estate_profit, social_insurance, life_insurance, earthquake_insurance, medical_expense, ideco, housing_loan, updated_at)
      VALUES ('current', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(id) DO UPDATE SET
        year = excluded.year,
        real_estate_profit = excluded.real_estate_profit,
        social_insurance = excluded.social_insurance,
        life_insurance = excluded.life_insurance,
        earthquake_insurance = excluded.earthquake_insurance,
        medical_expense = excluded.medical_expense,
        ideco = excluded.ideco,
        housing_loan = excluded.housing_loan,
        updated_at = datetime('now', 'localtime')
    `).run(
      body.year || 2025,
      body.real_estate_profit || 0,
      body.social_insurance || 0,
      body.life_insurance || 0,
      body.earthquake_insurance || 0,
      body.medical_expense || 0,
      body.ideco || 0,
      body.housing_loan || 0,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tax sim save error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
