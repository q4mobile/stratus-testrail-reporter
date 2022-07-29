"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFiles = void 0;
const core_1 = require("@actions/core");
const fs_1 = require("fs");
const lodash_1 = require("lodash");
async function readFiles(filePaths) {
    if ((0, lodash_1.isEmpty)(filePaths))
        return Promise.resolve([]);
    return new Promise((resolve) => {
        let testRailResults = [];
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
    });
}
exports.readFiles = readFiles;
