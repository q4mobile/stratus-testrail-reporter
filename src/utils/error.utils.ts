export function extractError(error: any): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  return JSON.stringify(error);
}
