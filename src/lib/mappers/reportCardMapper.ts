import type { ReportListItemDTO } from "@/types";
import type { ReportCardVM } from "@/components/dashboard/types";

export function mapReportToCardVM(item: ReportListItemDTO): ReportCardVM {
  const date = new Date(item.created_at);
  const weekNumber = getISOWeek(date);
  return {
    id: item.id,
    createdAt: item.created_at,
    weekNumber,
    sequence: item.sequence,
    cardioDays: item.cardio_days ?? 0,
    hasNote: !!item.note,
    imageThumbUrls: (item.image_thumb_urls as string[]) ?? [],
  };
}

function getISOWeek(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
