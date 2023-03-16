import { getBooleanInput, getInput, setFailed, setOutput } from "@actions/core";
import { isEmpty } from "lodash";
import moment from "moment-timezone";
import { INewTestRun } from "testrail-api";
import { extractError } from "../utils";
import { Environment, InputKey, RunInputs } from "./run.definition";
import { extractTestResults } from "./run.utils";
import { TestrailService } from "../services";

const environment = process.env.NODE_ENV || "debug";

export async function run(): Promise<void> {
  const jiraKey = getInput(InputKey.JiraKey);
  const trunkMode = !!jiraKey;
  const regressionMode = getBooleanInput(InputKey.RegressionMode);
  const projectId = parseInt(getInput(InputKey.ProjectId), 10);
  const suiteId = parseInt(getInput(InputKey.SuiteId), 10);
  const testRailOptions = {
    host: getInput(InputKey.NetworkUrl),
    user: getInput(InputKey.Username),
    password: getInput(InputKey.ApiKey),
  };
  const runOptions: RunInputs = {
    jiraKey,
    trunkMode,
    regressionMode,
    projectId,
    suiteId,
  };

  const testrailService = new TestrailService(testRailOptions, runOptions);

  try {
    const results = trunkMode
      ? await extractTestResults(projectId, suiteId)
      : await extractTestResults();

    if (isEmpty(results)) {
      setFailed("No results for reporting to TestRail were found.");

      return;
    }

    const { body: suite } = await testrailService.getTestSuite();

    if (isEmpty(suite)) {
      setFailed("A TestRail Suite could not be found for the provided suite id.");

      return;
    }

    const milestone = await testrailService.establishMilestone();
    // @ts-ignore because the type for INewTestRun is incorrect
    const testRunOptions: INewTestRun = {
      suite_id: suiteId,
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

    if (isEmpty(testRun)) {
      setFailed("A TestRail Run could not be established.");

      return;
    }

    await testrailService.addTestRunResults(testRun.id, results);

    if ((trunkMode && testRun.untested_count === 0) || (!trunkMode && !regressionMode)) {
      await testrailService.closeTestRun(testRun.id);
    }

    if (trunkMode) {
      await testrailService.sweepUpTestRuns(milestone?.id);
    }

    if (environment === Environment.Production && suite?.name?.includes("E2E")) {
      await testrailService.closeMilestone(milestone?.id);
    }

    setOutput("completion_time", new Date().toTimeString());
    setOutput("run_id", testRun.id); // output run_id for future steps
  } catch (error) {
    setFailed(`Stratus TestRail Reporter encountered an issue: ${extractError(error)}`);
  }
}
