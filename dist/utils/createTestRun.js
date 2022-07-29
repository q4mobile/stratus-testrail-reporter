"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestRun = void 0;
const core_1 = require("@actions/core");
const error_1 = require("./error");
const results_1 = require("./results");
function createTestRun(testRailClient, projectId, testRunOptions, testRailResults, regressionMode) {
    testRailClient
        .addRun(projectId, testRunOptions)
        .then((addRunResponse) => {
        var _a;
        const { id } = (_a = addRunResponse.body) !== null && _a !== void 0 ? _a : {};
        (0, results_1.addResults)(testRailClient, id, testRailResults, regressionMode);
    })
        .catch((error) => {
        (0, core_1.setFailed)(`Failed to add a new TestRail run: ${(0, error_1.extractError)(error)}`);
    });
}
exports.createTestRun = createTestRun;
