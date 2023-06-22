"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const core_1 = require("@actions/core");
const utils_1 = require("../utils");
const run_definition_1 = require("./run.definition");
const run_utils_1 = require("./run.utils");
const services_1 = require("../services");
const findDuplicate_1 = __importDefault(require("../utils/findDuplicate"));
const environment = process.env.NODE_ENV || "debug";
async function run() {
    const jiraKey = (0, core_1.getInput)(run_definition_1.InputKey.JiraKey);
    const regressionMode = (0, core_1.getBooleanInput)(run_definition_1.InputKey.RegressionMode);
    const projectId = parseInt((0, core_1.getInput)(run_definition_1.InputKey.ProjectId), 10);
    const suiteId = parseInt((0, core_1.getInput)(run_definition_1.InputKey.SuiteId), 10);
    const trunkMode = !projectId && !suiteId;
    const testRailOptions = {
        host: (0, core_1.getInput)(run_definition_1.InputKey.NetworkUrl),
        user: (0, core_1.getInput)(run_definition_1.InputKey.Username),
        password: (0, core_1.getInput)(run_definition_1.InputKey.ApiKey),
    };
    try {
        let testRunConfigs;
        if (trunkMode) {
            // TODO: Use glob pattern to find all testrail report files
            // https://github.com/isaacs/node-glob#readme
            testRunConfigs = await (0, run_utils_1.getTrunkTestRunConfigs)();
            for (const testRun of testRunConfigs) {
                await reportToTestrail(jiraKey, trunkMode, regressionMode, testRun, testRailOptions);
            }
        }
        else {
            testRunConfigs = [{ projectId: projectId, suiteId: suiteId }];
            await reportToTestrail(jiraKey, trunkMode, regressionMode, testRunConfigs[0], testRailOptions);
        }
        (0, core_1.setOutput)("completion_time", new Date().toTimeString());
        (0, core_1.setOutput)("test_runs", testRunConfigs); // output run_id for future steps
    }
    catch (error) {
        (0, core_1.setFailed)(`Stratus TestRail Reporter encountered an issue: ${(0, utils_1.extractError)(error)}`);
    }
}
exports.run = run;
async function reportToTestrail(jiraKey, trunkMode, regressionMode, testRunConfig, testRailOptions) {
    const runOptions = {
        jiraKey,
        trunkMode,
        regressionMode,
        testRunConfig,
    };
    const testrailService = new services_1.TestrailService(testRailOptions, runOptions);
    const results = trunkMode
        ? await (0, run_utils_1.extractTestResults)(testRunConfig.projectId, testRunConfig.suiteId)
        : await (0, run_utils_1.extractTestResults)();
    if (!results.length) {
        (0, core_1.setFailed)("No results for reporting to TestRail were found.");
        throw new Error();
    }
    // Ensure there are no duplicate case ids
    const case_ids = results.map((result) => result.case_id); // TODO: Stronger typing for results
    const duplicate_case_ids = (0, findDuplicate_1.default)(case_ids);
    if (duplicate_case_ids.length) {
        (0, core_1.setFailed)(`Duplicate case ids found in test results: ${duplicate_case_ids.join(", ")}. Please ensure that each test case is only reported once.`);
        throw new Error();
    }
    const { body: suite } = await testrailService.getTestSuite().catch((error) => {
        (0, core_1.setFailed)("A TestRail Suite could not be found for the provided suite id.");
        throw error;
    });
    const milestone = await testrailService.establishMilestone().catch((error) => {
        (0, core_1.setFailed)("A TestRail Milestone could not be established.");
        throw error;
    });
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
    const testRunOptions = {
        suite_id: testRunConfig.suiteId,
        // @ts-ignore because milestone_id is not required
        milestone_id: trunkMode || regressionMode ? milestone.id : null,
        name: trunkMode
            ? suite.name
            : `[${environment}][${suite.name}][${datetime}] Automated Test Run`,
        include_all: true,
    };
    const testRun = await testrailService.establishTestRun(testRunOptions, results).catch((error) => {
        (0, core_1.setFailed)("A TestRail Run could not be established.");
        throw error;
    });
    await testrailService.addTestRunResults(testRun.id, results).catch((error) => {
        (0, core_1.setFailed)("Test run results could not be added to the TestRail Run.");
        throw error;
    });
    if ((trunkMode && testRun.untested_count === 0) || (!trunkMode && !regressionMode)) {
        await testrailService.closeTestRun(testRun.id).catch((error) => {
            (0, core_1.setFailed)("The TestRail Run could not be closed.");
            throw error;
        });
    }
    if (trunkMode) {
        await testrailService.sweepUpTestRuns(milestone.id, case_ids).catch((error) => {
            (0, core_1.setFailed)("TestRail Runs could not be closed.");
            throw error;
        });
    }
    if (environment === run_definition_1.Environment.Production && suite.name.includes("E2E")) {
        await testrailService.closeMilestone(milestone.id).catch((error) => {
            (0, core_1.setFailed)("The TestRail Milestone could not be closed.");
            throw error;
        });
    }
}
