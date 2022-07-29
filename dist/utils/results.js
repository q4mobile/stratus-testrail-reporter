"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addResults = void 0;
const core_1 = require("@actions/core");
const closeTestRun_1 = require("./closeTestRun");
const error_1 = require("./error");
function addResults(testRailClient, runId, testRailResults, regressionMode) {
    testRailClient
        .addResultsForCases(runId, testRailResults)
        .then(() => {
        if (!regressionMode) {
            (0, closeTestRun_1.closeTestRun)(testRailClient, runId);
        }
        (0, core_1.setOutput)("completion_time", new Date().toTimeString());
        (0, core_1.setOutput)("run_id", runId); // output run_id for future steps
    })
        .catch((error) => {
        (0, core_1.setFailed)(`Failed to add test case results to TestRail: ${(0, error_1.extractError)(error)}`);
        if (!regressionMode) {
            (0, closeTestRun_1.closeTestRun)(testRailClient, runId);
        }
    });
}
exports.addResults = addResults;
