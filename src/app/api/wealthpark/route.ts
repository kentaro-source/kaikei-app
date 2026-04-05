import { NextRequest, NextResponse } from "next/server";
import { parseWealthParkPdf } from "@/lib/wealthparkParser";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    // ファイル保存
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());

    // pdf-parse でテキスト抽出
    const pdfParse = require("pdf-parse");
    const pdfData = await pdfParse(buffer);

    // パース
    const report = parseWealthParkPdf(pdfData.text);

    if (report.properties.length === 0) {
      return NextResponse.json({ error: "物件データが見つかりませんでした" }, { status: 400 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("WealthPark parse error:", error);
    return NextResponse.json({ error: "PDFの解析に失敗しました" }, { status: 500 });
  }
}
