"use client";

import { useState } from "react";
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
  onConfirm: (parsedData: Record<string, unknown>) => void;
}

const RENT_FIELDS = [
  { key: "property_name", label: "物件名", type: "text" },
  { key: "settlement_month", label: "精算月", type: "text" },
  { key: "rent_income", label: "家賃収入", type: "number" },
  { key: "management_fee", label: "管理費", type: "number" },
  { key: "repair_reserve", label: "修繕積立金", type: "number" },
  { key: "transfer_amount", label: "振込額", type: "number" },
];

const SALARY_FIELDS = [
  { key: "employer_name", label: "勤務先名", type: "text" },
  { key: "payment_month", label: "支給月", type: "text" },
  { key: "gross_salary", label: "総支給額", type: "number" },
  { key: "income_tax", label: "所得税", type: "number" },
  { key: "resident_tax", label: "住民税", type: "number" },
  { key: "social_insurance", label: "社会保険料", type: "number" },
  { key: "net_salary", label: "差引支給額", type: "number" },
];

export default function OcrResultEditor({
  ocrResult,
  documentType,
  onConfirm,
}: OcrResultEditorProps) {
  const parsed = JSON.parse(ocrResult.parsed_data || "{}");
  const [formData, setFormData] = useState<Record<string, unknown>>(parsed);
  const [showRawText, setShowRawText] = useState(false);

  const fields = documentType === "rent_statement" ? RENT_FIELDS : SALARY_FIELDS;

  const handleChange = (key: string, value: string, type: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: type === "number" ? (value ? parseInt(value, 10) : undefined) : value,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">OCR結果の確認・修正</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type}
                value={formData[field.key]?.toString() || ""}
                onChange={(e) => handleChange(field.key, e.target.value, field.type)}
                className={
                  parsed[field.key] !== undefined && parsed[field.key] !== null
                    ? ""
                    : "border-orange-300 bg-orange-50"
                }
              />
              {(!parsed[field.key] && parsed[field.key] !== 0) && (
                <p className="text-xs text-orange-500">OCRで検出できませんでした</p>
              )}
            </div>
          ))}
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
