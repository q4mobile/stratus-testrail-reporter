"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeTestRun = void 0;
const core_1 = require("@actions/core");
const error_1 = require("./error");
function closeTestRun(testRailClient, runId) {
    testRailClient.closeRun(runId).catch((error) => {
        (0, core_1.setFailed)(`Failed to close the TestRail run: ${(0, error_1.extractError)(error)}`);
    });
}
exports.closeTestRun = closeTestRun;
