import { getBooleanInput, getInput, setFailed, setOutput } from "@actions/core";
import { INewTestRun } from "testrail-api";
import { extractError } from "../utils";
import { Environment, InputKey, RunInputs, TestRunConfig, TestRailOptions } from "./run.definition";
import {
  containsE2Etest,
  extractTestResults,
  getTrunkTestRunConfigs,
  getUnitTestConfig,
} from "./run.utils";
import { TestrailService } from "../services";
import findDuplicates from "../utils/findDuplicate";

const environment = process.env.NODE_ENV || "debug";
export async function run(): Promise<void> {
  const closeMilestone = getBooleanInput(InputKey.CloseMilestone);
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
      const containsE2E = await containsE2Etest();
      const unitTestConfig = await getUnitTestConfig();
      if (unitTestConfig && !containsE2E && environment === Environment.Production) {
        testRunConfigs = [unitTestConfig];
        await closeMilestoneWithOnlyUnitTest(
          jiraKey,
          trunkMode,
          regressionMode,
          testRunConfigs[0],
          testRailOptions
        );
      } else {
        // TODO: Use glob pattern to find the testrail report file
        // https://github.com/isaacs/node-glob#readme
        testRunConfigs = await getTrunkTestRunConfigs();
        console.log("testRunConfigs", testRunConfigs);
        for (const testRun of testRunConfigs) {
          await reportToTestrail(
            closeMilestone,
            jiraKey,
            trunkMode,
            regressionMode,
            testRun,
            testRailOptions
          );
        }
      }
    } else {
      testRunConfigs = [{ projectId: projectId, suiteId: suiteId }];

      await reportToTestrail(
        closeMilestone,
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

async function closeMilestoneWithOnlyUnitTest(
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

  // get the milestone created in the build/test-unit job
  const milestone = await testrailService.establishMilestone().catch((error) => {
    setFailed("A TestRail Milestone could not be established.");
    throw error;
  });

  if (!milestone) {
    setFailed("A TestRail Milestone could not be established.");
    throw new Error();
  }

  // and close it
  await testrailService.closeMilestone(milestone?.id).catch((error) => {
    setFailed("The TestRail Milestone could not be closed.");
    throw error;
  });
}

async function reportToTestrail(
  closeMilestone: boolean,
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

  console.log("results", results);

  if (!results.length) {
    setFailed("No results for reporting to TestRail were found.");
    throw new Error();
  }

  // Ensure there are no duplicate case ids
  const case_ids = results.map((result) => result.case_id as number); // TODO: Stronger typing for results
  const duplicate_case_ids = findDuplicates(case_ids);

  if (duplicate_case_ids.length) {
    setFailed(
      `Duplicate case ids found in test results: ${duplicate_case_ids.join(
        ", "
      )}. Please ensure that each test case is only reported once.`
    );
    throw new Error();
  }

  const { body: suite } = await testrailService.getTestSuite().catch((error) => {
    setFailed("A TestRail Suite could not be found for the provided suite id.");
    throw error;
  });

  const milestone = await testrailService.establishMilestone().catch((error) => {
    setFailed("A TestRail Milestone could not be established.");
    throw error;
  });

  if (!milestone) {
    setFailed("A TestRail Milestone could not be established.");
    throw new Error();
  }

  const datetime = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date());

  // @ts-ignore because the type for INewTestRun is incorrect
  const testRunOptions: INewTestRun = {
    suite_id: testRunConfig.suiteId,
    // @ts-ignore because milestone_id is not required
    milestone_id: trunkMode || regressionMode ? milestone.id : null,
    name: trunkMode
      ? suite.name
      : `[${environment}][${suite.name}][${datetime}] Automated Test Run`,
    include_all: true,
  };

  const testRun = await testrailService.establishTestRun(testRunOptions, results).catch((error) => {
    setFailed("A TestRail Run could not be established.");
    throw error;
  });

  await testrailService.addTestRunResults(testRun.id, results).catch((error) => {
    setFailed("Test run results could not be added to the TestRail Run.");
    throw error;
  });

  if ((trunkMode && testRun.untested_count === 0) || (!trunkMode && !regressionMode)) {
    await testrailService.closeTestRun(testRun.id).catch((error) => {
      setFailed("The TestRail Run could not be closed.");
      throw error;
    });
  }

  if (trunkMode) {
    await testrailService.sweepUpTestRuns(milestone.id).catch((error) => {
      setFailed("TestRail Runs could not be closed.");
      throw error;
    });
  }

  if (environment === Environment.Production && (suite.name.includes("E2E") || closeMilestone)) {
    await testrailService.closeMilestone(milestone.id).catch((error) => {
      setFailed("The TestRail Milestone could not be closed.");
      throw error;
    });
  }
}
