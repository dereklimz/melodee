export interface SampleEntry {
  id: string;
  name: string;
  file: string;
  rootNote: number | null;
  tag?: string;
}

export type SampleLibrary = Record<string, SampleEntry[]>;
