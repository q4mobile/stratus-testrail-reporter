export enum Environment {
  Local = "local",
  Debug = "debug",
  Development = "dev",
  Stage = "stage",
  Production = "prod",
}

export enum InputKey {
  NetworkUrl = "network_url",
  Username = "username",
  ApiKey = "api_key",
  JiraKey = "jira_key",

  RegressionMode = "regression_mode",
  TargetBranch = "target_branch",
  ProjectId = "project_id",
  SuiteId = "suite_id",
  ExcludeE2E = "exclude_e2e",
}

export type TestRunConfig = {
  projectId: number;
  suiteId: number;
  runId?: number;
};

export interface RunInputs {
  jiraKey: string | undefined;
  trunkMode: boolean;
  regressionMode: boolean;
  testRunConfig: TestRunConfig;
}

export type TestRailOptions = {
  host: string;
  user: string;
  password: string;
};
