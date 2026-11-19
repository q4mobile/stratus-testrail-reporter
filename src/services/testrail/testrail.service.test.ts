import TestRailApiClient from "testrail-api";
import TestrailService, { REQUEST_TIMEOUT_MS, RESULTS_BATCH_SIZE } from "./testrail.service";
import { RequestTimeoutError } from "../../utils";

jest.mock("testrail-api");

const MockClient = TestRailApiClient as jest.MockedClass<typeof TestRailApiClient>;
const options = { host: "https://testrail.example", user: "user", password: "key" };
const runInputs = {
  jiraKey: "ABC-123",
  trunkMode: true,
  regressionMode: false,
  testRunConfig: { projectId: 27, suiteId: 55346 },
};

function results(count: number) {
  return Array.from({ length: count }, (_, index) => ({ case_id: index + 1, status_id: 1 }));
}

function client(): jest.Mocked<TestRailApiClient> {
  return MockClient.mock.instances[0] as jest.Mocked<TestRailApiClient>;
}

describe("TestrailService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe("addTestRunResults", () => {
    it("[Given] more results than one batch [When] they are added [Then] they are posted in sequential batches of at most the batch size", async () => {
      const service = new TestrailService(options, runInputs);
      const sizes: number[] = [];
      let inFlight = 0;
      let maxInFlight = 0;
      client().addResultsForCases.mockImplementation((async (
        _runId: number,
        batch: { case_id: number }[]
      ) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        sizes.push(batch.length);
        await Promise.resolve();
        inFlight -= 1;
        return { response: { statusCode: 200 }, body: batch.map((r) => ({ case_id: r.case_id })) };
      }) as never);

      const { body } = await service.addTestRunResults(42, results(RESULTS_BATCH_SIZE * 5 + 118));

      expect(sizes).toEqual([1000, 1000, 1000, 1000, 1000, 118]);
      expect(maxInFlight).toBe(1);
      expect(client().addResultsForCases).toHaveBeenCalledWith(42, expect.any(Array));
      expect(body).toHaveLength(5118);
    });

    it("[Given] a batch TestRail never answers [When] the timeout passes [Then] the call rejects naming the request and batch", async () => {
      jest.useFakeTimers();
      const service = new TestrailService(options, runInputs);
      client().addResultsForCases.mockImplementation(() => new Promise(() => undefined));

      const pending = service.addTestRunResults(42, results(1500));
      const assertion = expect(pending).rejects.toThrow(
        'TestRail request "add_results_for_cases/42 (batch 1 of 2)" did not respond within 120s'
      );
      await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

      await assertion;
      await expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
      expect(client().addResultsForCases).toHaveBeenCalledTimes(1);
    });
  });

  describe("establishMilestone", () => {
    it("[Given] the project has more than one page of open milestones and the Jira key's milestone is on page two [When] the milestone is established [Then] it reuses that milestone and creates none", async () => {
      const service = new TestrailService(options, runInputs);
      const pageOne = Array.from({ length: 250 }, (_, index) => ({
        id: index + 1,
        refs: "OTHER-1",
      }));
      client().getMilestones.mockImplementation((async (
        _projectId: number,
        filters: { offset: number }
      ) => {
        const { offset } = filters;
        const body =
          offset === 0
            ? { milestones: pageOne, _links: { next: "/api/v2/get_milestones/27&offset=250" } }
            : { milestones: [{ id: 9001, refs: "ABC-123" }], _links: { next: null } };
        return { response: { statusCode: 200 }, body };
      }) as never);

      const milestone = await service.establishMilestone();

      expect(milestone?.id).toBe(9001);
      expect(client().getMilestones).toHaveBeenCalledTimes(2);
      expect(client().getMilestones).toHaveBeenNthCalledWith(2, 27, {
        is_completed: 0,
        limit: 250,
        offset: 250,
      });
      expect(client().addMilestone).not.toHaveBeenCalled();
    });

    it("[Given] the Jira key's milestone is on the first of several pages [When] the milestone is established [Then] it stops reading pages once it is found", async () => {
      const service = new TestrailService(options, runInputs);
      client().getMilestones.mockResolvedValue({
        response: {},
        body: {
          milestones: [{ id: 5, refs: "ABC-123" }],
          _links: { next: "/api/v2/get_milestones/27&offset=250" },
        },
      } as never);

      const milestone = await service.establishMilestone();

      expect(milestone?.id).toBe(5);
      expect(client().getMilestones).toHaveBeenCalledTimes(1);
      expect(client().addMilestone).not.toHaveBeenCalled();
    });

    it("[Given] no open milestone references the Jira key on any page [When] the milestone is established [Then] a new milestone is created once", async () => {
      const service = new TestrailService(options, runInputs);
      client().getMilestones.mockResolvedValue({
        response: {},
        body: { milestones: [], _links: { next: null } },
      } as never);
      client().addMilestone.mockResolvedValue({
        response: {},
        body: { id: 77, refs: "ABC-123" },
      } as never);

      const milestone = await service.establishMilestone();

      expect(milestone?.id).toBe(77);
      expect(client().getMilestones).toHaveBeenCalledTimes(1);
      expect(client().addMilestone).toHaveBeenCalledTimes(1);
    });
  });
});
