import {
  getInput,
  setOutput,
  setFailed,
  getMultilineInput,
  error as logError,
} from "@actions/core";
import { promises as fs } from "fs";
import { isEmpty } from "lodash";
import moment from "moment-timezone";
import TestRailApiClient, { IMilestone, IMilestoneFilters, INewTestResult, INewTestRun, ITestRun } from "testrail-api";

const environment = process.env.NODE_ENV || "debug";

async function run(): Promise<void> {
  async function readFiles(filePaths: string[]): Promise<INewTestResult[]> {
    return new Promise((resolve) => {
      let testRailResults: INewTestResult[] = [];

      const promises = filePaths.map((filePath) => {
        return fs
          .readFile(filePath, "utf-8")
          .then((fileResults) => {
            try {
              const results = JSON.parse(fileResults);
              testRailResults = testRailResults.concat(results);
            } catch (error: any) {
              logError(`Parsing report file has failed: ${error.message}`);
              resolve([]);
            }
          })
          .catch((error: any) => {
            logError(`Reading report file has failed:: ${error.message}`);
            resolve([]);
          });
      });

      Promise.all(promises)
        .then(() => {
          resolve(testRailResults);
        })
        .catch((error: any) => {
          setFailed(error.message);
          resolve([]);
        });
    });
  }

  async function getTestRailMilestone(testRailClient: TestRailApiClient, projectId: number): Promise<IMilestone> {
    // @ts-ignore because is_started is not actually required
    const milestoneFilters: IMilestoneFilters = { is_completed: 0 };

    return new Promise((resolve) => {
      testRailClient.getMilestones(projectId, milestoneFilters).then((milestonesResponse) => {
        // @ts-ignore because getMilestones response is typed incorrectly
        const { milestones } = milestonesResponse.body ?? {};

        if (isEmpty(milestones)) {
          testRailClient.addMilestone(projectId, {
            name: `[${moment()
              .tz("America/New_York")
              .format("YYYY-MM-DD")}] Automated Mile Stone`
          }).then((addMilestoneResponse) => {
            resolve(addMilestoneResponse.body ?? {});
          });
        } else {
          resolve(milestones[0]);
        }
      });
    });
  }

  function createTestPlan(testPlanOptions: any): void {
    testRailClient.addPlan(projectId, testPlanOptions).then((addPlanResponse) => {
      const { entries } = addPlanResponse.body ?? {};
      const { runs } = (entries || [])[0] ?? {};
      const { id } = (runs || [])[0] as ITestRun ?? {};

      addResults(id);
    })
    .catch((error: any) => {
      setFailed(`Failed to add a new TestRail plan: ${extractError(error)}`);
    });
  }

  function createTestRun(testRunOptions: INewTestRun): void {
    testRailClient
      .addRun(projectId, testRunOptions)
      .then((addRunResponse) => {
        const { id } = addRunResponse.body ?? {};

        addResults(id);
      })
      .catch((error: any) => {
        setFailed(`Failed to add a new TestRail run: ${extractError(error)}`);
      });
  }

  function closeTestRun(runId: number): void {
    testRailClient.closeRun(runId).catch((error: any) => {
      setFailed(`Failed to close the TestRail run: ${extractError(error)}`);
    });
  }

  function addResults(runId: number): void {
    testRailClient
      .addResultsForCases(runId, testRailResults)
      .then(() => {
        if (!regressionMode) {
          closeTestRun(runId);
        }

        setOutput("completion_time", new Date().toTimeString());
        setOutput("run_id", runId); // output run_id for future steps
      })
      .catch((error: any) => {
        setFailed(`Failed to add test case results to TestRail: ${extractError(error)}`);

        if (!regressionMode) {
          closeTestRun(runId);
        }
      });
  }

  function extractError(error: any): string {
    if (isEmpty(error)) return "An error is present, but could not be parsed";

    return error.error || error.message?.error || error.message || JSON.stringify(error);
  }

  const regressionMode = getInput("target_branch") === "staging";
  const reportFiles: string[] = getMultilineInput("report_files");
  const projectId = parseInt(getInput("project_id"), 10);
  const suiteId = parseInt(getInput("suite_id"), 10);
  const testRailOptions = {
    host: getInput("network_url"),
    user: getInput("username"),
    password: getInput("api_key"),
  };

  const testRailClient = new TestRailApiClient(testRailOptions);
  const testRailResults = await readFiles(reportFiles);
  let testRailMilestone: IMilestone;

  if (isEmpty(testRailResults)) {
    setFailed("No TestRail results were found.");
    return;
  }

  if (regressionMode) {
    testRailMilestone = await getTestRailMilestone(testRailClient, projectId);
  }

  testRailClient
    .getUserByEmail(testRailOptions.user)
    .then((userResponse) => {
      const { id: userId } = userResponse.body ?? {};

      const milestoneId = isEmpty(testRailMilestone) ? null : testRailMilestone.id;
      const testRunOptions: INewTestRun = {
        suite_id: suiteId,
        // @ts-ignore because milestone is not required
        milestone_id: milestoneId,
        name: `[${environment}][${moment()
          .tz("America/New_York")
          .format("YYYY-MM-DD h:mm:ss")}] Automated Test Run`,
        description: "This test run was automatically generated by Github Actions.",
        include_all: true,
        assignedto_id: userId,
      };
      const testPlanOptions = {
        milestone_id: milestoneId,
        name: `[${environment}][${moment()
          .tz("America/New_York")
          .format("YYYY-MM-DD h:mm:ss")}] Automated Test Plan`,
        entries: [testRunOptions]
      };

      if (regressionMode) {
        createTestPlan(testPlanOptions);
      } else {
        createTestRun(testRunOptions);
      }
    })
    .catch((error: any) => {
      setFailed(`Failed to get TestRail user: ${extractError(error)}`);

      return;
    });
}

run();
