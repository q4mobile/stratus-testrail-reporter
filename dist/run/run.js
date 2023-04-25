"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const core_1 = require("@actions/core");
const lodash_1 = require("lodash");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const utils_1 = require("../utils");
const run_definition_1 = require("./run.definition");
const run_utils_1 = require("./run.utils");
const services_1 = require("../services");
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
    var _a;
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
    if ((0, lodash_1.isEmpty)(results)) {
        (0, core_1.setFailed)("No results for reporting to TestRail were found.");
        throw new Error();
    }
    const { body: suite } = await testrailService.getTestSuite();
    if ((0, lodash_1.isEmpty)(suite)) {
        (0, core_1.setFailed)("A TestRail Suite could not be found for the provided suite id.");
        throw new Error();
    }
    const milestone = await testrailService.establishMilestone();
    // @ts-ignore because the type for INewTestRun is incorrect
    const testRunOptions = {
        suite_id: testRunConfig.suiteId,
        // @ts-ignore because milestone_id is not required
        milestone_id: trunkMode || regressionMode ? milestone === null || milestone === void 0 ? void 0 : milestone.id : null,
        name: trunkMode
            ? suite === null || suite === void 0 ? void 0 : suite.name
            : `[${environment}][${suite === null || suite === void 0 ? void 0 : suite.name}][${(0, moment_timezone_1.default)()
                .tz("America/New_York")
                .format("YYYY-MM-DD h:mm:ss")}] Automated Test Run`,
        include_all: true,
    };
    const testRun = await testrailService.establishTestRun(testRunOptions, results);
    testRunConfig.runId = testRun.id;
    if ((0, lodash_1.isEmpty)(testRun)) {
        (0, core_1.setFailed)("A TestRail Run could not be established.");
        throw new Error();
    }
    await testrailService.addTestRunResults(testRunConfig.runId, results);
    if ((trunkMode && testRun.untested_count === 0) || (!trunkMode && !regressionMode)) {
        await testrailService.closeTestRun(testRunConfig.runId);
    }
    if (trunkMode) {
        await testrailService.sweepUpTestRuns(milestone === null || milestone === void 0 ? void 0 : milestone.id);
    }
    if (environment === run_definition_1.Environment.Production && ((_a = suite === null || suite === void 0 ? void 0 : suite.name) === null || _a === void 0 ? void 0 : _a.includes("E2E"))) {
        await testrailService.closeMilestone(milestone === null || milestone === void 0 ? void 0 : milestone.id);
    }
}
