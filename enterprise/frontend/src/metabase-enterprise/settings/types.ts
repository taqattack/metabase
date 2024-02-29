import type { Settings } from "metabase-types/api";
import type { SettingsState, State } from "metabase-types/store";

export interface EnterpriseState extends State {
  settings: EnterpriseSettingsState;
}

interface EnterpriseSettingsState extends SettingsState {
  values: EnterpriseSettings;
}

export interface EnterpriseSettings extends Settings {
  "application-colors"?: Record<string, string>;
  "application-logo-url"?: string;
  "login-page-illustration"?: "default" | "no-illustration" | "custom";
  "login-page-illustration-custom"?: string;
  "landing-page"?: string;
  "ee-openai-model"?: string;
  "ee-openai-api-key"?: string;
  /**
   * @deprecated
   */
  application_logo_url?: string;
}

export type EnterpriseSettingKey = keyof EnterpriseSettings;
