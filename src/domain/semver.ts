/**
 * Dependency-free SemVer 2.0.0. `inc()` mirrors node-semver (what `npm version` uses).
 * Pure: no I/O.
 */

export const RELEASE_TYPES = [
	"major",
	"minor",
	"patch",
	"premajor",
	"preminor",
	"prepatch",
	"prerelease",
	"release",
] as const;

export type ReleaseType = (typeof RELEASE_TYPES)[number];

type Identifier = string | number;

export interface SemVer {
	major: number;
	minor: number;
	patch: number;
	prerelease: Identifier[];
	build: string[];
}

// The SemVer grammar is the one place where a regex is the right tool.
const NUM = "0|[1-9]\\d*";
const PRE_ID = `(?:${NUM}|\\d*[a-zA-Z-][0-9a-zA-Z-]*)`;
const BUILD_ID = "[0-9a-zA-Z-]+";
const SEMVER_RE = new RegExp(
	`^v?(${NUM})\\.(${NUM})\\.(${NUM})(?:-(${PRE_ID}(?:\\.${PRE_ID})*))?(?:\\+(${BUILD_ID}(?:\\.${BUILD_ID})*))?$`,
);
const PRE_ID_RE = new RegExp(`^${PRE_ID}$`);

const isDigits = (s: string) =>
	!!s && [...s].every((c) => c >= "0" && c <= "9");
const toIdentifier = (id: string): Identifier =>
	isDigits(id) ? Number(id) : id;

export const isReleaseType = (value: string): value is ReleaseType =>
	RELEASE_TYPES.includes(value as ReleaseType);

export const isValidPreid = (preid: string) => PRE_ID_RE.test(preid);

export function parse(input: string): SemVer | null {
	const m = SEMVER_RE.exec(input.trim());
	if (!m) return null;
	const [major, minor, patch] = [m[1], m[2], m[3]].map(Number) as [
		number,
		number,
		number,
	];
	if (![major, minor, patch].every(Number.isSafeInteger)) return null;
	return {
		major,
		minor,
		patch,
		prerelease: m[4] ? m[4].split(".").map(toIdentifier) : [],
		build: m[5] ? m[5].split(".") : [],
	};
}

export function format(v: SemVer): string {
	const core = `${v.major}.${v.minor}.${v.patch}`;
	const pre = v.prerelease.length ? `-${v.prerelease.join(".")}` : "";
	const build = v.build.length ? `+${v.build.join(".")}` : "";
	return core + pre + build;
}

/** Normalised version string (without leading "v"), or null when invalid. */
export function valid(input: string): string | null {
	const v = parse(input);
	return v && format(v);
}

function compareIdentifiers(a: Identifier, b: Identifier): -1 | 0 | 1 {
	if (typeof a !== typeof b) return typeof a === "number" ? -1 : 1;
	return a === b ? 0 : a < b ? -1 : 1;
}

function comparePrerelease(a: Identifier[], b: Identifier[]): -1 | 0 | 1 {
	if (!a.length || !b.length)
		return a.length === b.length ? 0 : a.length ? -1 : 1;
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const [x, y] = [a[i], b[i]];
		if (x === undefined) return -1;
		if (y === undefined) return 1;
		const c = compareIdentifiers(x, y);
		if (c) return c;
	}
	return 0;
}

/** SemVer precedence (build metadata ignored). Usable as an `Array#sort` comparator. */
export function compare(a: string, b: string): -1 | 0 | 1 {
	const x = parse(a);
	const y = parse(b);
	if (!x) throw new TypeError(`Invalid version: ${a}`);
	if (!y) throw new TypeError(`Invalid version: ${b}`);
	for (const key of ["major", "minor", "patch"] as const) {
		if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1;
	}
	return comparePrerelease(x.prerelease, y.prerelease);
}

/** Increment the last numeric identifier, or append 0 if there is none. */
function bumpCounter(prerelease: Identifier[]): Identifier[] {
	const last = prerelease.findLastIndex((id) => typeof id === "number");
	if (last === -1) return [...prerelease, 0];
	return prerelease.map((id, i) => (i === last ? (id as number) + 1 : id));
}

function nextPrerelease(
	prerelease: Identifier[],
	preid?: string,
): Identifier[] {
	const bumped = prerelease.length ? bumpCounter(prerelease) : [0];
	if (!preid) return bumped;
	const keepsCounter = bumped[0] === preid && typeof bumped[1] === "number";
	return keepsCounter ? bumped : [preid, 0];
}

function release(v: SemVer): SemVer {
	if (!v.prerelease.length)
		throw new TypeError(`Version ${format(v)} is not a prerelease`);
	return { ...v, prerelease: [] };
}

const STEPS: Record<ReleaseType, (v: SemVer, preid?: string) => SemVer> = {
	// 2.0.0-rc.1 -> 2.0.0, otherwise 1.2.3 -> 2.0.0
	major: (v) => ({
		...v,
		major: v.prerelease.length && !v.minor && !v.patch ? v.major : v.major + 1,
		minor: 0,
		patch: 0,
		prerelease: [],
	}),
	// 1.3.0-rc.1 -> 1.3.0, otherwise 1.2.3 -> 1.3.0
	minor: (v) => ({
		...v,
		minor: v.prerelease.length && !v.patch ? v.minor : v.minor + 1,
		patch: 0,
		prerelease: [],
	}),
	// 1.2.4-rc.1 -> 1.2.4, otherwise 1.2.3 -> 1.2.4
	patch: (v) => ({
		...v,
		patch: v.prerelease.length ? v.patch : v.patch + 1,
		prerelease: [],
	}),
	premajor: (v, preid) => ({
		...v,
		major: v.major + 1,
		minor: 0,
		patch: 0,
		prerelease: nextPrerelease([], preid),
	}),
	preminor: (v, preid) => ({
		...v,
		minor: v.minor + 1,
		patch: 0,
		prerelease: nextPrerelease([], preid),
	}),
	prepatch: (v, preid) => ({
		...v,
		patch: v.patch + 1,
		prerelease: nextPrerelease([], preid),
	}),
	prerelease: (v, preid) =>
		v.prerelease.length
			? { ...v, prerelease: nextPrerelease(v.prerelease, preid) }
			: { ...v, patch: v.patch + 1, prerelease: nextPrerelease([], preid) },
	release,
};

/**
 * Increment `version` by `type`.
 *
 *   inc("1.2.3", "minor")               -> "1.3.0"
 *   inc("1.2.3", "prerelease", "beta")  -> "1.2.4-beta.0"
 *   inc("1.2.4-beta.0", "prerelease")   -> "1.2.4-beta.1"
 *   inc("2.0.0-rc.1", "major")          -> "2.0.0"
 */
export function inc(
	version: string,
	type: ReleaseType,
	preid?: string,
): string {
	const v = parse(version);
	if (!v) throw new TypeError(`Invalid version: ${version}`);
	if (preid && !isValidPreid(preid))
		throw new TypeError(`Invalid prerelease identifier: ${preid}`);
	return format({ ...STEPS[type](v, preid), build: [] });
}
