"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Template {
  id: string;
  name: string;
  description: string | null;
  document_type: string;
  regions: string;
  created_at: string;
}

interface Region {
  id: string;
  label: string;
  field_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const FIELD_OPTIONS = [
  { value: "property_name", label: "物件名" },
  { value: "settlement_month", label: "精算月" },
  { value: "rent_income", label: "家賃収入" },
  { value: "management_fee", label: "管理費" },
  { value: "repair_reserve", label: "修繕積立金" },
  { value: "transfer_amount", label: "振込額" },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(console.error);
  }, []);

  const addRegion = () => {
    setRegions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: "",
        field_name: "rent_income",
        x: 0,
        y: 0,
        width: 100,
        height: 30,
      },
    ]);
  };

  const updateRegion = (id: string, key: keyof Region, value: string | number) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r))
    );
  };

  const removeRegion = (id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, regions }),
      });
      const data = await res.json();
      setTemplates((prev) => [data.template, ...prev]);
      setShowForm(false);
      setName("");
      setDescription("");
      setRegions([]);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">テンプレート管理</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "キャンセル" : "新規テンプレート"}
        </Button>
      </div>

      <p className="text-sm text-gray-500">
        家賃精算書のレイアウトが固定の場合、読取領域を設定して精度を高めることができます。
        座標はピクセル単位で、画像の左上が原点(0,0)です。
      </p>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">新規テンプレート</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>テンプレート名</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: ○○管理会社 家賃精算書" />
            </div>
            <div className="space-y-2">
              <Label>説明</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="テンプレートの説明（任意）" rows={2} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>読取領域</Label>
                <Button variant="outline" size="sm" onClick={addRegion}>
                  領域を追加
                </Button>
              </div>

              {regions.map((region) => (
                <div key={region.id} className="rounded border p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">フィールド</Label>
                      <select
                        value={region.field_name}
                        onChange={(e) => updateRegion(region.id, "field_name", e.target.value)}
                        className="w-full rounded border p-1.5 text-sm"
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">ラベル</Label>
                      <Input
                        value={region.label}
                        onChange={(e) => updateRegion(region.id, "label", e.target.value)}
                        placeholder="表示名"
                        className="text-sm"
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeRegion(region.id)} className="mt-5 text-red-500">
                      削除
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(["x", "y", "width", "height"] as const).map((key) => (
                      <div key={key}>
                        <Label className="text-xs">{key}</Label>
                        <Input
                          type="number"
                          value={region[key]}
                          onChange={(e) => updateRegion(region.id, key, parseInt(e.target.value) || 0)}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleSave} disabled={saving || !name}>
              {saving ? "保存中..." : "テンプレートを保存"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">テンプレートがまだありません。</p>
        ) : (
          templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between pt-4">
                <div>
                  <div className="font-medium">{t.name}</div>
                  {t.description && <div className="text-sm text-gray-500">{t.description}</div>}
                  <div className="text-xs text-gray-400">
                    領域数: {JSON.parse(t.regions).length} / 作成: {t.created_at}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
