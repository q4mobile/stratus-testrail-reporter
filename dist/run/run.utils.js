"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTestResults = exports.getTrunkTestRunConfigs = exports.extractFilePaths = void 0;
const core_1 = require("@actions/core");
const fs_1 = require("fs");
function extractFilePaths(localFilePaths, projectIdPattern, suiteIdPattern) {
    const filePaths = [];
    if (!localFilePaths.length)
        return [];
    const gitPattern = new RegExp(".*-?testrail-report.json");
    const trunkPattern = projectIdPattern &&
        suiteIdPattern &&
        new RegExp(`testrail-${projectIdPattern}-${suiteIdPattern}-report.json`);
    localFilePaths.forEach((localFilePath) => {
        if (trunkPattern) {
            trunkPattern.test(localFilePath) && filePaths.push(localFilePath);
        }
        else {
            gitPattern.test(localFilePath) && filePaths.push(localFilePath);
        }
    });
    return filePaths;
}
exports.extractFilePaths = extractFilePaths;
function parseFileName(fileName) {
    const parts = fileName.split("-");
    return {
        projectId: parseInt(parts[1], 10),
        suiteId: parseInt(parts[2], 10),
    };
}
async function getTrunkTestRunConfigs() {
    const testRunConfigs = [];
    await fs_1.promises
        .readdir("./")
        .then((localFilePaths) => {
        const filePaths = extractFilePaths(localFilePaths, ".*", ".*");
        filePaths.forEach((fileName) => {
            testRunConfigs.push(parseFileName(fileName));
        });
    })
        .catch((error) => {
        (0, core_1.error)(`Reading file system has failed:: ${error.message}`);
    });
    return testRunConfigs;
}
exports.getTrunkTestRunConfigs = getTrunkTestRunConfigs;
async function extractTestResults(projectId, suiteId) {
    return new Promise((resolve) => {
        let testRailResults = [];
        fs_1.promises.readdir("./")
            .then((localFilePaths) => {
            const filePaths = extractFilePaths(localFilePaths, projectId === null || projectId === void 0 ? void 0 : projectId.toString(), suiteId === null || suiteId === void 0 ? void 0 : suiteId.toString());
            if (!filePaths.length)
                return Promise.resolve([]);
            const promises = filePaths.map((filePath) => {
                return fs_1.promises
                    .readFile(filePath, "utf-8")
                    .then((fileResults) => {
                    try {
                        const results = JSON.parse(fileResults);
                        testRailResults = testRailResults.concat(results);
                    }
                    catch (error) {
                        (0, core_1.error)(`Parsing report file has failed: ${error.message}`);
                        resolve([]);
                    }
                })
                    .catch((error) => {
                    (0, core_1.error)(`Reading report file has failed:: ${error.message}`);
                    resolve([]);
                });
            });
            Promise.all(promises)
                .then(() => {
                resolve(testRailResults);
            })
                .catch((error) => {
                (0, core_1.setFailed)(error.message);
                resolve([]);
            });
        })
            .catch((error) => {
            (0, core_1.error)(`Reading file system has failed:: ${error.message}`);
            return Promise.resolve([]);
        });
    });
}
exports.extractTestResults = extractTestResults;
