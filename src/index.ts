import { run } from "./run/run";

// Exit once the run settles: a request abandoned by a timeout keeps its socket open, which would
// otherwise keep the process, and the CI step, alive. setFailed has already set the exit code.
run().finally(() => process.exit());
