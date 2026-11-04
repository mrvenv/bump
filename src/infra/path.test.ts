import { expect, test } from "bun:test";
import { joinPath, resolveDir } from "./path.ts";

test("joinPath", () => {
	expect(joinPath("/a", "b", "c.json")).toBe("/a/b/c.json");
	expect(joinPath("/a/", "b")).toBe("/a/b");
	expect(joinPath("/", "b")).toBe("/b");
	expect(joinPath("C:\\a\\", "b")).toBe("C:\\a/b");
});

test("resolveDir", () => {
	expect(resolveDir()).toBe(process.cwd());
	expect(resolveDir("/abs")).toBe("/abs");
	expect(resolveDir("C:\\abs")).toBe("C:\\abs");
	expect(resolveDir("rel")).toBe(joinPath(process.cwd(), "rel"));
});
