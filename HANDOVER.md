# HANDOVER.md

初見のAIがこのファイルだけを読んで開発を継続できるよう記載。事実ベース、推測は含めない。

## 1. プロジェクトの目的

個人事業主（フリーランス産業医）＋自社法人（株式会社DRK企画）のオーナー個人が使う会計補助Webアプリ。以下を弥生会計デスクトップ版に取り込めるCSVに変換して出力する。

- **家賃**: 不動産管理会社（大興土地建物管理）から毎月配布されるWealthPark月次収支報告書PDF
- **通帳**: 宮崎太陽銀行の紙通帳をスキャンした画像（オンラインバンキング非対応のためOCR経由）
- **カード**: マネーフォワードME からエクスポートしたクレジットカード明細CSV
- **給与**: 複数勤務先の給与明細を手入力（産業医収入は通帳側で自動化）
- **確定申告シミュレーション**: 課税所得予測とふるさと納税上限の目安表示

弥生の役割は最終台帳。自動連携が効かない領域を本アプリで橋渡しする。

## 2. 技術構成

### 言語・フレームワーク
- **Next.js 15.5** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS v4** + shadcn/ui コンポーネント（`src/components/ui/`）
- ローカル PC でのみ動作（`npm run dev` で `http://localhost:3000`）
- 外部公開したい場合は `npm run tunnel` で Cloudflare Tunnel（`cloudflared` CLI が別途必要）

### データベース
- **better-sqlite3** (WAL モード、外部キー ON)
- ファイルパス: `data/db.sqlite`（プロジェクトルート直下）
- **重要**: `data/*.sqlite*` は `.gitignore` 対象。DB は各PCに個別に生成される
- スキーマ定義: `src/lib/db.ts` の `initTables()` に一部だけ書かれている
- 実際のスキーマは以下のテーブルが存在（`.sqlite` から確認）:
  - `documents`: 従来のOCR用アップロード書類（現状ほぼ未使用）
  - `ocr_results`: 従来のOCR結果（現状ほぼ未使用）
  - `templates`: 空
  - `journal_entries`: 仕訳データ。`source` カラム（`wealthpark` / `wealthpark_personal` / `bankbook` / `card` / `other`）で振分け。`exported` で出力済フラグ
  - `salary_entries`: 手入力の給与データ（勤務先・支給日・課税支給額・源泉徴収税額・健保・厚年・子育て支援金）
  - `tax_sim_data`: 確定申告シミュレーションの入力値（1行だけ、id='current' UPSERT）
  - `tenants`: WealthPark PDFから抽出した入居者情報（物件×部屋×月でUNIQUE）
- `salary_entries` と `tax_sim_data` は `ALTER TABLE` で後付けカラムが増えているため、DB作り直し時は最新 API 経由で作成すること（`src/lib/db.ts` の定義には未反映のカラムがある）

### 外部サービス
- **Anthropic Claude API**: 通帳スキャンのOCR用（`claude-sonnet-4-20250514`）。10MB制限があるため `sharp` で圧縮してから送信
  - APIキー: `.env.local` の `ANTHROPIC_API_KEY`
  - `.env*` は `.gitignore` 対象。**コミット禁止**
  - キーが必要なのは `/api/ocr-claude` のみ
- **WealthPark**: PDF は手動ダウンロード。API連携なし
- **マネーフォワードME**: CSV は手動ダウンロード（Shift_JIS）
- **弥生会計デスクトップ版**: 出力CSV（Shift_JIS）を「仕訳日記帳 → ファイル → インポート」で取り込む

### 主要ライブラリ
- `pdf-parse@1.1.1`: WealthPark PDF のテキスト抽出（テキストベースPDF）
- `pdfjs-dist@3.11`: クライアント側でPDFを画像化（`src/components/ImageUploader.tsx`）。v3固定・`next.config.ts` で `canvas` を alias false
- `tesseract.js`: 給与明細画像OCR用（現状ほぼ使われていない）
- `sharp`: 画像圧縮（Claude APIの10MB制限対策）
- `iconv-lite`: Shift_JIS ⇔ UTF-8 変換（弥生CSV出力・マネーフォワードCSV読み込み）
- `@anthropic-ai/sdk`

### ディレクトリ
- `src/app/page.tsx`: ダッシュボード
- `src/app/{wealthpark,bankbook,card,salary,tax-sim,export,upload}/page.tsx`: 各機能ページ
- `src/app/api/*/route.ts`: API Routes
- `src/lib/`: 純粋ロジック（パーサー・仕訳生成・CSV生成）
- `src/components/`: 共有UIコンポーネント（`AccountSelect`, `MonthProgress`, `ImageUploader`, `OcrProcessor`, `OcrResultEditor`）
- `data/uploads/`: アップロードファイル置き場（.gitignore対象）
- `.claude/launch.json`: Claude Preview MCP用の dev サーバー設定
- `samples/`: 実物サンプル書類（.gitignore対象・機密含む）
- `test/data/05-versions-space.pdf`: `pdf-parse` v1.1.1 が起動時に読みに行くダミーファイル（削除禁止）

### ナビゲーション（`src/app/layout.tsx`）
`会計アシスタント / 家賃 / 通帳 / カード / 給与 / 確定申告 / CSV出力`

## 3. 実装済み機能

### 家賃取込（`/wealthpark`）
- WealthPark月次収支報告書PDFをドロップ → `pdf-parse` でテキスト抽出 → 物件データと入居者データをパース
- パーサー: `src/lib/wealthparkParser.ts`
  - `parseWealthParkPdf()`: 月次PDF → 物件収支リスト
  - `parseWealthParkAnnualPdf()`: 年次PDF → 物件×月データ（**UIから未接続、関数のみ存在**）
  - `extractTenants()`: 収入明細ページから入居者情報を抽出
- 物件名の正規化 (`PROPERTY_NAME_MAP`):
  - `祇園ＫＡＷＡＮＯビルIII` / `祇園KAWANOビルIII` / `祇園KAWANOビルⅢ` → `祇園kawanoビルⅢ`
  - `オーシャンハイツ桜ヶ丘` → `オーシャンハイツ`
  - `グリーンゲーブルズ` は完全除外（`EXCLUDED_PROPERTIES`）
- 仕訳生成: `src/lib/wealthparkJournals.ts` `wealthParkToJournals(property, date?, isPersonal)`
  - 収入: 借方=普通預金(宮崎太陽銀行) / 貸方=売上高 or 賃貸料（isPersonal時）で補助科目=物件名
  - 支出: 借方=マッピング科目・補助=物件名 / 貸方=普通預金(宮崎太陽銀行)
  - 法人=`売上高`+`外注費`、個人=`賃貸料`+`外注管理費` （管理手数料）
  - その他マッピング: 水道・電気→水道光熱費、エレベータ保守料→修繕費、別借駐車場代→地代家賃、貼り替え/取付/交換/修理/調整/補修/清掃/その他 → 修繕費、営業促進費 → 広告宣伝費
- UI: 法人/個人トグル、DBの既存入居者データを表示、月額と年間の集計表（部屋×契約者ごと）
- 個人モードの場合 `source='wealthpark_personal'`、法人は `wealthpark`
- 月次進捗バー `MonthProgress` を表示（法人=12月〜11月、個人=暦年）

### 通帳取込（`/bankbook`）
- 通帳スキャン画像を複数ファイルまとめてアップロード。プレビュー後に「読み取り開始」ボタンで一括処理
- Claude API（`/api/ocr-claude`）で画像OCR → JSON配列で取引一覧を取得
  - 画像が7MB超なら `sharp` で 2400px→1200px, quality 80→40 に段階的縮小して10MB以内に収める
- サーバー側で `processBankTransactions()` を実行
  - 取込開始日フィルター（デフォルト `2025/12/01`。法人期首）
  - 重複除外（日付+withdrawal+deposit+balance で判定）
  - 除外ルール: 大興土地建物管理からの入金は除外（WealthParkで処理済み）
  - 仕訳ルール（`JOURNAL_RULES`）: 産業医収入 / ローン返済 / 約定利息 / 定期積金 / 社会保険料（3行仕訳） / インターネット代（RKS→オーシャンハイツ、SMBC→祇園） / 受取利息 / 法人税等 / 税理士報酬 / UC/三井住友カード引落 / 振込手数料 / 資金移動
  - 金額で物件判別: 定期積金は10万以上→宮崎太陽銀行(オーシャン)、未満→宮崎太陽銀行(祇園kawano)。ローン返済/利息は20万以上→オーシャンハイツ、未満→祇園kawanoビルⅢ
  - 産業医収入マッチしなかった入金 → 産業医収入で自動仕訳。マッチしなかった出金 → `【要確認】` として保存（手動修正）
- UI: 除外一覧に「復活」ボタン（除外解除して仕訳対象に戻す）、各仕訳に手動「除外」ボタン、借方/貸方の科目プルダウン編集可能
- 保存時 `source='bankbook'`
- Claude APIプロンプトは `src/app/api/ocr-claude/route.ts` の `BANKBOOK_PROMPT`。振込先名の既知エイリアス（大興土地建物管理、宮崎千果、UC、RKS、SMBC、ミツイスミトモカード）をヒントとして与えている

### カード取込（`/card`）
- マネーフォワードME からダウンロードしたクレジットカード明細CSV（Shift_JIS）をドロップ
- パーサー: `src/lib/cardCsvParser.ts`
  - 振替（`振替=1`）は除外
  - 摘要から `ETC` を検出 → `旅費交通費`（説明文優先）
  - マネーフォワードの中項目/大項目 → 弥生勘定科目マップ（ガソリン→車両費、外食→接待交際費 など。マッチしなければ雑費）
- 仕訳: 借方=カテゴリ勘定科目、貸方=未払金(補助=クレジットカード)
- 保存時 `source='card'`

### 給与入力（`/salary`）
- 手入力フォーム。EMPLOYERS: 株式会社DRK企画 / 同仁病院 / 森のクリニック / 若草病院 / 小林保養院
- 株式会社DRK企画 を選ぶと健保・厚年・子ども子育て支援金の入力欄が追加表示
- 一覧に勤務先ごと・月別の小計表示
- POST/GET/DELETE `/api/salary` で `salary_entries` テーブルに直接保存
- **注意**: このAPIは `journal_entries` には仕訳を書かない。給与は税シミュレーション専用データとして分離管理

### 確定申告シミュレーション（`/tax-sim`）
- `salary_entries` から給与収入を自動集計
- 給与所得控除（2025年改正 最低65万円）、所得金額調整控除（850万超）を自動計算
- 基礎控除（2026年分暫定: 所得132万以下 95万〜2350万超 0円）を自動計算
- 給与の健保+厚年+子育て支援金を社会保険料控除に自動加算（手入力欄と合算）
- 不動産所得は「計算済み額」を1入力（収入-経費の内訳は別途弥生で管理）
- 生命保険料/地震保険料/医療費/iDeCo/住宅ローン控除を手入力（500ms debounce で自動保存）
- 出力: 総所得金額、所得控除合計、課税所得、所得税額、源泉徴収済み差引、ふるさと納税上限
- 所得税ブラケット表 `TAX_BRACKETS` は 2024年基準（2025/2026年も同じ）
- 保存時 `tax_sim_data` の `id='current'` を UPSERT

### CSV出力（`/export`）
- `journal_entries` から未出力（`exported=0`）のみをデフォルト表示
- 期間・エンティティ（法人/個人/全て）でフィルター
- 選択行のみ弥生形式CSV（Shift_JIS、`\r\n` 改行、25列）でダウンロード
- CSV仕様: `src/lib/yayoiCsv.ts` に定義。全行 `税区分=対象外` 固定（税抜処理なし。金額はすべて税込み）
- 出力後は `exported=1` に更新
- 個別の仕訳削除ボタンあり（`/api/export/delete`）

### 進捗表示（`MonthProgress` コンポーネント）
- `journal_entries.source` で絞り込み、月ごとの件数と合計を12ヶ月分カラーバーで表示
- 法人は12月〜11月、個人（`wealthpark_personal`）は暦年
- WealthParkページは `showDate={false}`（月1回取込なので日付不要）

### PWA
- `public/manifest.json` + `public/sw.js`（Service Worker）+ `public/icon-192.png` / `icon-512.png`

### ダッシュボード（`/`）
- 未処理・OCR済・確認済・出力済 のカウント表示。これは旧 `documents` テーブルベースで、現状ほぼ使われていない
- 「書類をアップロード」ボタンは `/upload` に飛ぶが、`/upload` は給与明細のOCR用で汎用UIではない（残置）

## 4. 既知のバグ・未解決の問題

- **`src/lib/db.ts` のスキーマ定義が実際のDBと乖離**: `salary_entries` / `tax_sim_data` / `tenants` は各APIの `ensureTable()` 側で個別作成しており `db.ts` に定義がない。`journal_entries.source` カラムも `db.ts` には無く、APIレイヤーで暗黙的に使われている。新しいPCでのセットアップ時、最初にAPIを叩かないとテーブルが揃わない
- **`data/db.sqlite` は共有されない**: `.gitignore` 対象なので、複数PC間でのデータ引き継ぎは手動コピー（またはクラウドストレージ経由）が必要
- **給与ページに過去のバグでデータが消失した履歴**: `body.health_insurance` を `body` 未定義で参照するバグが `21e9980` で混入し `285bd57` で修正されるまでの間、全てのPOSTが500エラーで保存失敗していた。復旧不可
- **OCRの摘要読み取り精度が不安定**: 同じ通帳の別スキャンで振込元名の読み取り結果が毎回変わる。除外/仕訳キーワードを追加し続けているが根本解決していない
- **税理士報酬の源泉徴収の分割仕訳は未実装**: 通帳には振込額（源泉差引後）しか出ないため。手動で預り金の仕訳を追加する必要あり
- **社会保険料の3行仕訳の会社負担・従業員負担額はハードコード** (`bankbookJournals.ts` の `SOCIAL_INSURANCE`)。会社負担11,294 / 従業員負担10,978 固定。料率変更時は要修正
- **年次PDFパーサー `parseWealthParkAnnualPdf` はUIから未接続**: 関数だけ存在
- **`src/app/upload/page.tsx` と `/api/ocr` /`/api/upload` は旧OCR系の残骸**: `tesseract.js` を含むこれらは現状の主要フローでは使われていない
- **ダッシュボード `/` は旧DBスキーマ依存**: `documents` テーブルの集計を出しているが、現運用では書類はここに登録されない
- **確定申告シミュレーションの年度切替なし**: 現状2026年の税制ハードコード。翌年以降は要修正
- **税制ブラケット（所得税率）は2024年基準**: `TAX_BRACKETS` は2025・2026年でも変わっていないため問題は出にくいが、変更時は要修正
- **REQUIREMENTS.md の初期構想は現状と大きく乖離**: `documents` / `ocr_results` / `templates` テーブルベースの汎用OCR構想は放棄され、書類種別ごと専用フロー（WealthPark/bankbook/card/salary）に置き換わっている
- **弥生の仕訳インポート時に「不正な行」エラーが出ることがある**: 原因未特定。過去にはUTF-8で出力していたバグを Shift_JIS に修正して解消したが、別要因での再発報告あり
- **通帳画像を1枚ずつスキャンして重複除外**: 見開き2枚を別画像でアップロードした場合の重複は、日付+金額+残高で照合しているため、Claude APIの読み取り誤差で残高が1円でも変わると重複除外に失敗する

## 5. 残タスクと次に着手すべきこと

### すぐ効きそうな改善
1. **`src/lib/db.ts` を各APIの `ensureTable()` と整合させて統一**（`initTables` を全テーブル網羅に）。DBセットアップ時の事故を防ぐ
2. **旧OCR系（`/upload`, `/api/ocr`, `/api/documents`, `tesseract.js`, `OcrProcessor`, `OcrResultEditor` など）の整理**: 現運用で使われていないので削除するか、給与明細用に作り直すか判断
3. **社会保険料の会社/従業員負担額を設定画面から編集可能に**（現状ハードコード）
4. **税理士報酬の請求書登録UI**を作り、通帳から検出された振込額と紐付けて源泉徴収の3行仕訳を自動生成
5. **通帳OCRの摘要マッチング再設計**: OCR誤読ゆらぎに強い方式（例: 金額×日付から候補提示、履歴からの学習）

### 継続運用の課題
6. **税率テーブル・給与所得控除・基礎控除の年度更新**（毎年12月頃）
7. **確定申告シミュレーションに雑所得/一時所得/配当所得の欄追加**（現状は給与＋不動産のみ）
8. **バックアップ運用**: `data/db.sqlite` の自動バックアップ（Cloudflare Tunnel経由の別PCアクセス時のデータロスに備える）
9. **弥生インポートの「不正な行」エラーの原因調査**: 実際にエラーが出たCSVを保存して差分解析するフローの整備

### 触るときの注意
- **APIキーを含むファイル**（`.env.local`）はコミットしない。`.gitignore` で除外済み
- **`data/uploads/`（アップロード原本）、`samples/`（実書類サンプル）、`data/*.sqlite*`** は個人情報を含む。コミット禁止（`.gitignore` 済み）
- **弥生の補助科目名は完全一致必須**: `祇園kawanoビルⅢ` の小文字と大文字を混在させると別補助科目扱いになる。既知の正確な名称は本ファイル §3「家賃取込」の `PROPERTY_NAME_MAP` を参照
- **Claude APIは有料**（残高は Anthropic Console で確認）。プロンプト検証時は同じ画像を何度も投げないよう注意
- Windows環境のみで運用実績あり。macOS/Linux では未検証

## 参考リソース
- `REQUIREMENTS.md`: 初期構想（現状と大きく異なる部分あり、参考程度）
- `README.md`: `create-next-app` のデフォルト（実用情報なし）
- git 履歴: 直近30コミットで現在の設計判断の経緯を追える
