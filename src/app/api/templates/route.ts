import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const db = getDb();
    const templates = db.prepare("SELECT * FROM templates ORDER BY created_at DESC").all();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Templates fetch error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, document_type, regions } = body;

    if (!name) {
      return NextResponse.json({ error: "テンプレート名は必須です" }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(
      "INSERT INTO templates (id, name, description, document_type, regions) VALUES (?, ?, ?, ?, ?)"
    ).run(id, name, description || null, document_type || "rent_statement", JSON.stringify(regions || []));

    const template = db.prepare("SELECT * FROM templates WHERE id = ?").get(id);
    return NextResponse.json({ template });
  } catch (error) {
    console.error("Template create error:", error);
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}
