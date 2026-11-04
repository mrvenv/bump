/** An expected, user-facing failure. The message should say how to fix it. */
export class VersionError extends Error {
	override name = "VersionError";
}
