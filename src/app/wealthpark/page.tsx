"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import AccountSelect from "@/components/AccountSelect";
import MonthProgress from "@/components/MonthProgress";

interface ExpenseItem {
  name: string;
  amount: number;
}

interface PropertyData {
  property_name: string;
  settlement_month: string;
  income: {
    rent: number;
    common_fee: number;
    parking: number;
    other: number;
    total: number;
  };
  expense: {
    items: ExpenseItem[];
    total: number;
  };
  transfer_amount: number;
}

interface ReportData {
  owner_name: string;
  management_company: string;
  month: string;
  properties: PropertyData[];
}

interface JournalEntry {
  id: string;
  date: string;
  debit_account: string;
  debit_sub_account: string;
  credit_account: string;
  credit_sub_account: string;
  amount: number;
  description: string;
}

export default function WealthParkPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [saved, setSaved] = useState(false);

  const updateJournal = (id: string, field: string, value: string) => {
    setJournals((prev) =>
      prev.map((j) => (j.id === id ? { ...j, [field]: value } : j))
    );
  };

  const handleUpload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setReport(null);
    setJournals([]);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/wealthpark", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReport(data.report);

      // 仕訳を生成
      const jRes = await fetch("/api/wealthpark/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties: data.report.properties }),
      });
      const jData = await jRes.json();
      if (!jRes.ok) throw new Error(jData.error);

      setJournals(jData.journals);
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
        body: JSON.stringify({ journals, month: report?.month }),
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
      <h1 className="text-2xl font-bold">WealthPark取込</h1>
      <MonthProgress source="wealthpark" />

      {/* アップロードエリア */}
      <Card>
        <CardContent className="pt-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pdf";
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
            <p className="text-sm text-gray-600">WealthParkの月次収支報告書PDFをドラッグ&ドロップ</p>
            <p className="mt-1 text-xs text-gray-400">または クリックして選択</p>
          </div>
          {loading && <p className="mt-3 text-sm text-blue-500">解析中...</p>}
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {/* 読み取り結果 */}
      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {report.month} 月次収支 — {report.properties.length}物件
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.properties.map((prop, i) => (
              <div key={i} className="rounded border p-4">
                <h3 className="mb-2 font-bold">{prop.property_name}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <div>賃貸料: <span className="font-mono">{prop.income.rent.toLocaleString()}</span></div>
                  <div>共益費: <span className="font-mono">{prop.income.common_fee.toLocaleString()}</span></div>
                  <div>駐車料: <span className="font-mono">{prop.income.parking.toLocaleString()}</span></div>
                  <div className="font-bold">収入合計: <span className="font-mono">{prop.income.total.toLocaleString()}</span></div>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  {prop.expense.items.map((item, j) => (
                    <div key={j} className="flex justify-between text-gray-600">
                      <span>{item.name}</span>
                      <span className="font-mono">-{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-1 font-bold">
                    <span>送金額</span>
                    <span className="font-mono">{prop.transfer_amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 生成された仕訳 */}
      {journals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>生成された仕訳 ({journals.length}件)</span>
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
                {journals.map((j) => (
                  <TableRow key={j.id}>
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
      )}
    </div>
  );
}
