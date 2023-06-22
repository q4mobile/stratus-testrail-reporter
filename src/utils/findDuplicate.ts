function findDuplicates(inputArray: string[]): string[] {
  const duplicates: string[] = [];
  const hashTable: { [key: string]: number } = {};

  inputArray.forEach((item) => {
    if (!hashTable[item]) {
      // If the string isn't in the hash table, add it
      hashTable[item] = 1;
    } else if (hashTable[item] === 1) {
      // Record the first duplicate of this item
      duplicates.push(item);

      // Increate the count to avoid recording the duplicate again
      hashTable[item] += 1;
    }
  });

  return duplicates;
}

export default findDuplicates;
