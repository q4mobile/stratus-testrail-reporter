import TestRailApiClient, { ICase, ICaseFilters, INewMilestone, ISuite } from "testrail-api";
import type {
  ITestRun,
  INewTestResult,
  INewTestRun,
  ITestResult,
  IMilestone,
  IMilestoneFilters,
  PromiseResponse,
} from "testrail-api";
import TestrailApiClient from "testrail-api";
import { RunInputs } from "../../run/run.definition";

export default class TestrailService {
  private readonly testRailClient: TestrailApiClient;
  private readonly runInputs: RunInputs;

  constructor(
    testRailOptions: { host: string; user: string; password: string },
    runInputs: RunInputs
  ) {
    this.testRailClient = new TestRailApiClient(testRailOptions);
    this.runInputs = runInputs;
  }

  async establishMilestone(): Promise<IMilestone> {
    const { body: milestonesResponse } = await this.getMilestones();
    // @ts-ignore because the types for body are not correct
    const milestones = (milestonesResponse?.milestones as IMilestone[]) ?? ([] as IMilestone[]);
    let milestone: IMilestone;

    if (this.runInputs.trunkMode) {
      // if we're in trunk mode, we want a milestone per JIRA key, so if we can't find it, we make it
      milestone = milestones?.filter?.((currentMilestone) => {
        // @ts-ignore because refs, while being a part of milestones, is not included in the interfaces
        return currentMilestone?.refs?.includes?.(this.runInputs.jiraKey);
      })?.[0];
    } else {
      // if we're in git mode, we simply want to grab the latest milestone
      // if we're in regression mode, we'll also create a new milestone if one is not found
      milestone = milestones?.[0];
    }

    if (milestone) {
      return Promise.resolve(milestone);
    }

    if (this.runInputs.trunkMode || this.runInputs.regressionMode) {
      const { body: newMilestone } = await this.createMilestone({
        name: `[${this.runInputs.jiraKey ?? "Automated"}] Release Milestone`,
        // @ts-ignore because refs, while being a part of milestones, is not included in the interfaces
        refs: this.runInputs.jiraKey,
      });

      milestone = newMilestone;
    }

    return Promise.resolve(milestone);
  }

  async establishTestRun(
    testRunOptions: INewTestRun,
    results: INewTestResult[]
  ): Promise<ITestRun> {
    if (this.runInputs.trunkMode) {
      // if we're in trunk mode, we want to make sure that a run is attached to the milestone for this suite
      // and if one is found for this suite and jira key, we simply return it
      const testRunFilters = {
        milestone_id: testRunOptions.milestone_id,
        suite_id: this.runInputs.testRunConfig.suiteId,
      };
      const { body: testRunsResponse } = await this.getTestRuns(testRunFilters);
      // @ts-ignore because the types for body are incorrect
      const testRuns = (testRunsResponse?.runs as ITestRun[]) ?? ([] as ITestRun[]);

      if (!testRuns.length) {
        const { body: testRun } = await this.createTestRun({
          ...testRunOptions,
          // @ts-ignore because the type for INewMilestone is missing refs
          refs: this.runInputs.jiraKey,
        });

        return Promise.resolve(testRun);
      }

      // if a test run is to be returned, we need to reset the results
      const testRun = testRuns?.[0];

      await this.testRailClient.addResultsForCases(
        testRun?.id,
        results.map((currentResult) => ({
          ...currentResult,
          status_id: 4, // retest
          comment: "Test result has been reset",
        }))
      );

      return Promise.resolve(testRun);
    } else {
      // if we're in git mode, we simply want to create a new test run
      const { body: testRun } = await this.createTestRun(testRunOptions);

      return Promise.resolve(testRun);
    }
  }

  async sweepUpTestRuns(milestone_id: number, case_ids: number[]): Promise<void> {
    if (!milestone_id) return Promise.reject();

    // find test runs for this jira key that might be loose (exploratory testing) and sweep then up
    const { body: testRunsResponse } = await this.getTestRuns();
    // @ts-ignore because the types for body are incorrect
    const testRuns = (testRunsResponse?.runs as ITestRun[]) ?? ([] as ITestRun[]);

    if (!testRuns.length) return Promise.resolve();

    await this.attachTestRunsToMilestone(
      testRuns.filter((currentTestRun) => currentTestRun?.milestone_id === null),
      milestone_id,
      case_ids
    ).catch((error) => Promise.reject(error));

    return Promise.resolve();
  }

  async addTestRunResults(
    runId: number,
    testRailResults: INewTestResult[]
  ): PromiseResponse<ITestResult[]> {
    return this.testRailClient.addResultsForCases(runId, testRailResults);
  }

  async attachTestRunsToMilestone(
    runs: ITestRun[],
    milestone_id: number,
    case_ids: number[]
  ): Promise<ITestRun[]> {
    if (!runs.length) return Promise.resolve([]);

    const promises = runs.map((run) => {
      return this.testRailClient.updateRun(run.id, {
        ...run,
        milestone_id,
        case_ids,
      });
    });

    await Promise.all(promises);

    return Promise.resolve(runs);
  }

  async getCases(filters?: ICaseFilters): PromiseResponse<ICase[]> {
    const caseFilters = {
      suite_id: this.runInputs.testRunConfig.suiteId,
      limit: 10000,
      ...filters,
    };

    return this.testRailClient.getCases(this.runInputs.testRunConfig.projectId, caseFilters);
  }

  async getTestRuns(filters?: Partial<ITestRun>): PromiseResponse<ITestRun[]> {
    const testRunFilters = { refs: this.runInputs.jiraKey, is_completed: 0, ...filters };

    return this.testRailClient.getRuns(this.runInputs.testRunConfig.projectId, testRunFilters);
  }

  async createTestRun(testRunOptions: INewTestRun): PromiseResponse<ITestRun> {
    return this.testRailClient.addRun(this.runInputs.testRunConfig.projectId, testRunOptions);
  }

  async closeTestRun(runId: number): PromiseResponse<ITestRun> {
    return this.testRailClient.closeRun(runId);
  }

  async getTestSuite(): PromiseResponse<ISuite> {
    return this.testRailClient.getSuite(this.runInputs.testRunConfig.suiteId);
  }

  async getMilestones(): PromiseResponse<IMilestone[]> {
    // @ts-ignore because getMilestones response is typed incorrectly
    const milestoneFilters: IMilestoneFilters = { is_completed: 0 };

    return this.testRailClient.getMilestones(
      this.runInputs.testRunConfig.projectId,
      milestoneFilters
    );
  }

  async createMilestone(milestoneOptions: INewMilestone): PromiseResponse<IMilestone> {
    return this.testRailClient.addMilestone(
      this.runInputs.testRunConfig.projectId,
      milestoneOptions
    );
  }

  async closeMilestone(milestone_id: number): PromiseResponse<IMilestone> {
    return this.testRailClient.updateMilestone(milestone_id, {
      is_completed: 1,
    });
  }
}
