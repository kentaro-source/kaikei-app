# kaikei-app

## プロジェクト概要
紙の書類（給与明細・家賃精算書）をスマホ撮影 → OCR → 弥生会計CSV出力するWebアプリ。

## 技術スタック
- Next.js 16 + TypeScript (strict mode)
- SQLite (better-sqlite3, WAL mode)
- Tesseract.js (日本語OCR)
- Tailwind CSS v4 + shadcn/ui
- パスエイリアス: `@/*` → `./src/*`

## ディレクトリ構成
```
src/
  app/          # Next.js App Router ページ・API
  components/   # UIコンポーネント
  lib/          # DB, OCR, 仕訳変換, CSV出力
data/           # SQLite DB, アップロード画像（gitignore済み）
samples/        # サンプル書類（gitignore済み、機密情報）
```

## 開発ルール
- 応答は日本語
- コミットメッセージは英語
- UI テキストは日本語
- CSV出力は Shift_JIS（弥生会計互換）

## コマンド
- `npm run dev` — 開発サーバー起動
- `npm run build` — ビルド
- `npm run lint` — ESLint 実行
