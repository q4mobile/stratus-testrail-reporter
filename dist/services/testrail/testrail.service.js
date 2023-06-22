"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testrail_api_1 = __importDefault(require("testrail-api"));
class TestrailService {
    constructor(testRailOptions, runInputs) {
        this.testRailClient = new testrail_api_1.default(testRailOptions);
        this.runInputs = runInputs;
    }
    async establishMilestone() {
        var _a, _b, _c, _d;
        const { body: milestonesResponse } = await this.getMilestones();
        // @ts-ignore because the types for body are not correct
        const milestones = (_a = milestonesResponse === null || milestonesResponse === void 0 ? void 0 : milestonesResponse.milestones) !== null && _a !== void 0 ? _a : [];
        let milestone;
        if (this.runInputs.trunkMode) {
            // if we're in trunk mode, we want a milestone per JIRA key, so if we can't find it, we make it
            milestone = (_c = (_b = milestones === null || milestones === void 0 ? void 0 : milestones.filter) === null || _b === void 0 ? void 0 : _b.call(milestones, (currentMilestone) => {
                var _a, _b;
                // @ts-ignore because refs, while being a part of milestones, is not included in the interfaces
                return (_b = (_a = currentMilestone === null || currentMilestone === void 0 ? void 0 : currentMilestone.refs) === null || _a === void 0 ? void 0 : _a.includes) === null || _b === void 0 ? void 0 : _b.call(_a, this.runInputs.jiraKey);
            })) === null || _c === void 0 ? void 0 : _c[0];
        }
        else {
            // if we're in git mode, we simply want to grab the latest milestone
            // if we're in regression mode, we'll also create a new milestone if one is not found
            milestone = milestones === null || milestones === void 0 ? void 0 : milestones[0];
        }
        if (milestone) {
            return Promise.resolve(milestone);
        }
        if (this.runInputs.trunkMode || this.runInputs.regressionMode) {
            const { body: newMilestone } = await this.createMilestone({
                name: `[${(_d = this.runInputs.jiraKey) !== null && _d !== void 0 ? _d : "Automated"}] Release Milestone`,
                // @ts-ignore because refs, while being a part of milestones, is not included in the interfaces
                refs: this.runInputs.jiraKey,
            });
            milestone = newMilestone;
        }
        return Promise.resolve(milestone);
    }
    async establishTestRun(testRunOptions, results) {
        var _a;
        if (this.runInputs.trunkMode) {
            // if we're in trunk mode, we want to make sure that a run is attached to the milestone for this suite
            // and if one is found for this suite and jira key, we simply return it
            const testRunFilters = {
                milestone_id: testRunOptions.milestone_id,
                suite_id: this.runInputs.testRunConfig.suiteId,
            };
            const { body: testRunsResponse } = await this.getTestRuns(testRunFilters);
            // @ts-ignore because the types for body are incorrect
            const testRuns = (_a = testRunsResponse === null || testRunsResponse === void 0 ? void 0 : testRunsResponse.runs) !== null && _a !== void 0 ? _a : [];
            if (!testRuns.length) {
                const { body: testRun } = await this.createTestRun({
                    ...testRunOptions,
                    // @ts-ignore because the type for INewMilestone is missing refs
                    refs: this.runInputs.jiraKey,
                });
                return Promise.resolve(testRun);
            }
            // if a test run is to be returned, we need to reset the results
            const testRun = testRuns === null || testRuns === void 0 ? void 0 : testRuns[0];
            await this.testRailClient.addResultsForCases(testRun === null || testRun === void 0 ? void 0 : testRun.id, results.map((currentResult) => ({
                ...currentResult,
                status_id: 4,
                comment: "Test result has been reset",
            })));
            return Promise.resolve(testRun);
        }
        else {
            // if we're in git mode, we simply want to create a new test run
            const { body: testRun } = await this.createTestRun(testRunOptions);
            return Promise.resolve(testRun);
        }
    }
    async sweepUpTestRuns(milestone_id, case_ids) {
        var _a;
        if (!milestone_id)
            return Promise.reject();
        // find test runs for this jira key that might be loose (exploratory testing) and sweep then up
        const { body: testRunsResponse } = await this.getTestRuns();
        // @ts-ignore because the types for body are incorrect
        const testRuns = (_a = testRunsResponse === null || testRunsResponse === void 0 ? void 0 : testRunsResponse.runs) !== null && _a !== void 0 ? _a : [];
        if (!testRuns.length)
            return Promise.resolve();
        await this.attachTestRunsToMilestone(testRuns.filter((currentTestRun) => (currentTestRun === null || currentTestRun === void 0 ? void 0 : currentTestRun.milestone_id) === null), milestone_id, case_ids).catch((error) => Promise.reject(error));
        return Promise.resolve();
    }
    async addTestRunResults(runId, testRailResults) {
        return this.testRailClient.addResultsForCases(runId, testRailResults);
    }
    async attachTestRunsToMilestone(runs, milestone_id, case_ids) {
        if (!runs.length)
            return Promise.resolve([]);
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
    async getCases(filters) {
        const caseFilters = {
            suite_id: this.runInputs.testRunConfig.suiteId,
            limit: 10000,
            ...filters,
        };
        return this.testRailClient.getCases(this.runInputs.testRunConfig.projectId, caseFilters);
    }
    async getTestRuns(filters) {
        const testRunFilters = { refs: this.runInputs.jiraKey, is_completed: 0, ...filters };
        return this.testRailClient.getRuns(this.runInputs.testRunConfig.projectId, testRunFilters);
    }
    async createTestRun(testRunOptions) {
        return this.testRailClient.addRun(this.runInputs.testRunConfig.projectId, testRunOptions);
    }
    async closeTestRun(runId) {
        return this.testRailClient.closeRun(runId);
    }
    async getTestSuite() {
        return this.testRailClient.getSuite(this.runInputs.testRunConfig.suiteId);
    }
    async getMilestones() {
        // @ts-ignore because getMilestones response is typed incorrectly
        const milestoneFilters = { is_completed: 0 };
        return this.testRailClient.getMilestones(this.runInputs.testRunConfig.projectId, milestoneFilters);
    }
    async createMilestone(milestoneOptions) {
        return this.testRailClient.addMilestone(this.runInputs.testRunConfig.projectId, milestoneOptions);
    }
    async closeMilestone(milestone_id) {
        return this.testRailClient.updateMilestone(milestone_id, {
            is_completed: 1,
        });
    }
}
exports.default = TestrailService;
