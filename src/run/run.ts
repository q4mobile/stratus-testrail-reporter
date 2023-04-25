import { getBooleanInput, getInput, setFailed, setOutput } from "@actions/core";
import { isEmpty } from "lodash";
import moment from "moment-timezone";
import { INewTestRun } from "testrail-api";
import { extractError } from "../utils";
import { Environment, InputKey, RunInputs, TestRunConfig, TestRailOptions } from "./run.definition";
import { extractTestResults, getTrunkTestRunConfigs } from "./run.utils";
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
    let testRunConfigs: TestRunConfig[];

    if (trunkMode) {
      testRunConfigs = await getTrunkTestRunConfigs();

      for (const testRun of testRunConfigs) {
        await reportToTestrail(jiraKey, trunkMode, regressionMode, testRun, testRailOptions);
      }
    } else {
      testRunConfigs = [{ projectId: projectId, suiteId: suiteId }];

      await reportToTestrail(
        jiraKey,
        trunkMode,
        regressionMode,
        testRunConfigs[0],
        testRailOptions
      );
    }

    setOutput("completion_time", new Date().toTimeString());
    setOutput("test_runs", testRunConfigs); // output run_id for future steps
  } catch (error) {
    setFailed(`Stratus TestRail Reporter encountered an issue: ${extractError(error)}`);
  }
}

async function reportToTestrail(
  jiraKey: string,
  trunkMode: boolean,
  regressionMode: boolean,
  testRunConfig: TestRunConfig,
  testRailOptions: TestRailOptions
): Promise<void> {
  const runOptions: RunInputs = {
    jiraKey,
    trunkMode,
    regressionMode,
    testRunConfig,
  };
  const testrailService = new TestrailService(testRailOptions, runOptions);

  const results = trunkMode
    ? await extractTestResults(testRunConfig.projectId, testRunConfig.suiteId)
    : await extractTestResults();

  if (isEmpty(results)) {
    setFailed("No results for reporting to TestRail were found.");
    throw new Error();
  }

  const { body: suite } = await testrailService.getTestSuite();

  if (isEmpty(suite)) {
    setFailed("A TestRail Suite could not be found for the provided suite id.");
    throw new Error();
  }

  const milestone = await testrailService.establishMilestone();
  // @ts-ignore because the type for INewTestRun is incorrect
  const testRunOptions: INewTestRun = {
    suite_id: testRunConfig.suiteId,
    // @ts-ignore because milestone_id is not required
    milestone_id: trunkMode || regressionMode ? milestone?.id : null,
    name: trunkMode
      ? suite?.name
      : `[${environment}][${suite?.name}][${moment()
          .tz("America/New_York")
          .format("YYYY-MM-DD h:mm:ss")}] Automated Test Run`,
    include_all: true,
  };

  const testRun = await testrailService.establishTestRun(testRunOptions, results);
  testRunConfig.runId = testRun.id;

  if (isEmpty(testRun)) {
    setFailed("A TestRail Run could not be established.");
    throw new Error();
  }

  await testrailService.addTestRunResults(testRunConfig.runId, results);

  if ((trunkMode && testRun.untested_count === 0) || (!trunkMode && !regressionMode)) {
    await testrailService.closeTestRun(testRunConfig.runId);
  }

  if (trunkMode) {
    await testrailService.sweepUpTestRuns(milestone?.id);
  }

  if (environment === Environment.Production && suite?.name?.includes("E2E")) {
    await testrailService.closeMilestone(milestone?.id);
  }
}
