import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const RENT_PROMPT = `これは不動産管理会社が作成した「家賃支払精算書」のスキャン画像です。

書類の構造:
- 右上ヘッダー: 「○○年○○月分 家賃支払精算書」「物件名 ○○」「合計金額 ○○」「送金額 ○○」
- 中央の表: 各入居者の賃貸料・共益費・駐車料・水道料などの明細
- 表の下部: 控除欄に「電気料金（電灯）」「管理手数料」とその消費税
- 左下: 領収証と振込情報

以下の項目をJSON形式で返してください。
数値は数字のみ（カンマなし）で返してください。金額はすべて税込みで返してください。
年は西暦で返してください（令和6年=2024年、令和7年=2025年、令和8年=2026年）。

{
  "property_name": "物件名（ヘッダーの「物件名」欄）",
  "settlement_month": "精算月（YYYY/MM形式。「○○年○○月分」から読み取る）",
  "rent_income": ヘッダーの「合計金額」（数値）,
  "electricity": 控除欄の電気料金（数値、なければ0）,
  "water": 表中の水道料の合計（数値、なければ0）,
  "management_fee": 管理手数料＋消費税の合計・税込（数値）,
  "transfer_amount": ヘッダーの「送金額」（数値）
}

JSONのみ返してください。説明不要です。`;

const SALARY_PROMPT = `この給与明細の画像を読み取り、以下の項目をJSON形式で返してください。
数値は数字のみ（カンマなし）で返してください。

{
  "employer_name": "勤務先名",
  "payment_month": "支給日（YYYY/MM/DD形式）",
  "gross_salary": 総支給額（数値）,
  "income_tax": 所得税（数値）,
  "net_salary": 差引支給額（数値）
}

JSONのみ返してください。説明不要です。`;

const BANKBOOK_PROMPT = `この通帳の画像を読み取り、全取引を以下のJSON配列で返してください。
数値は数字のみ（カンマなし）で返してください。

[
  {
    "date": "YYYY/MM/DD",
    "description": "摘要（振込先名や内容）",
    "withdrawal": 支払金額（出金、なければ0）,
    "deposit": 預り金額（入金、なければ0）,
    "balance": 差引残高（数値）
  }
]

JSONのみ返してください。説明不要です。`;

function getPromptForType(type: string): string {
  switch (type) {
    case "rent_statement": return RENT_PROMPT;
    case "salary_slip": return SALARY_PROMPT;
    case "bankbook": return BANKBOOK_PROMPT;
    default: return RENT_PROMPT;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { file_path, document_type } = await request.json();

    if (!file_path) {
      return NextResponse.json({ error: "file_path が必要です" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
    }

    const filePath = path.join(UPLOAD_DIR, file_path);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(file_path).toLowerCase();

    const client = new Anthropic({ apiKey });

    // 画像コンテンツブロックを作成
    type ImageBlock = {
      type: "image";
      source: { type: "base64"; media_type: "image/png" | "image/jpeg"; data: string };
    };
    const imageBlocks: ImageBlock[] = [];

    if (ext === ".pdf") {
      // PDFの各ページをsharpで画像に変換
      const sharp = (await import("sharp")).default;
      // sharpはPDF非対応なので、PDFはdocumentとして送る
      const base64 = fileBuffer.toString("base64");
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document" as const,
                source: {
                  type: "base64" as const,
                  media_type: "application/pdf" as const,
                  data: base64,
                },
              },
              { type: "text", text: getPromptForType(document_type) },
            ],
          },
        ],
      });
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        return NextResponse.json({ error: "APIからテキスト応答がありません" }, { status: 500 });
      }
      let jsonStr = textContent.text.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      return NextResponse.json({ parsed: Array.isArray(parsed) ? parsed[0] : parsed, raw_response: textContent.text });
    }

    // 画像の場合
    const base64 = fileBuffer.toString("base64");
    const mediaType = ext === ".png" ? "image/png" : "image/jpeg";
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg", data: base64 },
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            { type: "text", text: getPromptForType(document_type) },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ error: "APIからテキスト応答がありません" }, { status: 500 });
    }

    // JSONを抽出（```json ... ``` で囲まれている場合にも対応）
    let jsonStr = textContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return NextResponse.json({ parsed, raw_response: textContent.text });
  } catch (error) {
    console.error("Claude OCR error:", error);
    const message = error instanceof Error ? error.message : "Claude APIでの読み取りに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
