#!/usr/bin/env bun
/** Executable entry point (`bin` in package.json, `bun build --compile` target). */
import { main } from "./main.ts";

process.exit(await main(Bun.argv.slice(2)));
