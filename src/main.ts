// backend/src/main.ts
// Entry point. Plain CommonJS on purpose: hosts that run `node src/main.ts` directly (e.g. Render's default
// start command) get ts-node registered first, so the TypeScript in ./server loads without a build step.
require('ts-node').register({ transpileOnly: true });
require('./server');
