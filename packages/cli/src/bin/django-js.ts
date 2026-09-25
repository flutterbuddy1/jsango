#!/usr/bin/env node
import { CliApplication } from '../public/app.js';

const app = CliApplication.createDefault();

void app
  .run(process.argv.slice(2))
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((err) => {
    process.stderr.write(`Fatal CLI error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
