/** Runs package.json script commands through the cross-platform Bun Shell. */
import { $ } from "bun";
import { joinPath, PATH_DELIMITER } from "./path.ts";

/** PATH with the package's local binaries first, like `npm run`. */
const pathWithLocalBins = (cwd: string) =>
	[joinPath(cwd, "node_modules", ".bin"), process.env.PATH]
		.filter((entry) => !!entry)
		.join(PATH_DELIMITER);

/**
 * Runs the command itself rather than `bun run <name>`: that would also fire
 * the script's own pre/post hooks and run preversion/postversion twice.
 * Returns the exit code.
 */
export async function runCommand(
	cwd: string,
	command: string,
	env: Record<string, string>,
): Promise<number> {
	const { exitCode } = await $`${{ raw: command }}`
		.cwd(cwd)
		.env({ ...process.env, ...env, PATH: pathWithLocalBins(cwd) })
		.nothrow();
	return exitCode;
}
