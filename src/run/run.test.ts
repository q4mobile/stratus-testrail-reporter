import { run } from "./run";

const date = new Date();
const now = date.getTime();
const mockId = 1234567;
const mockName = "mockName";

describe("run", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(date);
  });
});
