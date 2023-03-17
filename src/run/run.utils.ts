import { setFailed, error as logError } from "@actions/core";
import { promises as fs } from "fs";
import { isEmpty } from "lodash";
import type { INewTestResult } from "testrail-api";

function extractFilePaths(
  localFilePaths: string[],
  projectId?: number,
  suiteId?: number
): string[] {
  const filePaths: string[] = [];

  if (isEmpty(localFilePaths)) return filePaths;

  const gitPattern = new RegExp(".*-?testrail-report.json");
  const trunkPattern = projectId && suiteId && `testrail-${projectId}-${suiteId}-report.json`;

  localFilePaths.forEach((localFilePath) => {
    if (trunkPattern) {
      localFilePath === trunkPattern && filePaths.push(localFilePath);
    } else {
      gitPattern.test(localFilePath) && filePaths.push(localFilePath);
    }
  });

  return filePaths;
}

export async function extractTestResults(
  projectId?: number,
  suiteId?: number
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
