export const extractReferences = (referencesString: string): string[] => {
  return referencesString?.split?.(", ") ?? [];
};

export const joinReferences = (references: string[]): string => {
  return references?.join?.(", ") ?? "";
};
