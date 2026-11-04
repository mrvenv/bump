/** Public API. Everything not exported here is internal. */

export type { VersionOptions, VersionResult } from "./src/app/version.ts";
export { getVersion, version } from "./src/app/version.ts";
export { VersionError } from "./src/domain/errors.ts";
export type { LifecycleEvent } from "./src/domain/release.ts";
export { LIFECYCLE_EVENTS, nextVersion } from "./src/domain/release.ts";
export type { ReleaseType, SemVer } from "./src/domain/semver.ts";
export {
	compare,
	format,
	inc,
	isReleaseType,
	isValidPreid,
	parse,
	RELEASE_TYPES,
	valid,
} from "./src/domain/semver.ts";
