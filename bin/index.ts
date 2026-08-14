#!/usr/bin/env node
import { run } from "../src/cli.ts"

const exitCode = await run(process.argv)
process.exit(exitCode)
