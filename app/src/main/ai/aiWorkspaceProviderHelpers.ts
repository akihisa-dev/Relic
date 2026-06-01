import type { AIWorkspaceFileOperation } from "../../shared/ipc";

export function formatPendingOperationForPrompt(operation: AIWorkspaceFileOperation): string {
  const lines = [
    `- id: ${operation.id}`,
    `- kind: ${operation.kind}`,
    `- path: ${operation.path}`,
    `- summary: ${operation.summary}`
  ];

  if (operation.kind !== "delete" && operation.content) {
    lines.push("```markdown", operation.content, "```");
  }

  return lines.join("\n");
}

export function createAIWorkspaceOperationId(kind: string): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
