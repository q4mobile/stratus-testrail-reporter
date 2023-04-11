import {setFailed, error as logError } from "@actions/core";
import { promises as fs } from "fs";
import { isEmpty } from "lodash";
import type { INewTestResult } from "testrail-api";
import type { TestRun } from "./run.definition";


export function extractFilePaths(
  localFilePaths: string[],
  projectIdPattern?: string,
  suiteIdPattern?: string
): string[] {
  const filePaths: string[] = [];

  if (isEmpty(localFilePaths)) return filePaths;

  const gitPattern = new RegExp(".*-?testrail-report.json");
  const trunkPattern = projectIdPattern && suiteIdPattern && new RegExp(`testrail-${projectIdPattern}-${suiteIdPattern}-report.json`);

  localFilePaths.forEach((localFilePath) => {
    if (trunkPattern) {
      trunkPattern.test(localFilePath) && filePaths.push(localFilePath) ;
    } else {
      gitPattern.test(localFilePath) && filePaths.push(localFilePath);
    }
  });
  return filePaths;
}

export async function getTrunkTestRuns(): Promise<TestRun[]> {
    const testRuns: TestRun[] = [];
    await fs.readdir("./").then((localFilePaths) => {
        const filePaths = extractFilePaths(localFilePaths, ".*", ".*");
        filePaths.forEach((fileName) => {
            testRuns.push(parseFileName(fileName));
        });
    }).catch((error: any) => {
        logError(`Reading file system has failed:: ${error.message}`);
    });
    return testRuns;
}
function parseFileName(fileName: string): TestRun {
    const parts = fileName.split("-");
    return {
        projectId: parseInt(parts[1], 10),
        suiteId:  parseInt(parts[2], 10)
    }
}

export async function extractTestResults(
  projectId?: string,
  suiteId?: string
): Promise<INewTestResult[]> {
  return new Promise((resolve) => {
    let testRailResults: INewTestResult[] = [];

    fs.readdir("./")
      .then((localFilePaths) => {
        const filePaths = extractFilePaths(localFilePaths, projectId, suiteId);

        if (isEmpty(filePaths)) return Promise.resolve([]);

        const promises = filePaths.map((filePath) => {
          return fs
            .readFile(filePath, "utf-8")
            .then((fileResults) => {
              try {
                const results = JSON.parse(fileResults);
                testRailResults = testRailResults.concat(results);
              } catch (error: any) {
                logError(`Parsing report file has failed: ${error.message}`);
                resolve([]);
              }
            })
            .catch((error: any) => {
              logError(`Reading report file has failed:: ${error.message}`);
              resolve([]);
            });
        });

        Promise.all(promises)
          .then(() => {
            resolve(testRailResults);
          })
          .catch((error: any) => {
            setFailed(error.message);
            resolve([]);
          });
      })
      .catch((error: any) => {
        logError(`Reading file system has failed:: ${error.message}`);
        return Promise.resolve([]);
      });
  });
}
