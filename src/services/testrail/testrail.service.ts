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
import { chunk, withTimeout } from "../../utils";

// TestRail stores an add_results_for_cases request of more than ~5,080 results but never answers it
// (SBR-3392), so results are posted in batches well under that.
export const RESULTS_BATCH_SIZE = 1000;
// A request TestRail never answers fails the step after this, instead of hanging the job.
export const REQUEST_TIMEOUT_MS = 120_000;
// TestRail's maximum page size for list endpoints.
const MILESTONES_PAGE_SIZE = 250;

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

  async establishMilestone(): Promise<IMilestone | undefined> {
    let milestone: IMilestone | undefined;

    for await (const milestones of this.milestonePages()) {
      milestone = this.runInputs.trunkMode
        ? this.findJiraKeyMilestone(milestones)
        : // in git mode we simply want the latest milestone; in regression mode one is created
          // below if none is found
          milestones[0];

      if (milestone || !this.runInputs.trunkMode) break;
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

      await this.addTestRunResults(
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

  async sweepUpTestRuns(milestone_id: number): Promise<void> {
    if (!milestone_id) return Promise.reject();

    // find test runs for this jira key that might be loose (exploratory testing) and sweep then up
    const { body: testRunsResponse } = await this.getTestRuns();
    // @ts-ignore because the types for body are incorrect
    const testRuns = (testRunsResponse?.runs as ITestRun[]) ?? ([] as ITestRun[]);

    if (!testRuns.length) return Promise.resolve();

    await this.attachTestRunsToMilestone(
      testRuns.filter((currentTestRun) => currentTestRun?.milestone_id === null),
      milestone_id
    ).catch((error) => Promise.reject(error));

    return Promise.resolve();
  }

  async addTestRunResults(
    runId: number,
    testRailResults: INewTestResult[]
  ): PromiseResponse<ITestResult[]> {
    const batches = chunk(testRailResults, RESULTS_BATCH_SIZE);
    const added: ITestResult[] = [];
    let response;

    // In sequence, so TestRail is never handed more than one batch at a time.
    for (const [index, batch] of batches.entries()) {
      const label = `add_results_for_cases/${runId} (batch ${index + 1} of ${batches.length})`;
      const result = await this.call(label, () =>
        this.testRailClient.addResultsForCases(runId, batch)
      );
      response = result.response;
      added.push(...((result.body as ITestResult[]) ?? []));
    }

    // @ts-ignore because response is only undefined when there were no results to add
    return { response, body: added };
  }

  async attachTestRunsToMilestone(runs: ITestRun[], milestone_id: number): Promise<ITestRun[]> {
    if (!runs.length) return Promise.resolve([]);

    const promises = runs.map((run) => {
      return this.call(`update_run/${run.id}`, () =>
        // @ts-ignore because case_ids aren't actually required
        this.testRailClient.updateRun(run.id, {
          ...run,
          milestone_id,
        })
      );
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

    return this.call("get_cases", () =>
      this.testRailClient.getCases(this.runInputs.testRunConfig.projectId, caseFilters)
    );
  }

  async getTestRuns(filters?: Partial<ITestRun>): PromiseResponse<ITestRun[]> {
    const testRunFilters = { refs: this.runInputs.jiraKey, is_completed: 0, ...filters };

    return this.call("get_runs", () =>
      this.testRailClient.getRuns(this.runInputs.testRunConfig.projectId, testRunFilters)
    );
  }

  async createTestRun(testRunOptions: INewTestRun): PromiseResponse<ITestRun> {
    return this.call("add_run", () =>
      this.testRailClient.addRun(this.runInputs.testRunConfig.projectId, testRunOptions)
    );
  }

  async closeTestRun(runId: number): PromiseResponse<ITestRun> {
    return this.call(`close_run/${runId}`, () => this.testRailClient.closeRun(runId));
  }

  async getTestSuite(): PromiseResponse<ISuite> {
    return this.call("get_suite", () =>
      this.testRailClient.getSuite(this.runInputs.testRunConfig.suiteId)
    );
  }

  /**
   * Open milestones, one page at a time. get_milestones returns at most 250 per page; reading only
   * the first page meant a project with more open milestones never found the one for its Jira key
   * and created a new one on every run (SBR-3392). Callers stop as soon as they have what they need.
   */
  async *milestonePages(): AsyncGenerator<IMilestone[]> {
    let offset = 0;

    while (true) {
      const milestoneFilters = {
        is_completed: 0,
        limit: MILESTONES_PAGE_SIZE,
        offset,
      } as unknown as IMilestoneFilters; // the filter type has no paging fields
      const { body } = await this.call(`get_milestones (offset ${offset})`, () =>
        this.testRailClient.getMilestones(this.runInputs.testRunConfig.projectId, milestoneFilters)
      );
      // @ts-ignore because the types for body are not correct
      const milestones = (body?.milestones as IMilestone[]) ?? [];

      yield milestones;

      // @ts-ignore because _links is not included in the interfaces
      if (!body?._links?.next || !milestones.length) return;
      offset += milestones.length;
    }
  }

  /** The milestone, or child milestone, whose refs include the Jira key. */
  private findJiraKeyMilestone(milestones: IMilestone[]): IMilestone | undefined {
    for (const currentMilestone of milestones) {
      // @ts-ignore because refs, while being a part of milestones, is not included in the interfaces
      if (currentMilestone?.refs?.includes(this.runInputs.jiraKey)) return currentMilestone;

      // @ts-ignore because child milestones are not included in the interfaces
      for (const childMilestone of currentMilestone?.milestones ?? []) {
        // @ts-ignore because refs, while being a part of milestones, is not included in the interfaces
        if (childMilestone?.refs?.includes(this.runInputs.jiraKey)) return childMilestone;
      }
    }

    return undefined;
  }

  async createMilestone(milestoneOptions: INewMilestone): PromiseResponse<IMilestone> {
    return this.call("add_milestone", () =>
      this.testRailClient.addMilestone(this.runInputs.testRunConfig.projectId, milestoneOptions)
    );
  }

  async closeMilestone(milestone_id: number): PromiseResponse<IMilestone> {
    return this.call(`update_milestone/${milestone_id}`, () =>
      this.testRailClient.updateMilestone(milestone_id, {
        is_completed: 1,
      })
    );
  }

  private call<T>(label: string, request: () => Promise<T>): Promise<T> {
    return withTimeout(request(), REQUEST_TIMEOUT_MS, label);
  }
}
