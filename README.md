# @tsofindavid/bump

`npm version` for Bun. Bumps the `version` in `package.json`, commits and tags it. No dependencies.

```bash
bun add -d @tsofindavid/bump
```

## CLI

```bash
bump                              # print current version
bump patch                        # 1.2.3 -> 1.2.4, commit "1.2.4", tag v1.2.4
bump minor                        # 1.2.3 -> 1.3.0
bump major                        # 1.2.3 -> 2.0.0
bump prerelease --preid beta      # 1.2.3 -> 1.2.4-beta.0 -> 1.2.4-beta.1 ...
bump premajor --preid rc          # 1.2.3 -> 2.0.0-rc.0
bump release                      # 2.0.0-rc.3 -> 2.0.0
bump 3.0.0                        # explicit version
bump from-git                     # take version from the latest git tag
bump patch --no-git-tag-version   # CI: only edit package.json
bump minor --push -m "release: %s"
```

Installs the `bump` command. Without installing: `bunx @tsofindavid/bump patch` (not `bunx bump` — that would fetch an unrelated npm package). Or add a script: `"release": "bump"` → `bun run release minor`.

| Option | Description |
| --- | --- |
| `--preid <id>` | Prerelease identifier for `pre*` bumps |
| `-m, --message <msg>` | Commit/tag message; `%s` becomes the version (default `%s`) |
| `--tag-version-prefix <p>` | Tag prefix (default `v`) |
| `--no-git-tag-version` | Don't commit or tag |
| `--no-commit-hooks` | `git commit --no-verify` |
| `--sign-git-commit` / `--sign-git-tag` | GPG-sign |
| `--push` | Push the commit and the tag |
| `--allow-same-version` | Allow setting the version to its current value |
| `-f, --force` | Skip the clean-working-tree check |
| `--ignore-scripts` | Skip lifecycle scripts |
| `--dry-run` | Show the new version, change nothing |
| `--cwd <dir>` | Run in another directory |
| `--json` | Print the result as JSON |

### Behaviour (same as `npm version`)

- Release-type rules match node-semver: `2.0.0-rc.1` + `major` gives `2.0.0`, `1.2.4-alpha.3` + `prerelease --preid beta` gives `1.2.4-beta.0`.
- Git steps run only inside a git repo. The command refuses if tracked files have changes (untracked files are ignored) or if the tag already exists.
- Runs the `preversion`, `version` and `postversion` scripts from `package.json`. They get `npm_old_version` and `npm_new_version` in the environment. If `preversion` fails, nothing is written.
- Keeps the file's indentation, line endings and trailing newline. Also updates `package-lock.json` / `npm-shrinkwrap.json` if present.

## API

```ts
import { version, getVersion, inc, valid, compare } from "@tsofindavid/bump";

await version("minor", { cwd: ".", preid: "beta", gitTagVersion: false });
// -> { name, from: "1.2.3", to: "1.3.0", files: ["package.json"], dryRun: false }

inc("1.2.3", "prerelease", "rc"); // "1.2.4-rc.0"
valid("v1.2.3");                  // "1.2.3"
compare("1.0.0-beta.2", "1.0.0-beta.11"); // -1
```

## Standalone binary

```bash
bun run build        # -> dist/bump, a single executable with Bun embedded (no runtime needed)
./dist/bump patch
```

Cross-compile with `--target`, e.g. `bun build --compile --target=bun-linux-x64 src/cli/bin.ts --outfile dist/bump-linux`.

## Development

```bash
bun run ci         # everything CI runs: Biome, typecheck, tests, build
bun run lint:fix   # Biome autofix (format + organize imports + safe fixes)
bun test
bun run typecheck
```

```
src/
  domain/  pure rules: semver, release, manifest, errors
  app/     use case: version()
  infra/   git, json-file, package-files, scripts, path
  cli/     args parser, help, main, bin (entry point)
```
