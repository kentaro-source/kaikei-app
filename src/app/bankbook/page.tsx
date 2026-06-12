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
import MonthProgress from "@/components/MonthProgress";

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [saved, setSaved] = useState(false);

  const excludeJournal = (id: string) => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.journal && r.journal.id === id) {
          return { ...r, action: "skip" as const, skip_reason: "手動除外", journal: undefined };
        }
        if (r.journals) {
          const target = r.journals.find((j) => j.id === id);
          if (target) {
            const remaining = r.journals.filter((j) => j.id !== id);
            return remaining.length > 0
              ? { ...r, journals: remaining }
              : { ...r, action: "skip" as const, skip_reason: "手動除外", journals: undefined };
          }
        }
        return r;
      })
    );
  };

  const restoreSkipped = (transactionIndex: number) => {
    setResults((prev) => {
      const skippedIndices: number[] = [];
      prev.forEach((r, i) => {
        if (r.action === "skip") skippedIndices.push(i);
      });
      const targetIndex = skippedIndices[transactionIndex];
      if (targetIndex === undefined) return prev;

      return prev.map((r, i) => {
        if (i !== targetIndex) return r;
        const t = r.transaction;
        const amount = t.deposit > 0 ? t.deposit : t.withdrawal;
        // 入金は産業医収入、出金は要確認として復活
        const cleanedDesc = t.description.replace(/^\*?[\d,\.]+/, "").trim();
        const journal = t.deposit > 0
          ? {
              id: crypto.randomUUID(),
              date: t.date,
              debit_account: "普通預金",
              debit_sub_account: "宮崎太陽銀行",
              credit_account: "産業医収入",
              credit_sub_account: "",
              amount,
              description: `産業医収入 ${cleanedDesc}`,
            }
          : {
              id: crypto.randomUUID(),
              date: t.date,
              debit_account: "【要確認】",
              debit_sub_account: "",
              credit_account: "普通預金",
              credit_sub_account: "宮崎太陽銀行",
              amount,
              description: cleanedDesc,
            };
        return { transaction: t, action: "journal" as const, journal };
      });
    });
  };

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

  const addFiles = useCallback((files: File[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
  }, []);

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = useCallback(async (files: File[]) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setSaved(false);

    try {
      const allTransactions: Record<string, unknown>[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // 1. ファイルをアップロード
        setError(`アップロード中... (${i + 1}/${files.length})`);
        const uploadForm = new FormData();
        uploadForm.append("file", file);
        uploadForm.append("type", "bankbook");

        const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error);

        // 2. Claude APIで読み取り
        setError(`Claude AIで読み取り中... (${i + 1}/${files.length})`);
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

        const parsed = Array.isArray(ocrData.parsed) ? ocrData.parsed : [ocrData.parsed];
        allTransactions.push(...parsed);
      }

      // 3. 仕訳ルール適用（全ファイルまとめて重複除外）
      setError(null);
      const parsed = allTransactions;
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
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) addFiles(files);
  }, [addFiles]);

  const startProcessing = useCallback(() => {
    if (pendingFiles.length > 0) {
      handleUpload(pendingFiles);
      setPendingFiles([]);
    }
  }, [pendingFiles, handleUpload]);

  const handleSave = async () => {
    const journals = results
      .filter((r) => r.action === "journal")
      .flatMap((r) => r.journals || (r.journal ? [r.journal] : []));

    try {
      const res = await fetch("/api/wealthpark/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journals, source: "bankbook" }),
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
      <MonthProgress source="bankbook" />

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
              input.multiple = true;
              input.onchange = (e) => {
                const files = Array.from((e.target as HTMLInputElement).files || []);
                if (files.length > 0) addFiles(files);
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
          {/* 追加済みファイル */}
          {pendingFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium">{pendingFiles.length}枚の画像を追加済み</p>
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs">
                    <span>{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600">×</button>
                  </div>
                ))}
              </div>
              <Button onClick={startProcessing} disabled={loading}>
                {loading ? "読み取り中..." : `${pendingFiles.length}枚を読み取り開始`}
              </Button>
            </div>
          )}
          {loading && error && <p className="mt-3 text-sm text-blue-500">{error}</p>}
          {!loading && error && <p className="mt-3 text-sm text-red-500">{error}</p>}
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
                    <TableHead></TableHead>
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
                      <TableCell>
                        <button onClick={() => excludeJournal(j.id)} className="text-xs text-red-400 hover:text-red-600">除外</button>
                      </TableCell>
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
                      <TableHead></TableHead>
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
                        <TableCell>
                          <button onClick={() => restoreSkipped(i)} className="text-xs text-blue-500 hover:text-blue-700">復活</button>
                        </TableCell>
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
