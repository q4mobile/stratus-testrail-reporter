export function extractError(error: any): string {
  if (!error) return "An error is present, but could not be parsed";

  return error.error || error.message?.error || error.message || JSON.stringify(error);
}
