"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import OcrProcessor from "@/components/OcrProcessor";
import OcrResultEditor from "@/components/OcrResultEditor";

interface DocumentData {
  id: string;
  type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  status: string;
}

interface OcrResultData {
  id: string;
  raw_text: string;
  parsed_data: string;
  confirmed: number;
}

interface JournalEntryData {
  id: string;
  date: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  description: string;
  exported: number;
}

const TYPE_LABELS: Record<string, string> = {
  rent_statement: "家賃精算書",
  salary_slip: "給与明細",
  receipt: "経費レシート",
  other: "その他",
};

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResultData | null>(null);
  const [journals, setJournals] = useState<JournalEntryData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      setDocument(data.document);
      setOcrResult(data.ocrResult || null);
      setJournals(data.journals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOcrComplete = () => {
    fetchData();
  };

  const handleConfirm = async (parsedData: Record<string, unknown>) => {
    try {
      // OCR結果を再送信して仕訳を再生成
      await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: id,
          raw_text: ocrResult?.raw_text || "",
          parsed_data: parsedData,
        }),
      });

      // ステータスを確認済みに更新
      await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });

      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p className="text-gray-500">読み込み中...</p>;
  if (!document) return <p className="text-red-500">書類が見つかりません</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ダッシュボード
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold">書類詳細</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            <Badge variant="outline">{TYPE_LABELS[document.type]}</Badge>
            {document.file_name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-500">
            アップロード: {document.uploaded_at} / ステータス: {document.status}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/images/${document.file_path}`}
            alt={document.file_name}
            className="max-h-96 rounded border object-contain"
          />
        </CardContent>
      </Card>

      {!ocrResult && (
        <OcrProcessor
          documentId={document.id}
          documentType={document.type}
          imagePath={document.file_path}
          onOcrComplete={handleOcrComplete}
        />
      )}

      {ocrResult && (
        <OcrResultEditor
          ocrResult={ocrResult}
          documentType={document.type}
          onConfirm={handleConfirm}
        />
      )}

      {journals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">生成された仕訳</CardTitle>
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
                    <TableCell>{j.date}</TableCell>
                    <TableCell>{j.debit_account}</TableCell>
                    <TableCell>{j.credit_account}</TableCell>
                    <TableCell className="text-right">
                      {j.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{j.description}</TableCell>
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
