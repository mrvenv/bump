/** Tiny argv parser (replaces `node:util` parseArgs). Pure: no I/O. */

export type FlagType = "string" | "boolean";
export type FlagSpec = Record<string, FlagType>;
export type Flags<S extends FlagSpec> = {
	[K in keyof S]?: S[K] extends "string" ? string : boolean;
};

export interface ParsedArgs<S extends FlagSpec> {
	flags: Flags<S>;
	positionals: string[];
}

/** Bad command-line input; the CLI prints usage after it. */
export class UsageError extends Error {
	override name = "UsageError";
}

/** "--name=value" -> ["name", "value"], "--name" -> ["name"], "-m" -> [alias of "m"] */
function splitFlag(
	arg: string,
	aliases: Record<string, string>,
): [name: string, inlineValue?: string] {
	if (!arg.startsWith("--")) return [aliases[arg.slice(1)] ?? arg];
	const body = arg.slice(2);
	const eq = body.indexOf("=");
	return eq === -1 ? [body] : [body.slice(0, eq), body.slice(eq + 1)];
}

const isFlag = (arg: string) => arg.startsWith("-") && arg !== "-";

/**
 * Supports `--flag`, `--flag value`, `--flag=value`, short aliases (`-m value`)
 * and `--` to end option parsing.
 */
export function parseArgs<S extends FlagSpec>(
	argv: readonly string[],
	spec: S,
	aliases: Record<string, keyof S & string> = {},
): ParsedArgs<S> {
	const flags: Record<string, string | boolean> = {};
	const positionals: string[] = [];
	const args = argv[Symbol.iterator]();

	for (const arg of args) {
		if (arg === "--") {
			positionals.push(...args);
			break;
		}
		if (!isFlag(arg)) {
			positionals.push(arg);
			continue;
		}

		const [name, inlineValue] = splitFlag(arg, aliases);
		const type = spec[name];
		if (!type) throw new UsageError(`Unknown option: ${arg}`);

		if (type === "boolean") {
			if (inlineValue !== undefined)
				throw new UsageError(`Option --${name} does not take a value`);
			flags[name] = true;
			continue;
		}

		const value: string | undefined = inlineValue ?? args.next().value;
		if (value === undefined)
			throw new UsageError(`Option --${name} requires a value`);
		flags[name] = value;
	}

	return { flags: flags as Flags<S>, positionals };
}
