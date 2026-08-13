import type { WorkspaceFileIndexEntry } from "../../shared/ipc";

export const maxWorkspaceFileIndexRecords = 100_000;
export const maxWorkspaceFileIndexLinesPerRecord = 100_000;
export const maxWorkspaceFileIndexAggregateLineBytes = 64 * 1024 * 1024;

export interface WorkspaceFileIndex {
  entries: WorkspaceFileIndexEntry[];
  stats: WorkspaceFileIndexStats;
  records: WorkspaceFileIndexRecord[];
}

export interface WorkspaceFileIndexRecord extends WorkspaceFileIndexEntry {
  /** Identity of the filesystem entry used to build this record. */
  dev?: number;
  ino?: number;
  lines: string[];
  searchable: boolean;
  realPath?: string;
  contentHash?: string;
  /** Hash of the same bounded prefix used for large-file markers. */
  headHash?: string;
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
