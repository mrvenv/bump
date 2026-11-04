import { expect, test } from "bun:test";
import { parseArgs } from "./args.ts";

const SPEC = { message: "string", force: "boolean", cwd: "string" } as const;
const ALIASES = { m: "message", f: "force" } as const;
const parse = (...argv: string[]) => parseArgs(argv, SPEC, ALIASES);

test("flags, values and positionals", () => {
	expect(parse("patch", "--force", "--cwd", "dir", "-m", "msg %s")).toEqual({
		flags: { force: true, cwd: "dir", message: "msg %s" },
		positionals: ["patch"],
	});
});

test("--flag=value and short aliases", () => {
	expect(parse("--message=a=b", "-f").flags).toEqual({
		message: "a=b",
		force: true,
	});
});

test("a value may start with a dash", () => {
	expect(parse("-m", "-x").flags.message).toBe("-x");
});

test("-- ends option parsing", () => {
	expect(parse("--", "--force", "x").positionals).toEqual(["--force", "x"]);
});

test.each([
	[["--nope"], "Unknown option: --nope"],
	[["-z"], "Unknown option: -z"],
	[["--cwd"], "requires a value"],
	[["--force=yes"], "does not take a value"],
])("%p throws %p", (argv, message) => {
	expect(() => parse(...argv)).toThrow(message);
});
