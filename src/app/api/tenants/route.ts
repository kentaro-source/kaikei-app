import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_name TEXT NOT NULL,
      room TEXT NOT NULL,
      tenant_name TEXT NOT NULL,
      month TEXT NOT NULL,
      total INTEGER NOT NULL,
      UNIQUE(property_name, room, month)
    )
  `);
  return db;
}

export async function GET(request: NextRequest) {
  try {
    const db = ensureTable();
    const url = new URL(request.url);
    const property = url.searchParams.get("property");

    let entries;
    if (property) {
      entries = db.prepare("SELECT * FROM tenants WHERE property_name = ? ORDER BY month DESC, room").all(property);
    } else {
      entries = db.prepare("SELECT * FROM tenants ORDER BY month DESC, property_name, room").all();
    }
    return NextResponse.json({ tenants: entries });
  } catch (error) {
    console.error("Tenants fetch error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = ensureTable();
    const { tenants } = await request.json();

    const upsert = db.prepare(`
      INSERT INTO tenants (property_name, room, tenant_name, month, total)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(property_name, room, month) DO UPDATE SET
        tenant_name = excluded.tenant_name,
        total = excluded.total
    `);

    const insertMany = db.transaction((entries: { property_name: string; room: string; tenant_name: string; month: string; total: number }[]) => {
      for (const t of entries) {
        upsert.run(t.property_name, t.room, t.tenant_name, t.month, t.total);
      }
    });

    insertMany(tenants);

    return NextResponse.json({ success: true, count: tenants.length });
  } catch (error) {
    console.error("Tenants save error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
