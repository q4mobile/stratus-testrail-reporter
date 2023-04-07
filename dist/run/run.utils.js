"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTestResults = exports.getTrunkTestRuns = exports.extractFilePaths = void 0;
const core_1 = require("@actions/core");
const fs_1 = require("fs");
const lodash_1 = require("lodash");
const source_code_directory = process.env['GITHUB_WORKSPACE'] || './';
console.log(source_code_directory);
function extractFilePaths(localFilePaths, projectIdPattern, suiteIdPattern) {
    const filePaths = [];
    if ((0, lodash_1.isEmpty)(localFilePaths))
        return filePaths;
    const gitPattern = new RegExp(".*-?testrail-report.json");
    const trunkPattern = projectIdPattern && suiteIdPattern && new RegExp(`testrail-${projectIdPattern}-${suiteIdPattern}-report.json`);
    localFilePaths.forEach((localFilePath) => {
        console.log(localFilePath);
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
async function getTrunkTestRuns() {
    const testRuns = [];
    await fs_1.promises.readdir(source_code_directory).then((localFilePaths) => {
        const filePaths = extractFilePaths(localFilePaths, ".*", ".*");
        filePaths.forEach((fileName) => {
            testRuns.push(parseFileName(fileName));
        });
    }).catch((error) => {
        (0, core_1.error)(`Reading file system has failed:: ${error.message}`);
    });
    return testRuns;
}
exports.getTrunkTestRuns = getTrunkTestRuns;
function parseFileName(fileName) {
    const parts = fileName.split("-");
    return {
        projectId: parseInt(parts[1], 10),
        suiteId: parseInt(parts[2], 10)
    };
}
async function extractTestResults(projectId, suiteId) {
    return new Promise((resolve) => {
        let testRailResults = [];
        fs_1.promises.readdir(source_code_directory)
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
