export interface ReportCardVM {
  id: string;
  createdAt: string; // ISO
  weekNumber: number;
  sequence: number;
  cardioDays: number;
  hasNote: boolean;
  imageThumbUrls: string[];
}
