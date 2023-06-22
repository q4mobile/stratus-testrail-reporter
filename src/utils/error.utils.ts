export function extractError(error: any): string {
  if (typeof error === "string") return error;

  return error.error || error.message?.error || error.message || JSON.stringify(error);
}
