import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    }

    const db = getDb();
    db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Journal delete error:", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
