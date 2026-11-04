import { RELEASE_TYPES } from "../domain/semver.ts";

export const HELP = `Usage: bump [<newversion> | ${RELEASE_TYPES.join(" | ")} | from-git] [options]

Bump the "version" in package.json, commit and tag it (like \`npm version\`).
Without arguments prints the current version.

Options:
  --preid <id>                Prerelease identifier, e.g. --preid beta -> 1.2.4-beta.0
  -m, --message <msg>         Commit/tag message, "%s" is replaced with the version (default "%s")
  --tag-version-prefix <p>    Tag prefix (default "v")
  --no-git-tag-version        Do not create a git commit and tag
  --no-commit-hooks           Pass --no-verify to git commit
  --sign-git-commit           GPG-sign the commit
  --sign-git-tag              GPG-sign the tag
  --push                      Push the commit and tag after tagging
  --allow-same-version        Allow setting the version to its current value
  -f, --force                 Skip the clean-working-tree check
  --ignore-scripts            Skip preversion/version/postversion scripts
  --dry-run                   Print what would happen, change nothing
  --cwd <dir>                 Run in another directory
  --json                      Print the result as JSON
  -h, --help                  Show this help

Examples:
  bump patch                       1.2.3 -> 1.2.4
  bump minor                       1.2.3 -> 1.3.0
  bump prerelease --preid beta     1.2.3 -> 1.2.4-beta.0
  bump 2.0.0 -m "release: %s"
  bump patch --no-git-tag-version  (CI-friendly: only edit package.json)`;
