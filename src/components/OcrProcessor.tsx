"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OcrProcessorProps {
  documentId: string;
  documentType: string;
  imagePath: string;
  templateId?: string;
  onOcrComplete: (result: Record<string, unknown>) => void;
  autoStart?: boolean;
}

export default function OcrProcessor({
  documentId,
  documentType,
  imagePath,
  onOcrComplete,
  autoStart = false,
}: OcrProcessorProps) {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const runOcr = useCallback(async () => {
    setProcessing(true);
    setError(null);
    setStatus("Claude AIで読み取り中...");

    try {
      // Claude APIで画像読み取り
      const claudeRes = await fetch("/api/ocr-claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: imagePath, document_type: documentType }),
      });
      const claudeData = await claudeRes.json();
      if (!claudeRes.ok) throw new Error(claudeData.error);

      setStatus("仕訳を生成中...");

      // OCR結果を保存して仕訳生成
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: documentId,
          raw_text: claudeData.raw_response || "",
          parsed_data: claudeData.parsed,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatus("完了");
      onOcrComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み取りに失敗しました");
    } finally {
      setProcessing(false);
    }
  }, [documentId, imagePath, documentType, onOcrComplete]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      runOcr();
    }
  }, [autoStart, runOcr]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI読み取り</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={runOcr} disabled={processing}>
          {processing ? "読み取り中..." : "Claude AIで読み取り"}
        </Button>

        {processing && (
          <p className="text-sm text-blue-500">{status}</p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
