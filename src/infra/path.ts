/**
 * Minimal path helpers so the package has no `node:path` import.
 * Bun accepts "/" separators on every platform, including Windows.
 */

const IS_WINDOWS = process.platform === "win32";

/** Separator between entries in the PATH environment variable. */
export const PATH_DELIMITER = IS_WINDOWS ? ";" : ":";

const isSeparator = (char: string | undefined) => char === "/" || char === "\\";

/** "/a" or "\\a" (POSIX / UNC) or "C:\\a" (Windows drive). */
const isAbsolute = (path: string) => isSeparator(path[0]) || path[1] === ":";

const trimTrailingSeparator = (path: string) =>
	isSeparator(path.at(-1)) ? path.slice(0, -1) : path;

export const joinPath = (dir: string, ...names: string[]) =>
	[trimTrailingSeparator(dir), ...names].join("/");

/** Absolute directory: `dir` itself, `dir` relative to the cwd, or the cwd. */
export function resolveDir(dir?: string): string {
	if (!dir) return process.cwd();
	return isAbsolute(dir) ? dir : joinPath(process.cwd(), dir);
}
