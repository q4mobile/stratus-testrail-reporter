"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestRailMilestone = void 0;
const lodash_1 = require("lodash");
const moment_1 = __importDefault(require("moment"));
async function getTestRailMilestone(testRailClient, projectId) {
    // @ts-ignore because is_started is not actually required
    const milestoneFilters = { is_completed: 0 };
    return new Promise((resolve) => {
        testRailClient.getMilestones(projectId, milestoneFilters).then((milestonesResponse) => {
            var _a;
            // @ts-ignore because getMilestones response is typed incorrectly
            const { milestones } = (_a = milestonesResponse.body) !== null && _a !== void 0 ? _a : {};
            if ((0, lodash_1.isEmpty)(milestones)) {
                testRailClient.addMilestone(projectId, {
                    name: `[${(0, moment_1.default)()
                        .tz("America/New_York")
                        .format("YYYY-MM-DD")}] Automated Mile Stone`
                }).then((addMilestoneResponse) => {
                    var _a;
                    resolve((_a = addMilestoneResponse.body) !== null && _a !== void 0 ? _a : {});
                });
            }
            else {
                resolve(milestones[0]);
            }
        });
    });
}
exports.getTestRailMilestone = getTestRailMilestone;
