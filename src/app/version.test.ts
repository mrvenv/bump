import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { main } from "../cli/main.ts";
import { joinPath as join } from "../infra/path.ts";
import { version } from "./version.ts";

let dir: string;

const pkgPath = () => join(dir, "package.json");
const readPkg = async () => Bun.file(pkgPath()).json();
const writePkg = (pkg: object, indent: string | number = 2) =>
	Bun.write(pkgPath(), `${JSON.stringify(pkg, null, indent)}\n`);

async function initGit() {
	await $`git init -q -b main && git config user.email test@example.com && git config user.name Test && git config commit.gpgsign false && git config tag.gpgsign false`
		.cwd(dir)
		.quiet();
	await $`git add -A && git commit -q -m init`.cwd(dir).quiet();
}

beforeEach(async () => {
	dir = (await $`mktemp -d`.text()).trim();
});
afterEach(async () => {
	await $`rm -rf ${dir}`.quiet();
});

describe("version() without git", () => {
	test("bumps patch and preserves formatting", async () => {
		await Bun.write(
			pkgPath(),
			'{\n\t"name": "x",\n\t"version": "1.2.3",\n\t"z": 1\n}\n',
		);
		const res = await version("patch", { cwd: dir });
		expect(res).toMatchObject({
			from: "1.2.3",
			to: "1.2.4",
			files: ["package.json"],
		});
		expect(res.tag).toBeUndefined();
		expect(await Bun.file(pkgPath()).text()).toBe(
			'{\n\t"name": "x",\n\t"version": "1.2.4",\n\t"z": 1\n}\n',
		);
	});

	test("preserves CRLF line endings and 4-space indent", async () => {
		await Bun.write(
			pkgPath(),
			'{\r\n    "name": "x",\r\n    "version": "1.0.0"\r\n}\r\n',
		);
		await version("minor", { cwd: dir });
		expect(await Bun.file(pkgPath()).text()).toBe(
			'{\r\n    "name": "x",\r\n    "version": "1.1.0"\r\n}\r\n',
		);
	});

	test("onScript reports each lifecycle script", async () => {
		await writePkg({
			name: "x",
			version: "1.0.0",
			scripts: { version: "true" },
		});
		const seen: string[] = [];
		await version("patch", {
			cwd: dir,
			onScript: (event, command) => seen.push(`${event}:${command}`),
		});
		expect(seen).toEqual(["version:true"]);
	});

	test("explicit version, with leading v", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		expect((await version("v3.1.4", { cwd: dir })).to).toBe("3.1.4");
		expect((await readPkg()).version).toBe("3.1.4");
	});

	test("same version is rejected unless allowed", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		expect(version("1.0.0", { cwd: dir })).rejects.toThrow(
			"Version not changed",
		);
		expect(
			(await version("1.0.0", { cwd: dir, allowSameVersion: true })).to,
		).toBe("1.0.0");
	});

	test("invalid target", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		expect(version("huge", { cwd: dir })).rejects.toThrow(
			"Invalid version or release type",
		);
	});

	test("dry run changes nothing", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		const res = await version("minor", { cwd: dir, dryRun: true });
		expect(res).toMatchObject({ to: "1.1.0", dryRun: true });
		expect((await readPkg()).version).toBe("1.0.0");
	});

	test("updates package-lock.json", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		await Bun.write(
			join(dir, "package-lock.json"),
			JSON.stringify(
				{
					name: "x",
					version: "1.0.0",
					packages: { "": { name: "x", version: "1.0.0" } },
				},
				null,
				2,
			),
		);
		const res = await version("major", { cwd: dir });
		expect(res.files).toEqual(["package.json", "package-lock.json"]);
		const lock = await Bun.file(join(dir, "package-lock.json")).json();
		expect(lock.version).toBe("2.0.0");
		expect(lock.packages[""].version).toBe("2.0.0");
	});

	test("runs lifecycle scripts in order with env", async () => {
		const log = join(dir, "log.txt");
		const append = (name: string) =>
			`echo "${name} $npm_old_version $npm_new_version" >> ${log}`;
		await writePkg({
			name: "x",
			version: "1.0.0",
			scripts: {
				preversion: append("pre"),
				version: append("version"),
				postversion: append("post"),
			},
		});
		await version("patch", { cwd: dir });
		expect(await Bun.file(log).text()).toBe(
			"pre 1.0.0 1.0.1\nversion 1.0.0 1.0.1\npost 1.0.0 1.0.1\n",
		);
	});

	test("failing preversion aborts before writing", async () => {
		await writePkg({
			name: "x",
			version: "1.0.0",
			scripts: { preversion: "exit 3" },
		});
		expect(version("patch", { cwd: dir })).rejects.toThrow(
			'"preversion" script exited with code 3',
		);
		expect((await readPkg()).version).toBe("1.0.0");
	});
});

describe("version() with git", () => {
	test("commits and creates annotated tag", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		await initGit();
		const res = await version("minor", { cwd: dir, message: "release %s" });
		expect(res.tag).toBe("v1.1.0");
		expect((await $`git log -1 --format=%s`.cwd(dir).text()).trim()).toBe(
			"release 1.1.0",
		);
		expect((await $`git cat-file -t v1.1.0`.cwd(dir).text()).trim()).toBe(
			"tag",
		);
		expect((await $`git status --porcelain`.cwd(dir).text()).trim()).toBe("");
	});

	test("refuses dirty tree, --force overrides", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		await Bun.write(join(dir, "a.txt"), "a");
		await initGit();
		await Bun.write(join(dir, "a.txt"), "changed");
		expect(version("patch", { cwd: dir })).rejects.toThrow("not clean");
		expect((await version("patch", { cwd: dir, force: true })).tag).toBe(
			"v1.0.1",
		);
	});

	test("untracked files do not count as dirty", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		await initGit();
		await Bun.write(join(dir, "new.txt"), "x");
		expect((await version("patch", { cwd: dir })).to).toBe("1.0.1");
	});

	test("existing tag is rejected", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		await initGit();
		await $`git tag v1.0.1`.cwd(dir).quiet();
		expect(version("patch", { cwd: dir })).rejects.toThrow("already exists");
		expect((await readPkg()).version).toBe("1.0.0");
	});

	test("gitTagVersion: false only edits file", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		await initGit();
		const res = await version("patch", { cwd: dir, gitTagVersion: false });
		expect(res.tag).toBeUndefined();
		expect((await $`git tag`.cwd(dir).text()).trim()).toBe("");
	});

	test("from-git", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		await initGit();
		await $`git tag v4.5.6`.cwd(dir).quiet();
		const res = await version("from-git", { cwd: dir, gitTagVersion: false });
		expect(res.to).toBe("4.5.6");
	});
});

describe("cli", () => {
	test("prints current version, bumps, reports errors", async () => {
		await writePkg({ name: "x", version: "1.0.0" });
		expect(await main(["--cwd", dir])).toBe(0);
		expect(
			await main([
				"prerelease",
				"--preid",
				"rc",
				"--cwd",
				dir,
				"--no-git-tag-version",
			]),
		).toBe(0);
		expect((await readPkg()).version).toBe("1.0.1-rc.0");
		expect(await main(["nonsense", "--cwd", dir])).toBe(1);
		expect(await main(["--bogus-flag"])).toBe(1);
	});
});
