"use client";

const ACCOUNTS = [
  "売上高",
  "産業医収入",
  "普通預金",
  "未払金",
  "未払費用",
  "預り金",
  "長期借入金",
  "定期積金",
  "役員貸付金",
  "管理費",
  "水道光熱費",
  "修繕費",
  "法定福利費",
  "支払利息",
  "支払手数料",
  "地代家賃",
  "車両費",
  "旅費交通費",
  "消耗品費",
  "接待交際費",
  "通信費",
  "新聞図書費",
  "福利厚生費",
  "保険料",
  "租税公課",
  "法人税等",
  "受取利息",
  "雑費",
];

interface AccountSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export default function AccountSelect({ value, onChange }: AccountSelectProps) {
  return (
    <select
      value={ACCOUNTS.includes(value) ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border px-1 py-0.5 text-xs"
    >
      {!ACCOUNTS.includes(value) && (
        <option value="">{value || "選択"}</option>
      )}
      {ACCOUNTS.map((a) => (
        <option key={a} value={a}>{a}</option>
      ))}
    </select>
  );
}
