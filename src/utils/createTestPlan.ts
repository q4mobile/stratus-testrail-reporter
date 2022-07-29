import { setFailed } from "@actions/core";
import type TestRailApiClient from "testrail-api";
import type { INewTestResult, ITestRun } from "testrail-api";
import { extractError } from "./error";
import { addResults } from "./results";

export function createTestPlan(testRailClient: TestRailApiClient, projectId: number, testPlanOptions: any, testRailResults: INewTestResult[], regressionMode: boolean): void {
  testRailClient.addPlan(projectId, testPlanOptions).then((addPlanResponse) => {
    const { entries } = addPlanResponse.body ?? {};
    const { runs } = (entries || [])[0] ?? {};
    const { id } = (runs || [])[0] as ITestRun ?? {};

    addResults(testRailClient, id, testRailResults, regressionMode);
  })
  .catch((error: any) => {
    setFailed(`Failed to add a new TestRail plan: ${extractError(error)}`);
  });
}
