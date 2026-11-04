/** Shapes of package.json / package-lock.json and pure updates to them. */

export interface Manifest {
	name?: string;
	version?: string;
	scripts?: Record<string, string>;
	[key: string]: unknown;
}

export interface LockFile {
	version?: string;
	packages?: Record<string, { version?: string; [key: string]: unknown }>;
	[key: string]: unknown;
}

/** Returns a copy with the new version; key order is preserved. */
export const withVersion = <T extends Manifest>(
	manifest: T,
	version: string,
): T => ({ ...manifest, version });

/** Updates both the top-level version and the root package entry (`packages[""]`). */
export function withLockVersion<T extends LockFile>(
	lock: T,
	version: string,
): T {
	const root = lock.packages?.[""];
	if (!root) return { ...lock, version };
	return {
		...lock,
		version,
		packages: { ...lock.packages, "": { ...root, version } },
	};
}
