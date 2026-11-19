import { chunk, RequestTimeoutError, withTimeout } from "./index";

describe("chunk", () => {
  it("[Given] items and a size [When] chunked [Then] every chunk but the last has the size and order is kept", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });

  it("[Given] a size below one [When] chunked [Then] it throws", () => {
    expect(() => chunk([1], 0)).toThrow("chunk size must be at least 1");
  });
});

describe("withTimeout", () => {
  afterEach(() => jest.useRealTimers());

  it("[Given] a promise that settles in time [When] wrapped [Then] its value is returned and no timer is left", async () => {
    jest.useFakeTimers();
    await expect(withTimeout(Promise.resolve("ok"), 1000, "get_suite")).resolves.toBe("ok");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("[Given] a promise that never settles [When] the timeout passes [Then] it rejects with a RequestTimeoutError naming the request", async () => {
    jest.useFakeTimers();
    const pending = withTimeout(new Promise(() => undefined), 1000, "get_suite");
    const assertion = expect(pending).rejects.toThrow(
      new RequestTimeoutError("get_suite", 1000).message
    );
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
