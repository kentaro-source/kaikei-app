import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const db = getDb();
    let query = "SELECT * FROM documents";
    const conditions: string[] = [];
    const params: string[] = [];

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY uploaded_at DESC";

    const documents = db.prepare(query).all(...params);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Documents fetch error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
