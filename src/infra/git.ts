/** Thin wrapper over the git CLI. No release rules here. */
import { $ } from "bun";

interface GitOutput {
	ok: boolean;
	stdout: string;
	stderr: string;
}

async function run(cwd: string, args: string[]): Promise<GitOutput> {
	const res = await $`git ${args}`.cwd(cwd).quiet().nothrow();
	return {
		ok: !res.exitCode,
		stdout: res.stdout.toString().trim(),
		stderr: res.stderr.toString().trim(),
	};
}

async function runOrThrow(cwd: string, args: string[]): Promise<string> {
	const { ok, stdout, stderr } = await run(cwd, args);
	if (!ok)
		throw new Error(`git ${args.join(" ")} failed:\n${stderr || stdout}`);
	return stdout;
}

export async function isRepo(cwd: string): Promise<boolean> {
	const { ok, stdout } = await run(cwd, ["rev-parse", "--is-inside-work-tree"]);
	return ok && stdout === "true";
}

/** Tracked files with uncommitted changes. Untracked files are ignored, like npm. */
export async function dirtyFiles(cwd: string): Promise<string[]> {
	const status = await runOrThrow(cwd, ["status", "--porcelain"]);
	return status
		.split("\n")
		.filter((line) => line && !line.startsWith("??"))
		.map((line) => line.slice(3));
}

export async function tagExists(cwd: string, name: string): Promise<boolean> {
	return (await run(cwd, ["rev-parse", "-q", "--verify", `refs/tags/${name}`]))
		.ok;
}

export const latestTag = (cwd: string) =>
	runOrThrow(cwd, ["describe", "--tags", "--abbrev=0"]);

export async function add(cwd: string, files: string[]): Promise<void> {
	await runOrThrow(cwd, ["add", "--", ...files]);
}

export async function commit(
	cwd: string,
	message: string,
	{ sign = false, noVerify = false } = {},
): Promise<void> {
	const signFlag = sign ? ["-S"] : [];
	const verifyFlag = noVerify ? ["--no-verify"] : [];
	await runOrThrow(cwd, ["commit", "-m", message, ...signFlag, ...verifyFlag]);
}

/** Annotated tag, or a signed one with `sign`. */
export async function tag(
	cwd: string,
	name: string,
	message: string,
	{ sign = false } = {},
): Promise<void> {
	await runOrThrow(cwd, ["tag", name, sign ? "-s" : "-a", "-m", message]);
}

export async function push(cwd: string, tagName: string): Promise<void> {
	await runOrThrow(cwd, ["push"]);
	await runOrThrow(cwd, ["push", "origin", `refs/tags/${tagName}`]);
}
