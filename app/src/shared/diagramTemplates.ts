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
  | "why-tree-incident-review"
  | "why-tree-risk-analysis"
  | "why-tree-improvement-plan"
  | "why-tree-decision-review";

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
  },
  {
    content: [
      "---",
      "type: why-tree",
      "title: リスク分析",
      "---",
      "",
      "phenomenon:",
      "  title: 気になるリスク",
      "  facts:",
      "    - すでに見えている兆候",
      "  solutions:",
      "    - リスクを下げる対策",
      "  actions:",
      "    - 監視する指標を決める",
      "  whys:",
      "    - title: リスクが起きる理由",
      "      facts: []",
      "      solutions:",
      "        - 予防策を用意する",
      "      actions: []",
      "      whys:",
      "        - title: 見落としやすい背景",
      "          facts: []",
      "          solutions: []",
      "          actions: []",
      ""
    ].join("\n"),
    defaultNameKey: "diagram.template.riskAnalysisName",
    descriptionKey: "diagram.template.riskAnalysisDescription",
    id: "why-tree-risk-analysis",
    titleKey: "diagram.template.riskAnalysis",
    type: "why-tree"
  },
  {
    content: [
      "---",
      "type: why-tree",
      "title: 改善案検討",
      "---",
      "",
      "phenomenon:",
      "  title: 改善したい状態",
      "  facts:",
      "    - 現在の困りごと",
      "  solutions:",
      "    - 改善案",
      "  actions:",
      "    - 小さく試すこと",
      "  whys:",
      "    - title: 今の状態が続く理由",
      "      facts: []",
      "      solutions:",
      "        - 変えられる仕組み",
      "      actions: []",
      ""
    ].join("\n"),
    defaultNameKey: "diagram.template.improvementPlanName",
    descriptionKey: "diagram.template.improvementPlanDescription",
    id: "why-tree-improvement-plan",
    titleKey: "diagram.template.improvementPlan",
    type: "why-tree"
  },
  {
    content: [
      "---",
      "type: why-tree",
      "title: 意思決定整理",
      "---",
      "",
      "phenomenon:",
      "  title: 決めたいこと",
      "  facts:",
      "    - 判断材料",
      "  solutions:",
      "    - 候補案",
      "  actions:",
      "    - 次に確認すること",
      "  whys:",
      "    - title: 迷っている理由",
      "      facts:",
      "        - 不確実な点",
      "      solutions:",
      "        - 判断基準を決める",
      "      actions: []",
      ""
    ].join("\n"),
    defaultNameKey: "diagram.template.decisionReviewName",
    descriptionKey: "diagram.template.decisionReviewDescription",
    id: "why-tree-decision-review",
    titleKey: "diagram.template.decisionReview",
    type: "why-tree"
  }
];

export function relicDiagramTemplateById(id: RelicDiagramTemplateId): RelicDiagramTemplate | null {
  return relicDiagramTemplates.find((template) => template.id === id) ?? null;
}

export function relicDiagramTemplatesForType(type: RelicDiagramType): RelicDiagramTemplate[] {
  return relicDiagramTemplates.filter((template) => template.type === type);
}
