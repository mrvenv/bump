
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Clean Architecture

Dependencies point inward only: outer layers may import inner ones, never the reverse.

| Layer | Here | Rules |
| --- | --- | --- |
| Domain | `src/domain/` (`semver`, `release`, `manifest`, `errors`) | Pure functions and types. No I/O, no `Bun.*`, no `process`, no imports from other layers. |
| Use cases | `src/app/` (`version`) | Orchestrates the domain and adapters. Takes input as plain options and returns plain results. No `console`, no `process.exit`, no argv parsing; report progress through callbacks (`onScript`). |
| Adapters / infrastructure | `src/infra/` (`git`, `json-file`, `package-files`, `scripts`, `path`) | Wrap a single external system (git, file system, shell). Thin, with no business rules. Only here may code touch `process.env` / `process.cwd()`. |
| Delivery | `src/cli/` (`args`, `help`, `main`, `bin`), `index.ts` | Parse input, call the use case, format output and exit codes. The only place that prints or exits. |

- Business rules (how a version is incremented, when to refuse a bump) belong in the domain or the use cases, never in the CLI or the adapters.
- Talk to external systems (git, fs, shell, network) only through an adapter module, so the use cases can be tested and their dependencies swapped.
- The public API is whatever `index.ts` exports. Keep everything else internal, and treat changes to those exports as semver-relevant.
- New feature: put the domain logic in a pure function first, add an adapter if it needs I/O, then wire the use case, then the CLI flag.

## Clean Code

- **Naming**: names say intent (`dirtyFiles`, `tagExists`), not type or implementation. Functions are verbs, values are nouns, booleans start with `is`/`has`/`allow`. No unclear abbreviations.
- **Functions**: small and doing one thing at one level of abstraction. Prefer at most 3 positional parameters; beyond that, pass an options object with defaults set in destructuring.
- **No side effects in queries**: a function either returns information or changes state, not both.
- **Errors**: throw `VersionError` with a message the user can act on, and say how to fix it ("use --force"). Never swallow errors. Fail fast: validate everything before writing any file (see `version()`: check, then dry-run return, then mutate).
- **Types**: `strict` mode, no `any` unless it's isolated and justified. Use `as const` and union types instead of magic strings. Make invalid states unrepresentable.
- **Immutability**: don't mutate arguments; copy them first (as `inc()` does). Prefer `const`.
- **DRY / YAGNI**: pull out a helper on the third repetition, not the first. Don't add options, abstractions or dependencies "for the future". Zero runtime dependencies is a goal for this package.
- **Comments**: explain *why*, not *what*. JSDoc on every exported symbol. Delete dead code; don't comment it out.
- **Formatting**: keep the existing style in each file. Imports go in the order external/node → local. Files stay focused (roughly under 300 lines).

## JS / TS idioms

Trust the types. Check only what the type allows; don't re-validate what TypeScript already guarantees.

- **`number | undefined`**: `if (!num)` is enough. No `typeof num === "number"`. Use `num == null` only when `0` is a valid value (`!0` is `true`).
- **`string | undefined`**: `if (!str)` covers both `undefined` and `""`.
- **Objects / arrays**: `if (!obj)` for `T | undefined`. For an array use `arr.length`, not `arr && arr.length > 0`.
- **null and undefined together**: `x == null`. It's the one accepted use of `==`; use `===` everywhere else.
- **Optional chaining and defaults**: write `a?.b?.c` instead of `a && a.b && a.b.c`. Use `??` for defaults when `0`, `""` or `false` are valid values; `||` only when every falsy value should fall back.
- **Defaults in parameters**: set defaults in destructuring (`{ force = false } = {}`) instead of `if (opts.force === undefined)`.
- **`typeof` / `instanceof`**: use them only where the type really is unknown, i.e. external data such as JSON, argv, env or `catch (err)`. Validate once at that boundary, then pass typed values inward.
- **Booleans**: `if (isDirty)`, never `if (isDirty === true)`. Return the condition directly instead of `if (cond) return true; return false;`.
- **Early return**: put guard clauses first; avoid nested `if`/`else` and `else` after `return`.

### Avoid regex when a string method does the job

| Instead of | Use |
| --- | --- |
| `/^v/.test(s)` | `s.startsWith("v")` |
| `/\n$/.test(s)` | `s.endsWith("\n")` |
| `/foo/.test(s)` | `s.includes("foo")` |
| `s.replace(/x/g, y)` | `s.replaceAll("x", y)` |
| `/^\d+$/.test(s)` → number | `Number.isInteger(Number(s))` (`Number("")` is `0`, so guard empty strings) |
| splitting with a regex | `s.split(".")`, `s.trim()`, `s.slice()` |

Use regex only for a real grammar (e.g. the SemVer pattern in `semver.ts`). Build it once as a module constant, never inside a loop.

### Node / Bun

- Use `async`/`await`, not `.then()` chains or callbacks. Run independent operations in parallel with `Promise.all`.
- **No `node:*` imports.** The CLI is compiled with `bun build --compile` (`bun run build`), so use Bun APIs only: `Bun.file`/`Bun.write` for files, `Bun.$` for processes and temp dirs, `Bun.argv`. For paths use `joinPath`/`resolveDir` from `src/infra/path.ts` instead of `node:path`; for argv use `src/cli/args.ts` instead of `node:util`. Enforced by Biome's `noNodejsModules` rule.
- Don't read `process.env` or `process.argv` deep inside modules: argv only in `src/cli/bin.ts`, env and cwd only in `src/infra/`.
- Always `await` or return a promise; no floating promises.
- Throw `Error` objects (with `{ cause }` when wrapping), never strings.

## Testing

- Every change to behaviour comes with a test. Write a failing test first for bug fixes.
- Domain: table-driven unit tests (`test.each`). Use cases: integration tests in a temp dir (`mkdtemp`) with a real `git init`. Never touch the real repo.
- Tests are deterministic and independent: no network, no shared state, and clean up in `afterEach`.
- Before finishing: `bun run ci` must pass (Biome lint + format, typecheck, tests, binary build) — the same checks as `.github/workflows/ci.yml`. Fix code with `bun run lint:fix`; never weaken `biome.json` to silence a rule.
