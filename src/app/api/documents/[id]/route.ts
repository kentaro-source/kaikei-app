import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const document = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
    if (!document) {
      return NextResponse.json({ error: "書類が見つかりません" }, { status: 404 });
    }

    const ocrResult = db
      .prepare("SELECT * FROM ocr_results WHERE document_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(id);

    const journals = ocrResult
      ? db.prepare("SELECT * FROM journal_entries WHERE ocr_result_id = ?").all((ocrResult as { id: string }).id)
      : [];

    return NextResponse.json({ document, ocrResult, journals });
  } catch (error) {
    console.error("Document fetch error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    if (body.status) {
      db.prepare("UPDATE documents SET status = ? WHERE id = ?").run(body.status, id);
    }
    if (body.memo !== undefined) {
      db.prepare("UPDATE documents SET memo = ? WHERE id = ?").run(body.memo, id);
    }

    const document = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
    return NextResponse.json({ document });
  } catch (error) {
    console.error("Document update error:", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Document delete error:", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
