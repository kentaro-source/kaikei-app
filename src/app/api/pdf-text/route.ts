import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function POST(request: NextRequest) {
  try {
    const { file_path } = await request.json();
    if (!file_path) {
      return NextResponse.json({ error: "file_path が必要です" }, { status: 400 });
    }

    const filePath = path.join(UPLOAD_DIR, file_path);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
    }

    const pdfParse = (await import("pdf-parse")).default;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);

    return NextResponse.json({ text: data.text, pages: data.numpages });
  } catch (error) {
    console.error("PDF text extraction error:", error);
    return NextResponse.json({ error: "PDFのテキスト抽出に失敗しました" }, { status: 500 });
  }
}
