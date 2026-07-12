import type { WorkspaceFileIndexEntry } from "../../shared/ipc";

export interface WorkspaceFileIndex {
  entries: WorkspaceFileIndexEntry[];
  stats: WorkspaceFileIndexStats;
  records: WorkspaceFileIndexRecord[];
}

export interface WorkspaceFileIndexRecord extends WorkspaceFileIndexEntry {
  lines: string[];
  searchable: boolean;
  contentHash?: string;
}

export interface WorkspaceFileIndexStats {
  cacheHitCount: number;
  cachedContentHitCount: number;
  cacheMissCount: number;
  readFileCount: number;
  readHeadCount: number;
  statCount: number;
  targetPathCount: number;
  unreadableCount: number;
}
