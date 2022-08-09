import { InputKey, run } from "./run";
import * as actions from "@actions/core";
import TestRailApiClient, { ISuite } from "testrail-api";
import * as createTestPlan from "./utils/createTestPlan";
import * as createTestRun from "./utils/createTestRun";
import * as getTestRailMilestone from "./utils/getTestRailMilestone";
import * as readFiles from "./utils/readFiles";
import { Response } from "request";

describe("run", () => {
  const getInputSpy = jest.spyOn(actions, "getInput");
  const createTestPlanSpy = jest.spyOn(createTestPlan, "createTestPlan");
  const createTestRunSpy = jest.spyOn(createTestRun, "createTestRun");
  const getTestRailMilestoneSpy = jest.spyOn(getTestRailMilestone, "getTestRailMilestone");
  const readFilesSpy = jest.spyOn(readFiles, "readFiles");
  const testRailApiClientSpy = jest.spyOn(TestRailApiClient.prototype, "getUserByEmail");
  const getSuiteSpy = jest.spyOn(TestRailApiClient.prototype, "getSuite");

  function setInputMock(target_branch: string, regression_branch?: string) {
    getInputSpy.mockImplementation((val): string => {
      switch (val) {
        case InputKey.RegressionBranch:
          return regression_branch ?? "";
        case InputKey.TargetBranch:
          return target_branch;
        default:
          return "";
      }
    });
  }

  beforeEach(() => {
    const mockId = 1234567;
    const mockName = "mockName";
    const now = new Date().getTime();

    setInputMock("test", "test");

    readFilesSpy.mockResolvedValue([{ status_id: mockId }]);
    createTestPlanSpy.mockImplementation();
    createTestRunSpy.mockImplementation();

    // @ts-ignore only body is used in the code
    testRailApiClientSpy.mockResolvedValue({
      body: { id: mockId, email: "mockEmail", name: mockName, is_active: true },
    });
    getTestRailMilestoneSpy.mockResolvedValue({
      completed_on: now,
      description: "mockDescription",
      due_on: now,
      id: mockId,
      is_completed: now,
      is_started: now,
      name: mockName,
      parent_id: mockId,
      project_id: mockId,
      start_on: now,
      started_on: now,
      url: "mockUrl",
    });

    getSuiteSpy.mockResolvedValue({
      body: {
        name: "mockSuiteName",
      } as ISuite,
      response: {} as Response,
    });
  });

  // #region Milestone Check
  function expectMilestoneToBeCalled(expected = true): void {
    expect(getInputSpy).toBeCalledWith(InputKey.RegressionBranch);
    expect(getInputSpy).toBeCalledWith(InputKey.TargetBranch);
    expect(getSuiteSpy).toHaveBeenCalled();
    if (expected) {
      expect(getTestRailMilestoneSpy).toBeCalled();
      expect(createTestPlanSpy).toBeCalled();
    } else {
      expect(getTestRailMilestoneSpy).not.toBeCalled();
      expect(createTestRunSpy).toBeCalled();
    }
  }
  it("[Given] the regression branch is 'test' [And] the target branch is 'test' [Then] expect a call to 'getTestRailMilestoneSpy' to be invoked", async () => {
    await run();
    expectMilestoneToBeCalled();
  });

  it("[Given] the regression branch is 'undefined' [And] the target branch is 'staging' [Then] expect a call to 'getTestRailMilestoneSpy' to be invoked", async () => {
    setInputMock("staging");
    await run();
    expectMilestoneToBeCalled();
  });

  it("[Given] the regression branch is 'undefined' [And] the target branch is 'test' [Then] expect a call to 'getTestRailMilestoneSpy' to be NOT invoked", async () => {
    setInputMock("test");
    await run();
    expectMilestoneToBeCalled(false);
  });
  // #endregion
});
