"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import AccountSelect from "@/components/AccountSelect";
import MonthProgress from "@/components/MonthProgress";

interface CardJournal {
  id: string;
  date: string;
  debit_account: string;
  debit_sub_account: string;
  credit_account: string;
  credit_sub_account: string;
  amount: number;
  description: string;
}

interface CardTransaction {
  date: string;
  description: string;
  amount: number;
  institution: string;
  category_major: string;
  category_minor: string;
  memo: string;
  is_transfer: boolean;
}

export default function CardPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [journals, setJournals] = useState<CardJournal[]>([]);
  const [saved, setSaved] = useState(false);

  const updateJournalAccount = (id: string, field: "debit_account", value: string) => {
    setJournals((prev) =>
      prev.map((j) => (j.id === id ? { ...j, [field]: value } : j))
    );
  };

  const handleUpload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setTransactions([]);
    setJournals([]);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/card", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTransactions(data.transactions);
      setJournals(data.journals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleSave = async () => {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">カード明細取込</h1>
      <MonthProgress source="card" />

      <Card>
        <CardContent className="pt-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv";
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
            <p className="text-sm text-gray-600">マネーフォワードのカード明細CSVをドラッグ&ドロップ</p>
            <p className="mt-1 text-xs text-gray-400">または クリックして選択</p>
          </div>
          {loading && <p className="mt-3 text-sm text-blue-500">解析中...</p>}
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {journals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>仕訳 ({journals.length}件)</span>
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
                  <TableHead>貸方</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>摘要</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journals.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs">{j.date}</TableCell>
                    <TableCell className="text-xs">
                      <AccountSelect value={j.debit_account} onChange={(v) => updateJournalAccount(j.id, "debit_account", v)} />
                    </TableCell>
                    <TableCell className="text-xs">{j.credit_account} {j.credit_sub_account && `(${j.credit_sub_account})`}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{j.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      {j.description}
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(j.description + " 勘定科目")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-500 hover:underline"
                        title="Google検索"
                      >🔍</a>
                      <a
                        href={`https://claude.ai/new?q=${encodeURIComponent(j.description + " これは法人の経費として何の勘定科目になりますか？")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-purple-500 hover:underline"
                        title="Claudeに聞く"
                      >💬</a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
