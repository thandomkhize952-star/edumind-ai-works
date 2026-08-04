import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExportFormat } from "@/lib/report-doc";

export function ExportFormatSelect({
  value,
  onChange,
  label = "Format",
}: {
  value: ExportFormat;
  onChange: (v: ExportFormat) => void;
  label?: string | null;
}) {
  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      <Select value={value} onValueChange={(v) => onChange(v as ExportFormat)}>
        <SelectTrigger aria-label="Download format">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="csv">CSV</SelectItem>
          <SelectItem value="pdf">PDF</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
