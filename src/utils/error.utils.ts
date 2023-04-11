import { isEmpty } from "lodash";

export function extractError(error: any): string {
  if (isEmpty(error)) return "An error is present, but could not be parsed";

  return JSON.stringify(error);
}
