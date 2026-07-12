import { relicClient } from "../relicClient";
import { useEffect, useMemo, useState } from "react";

import { extractEmbedTargets, maxEmbeddedFileLength, type EmbedState } from "../previewMarkdown";
import { runWithConcurrency } from "../concurrency";

const emptyEmbeds = new Map<string, EmbedState>();
const maxConcurrentEmbeds = 2;

export function usePreviewEmbeds(content: string, workspacePath: string | null | undefined): Map<string, EmbedState> {
  const [embeds, setEmbeds] = useState<Map<string, EmbedState>>(new Map());
  const targets = useMemo(() => extractEmbedTargets(content), [content]);

  useEffect(() => {
    if (targets.length === 0 || !relicClient.current) {
      return;
    }

    let canceled = false;
    setEmbeds(new Map(targets.map((target) => [target, { status: "loading" }])));

    const loadEmbedTasks = targets.map((target): (() => Promise<[string, EmbedState]>) => async () => {
      try {
        const result = await relicClient.current!.readMarkdownFile({ path: target });

        if (!result.ok) {
          return [target, { status: "error", message: result.error.message }];
        }

        if (result.value.content.length > maxEmbeddedFileLength) {
          return [target, { status: "large", name: result.value.name }];
        }

        return [target, {
          status: "loaded",
          content: result.value.content,
          name: result.value.name
        }];
      } catch (error) {
        return [target, {
          status: "error",
          message: error instanceof Error ? error.message : "Failed to read embedded file."
        }];
      }
    });

    void runWithConcurrency(loadEmbedTasks, maxConcurrentEmbeds).then((entries) => {
      if (!canceled) {
        setEmbeds(new Map(entries));
      }
    });

    return () => {
      canceled = true;
    };
  }, [targets, workspacePath]);

  return targets.length > 0 && relicClient.current ? embeds : emptyEmbeds;
}
