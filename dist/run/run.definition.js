"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputKey = exports.Environment = void 0;
var Environment;
(function (Environment) {
    Environment["Local"] = "local";
    Environment["Debug"] = "debug";
    Environment["Development"] = "dev";
    Environment["Stage"] = "stage";
    Environment["Production"] = "prod";
})(Environment = exports.Environment || (exports.Environment = {}));
var InputKey;
(function (InputKey) {
    InputKey["NetworkUrl"] = "network_url";
    InputKey["Username"] = "username";
    InputKey["ApiKey"] = "api_key";
    InputKey["JiraKey"] = "jira_key";
    InputKey["RegressionMode"] = "regression_mode";
    InputKey["TargetBranch"] = "target_branch";
    InputKey["ProjectId"] = "project_id";
    InputKey["SuiteId"] = "suite_id";
})(InputKey = exports.InputKey || (exports.InputKey = {}));
