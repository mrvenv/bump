import { describe, expect, test } from "bun:test";
import { compare, inc, parse, type ReleaseType, valid } from "./semver.ts";

describe("parse / valid", () => {
	test.each([
		["1.2.3", "1.2.3"],
		["v1.2.3", "1.2.3"],
		["1.2.3-beta.1", "1.2.3-beta.1"],
		["1.2.3-rc.1+build.5", "1.2.3-rc.1+build.5"],
		[" 0.0.0 ", "0.0.0"],
	])("valid(%p) -> %p", (input, out) => expect(valid(input)).toBe(out));

	test.each(["1.2", "01.2.3", "1.2.3-01", "1.2.3-", "latest", "", "1.2.3.4"])(
		"invalid %p",
		(input) => expect(valid(input)).toBeNull(),
	);

	test("numeric prerelease ids become numbers", () => {
		expect(parse("1.0.0-alpha.10")?.prerelease).toEqual(["alpha", 10]);
	});
});

describe("inc (matches node-semver / npm version)", () => {
	const cases: [string, ReleaseType, string | undefined, string][] = [
		["1.2.3", "major", undefined, "2.0.0"],
		["1.2.3", "minor", undefined, "1.3.0"],
		["1.2.3", "patch", undefined, "1.2.4"],
		["1.2.3+build", "patch", undefined, "1.2.4"],
		["2.0.0-rc.1", "major", undefined, "2.0.0"],
		["2.1.0-rc.1", "major", undefined, "3.0.0"],
		["1.3.0-rc.1", "minor", undefined, "1.3.0"],
		["1.3.1-rc.1", "minor", undefined, "1.4.0"],
		["1.2.4-rc.1", "patch", undefined, "1.2.4"],
		["1.2.3", "premajor", undefined, "2.0.0-0"],
		["1.2.3", "premajor", "alpha", "2.0.0-alpha.0"],
		["1.2.3", "preminor", "beta", "1.3.0-beta.0"],
		["1.2.3", "prepatch", "rc", "1.2.4-rc.0"],
		["1.2.3-beta.4", "prepatch", "beta", "1.2.4-beta.0"],
		["1.2.3", "prerelease", undefined, "1.2.4-0"],
		["1.2.3", "prerelease", "beta", "1.2.4-beta.0"],
		["1.2.4-0", "prerelease", undefined, "1.2.4-1"],
		["1.2.4-beta.0", "prerelease", undefined, "1.2.4-beta.1"],
		["1.2.4-beta.0", "prerelease", "beta", "1.2.4-beta.1"],
		["1.2.4-alpha.3", "prerelease", "beta", "1.2.4-beta.0"],
		["1.2.4-beta", "prerelease", undefined, "1.2.4-beta.0"],
		["1.2.4-beta", "prerelease", "beta", "1.2.4-beta.0"],
		["1.2.4-beta.1.x", "prerelease", undefined, "1.2.4-beta.2.x"],
		["1.2.4-beta.9", "release", undefined, "1.2.4"],
	];
	test.each(cases)("inc(%p, %p, %p) -> %p", (v, type, preid, out) => {
		expect(inc(v, type, preid)).toBe(out);
	});

	test("throws on bad input", () => {
		expect(() => inc("nope", "patch")).toThrow("Invalid version");
		expect(() => inc("1.0.0", "prerelease", "bad id")).toThrow(
			"Invalid prerelease identifier",
		);
		expect(() => inc("1.0.0", "release")).toThrow("not a prerelease");
	});
});

describe("compare", () => {
	test("orders by semver precedence", () => {
		const sorted = [
			"1.0.0",
			"1.0.0-alpha",
			"1.0.0-alpha.1",
			"1.0.0-beta.11",
			"1.0.0-beta.2",
			"1.0.0-alpha.beta",
			"0.9.9",
		].sort(compare);
		expect(sorted).toEqual([
			"0.9.9",
			"1.0.0-alpha",
			"1.0.0-alpha.1",
			"1.0.0-alpha.beta",
			"1.0.0-beta.2",
			"1.0.0-beta.11",
			"1.0.0",
		]);
		expect(compare("1.0.0+a", "1.0.0+b")).toBe(0);
	});
});
