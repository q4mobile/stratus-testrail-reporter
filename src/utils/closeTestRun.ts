import { setFailed } from "@actions/core";
import type TestRailApiClient from "testrail-api";
import { extractError } from "./error";

export function closeTestRun(testRailClient: TestRailApiClient, runId: number): void {
  testRailClient.closeRun(runId).catch((error: any) => {
    setFailed(`Failed to close the TestRail run: ${extractError(error)}`);
  });
}
