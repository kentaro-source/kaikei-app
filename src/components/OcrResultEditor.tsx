"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OcrResultEditorProps {
  ocrResult: {
    id: string;
    raw_text: string;
    parsed_data: string;
  };
  documentType: string;
  imagePath?: string;
  onConfirm: (parsedData: Record<string, unknown>) => void;
}

const RENT_FIELDS = [
  { key: "property_name", label: "物件名", type: "text" },
  { key: "settlement_month", label: "精算月", type: "text", placeholder: "2025/03" },
  { key: "rent_income", label: "賃貸料合計", type: "number" },
  { key: "electricity", label: "電気料金", type: "number" },
  { key: "water", label: "水道料金", type: "number" },
  { key: "management_fee", label: "管理手数料（税込）", type: "number" },
  { key: "transfer_amount", label: "送金額", type: "number" },
];

const SALARY_FIELDS = [
  { key: "employer_name", label: "勤務先名", type: "text" },
  { key: "payment_month", label: "支給日", type: "text", placeholder: "2026/02/25" },
  { key: "gross_salary", label: "総支給額", type: "number" },
  { key: "income_tax", label: "所得税", type: "number" },
  { key: "net_salary", label: "差引支給額", type: "number", auto: true },
];

function formatNumber(val: unknown): string {
  if (val === undefined || val === null || val === "") return "";
  const num = typeof val === "string" ? parseInt(val, 10) : val;
  if (typeof num !== "number" || isNaN(num)) return "";
  return num.toLocaleString();
}

function parseNumberInput(val: string): number | undefined {
  const cleaned = val.replace(/[,，\s]/g, "");
  if (!cleaned) return undefined;
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? undefined : num;
}

export default function OcrResultEditor({
  ocrResult,
  documentType,
  imagePath,
  onConfirm,
}: OcrResultEditorProps) {
  const parsed = JSON.parse(ocrResult.parsed_data || "{}");
  const [formData, setFormData] = useState<Record<string, unknown>>(parsed);
  const [showRawText, setShowRawText] = useState(false);

  const fields = documentType === "rent_statement" ? RENT_FIELDS : SALARY_FIELDS;

  const handleChange = (key: string, value: string, type: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: type === "number" ? parseNumberInput(value) : value,
    }));
  };

  // 差引支給額の自動計算（総支給額 - 所得税）
  useEffect(() => {
    if (documentType !== "salary_slip") return;
    const gross = (formData.gross_salary as number) || 0;
    const tax = (formData.income_tax as number) || 0;
    const calculated = gross - tax;
    if (calculated > 0 && !formData.net_salary) {
      setFormData((prev) => ({ ...prev, net_salary: calculated }));
    }
  }, [documentType, formData.gross_salary, formData.income_tax, formData.net_salary]);

  const calcNet = () => {
    const gross = (formData.gross_salary as number) || 0;
    const tax = (formData.income_tax as number) || 0;
    const calculated = gross - tax;
    if (calculated > 0) {
      setFormData((prev) => ({ ...prev, net_salary: calculated }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">OCR結果の確認・修正</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 画像とフォームを横並び */}
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* 書類画像 */}
          {imagePath && (
            <div className="shrink-0 lg:w-1/2">
              {imagePath.toLowerCase().endsWith(".pdf") ? (
                <embed
                  src={`/api/images/${imagePath}`}
                  type="application/pdf"
                  className="h-[400px] w-full rounded border"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/images/${imagePath}`}
                  alt="書類"
                  className="max-h-[400px] w-full rounded border object-contain"
                />
              )}
            </div>
          )}

          {/* 入力フォーム */}
          <div className={`flex-1 space-y-3 ${imagePath ? "" : "w-full"}`}>
            {fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={field.key} className="text-sm font-medium">
                  {field.label}
                  {field.type === "number" && formData[field.key] != null && (
                    <span className="ml-2 text-xs text-gray-400">
                      {formatNumber(formData[field.key])}円
                    </span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={field.key}
                    type={field.type === "number" ? "text" : field.type}
                    inputMode={field.type === "number" ? "numeric" : undefined}
                    placeholder={(field as { placeholder?: string }).placeholder || ""}
                    value={
                      field.type === "number"
                        ? formData[field.key]?.toString() || ""
                        : (formData[field.key] as string) || ""
                    }
                    onChange={(e) => handleChange(field.key, e.target.value, field.type)}
                    className={
                      parsed[field.key] !== undefined && parsed[field.key] !== null
                        ? ""
                        : "border-orange-300 bg-orange-50"
                    }
                  />
                  {(field as { auto?: boolean }).auto && documentType === "salary_slip" && (
                    <Button variant="outline" size="sm" onClick={calcNet} type="button" className="shrink-0 text-xs">
                      自動計算
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => onConfirm(formData)}>確認して仕訳生成</Button>
          <Button variant="outline" onClick={() => setShowRawText(!showRawText)}>
            {showRawText ? "生テキストを隠す" : "生テキストを表示"}
          </Button>
        </div>

        {showRawText && (
          <div className="space-y-1">
            <Label>OCR生テキスト</Label>
            <Textarea
              value={ocrResult.raw_text}
              readOnly
              rows={10}
              className="font-mono text-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
