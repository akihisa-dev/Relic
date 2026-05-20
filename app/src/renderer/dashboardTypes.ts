export interface DashboardFileStats {
  chars: number;
  folder: string;
  hasFrontmatter: boolean;
  headings: number;
  links: number;
  name: string;
  path: string;
  properties: Record<string, unknown>;
  tags: string[];
  words: number;
}

export interface DashboardTreemapRect {
  count: number;
  fill: string;
  height: number;
  label: string;
  showLabel: boolean;
  textLight: boolean;
  width: number;
  x: number;
  y: number;
}

export interface DashboardStats {
  averageChars: number;
  files: DashboardFileStats[];
  folderCount: number;
  folderDistribution: Array<{ count: number; label: string }>;
  frontmatterFiles: number;
  lengthBuckets: Array<{ count: number; label: string }>;
  maxChars: number;
  tagDistribution: Array<{ count: number; label: string }>;
  totalChars: number;
  totalFiles: number;
  totalHeadings: number;
  totalLinks: number;
  totalWords: number;
}

export interface LoadedMarkdownFile {
  content: string;
  name: string;
  path: string;
}
