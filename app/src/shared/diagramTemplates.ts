import {
  emptyRelicRelationshipMarkdownContent,
  emptyRelicWhyTreeMarkdownContent,
  type RelicDiagramType
} from "./diagramMarkdown";
import type { TranslationKey } from "./i18n";

export type RelicDiagramTemplateId =
  | "relationship-empty"
  | "why-tree-empty"
  | "why-tree-basic-cause"
  | "why-tree-incident-review";

export interface RelicDiagramTemplate {
  content: string;
  defaultNameKey: TranslationKey;
  descriptionKey: TranslationKey;
  id: RelicDiagramTemplateId;
  titleKey: TranslationKey;
  type: RelicDiagramType;
}

export const relicDiagramTemplates: readonly RelicDiagramTemplate[] = [
  {
    content: emptyRelicRelationshipMarkdownContent,
    defaultNameKey: "diagram.defaultNewRelationshipName",
    descriptionKey: "diagram.template.relationshipEmptyDescription",
    id: "relationship-empty",
    titleKey: "diagram.template.relationshipEmpty",
    type: "relationship"
  },
  {
    content: emptyRelicWhyTreeMarkdownContent,
    defaultNameKey: "diagram.defaultNewWhyTreeName",
    descriptionKey: "diagram.template.whyTreeEmptyDescription",
    id: "why-tree-empty",
    titleKey: "diagram.template.whyTreeEmpty",
    type: "why-tree"
  },
  {
    content: [
      "---",
      "type: why-tree",
      "title: 基本の原因分析",
      "---",
      "",
      "phenomenon:",
      "  title: 起きている問題",
      "  facts:",
      "    - 確認できている事実",
      "  solutions:",
      "    - 試す解決策",
      "  actions:",
      "    - 最初に行うこと",
      "  whys:",
      "    - title: 直接の原因",
      "      facts: []",
      "      solutions: []",
      "      actions: []",
      "      whys:",
      "        - title: さらに深い原因",
      "          facts: []",
      "          solutions: []",
      "          actions: []",
      ""
    ].join("\n"),
    defaultNameKey: "diagram.template.basicCauseName",
    descriptionKey: "diagram.template.basicCauseDescription",
    id: "why-tree-basic-cause",
    titleKey: "diagram.template.basicCause",
    type: "why-tree"
  },
  {
    content: [
      "---",
      "type: why-tree",
      "title: トラブル振り返り",
      "---",
      "",
      "phenomenon:",
      "  title: 発生したトラブル",
      "  facts:",
      "    - 実際に起きたこと",
      "    - 影響を受けた範囲",
      "  solutions:",
      "    - 再発防止策",
      "  actions:",
      "    - 担当者と期限を決める",
      "  whys:",
      "    - title: 直接のきっかけ",
      "      facts:",
      "        - その時点で分かっている証拠",
      "      solutions: []",
      "      actions: []",
      "      whys:",
      "        - title: 背景にある原因",
      "          facts: []",
      "          solutions:",
      "            - 仕組みとして直すこと",
      "          actions: []",
      ""
    ].join("\n"),
    defaultNameKey: "diagram.template.incidentReviewName",
    descriptionKey: "diagram.template.incidentReviewDescription",
    id: "why-tree-incident-review",
    titleKey: "diagram.template.incidentReview",
    type: "why-tree"
  }
];

export function relicDiagramTemplateById(id: RelicDiagramTemplateId): RelicDiagramTemplate | null {
  return relicDiagramTemplates.find((template) => template.id === id) ?? null;
}

export function relicDiagramTemplatesForType(type: RelicDiagramType): RelicDiagramTemplate[] {
  return relicDiagramTemplates.filter((template) => template.type === type);
}
