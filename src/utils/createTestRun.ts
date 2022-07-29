import { setFailed } from "@actions/core";
import type TestrailApiClient from "testrail-api";
import type { INewTestRun } from "testrail-api";
import { extractError } from "./error";
import { addResults } from "./results";

export function createTestRun(testRailClient: TestrailApiClient, projectId: number, testRunOptions: INewTestRun, testRailResults: TestrailApiClient.INewTestResult[], regressionMode: boolean): void {
  testRailClient
    .addRun(projectId, testRunOptions)
    .then((addRunResponse) => {
      const { id } = addRunResponse.body ?? {};

      addResults(testRailClient, id, testRailResults, regressionMode);
    })
    .catch((error: any) => {
      setFailed(`Failed to add a new TestRail run: ${extractError(error)}`);
    });
}
