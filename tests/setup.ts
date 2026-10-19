// Runs before every test file (see vite.config.ts). After each test, it lets the test worker
// read its messages before the next test starts. The worker tells the main process how each test
// went and gives up on an answer after 60 seconds, but it only reads the answer once nothing else
// is running, and a real set's long tests, one after another, can keep it busy for longer than
// that on GitHub's machines. Then the run fails, though every test passed.
import { afterEach } from 'vitest';

afterEach(() => new Promise((resolve) => setTimeout(resolve)));
