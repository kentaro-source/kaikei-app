import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import fs from "fs";

// Claude APIの応答に時間がかかるため
export const maxDuration = 120;

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

const BANKBOOK_PROMPT = `これは日本の銀行通帳（普通預金）のスキャン画像です。全取引を正確に読み取ってJSON配列で返してください。

■ 年月日の変換ルール：
通帳の年月日は「YY-MM-DD」形式で、YYは令和の年号です。
- 07 → 2025年（令和7年）
- 08 → 2026年（令和8年）
例：07-12-15 → 2025/12/15

■ 入出金の判別ルール（最重要）：
通帳には3つの金額列があります：
1. 左列「お支払金額」= 出金（withdrawal）：口座から出ていくお金
2. 中列「お預り金額」= 入金（deposit）：口座に入ってくるお金
3. 右列「差引残高」= 残高（balance）

判別方法：
- 前の行の残高より増えていれば → その行は入金（deposit）
- 前の行の残高より減っていれば → その行は出金（withdrawal）
- 「振込」で始まる摘要は入金であることが多い（他者からの振込入金）
- 「200」という記号の後に続く取引は口座引落（出金）であることが多い

■ 摘要の読み取りルール（重要）：
- 摘要には金額を含めないでください。金額は別の列（withdrawal/deposit）に入れます
- 「*89,360UC」の場合 → descriptionは「UC」、withdrawalは89360
- 「*24,035RKS(ギガプライス)」の場合 → descriptionは「RKS(ギガプライス)」、withdrawalは24035
- 「200」は記号番号なので摘要に含めないでください
- 半角カタカナをそのまま正確に転記してください
- ダブルクォートやバックスラッシュは使わず、そのまま半角カタカナで記載

■ よくある振込先名（参考）：
- 振込カ)ダイコウ トチタテモノ = 大興土地建物管理（不動産管理会社）
- 振込ミヤザキセンカ(カ ダイ = 宮崎千果株式会社（産業医）
- 振込カ)コアクリエイトシステム = コアクリエイトシステム
- UC = クレジットカード引落
- RKS(ギガプライス) = インターネット回線
- SMBC(UMEインターネット = インターネット回線
- ミツイスミトモカード = クレジットカード引落

■ 数値ルール：
- カンマなしの整数で返してください
- *（アスタリスク）は金額の前にある記号なので無視してください
- 金額はdescriptionに含めず、必ずwithdrawalまたはdepositに入れてください

[
  {
    "date": "YYYY/MM/DD",
    "description": "摘要テキスト（200は除く）",
    "withdrawal": 出金額（入金の場合は0）,
    "deposit": 入金額（出金の場合は0）,
    "balance": 差引残高
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
        model: "claude-sonnet-5",
        max_tokens: 8096,
        thinking: { type: "disabled" },
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
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        const fixed = jsonStr.replace(/\\"/g, "'").replace(/[\x00-\x1F]/g, "");
        parsed = JSON.parse(fixed);
      }
      return NextResponse.json({ parsed: Array.isArray(parsed) ? parsed[0] : parsed, raw_response: textContent.text });
    }

    // 画像の場合（Claude APIの10MB制限に合わせて圧縮）
    const sharp = (await import("sharp")).default;
    let imageBuffer = fileBuffer;
    // 10MB以下になるまで圧縮（base64は約4/3倍になるので7MBを目安）
    const MAX_SIZE = 7 * 1024 * 1024;
    if (fileBuffer.length > MAX_SIZE) {
      let quality = 80;
      let width = 2400;
      while (true) {
        imageBuffer = await sharp(fileBuffer)
          .resize({ width, withoutEnlargement: true })
          .jpeg({ quality })
          .toBuffer();
        if (imageBuffer.length <= MAX_SIZE || (quality <= 40 && width <= 1200)) break;
        if (quality > 40) quality -= 10;
        else width = Math.floor(width * 0.8);
      }
    }
    const base64 = imageBuffer.toString("base64");
    const mediaType = ext === ".png" && fileBuffer.length <= MAX_SIZE ? "image/png" : "image/jpeg";
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg", data: base64 },
    });

    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8096,
      thinking: { type: "disabled" },
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

    // JSONパース（エラー時は修復を試みる）
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // 半角カタカナの濁点等でJSONが壊れる場合がある
      // バックスラッシュ+ダブルクォートの修復
      const fixed = jsonStr
        .replace(/\\"/g, "'")
        .replace(/[\x00-\x1F]/g, "");
      try {
        parsed = JSON.parse(fixed);
      } catch (e2) {
        return NextResponse.json({ error: (e2 as Error).message }, { status: 500 });
      }
    }

    return NextResponse.json({ parsed, raw_response: textContent.text });
  } catch (error) {
    console.error("Claude OCR error:", error);
    const message = error instanceof Error ? error.message : "Claude APIでの読み取りに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
