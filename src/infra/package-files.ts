/** Locating and reading the package's version-bearing files. */
import type { LockFile, Manifest } from "../domain/manifest.ts";
import { type JsonFile, readJsonFile } from "./json-file.ts";
import { joinPath } from "./path.ts";

/** A JSON file plus its name relative to the package directory. */
export type PackageFile<T> = JsonFile<T> & { name: string };

const MANIFEST = "package.json";
const LOCK_FILES = ["package-lock.json", "npm-shrinkwrap.json"];

async function readPackageFile<T>(
	cwd: string,
	name: string,
): Promise<PackageFile<T>> {
	return { ...(await readJsonFile<T>(joinPath(cwd, name))), name };
}

async function readIfExists<T>(
	cwd: string,
	name: string,
): Promise<PackageFile<T> | undefined> {
	if (!(await Bun.file(joinPath(cwd, name)).exists())) return;
	return readPackageFile<T>(cwd, name);
}

export const readManifest = (cwd: string) =>
	readPackageFile<Manifest>(cwd, MANIFEST);

/** Lockfiles that embed the root package version (package-lock.json, npm-shrinkwrap.json). */
export async function readLockFiles(
	cwd: string,
): Promise<PackageFile<LockFile>[]> {
	const files = await Promise.all(
		LOCK_FILES.map((name) => readIfExists<LockFile>(cwd, name)),
	);
	return files.filter((file): file is PackageFile<LockFile> => !!file);
}
