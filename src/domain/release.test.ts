import { describe, expect, test } from "bun:test";
import { withLockVersion, withVersion } from "./manifest.ts";
import {
	assertChanged,
	commitMessage,
	nextVersion,
	versionFromTag,
} from "./release.ts";

describe("nextVersion", () => {
	test.each([
		["1.2.3", "minor", undefined, "1.3.0"],
		["1.2.3", "v2.0.0", undefined, "2.0.0"],
		["1.2.3", "prerelease", "rc", "1.2.4-rc.0"],
		[undefined, "1.0.0", undefined, "1.0.0"],
	])("nextVersion(%p, %p, %p) -> %p", (current, target, preid, out) => {
		expect(nextVersion(current, target, preid)).toBe(out);
	});

	test.each([
		["1.0.0", "huge", "Invalid version or release type"],
		[undefined, "patch", 'no "version" field'],
		["latest", "patch", "not valid semver"],
		["1.0.0", "release", "not a prerelease"],
	])("nextVersion(%p, %p) throws %p", (current, target, message) => {
		expect(() => nextVersion(current, target)).toThrow(message);
	});
});

test("versionFromTag strips the prefix", () => {
	expect(versionFromTag("v1.2.3", "v")).toBe("1.2.3");
	expect(versionFromTag("release-1.2.3", "release-")).toBe("1.2.3");
	expect(() => versionFromTag("nightly", "v")).toThrow("not a valid version");
});

test("assertChanged", () => {
	expect(() => assertChanged("1.0.0", "1.0.0", false)).toThrow(
		"Version not changed",
	);
	expect(() => assertChanged("1.0.0", "1.0.0", true)).not.toThrow();
	expect(() => assertChanged(undefined, "1.0.0", false)).not.toThrow();
});

test("commitMessage replaces every %s", () => {
	expect(commitMessage("release %s (%s)", "1.0.0")).toBe(
		"release 1.0.0 (1.0.0)",
	);
});

describe("manifest updates are immutable", () => {
	test("withVersion keeps key order", () => {
		const pkg = { name: "x", version: "1.0.0", private: true };
		const next = withVersion(pkg, "2.0.0");
		expect(Object.keys(next)).toEqual(["name", "version", "private"]);
		expect(pkg.version).toBe("1.0.0");
	});

	test("withLockVersion updates the root package entry", () => {
		const lock = {
			version: "1.0.0",
			packages: {
				"": { version: "1.0.0" },
				"node_modules/a": { version: "9.9.9" },
			},
		};
		const next = withLockVersion(lock, "2.0.0");
		expect(next.packages[""].version).toBe("2.0.0");
		expect(next.packages["node_modules/a"].version).toBe("9.9.9");
		expect(lock.packages[""].version).toBe("1.0.0");
	});
});
