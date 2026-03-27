import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "other";

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    // ファイル保存
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(file.name) || ".jpg";
    const id = uuidv4();
    const fileName = `${id}${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // DB登録
    const db = getDb();
    db.prepare(
      "INSERT INTO documents (id, type, file_name, file_path) VALUES (?, ?, ?, ?)"
    ).run(id, type, file.name, fileName);

    const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }
}
