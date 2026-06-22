export interface FeatureToggles {
  chronicle: boolean;
  chronicleSettings: boolean;
  tools: boolean;
  frontmatter: boolean;
  rightPanelLinks: boolean;
  rightPanelOutline: boolean;
}

export type UserDefinedFieldType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "boolean"
  | "select"
  | "multi-select"
  | "url";

export interface UserDefinedField {
  choices?: string[];
  name: string;
  type: UserDefinedFieldType;
}

export interface FrontmatterTemplate {
  fieldNames: string[];
  name: string;
}

export const defaultUserDefinedFields: UserDefinedField[] = [];
export const defaultFrontmatterTemplates: FrontmatterTemplate[] = [];

export const defaultFeatureToggles: FeatureToggles = {
  chronicle: false,
  chronicleSettings: false,
  tools: false,
  frontmatter: false,
  rightPanelLinks: true,
  rightPanelOutline: true
};

export type EditorFont = "system" | "gothic" | "mincho" | "mono";
export type EditorMaxWidth = "550px" | "660px" | "800px" | "none";
export type FrontmatterDateFormat = "dmy" | "mdy" | "system" | "ymd";

export type AppTheme = "light" | "dark" | "system";
export type AppLanguage = "system" | "en" | "ja";

export interface EditorSettings {
  font: EditorFont;
  fontSize: number;
  frontmatterDateFormat: FrontmatterDateFormat;
  language: AppLanguage;
  lineHeight: number;
  maxWidth: EditorMaxWidth;
  showLineNumbers: boolean;
  spellCheck: boolean;
  theme: AppTheme;
}

export const defaultEditorSettings: EditorSettings = {
  font: "system",
  fontSize: 16,
  frontmatterDateFormat: "ymd",
  language: "en",
  lineHeight: 1.7,
  maxWidth: "660px",
  showLineNumbers: false,
  spellCheck: true,
  theme: "system"
};
