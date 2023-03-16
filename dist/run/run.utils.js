"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTestResults = void 0;
const core_1 = require("@actions/core");
const fs_1 = require("fs");
const lodash_1 = require("lodash");
function extractFilePaths(localFilePaths, projectId, suiteId) {
    const filePaths = [];
    if ((0, lodash_1.isEmpty)(localFilePaths))
        return filePaths;
    const gitPattern = new RegExp(".*-?testrail-report.json");
    const trunkPattern = projectId && suiteId && `testrail-${projectId}-${suiteId}-report.json`;
    localFilePaths.forEach((localFilePath) => {
        if (trunkPattern) {
            localFilePath === trunkPattern && filePaths.push(localFilePath);
        }
        else {
            gitPattern.test(localFilePath) && filePaths.push(localFilePath);
        }
    });
    return filePaths;
}
async function extractTestResults(projectId, suiteId) {
    return new Promise((resolve) => {
        let testRailResults = [];
        fs_1.promises.readdir("./")
            .then((localFilePaths) => {
            const filePaths = extractFilePaths(localFilePaths, projectId, suiteId);
            if ((0, lodash_1.isEmpty)(filePaths))
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
