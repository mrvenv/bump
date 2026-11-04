/** Use case: bump the package version, like `npm version <target>`. */
import { VersionError } from "../domain/errors.ts";
import {
	type LockFile,
	type Manifest,
	withLockVersion,
	withVersion,
} from "../domain/manifest.ts";
import {
	assertChanged,
	commitMessage,
	type LifecycleEvent,
	lifecycleEnv,
	nextVersion,
	tagName,
	versionFromTag,
} from "../domain/release.ts";
import * as git from "../infra/git.ts";
import { writeJsonFile } from "../infra/json-file.ts";
import {
	type PackageFile,
	readLockFiles,
	readManifest,
} from "../infra/package-files.ts";
import { resolveDir } from "../infra/path.ts";
import { runCommand } from "../infra/scripts.ts";

export interface VersionOptions {
	/** Directory containing package.json. Default: current directory */
	cwd?: string;
	/** Prerelease identifier for pre* bumps, e.g. "beta" -> 1.2.4-beta.0 */
	preid?: string;
	/** Create a git commit and tag (only inside a git repo). Default: true */
	gitTagVersion?: boolean;
	/** Commit and tag message; every "%s" becomes the new version. Default: "%s" */
	message?: string;
	/** Default: "v" */
	tagVersionPrefix?: string;
	/** Allow setting the version to its current value. Default: false */
	allowSameVersion?: boolean;
	/** Skip the clean-working-tree check. Default: false */
	force?: boolean;
	/** Run git commit hooks. Default: true */
	commitHooks?: boolean;
	signGitCommit?: boolean;
	signGitTag?: boolean;
	/** Push the commit and the tag. Default: false */
	push?: boolean;
	/** Skip preversion / version / postversion. Default: false */
	ignoreScripts?: boolean;
	/** Compute the result without changing anything. Default: false */
	dryRun?: boolean;
	/** Called before each lifecycle script runs, e.g. to log it. */
	onScript?: (event: LifecycleEvent, command: string) => void;
}

export interface VersionResult {
	name?: string;
	from?: string;
	to: string;
	/** The created git tag; absent when git was not used. */
	tag?: string;
	/** Files written, relative to cwd. */
	files: string[];
	dryRun: boolean;
}

type Settings = Required<Omit<VersionOptions, "preid" | "onScript">> &
	Pick<VersionOptions, "preid" | "onScript">;

function withDefaults({
	cwd,
	preid,
	gitTagVersion = true,
	message = "%s",
	tagVersionPrefix = "v",
	allowSameVersion = false,
	force = false,
	commitHooks = true,
	signGitCommit = false,
	signGitTag = false,
	push = false,
	ignoreScripts = false,
	dryRun = false,
	onScript,
}: VersionOptions): Settings {
	return {
		cwd: resolveDir(cwd),
		preid,
		gitTagVersion,
		message,
		tagVersionPrefix,
		allowSameVersion,
		force,
		commitHooks,
		signGitCommit,
		signGitTag,
		push,
		ignoreScripts,
		dryRun,
		onScript,
	};
}

async function resolveTarget(
	s: Settings,
	current: string | undefined,
	target: string,
): Promise<string> {
	if (target !== "from-git") return nextVersion(current, target, s.preid);
	if (!(await git.isRepo(s.cwd)))
		throw new VersionError("from-git requires a git repository");
	return versionFromTag(await git.latestTag(s.cwd), s.tagVersionPrefix);
}

async function assertGitReady(
	cwd: string,
	gitTag: string,
	force: boolean,
): Promise<void> {
	const [dirty, exists] = await Promise.all([
		force ? [] : git.dirtyFiles(cwd),
		git.tagExists(cwd, gitTag),
	]);
	if (dirty.length) {
		const list = dirty.map((file) => `  ${file}`).join("\n");
		throw new VersionError(
			`Git working directory not clean:\n${list}\nCommit or stash changes, or use --force.`,
		);
	}
	if (exists) throw new VersionError(`Git tag ${gitTag} already exists`);
}

function createScriptRunner(
	s: Settings,
	manifest: Manifest,
	from: string | undefined,
	to: string,
) {
	return async (event: LifecycleEvent) => {
		const command = manifest.scripts?.[event];
		if (s.ignoreScripts || !command) return;
		s.onScript?.(event, command);
		const exitCode = await runCommand(
			s.cwd,
			command,
			lifecycleEnv(event, from, to),
		);
		if (exitCode)
			throw new VersionError(`"${event}" script exited with code ${exitCode}`);
	};
}

async function writeVersion(
	manifest: PackageFile<Manifest>,
	locks: PackageFile<LockFile>[],
	to: string,
) {
	await Promise.all([
		writeJsonFile({ ...manifest, data: withVersion(manifest.data, to) }),
		...locks.map((lock) =>
			writeJsonFile({ ...lock, data: withLockVersion(lock.data, to) }),
		),
	]);
}

async function commitAndTag(
	s: Settings,
	files: string[],
	to: string,
	gitTag: string,
): Promise<void> {
	const message = commitMessage(s.message, to);
	await git.add(s.cwd, files);
	await git.commit(s.cwd, message, {
		sign: s.signGitCommit,
		noVerify: !s.commitHooks,
	});
	await git.tag(s.cwd, gitTag, message, { sign: s.signGitTag });
}

/** The current "version" from package.json. */
export async function getVersion(cwd?: string): Promise<string | undefined> {
	return (await readManifest(resolveDir(cwd))).data.version;
}

/**
 * Bump the version in package.json (and lockfiles), then commit, tag and run lifecycle scripts.
 *
 * `target`: major | minor | patch | premajor | preminor | prepatch | prerelease | release
 *           | from-git | an explicit version such as "1.2.3".
 */
export async function version(
	target: string,
	options: VersionOptions = {},
): Promise<VersionResult> {
	const s = withDefaults(options);
	const [manifest, locks] = await Promise.all([
		readManifest(s.cwd),
		readLockFiles(s.cwd),
	]);
	const from = manifest.data.version;
	const to = await resolveTarget(s, from, target);
	assertChanged(from, to, s.allowSameVersion);

	const useGit = s.gitTagVersion && (await git.isRepo(s.cwd));
	const gitTag = tagName(to, s.tagVersionPrefix);
	if (useGit) await assertGitReady(s.cwd, gitTag, s.force);

	const files = [manifest, ...locks].map((file) => file.name);
	const result: VersionResult = {
		name: manifest.data.name,
		from,
		to,
		files,
		dryRun: s.dryRun,
	};
	if (useGit) result.tag = gitTag;
	if (s.dryRun) return result;

	const runScript = createScriptRunner(s, manifest.data, from, to);
	await runScript("preversion");
	await writeVersion(manifest, locks, to);
	await runScript("version");
	if (useGit) await commitAndTag(s, files, to, gitTag);
	await runScript("postversion");
	if (useGit && s.push) await git.push(s.cwd, gitTag);

	return result;
}
