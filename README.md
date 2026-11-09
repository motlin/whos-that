# Who's That?

A face-memory game: memorize a hand-drawn face, then find it again. It has four modes (Classic, Spot the Difference, Build It and Lineup) and a shared top-ten board for each. It started as a single-file Claude artifact and now runs as a Cloudflare Worker at whos-that.motlin.com.

## Layout

`src/game/` is the game, split into modules. `faces.ts` holds the face data and the face and decoy generators, `difficulty.ts` how each level scales, `draw.ts` the SVG drawing, `sound.ts` the sound effects, `screens.ts` every screen and the game flow, and `store.ts` the leaderboard client. `src/styles/game.css` is the artifact's stylesheet unchanged, and `index.html` its markup.

The artifact's `Store` used the Claude artifact runtime (`window.claude.use('db')` and `('user')`). `src/game/store.ts` replaces it with calls to the Worker's API. When the API cannot be reached, the board falls back to localStorage under the artifact's `wt_boards` key, and the next load that reaches the API uploads those scores. Each device gets a random id, kept in localStorage as `wt_device`, and the player types a name when saving, as before.

`src/shared/scores.ts` holds what the game and the Worker agree on: the four modes, the ranking, the score bound and the submission check. `src/worker/` is the Worker. It serves `/api/scores` and leaves every other path to the static assets in `dist/`.

## API

`GET /api/scores` returns `{classic, spot, build, lineup}`, each the top ten as `{n, s, l, t}` (name, score, level, time in epoch ms), sorted by score descending and then by time ascending.

`POST /api/scores` takes `{mode, name, score, level, deviceId}` and answers `201 {entry}` with the stored entry. It answers `400 {error}` unless the mode is one of the four, the trimmed name is 1 to 12 characters with no control characters, the level is an integer of at least 1, the score is a whole number that is possible at that level, and the device id is 8 to 64 letters, digits, `-` or `_`. It answers `429 {error}` once a device has had 10 scores accepted in the last hour, or an IP address (`CF-Connecting-IP`) has had 30. Rejected submissions do not count toward those limits.

### The score bound

The artifact's `award(frac)` gives `100 + 10*(L-1) + Math.round(100*frac)` points for clearing level `L`, where `frac` is the fraction of the round's time left, from 0 to 1. `G.level` starts at 1 and goes up by one only after a level is cleared, and the game submits `G.level` at game over. So a score submitted at level `l` holds exactly one award for each of levels 1 to `l - 1`. With `c = l - 1`, summing the awards gives `100c + 5c(c-1)` when no time was left on any level and `200c + 5c(c-1)` when all of it was. The API accepts only scores between those two. `tests/unit/scores.test.ts` checks the closed forms against the summed awards, and checks that the artifact's source still has that exact `award()`.

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
