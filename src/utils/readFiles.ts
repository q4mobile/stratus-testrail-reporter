import {
  setFailed,
  error as logError,
} from "@actions/core";
import { promises as fs } from "fs";
import { isEmpty } from "lodash";
import type { INewTestResult } from "testrail-api";

export async function readFiles(filePaths: string[]): Promise<INewTestResult[]> {
  if (isEmpty(filePaths)) return Promise.resolve([]);

  return new Promise((resolve) => {
    let testRailResults: INewTestResult[] = [];

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
  });
}
