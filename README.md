# Who's That?

A face-memory game: memorize a hand-drawn face, then find it again. It has four modes (Classic, Spot the Difference, Build It and Lineup) and a shared top-ten board for each. It started as a single-file Claude artifact and now runs as a Cloudflare Worker at whos-that.motlin.com.

## Layout

`src/game/` is the game, split into modules. `faces.ts` holds the face data and the face and decoy generators, `difficulty.ts` how each level scales, `draw.ts` the SVG wrapper around a drawn face, `sound.ts` the sound effects, `screens.ts` every screen and the game flow, `settings.ts` the saved settings, and `store.ts` the leaderboard client. `src/styles/game.css` is the stylesheet, and `index.html` the markup.

## Art styles

The settings screen picks one of five art styles: Storybook, Cut Paper (the default), Pixel Arcade, Modelling Clay and Notebook (the original sketch). The choice is kept in localStorage as `wt_style`. Each style is one file in `src/game/styles/` that draws every option of every feature, and `styles/index.ts` lists them. `geometry.ts` holds what they share: the card coordinates and the region each feature occupies, which is how the game crops, highlights and marks a face the same way in any style. A style's filters are in its `defs`, which `settings.ts` puts on the page once. `src/styles/themes.css` restyles the page to match the chosen style, keyed off `data-style` on the root.

`just test-visibility` checks the default style, `STYLE=clay just test-visibility` another one, and `just test-visibility-all` all five.

The artifact's `Store` used the Claude artifact runtime (`window.claude.use('db')` and `('user')`). `src/game/store.ts` replaces it with calls to the Worker's API. When the API cannot be reached, the board falls back to localStorage under the artifact's `wt_boards` key, and the next load that reaches the API uploads those scores. Each device gets a random id, kept in localStorage as `wt_device`, and the player types a name when saving, as before.

`src/shared/scores.ts` holds what the game and the Worker agree on: the four modes, the ranking, the score bound and the submission check. `src/worker/` is the Worker. It serves `/api/scores` and leaves every other path to the static assets in `dist/`.

## Installing and playing offline

The game installs from the browser as a standalone app and plays offline. `index.html` links `/manifest.webmanifest` and has `theme-color` and Safari's `apple-*` tags, and `src/pwa/register.ts` registers `/sw.js`. `src/pwa/manifest.ts` holds the manifest and the fixed files the worker keeps, and `src/pwa/worker.ts` its logic.

`scripts/service-worker-build.ts` builds `src/pwa/sw.ts` to `dist/sw.js` and writes `dist/manifest.webmanifest`. It adds the build's hashed script and stylesheet to the files the worker keeps, and versions the worker's cache with a hash of everything it keeps, so each deploy that changes them is a new worker. A launch loads the page from the network when it can and from the cache when it cannot, the new worker takes over at once, and it deletes the old build's cache. `/api/` always goes to the network, and offline the board falls back to the device as it does whenever the API is down. `public/_headers` stops Cloudflare caching `sw.js` and the manifest, and gives the manifest its type. The icons in `public/icons/` are rendered by `just icons`: the plain icons from `public/favicon.svg`, and the maskable and touch icons from `scripts/icons/*.svg`, with the maskable face shrunk to fit the safe zone.

`tests/unit/pwa/` checks the manifest, the icons, the head tags, the headers and the worker's caching against fake caches. `tests/browser/pwa.spec.ts` checks that Chromium reads the manifest without errors and finds the page installable, that the Worker serves the manifest and the worker with their types, that the worker takes control and caches this build, and that a reload offline still starts a game. An iPhone home screen install still needs a real device, and the Google Fonts files are not cached by the worker, so offline the game falls back to its system fonts unless the browser's own cache still holds them.

## API

`GET /api/scores` returns `{classic, spot, build, lineup}`, each the top ten as `{n, s, l, t}` (name, score, level, time in epoch ms), sorted by score descending and then by time ascending.

`POST /api/scores` takes `{mode, name, score, level, deviceId}` and answers `201 {entry}` with the stored entry. It answers `400 {error}` unless the mode is one of the four, the trimmed name is 1 to 12 characters with no control characters, the level is an integer of at least 1, the score is a whole number that is possible at that level, and the device id is 8 to 64 letters, digits, `-` or `_`. It answers `429 {error}` once a device has had 10 scores accepted in the last hour, or an IP address (`CF-Connecting-IP`) has had 30. Rejected submissions do not count toward those limits.

### The score bound

The game's `award()` gives `levelPoints(L, answer, memorize)` from `src/shared/scores.ts`: `100 + 10*(L-1) + Math.round(100*(answer + memorize))` points for clearing level `L`, where `answer` is the fraction of the answer time left and `memorize` the fraction of the memorize time left when the player tapped ready, each from 0 to 1 and read from the millisecond clock. `G.level` starts at 1 and goes up by one only after a level is cleared, and the game submits `G.level` at game over. So a score submitted at level `l` holds exactly one award for each of levels 1 to `l - 1`. With `c = l - 1`, summing the awards gives `100c + 5c(c-1)` when no time was left on any level and `300c + 5c(c-1)` when all of both was. The API accepts only scores between those two. `tests/unit/scores.test.ts` checks the closed forms against the summed awards.

### Adding Turnstile or Cloudflare Access

`src/worker/guard.ts` is the one hook a submission passes through after its body is valid and before it is rate-limited or saved. It allows everything today. A Turnstile check (verify a token against siteverify with a secret binding) or a Cloudflare Access check (the `Cf-Access-Jwt-Assertion` header) goes there. `tests/worker/api.test.ts` shows a guard refusing a score.

## Data

`migrations/0001_scores.sql` creates the `scores` table and the `submissions` table that the rate limits count from. Rows in `submissions` older than an hour are dropped on each accepted submission. There is no seed migration: the scores from the artifact's board are loaded once at go-live with a `wrangler d1 execute --remote` command that is not checked in. The tests load invented scores from `tests/fixtures/scores.sql` instead.

## Commands

| Command                | What it does                                                                    |
| ---------------------- | ------------------------------------------------------------------------------- |
| `just dev`             | Runs the Vite dev server, sending `/api` to `just worker` when it is running    |
| `just worker`          | Builds, applies the migrations to a local D1 and serves the Worker on miniflare |
| `just check`           | Lints and type-checks                                                           |
| `just test`            | Runs the unit tests and the Worker tests                                        |
| `just test-visibility` | Renders faces to pixels and fails when one feature hides a change to another    |
| `just test-browser`    | Builds, then runs the Playwright tests against `wrangler dev`                   |
| `just verify`          | Runs every check, the unit tests and the browser tests                          |
| `just build`           | Writes `dist/`                                                                  |
| `just deploy`          | Applies the migrations to the production D1 and deploys to whos-that.motlin.com |

Tool versions are pinned in `.mise/config.toml`. The toolchain is synced from `~/projects/typescript-template`, and differs from it on purpose in three ways, as cublitz does. Formatting uses oxfmt-next-line, configured in `.oxfmtrc.json`, with `check.fmt: false` in `vite.config.ts`. The Storybook scripts, dependencies and lint overrides are gone, because the game has no stories. The `install` recipe does not format a `CLAUDE.md`, because there is none.

## Tests

`tests/unit/` covers the score rules and the leaderboard client with `fetch` and localStorage stubbed. `tests/visibility/` renders every change of one feature next to every value of each other feature, on every face shape, and fails when another feature hides it (run with `just test-visibility`). `tests/worker/` calls the Worker's handler against a real D1 from miniflare with every migration applied. `tests/browser/` runs Playwright against `wrangler dev` on a fresh local D1 with the fixture scores: the game loads, the board renders those scores from the API, it falls back to the device when the API is down, and a played game's score saves to the shared board.

## Going live

The first deploy needs these steps once:

1. `wrangler d1 create whos-that`, then put the `database_id` it prints into `wrangler.toml` in place of the zero placeholder.
2. `wrangler d1 migrations apply whos-that --remote`, then load the artifact's scores with a one-off `wrangler d1 execute whos-that --remote --command "INSERT INTO scores ..."` (kept out of the repo).
3. `just deploy`, which runs `wrangler deploy --domain whos-that.motlin.com`.
4. Create the GitHub repository, add the secrets `CLOUDFLARE_API_TOKEN` (with Workers Scripts, D1 and Workers Routes edit permissions on the motlin.com zone) and `CLOUDFLARE_ACCOUNT_ID`, and a `production` environment. After that, `.github/workflows/deploy.yml` applies migrations and deploys on every push to main.
