import { getBooleanInput, getInput, setFailed, setOutput } from "@actions/core";
import { isEmpty } from "lodash";
import moment from "moment-timezone";
import { INewTestRun } from "testrail-api";
import { extractError } from "../utils";
import { Environment, InputKey, RunInputs, TestRun, TestRailOptions } from "./run.definition";
import {extractTestResults, getTrunkTestRuns} from "./run.utils";
import { TestrailService } from "../services";

const environment = process.env.NODE_ENV || "debug";
export async function run(): Promise<void> {
  const jiraKey = getInput(InputKey.JiraKey);
  const regressionMode = getBooleanInput(InputKey.RegressionMode);
  const projectId = parseInt(getInput(InputKey.ProjectId), 10);
  const suiteId = parseInt(getInput(InputKey.SuiteId), 10);
  const trunkMode = !projectId && !suiteId;
  const testRailOptions = {
    host: getInput(InputKey.NetworkUrl),
    user: getInput(InputKey.Username),
    password: getInput(InputKey.ApiKey),
  };
    try {
      let testRuns: TestRun[];
      if (trunkMode) {
        testRuns = await getTrunkTestRuns();
        for (const testRun of testRuns) {
          console.log(testRun);
          await reportToTestrail(jiraKey, trunkMode, regressionMode, testRun, testRailOptions);
        }
      } else {
        testRuns = [{projectId: projectId, suiteId: suiteId}];
        await reportToTestrail(jiraKey, trunkMode, regressionMode, testRuns[0], testRailOptions);
      }
      console.log(testRuns);
      setOutput("completion_time", new Date().toTimeString());
      setOutput("test_runs", testRuns); // output run_id for future steps
    } catch (error) {
      setFailed(`Stratus TestRail Reporter encountered an issue: ${extractError(error)}`);
    }
}

async function reportToTestrail(jiraKey: string, trunkMode: boolean, regressionMode: boolean, testRun: TestRun, testRailOptions: TestRailOptions): Promise<void> {
  const runOptions: RunInputs = {
    jiraKey,
    trunkMode,
    regressionMode,
    testRun,
  };
  const testrailService = new TestrailService(testRailOptions, runOptions);

  const results = trunkMode
      ? await extractTestResults(testRun.projectId.toString(), testRun.suiteId.toString())
      : await extractTestResults();

  if (isEmpty(results)) {
    setFailed("No results for reporting to TestRail were found.");
    throw new Error();
  }

  const {body: suite} = await testrailService.getTestSuite();

  if (isEmpty(suite)) {
    setFailed("A TestRail Suite could not be found for the provided suite id.");
    throw new Error();
  }

  const milestone = await testrailService.establishMilestone();
  // @ts-ignore because the type for INewTestRun is incorrect
  const testRunOptions: INewTestRun = {
    suite_id: testRun.suiteId,
    // @ts-ignore because milestone_id is not required
    milestone_id: trunkMode || regressionMode ? milestone?.id : null,
    name: trunkMode
        ? suite?.name
        : `[${environment}][${suite?.name}][${moment()
            .tz("America/New_York")
            .format("YYYY-MM-DD h:mm:ss")}] Automated Test Run`,
    include_all: true,
  };

  const result = await testrailService.establishTestRun(testRunOptions, results);
  testRun.runId = result.id;

  if (isEmpty(testRun)) {
    setFailed("A TestRail Run could not be established.");
    throw new Error();
  }

  await testrailService.addTestRunResults(testRun.runId, results);

  if ((trunkMode && result.untested_count === 0) || (!trunkMode && !regressionMode)) {
    await testrailService.closeTestRun(testRun.runId);
  }

  if (trunkMode) {
    await testrailService.sweepUpTestRuns(milestone?.id);
  }

  if (environment === Environment.Production && suite?.name?.includes("E2E")) {
    await testrailService.closeMilestone(milestone?.id);
  }
}