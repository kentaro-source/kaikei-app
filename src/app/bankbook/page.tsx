"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import AccountSelect from "@/components/AccountSelect";

interface BankTransaction {
  date: string;
  description: string;
  withdrawal: number;
  deposit: number;
  balance: number;
}

interface BankJournalEntry {
  id: string;
  date: string;
  debit_account: string;
  debit_sub_account: string;
  credit_account: string;
  credit_sub_account: string;
  amount: number;
  description: string;
}

interface TransactionWithRule {
  transaction: BankTransaction;
  action: "journal" | "skip";
  skip_reason?: string;
  journal?: BankJournalEntry;
  journals?: BankJournalEntry[];
}

export default function BankbookPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("2025/12/01");
  const [results, setResults] = useState<TransactionWithRule[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateJournal = (id: string, field: string, value: string) => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.journal && r.journal.id === id) {
          return { ...r, journal: { ...r.journal, [field]: value } };
        }
        if (r.journals) {
          const updated = r.journals.map((j) =>
            j.id === id ? { ...j, [field]: value } : j
          );
          return { ...r, journals: updated };
        }
        return r;
      })
    );
  };

  const handleUpload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setSaved(false);

    try {
      // 1. ファイルをアップロード
      setError("アップロード中...");
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("type", "bankbook");

      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error);

      // 2. Claude APIで読み取り（30秒以上かかる場合あり）
      setError(null);
      const ocrRes = await fetch("/api/ocr-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: uploadData.document.file_path,
          document_type: "bankbook",
        }),
      });
      const ocrData = await ocrRes.json();
      if (!ocrRes.ok) throw new Error(ocrData.error);

      // 3. 仕訳ルール適用
      const parsed = Array.isArray(ocrData.parsed) ? ocrData.parsed : [ocrData.parsed];
      const ruleRes = await fetch("/api/bankbook/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: parsed, start_date: startDate }),
      });
      const ruleData = await ruleRes.json();
      if (!ruleRes.ok) throw new Error(ruleData.error);

      setResults(ruleData.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み取りに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleSave = async () => {
    const journals = results
      .filter((r) => r.action === "journal")
      .flatMap((r) => r.journals || (r.journal ? [r.journal] : []));

    try {
      const res = await fetch("/api/wealthpark/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    }
  };

  const journalResults = results.filter((r) => r.action === "journal");
  const allJournals = journalResults.flatMap((r) => r.journals || (r.journal ? [r.journal] : []));
  const skipResults = results.filter((r) => r.action === "skip");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">通帳取込</h1>

      {/* 設定 */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <Label htmlFor="startDate">取込開始日</Label>
            <Input
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="2025/12/01"
              className="mt-1 max-w-xs"
            />
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*,.pdf";
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) handleUpload(f);
              };
              input.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 transition-colors ${
              dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }`}
          >
            <p className="text-sm text-gray-600">通帳のスキャン画像をドラッグ&ドロップ</p>
            <p className="mt-1 text-xs text-gray-400">PDF・画像対応（Claude AIで読み取り）</p>
          </div>
          {loading && <p className="mt-3 text-sm text-blue-500">Claude AIで読み取り中...</p>}
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {/* 結果 */}
      {results.length > 0 && (
        <>
          {/* 仕訳対象 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>仕訳対象 ({allJournals.length}件)</span>
                {!saved ? (
                  <Button onClick={handleSave} size="sm">保存してCSV出力可能にする</Button>
                ) : (
                  <span className="text-sm text-green-600">保存済み</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日付</TableHead>
                    <TableHead>借方</TableHead>
                    <TableHead>補助</TableHead>
                    <TableHead>貸方</TableHead>
                    <TableHead>補助</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead>摘要</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allJournals.map((j) => (
                    <TableRow key={j.id} className={j.debit_account === "【要確認】" || j.credit_account === "【要確認】" ? "bg-orange-50" : ""}>
                      <TableCell className="text-xs">{j.date}</TableCell>
                      <TableCell className="text-xs">
                        <AccountSelect value={j.debit_account} onChange={(v) => updateJournal(j.id, "debit_account", v)} />
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{j.debit_sub_account}</TableCell>
                      <TableCell className="text-xs">
                        <AccountSelect value={j.credit_account} onChange={(v) => updateJournal(j.id, "credit_account", v)} />
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{j.credit_sub_account}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{j.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{j.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 除外 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <button onClick={() => setShowSkipped(!showSkipped)} className="flex items-center gap-2">
                  <span>除外 ({skipResults.length}件)</span>
                  <span className="text-xs text-gray-400">{showSkipped ? "▲" : "▼"}</span>
                </button>
              </CardTitle>
            </CardHeader>
            {showSkipped && (
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日付</TableHead>
                      <TableHead>摘要</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>除外理由</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skipResults.map((r, i) => (
                      <TableRow key={i} className="text-gray-400">
                        <TableCell className="text-xs">{r.transaction.date}</TableCell>
                        <TableCell className="text-xs">{r.transaction.description}</TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {r.transaction.deposit > 0 ? `+${r.transaction.deposit.toLocaleString()}` : `-${r.transaction.withdrawal.toLocaleString()}`}
                        </TableCell>
                        <TableCell className="text-xs">{r.skip_reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
