"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = exports.InputKey = void 0;
const core_1 = require("@actions/core");
const lodash_1 = require("lodash");
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const testrail_api_1 = __importDefault(require("testrail-api"));
const utils_1 = require("./utils");
const environment = process.env.NODE_ENV || "debug";
var InputKey;
(function (InputKey) {
    InputKey["RegressionBranch"] = "regression_branch";
    InputKey["TargetBranch"] = "target_branch";
})(InputKey = exports.InputKey || (exports.InputKey = {}));
async function run() {
    const regressionBranch = (0, core_1.getInput)(InputKey.RegressionBranch) || "staging";
    const regressionMode = (0, core_1.getInput)(InputKey.TargetBranch) === regressionBranch;
    const reportFiles = (0, core_1.getMultilineInput)("report_files");
    const projectId = parseInt((0, core_1.getInput)("project_id"), 10);
    const suiteId = parseInt((0, core_1.getInput)("suite_id"), 10);
    const testRailOptions = {
        host: (0, core_1.getInput)("network_url"),
        user: (0, core_1.getInput)("username"),
        password: (0, core_1.getInput)("api_key"),
    };
    const testRailClient = new testrail_api_1.default(testRailOptions);
    const testRailResults = await (0, utils_1.readFiles)(reportFiles);
    let testRailMilestone;
    if ((0, lodash_1.isEmpty)(testRailResults)) {
        (0, core_1.setFailed)("No TestRail results were found.");
        return;
    }
    if (regressionMode) {
        testRailMilestone = await (0, utils_1.getTestRailMilestone)(testRailClient, projectId);
    }
    testRailClient
        .getUserByEmail(testRailOptions.user)
        .then((userResponse) => {
        var _a;
        const { id: userId } = (_a = userResponse.body) !== null && _a !== void 0 ? _a : {};
        const milestoneId = (0, lodash_1.isEmpty)(testRailMilestone) ? null : testRailMilestone.id;
        const testRunOptions = {
            suite_id: suiteId,
            // @ts-ignore because milestone is not required
            milestone_id: milestoneId,
            name: `[${environment}][${(0, moment_timezone_1.default)()
                .tz("America/New_York")
                .format("YYYY-MM-DD h:mm:ss")}] Automated Test Run`,
            description: "This test run was automatically generated by Github Actions.",
            include_all: true,
            assignedto_id: userId,
        };
        const testPlanOptions = {
            milestone_id: milestoneId,
            name: `[${environment}][${(0, moment_timezone_1.default)()
                .tz("America/New_York")
                .format("YYYY-MM-DD h:mm:ss")}] Automated Test Plan`,
            entries: [testRunOptions]
        };
        if (regressionMode) {
            (0, utils_1.createTestPlan)(testRailClient, projectId, testPlanOptions, testRailResults, true);
        }
        else {
            (0, utils_1.createTestRun)(testRailClient, projectId, testRunOptions, testRailResults, false);
        }
    })
        .catch((error) => {
        (0, core_1.setFailed)(`Failed to get TestRail user: ${(0, utils_1.extractError)(error)}`);
    });
}
exports.run = run;
