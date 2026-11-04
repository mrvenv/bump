/** Release rules: which version comes next, and what gets tagged. Pure: no I/O. */
import { VersionError } from "./errors.ts";
import { inc, isReleaseType, valid } from "./semver.ts";

export const LIFECYCLE_EVENTS = [
	"preversion",
	"version",
	"postversion",
] as const;
export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

/** Resolve an explicit version ("1.2.3", "v1.2.3") or a release type against `current`. */
export function nextVersion(
	current: string | undefined,
	target: string,
	preid?: string,
): string {
	const explicit = valid(target);
	if (explicit) return explicit;
	if (!isReleaseType(target))
		throw new VersionError(`Invalid version or release type: "${target}"`);
	if (!current)
		throw new VersionError(
			`package.json has no "version" field; pass an explicit version`,
		);
	if (!valid(current))
		throw new VersionError(`Current version "${current}" is not valid semver`);
	try {
		return inc(current, target, preid);
	} catch (err) {
		throw new VersionError((err as Error).message, { cause: err });
	}
}

/** "v1.2.3" -> "1.2.3" */
export function versionFromTag(tag: string, prefix: string): string {
	const version = valid(
		tag.startsWith(prefix) ? tag.slice(prefix.length) : tag,
	);
	if (!version)
		throw new VersionError(`Latest git tag "${tag}" is not a valid version`);
	return version;
}

export function assertChanged(
	from: string | undefined,
	to: string,
	allowSameVersion: boolean,
): void {
	if (allowSameVersion || !from || valid(from) !== to) return;
	throw new VersionError(
		`Version not changed (${to}); use --allow-same-version to override`,
	);
}

export const tagName = (version: string, prefix: string) => prefix + version;

/** Every "%s" in the template becomes the version. */
export const commitMessage = (template: string, version: string) =>
	template.replaceAll("%s", version);

/** Environment for lifecycle scripts, same variable names as npm. */
export const lifecycleEnv = (
	event: LifecycleEvent,
	from: string | undefined,
	to: string,
) => ({
	npm_lifecycle_event: event,
	npm_old_version: from ?? "",
	npm_new_version: to,
});
