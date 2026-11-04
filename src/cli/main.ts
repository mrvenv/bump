/** Delivery layer: argv in, text and exit code out. The only place that prints. */
import {
	getVersion,
	type VersionOptions,
	type VersionResult,
	version,
} from "../app/version.ts";
import { tagName } from "../domain/release.ts";
import { type Flags, parseArgs, UsageError } from "./args.ts";
import { HELP } from "./help.ts";

const FLAGS = {
	preid: "string",
	message: "string",
	"tag-version-prefix": "string",
	"no-git-tag-version": "boolean",
	"no-commit-hooks": "boolean",
	"sign-git-commit": "boolean",
	"sign-git-tag": "boolean",
	push: "boolean",
	"allow-same-version": "boolean",
	force: "boolean",
	"ignore-scripts": "boolean",
	"dry-run": "boolean",
	cwd: "string",
	json: "boolean",
	help: "boolean",
} as const;

const ALIASES = { m: "message", f: "force", h: "help" } as const;

type CliFlags = Flags<typeof FLAGS>;

const toOptions = (flags: CliFlags): VersionOptions => ({
	cwd: flags.cwd,
	preid: flags.preid,
	message: flags.message,
	tagVersionPrefix: flags["tag-version-prefix"],
	gitTagVersion: !flags["no-git-tag-version"],
	commitHooks: !flags["no-commit-hooks"],
	signGitCommit: flags["sign-git-commit"],
	signGitTag: flags["sign-git-tag"],
	push: flags.push,
	allowSameVersion: flags["allow-same-version"],
	force: flags.force,
	ignoreScripts: flags["ignore-scripts"],
	dryRun: flags["dry-run"],
	onScript: (_event, command) => console.error(`$ ${command}`),
});

function formatResult(result: VersionResult, flags: CliFlags): string {
	if (flags.json) return JSON.stringify(result, null, 2);
	if (result.dryRun)
		return `[dry-run] ${result.from ?? "(none)"} -> ${result.to}`;
	return tagName(result.to, flags["tag-version-prefix"] ?? "v");
}

async function printCurrent(flags: CliFlags): Promise<void> {
	const current = await getVersion(flags.cwd);
	console.log(
		flags.json ? JSON.stringify({ version: current ?? null }) : (current ?? ""),
	);
}

async function run(argv: readonly string[]): Promise<void> {
	const { flags, positionals } = parseArgs(argv, FLAGS, ALIASES);
	if (flags.help) return console.log(HELP);
	if (positionals.length > 1)
		throw new UsageError(
			`Expected at most one argument, got ${positionals.length}`,
		);

	const [target] = positionals;
	if (!target) return printCurrent(flags);
	console.log(formatResult(await version(target, toOptions(flags)), flags));
}

/** Runs the CLI and returns the process exit code. */
export async function main(argv: readonly string[]): Promise<number> {
	try {
		await run(argv);
		return 0;
	} catch (err) {
		console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
		if (err instanceof UsageError) console.error(`\n${HELP}`);
		return 1;
	}
}
