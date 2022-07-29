import { setFailed, setOutput } from "@actions/core";
import type TestRailApiClient from "testrail-api";
import type { INewTestResult } from "testrail-api";
import { closeTestRun } from "./closeTestRun";
import { extractError } from "./error";

export function addResults(testRailClient: TestRailApiClient, runId: number, testRailResults: INewTestResult[], regressionMode: boolean): void {
  testRailClient
    .addResultsForCases(runId, testRailResults)
    .then(() => {
      if (!regressionMode) {
        closeTestRun(testRailClient, runId);
      }

      setOutput("completion_time", new Date().toTimeString());
      setOutput("run_id", runId); // output run_id for future steps
    })
    .catch((error: any) => {
      setFailed(`Failed to add test case results to TestRail: ${extractError(error)}`);

      if (!regressionMode) {
        closeTestRun(testRailClient, runId);
      }
    });
}
