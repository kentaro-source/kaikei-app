"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import ImageUploader from "@/components/ImageUploader";

const DOCUMENT_TYPES = [
  { value: "rent_statement", label: "家賃精算書" },
  { value: "salary_slip", label: "給与明細" },
  { value: "receipt", label: "経費レシート" },
  { value: "other", label: "その他" },
];

export default function UploadPage() {
  const router = useRouter();
  const [documentType, setDocumentType] = useState("rent_statement");

  const handleUploadComplete = (document: Record<string, unknown>) => {
    window.location.href = `/documents/${document.id}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">書類アップロード</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">書類の種類を選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DOCUMENT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setDocumentType(type.value)}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  documentType === type.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <Label className="mb-2 block text-sm font-medium">
          {DOCUMENT_TYPES.find((t) => t.value === documentType)?.label}をアップロード
        </Label>
        <ImageUploader
          documentType={documentType}
          onUploadComplete={handleUploadComplete}
        />
      </div>
    </div>
  );
}
