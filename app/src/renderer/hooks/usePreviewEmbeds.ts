import { useEffect, useState } from "react";

import { extractEmbedTargets, maxEmbeddedFileLength, type EmbedState } from "../previewMarkdown";

export function usePreviewEmbeds(content: string, workspacePath: string | null | undefined): Map<string, EmbedState> {
  const [embeds, setEmbeds] = useState<Map<string, EmbedState>>(new Map());

  useEffect(() => {
    const targets = extractEmbedTargets(content);

    if (targets.length === 0 || !window.relic) {
      setEmbeds(new Map());
      return;
    }

    let canceled = false;
    setEmbeds(new Map(targets.map((target) => [target, { status: "loading" } as EmbedState])));

    void Promise.all(
      targets.map(async (target) => {
        const result = await window.relic!.readMarkdownFile({ path: target });

        if (!result.ok) {
          return [target, { status: "error", message: result.error.message } as EmbedState] as const;
        }

        if (result.value.content.length > maxEmbeddedFileLength) {
          return [target, { status: "large", name: result.value.name } as EmbedState] as const;
        }

        return [
          target,
          { status: "loaded", content: result.value.content, name: result.value.name } as EmbedState
        ] as const;
      })
    ).then((entries) => {
      if (!canceled) setEmbeds(new Map(entries));
    });

    return () => {
      canceled = true;
    };
  }, [content, workspacePath]);

  return embeds;
}
