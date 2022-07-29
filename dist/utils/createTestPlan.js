"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestPlan = void 0;
const core_1 = require("@actions/core");
const error_1 = require("./error");
const results_1 = require("./results");
function createTestPlan(testRailClient, projectId, testPlanOptions, testRailResults, regressionMode) {
    testRailClient.addPlan(projectId, testPlanOptions).then((addPlanResponse) => {
        var _a, _b, _c;
        const { entries } = (_a = addPlanResponse.body) !== null && _a !== void 0 ? _a : {};
        const { runs } = (_b = (entries || [])[0]) !== null && _b !== void 0 ? _b : {};
        const { id } = (_c = (runs || [])[0]) !== null && _c !== void 0 ? _c : {};
        (0, results_1.addResults)(testRailClient, id, testRailResults, regressionMode);
    })
        .catch((error) => {
        (0, core_1.setFailed)(`Failed to add a new TestRail plan: ${(0, error_1.extractError)(error)}`);
    });
}
exports.createTestPlan = createTestPlan;
