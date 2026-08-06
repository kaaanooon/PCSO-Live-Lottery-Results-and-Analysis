# Philippine Lottery Results and Analysis

A small Python toolkit that reads Philippine lottery draw history from the JSON feed used by [LottoMatik](https://lottomatik.pcso.gov.ph/lotto-results), exports the eight requested fields, and builds an interactive, non-ML analysis report.

## Mobile app

The React Native/Expo app is in [`mobile`](mobile). It includes Results, Pick, and Analysis tabs, works from a bundled offline archive, and refreshes the newest LottoMatik records when the endpoint is available.

```powershell
cd mobile
npm install
npm start
```

See [`mobile/README.md`](mobile/README.md) for features, validation commands, data behavior, and release notes.

## Setup

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

## Usage

Fetch the last four calendar days and print a table:

```powershell
lottery-picker
```

Fetch a date range for one game:

```powershell
lottery-picker --from 2026-08-01 --to 2026-08-05 --game UL58
```

Export JSON or CSV:

```powershell
lottery-picker --from 2026-08-01 --to 2026-08-05 --format json --output results.json
lottery-picker --from 2026-08-01 --to 2026-08-05 --format csv --output results.csv
```

Export every available record in chronological order:

```powershell
lottery-picker --from 2023-12-23 --allow-partial --order oldest --format csv --output lotto_results.csv
```

LottoMatik does not cover dates before late December 2023. Older or partially covered requests fail clearly by default. To accept whatever portion is available, add `--allow-partial`.

Useful game filters include `UL58`, `GL55`, `SL49`, `ML45`, `LOTTO42`, `6DL`, `4DL`, `3DL`, `2DL`, `3DL-2PM`, and `2DL-9PM`. Names such as `Grand Lotto 6/55` and aliases such as `6/58` also work.

## Output fields

CSV and JSON draw records contain exactly:

- `game_code`
- `game`
- `numbers`
- `combination`
- `draw_date`
- `draw_time`
- `jackpot`
- `winners`

Winning numbers remain strings so leading zeroes are preserved.

## Statistical analysis

Generate a mobile-friendly HTML report plus auditable JSON and per-game CSV tables from the draw archive. With no date arguments, the analyzer uses the latest five draws **for each logical game** so the first report is quick to build:

```powershell
lottery-analysis `
  --input lotto_results_all_games_oldest_to_latest_8_columns.csv `
  --candidates 10 `
  --seed 20260806 `
  --output-dir analysis_output
```

Choose between one and five recent draws per logical game with `--latest-draws`:

```powershell
lottery-analysis `
  --input lotto_results_all_games_oldest_to_latest_8_columns.csv `
  --latest-draws 3 `
  --output-dir analysis_output
```

Or analyze an inclusive date range instead:

```powershell
lottery-analysis `
  --input lotto_results_all_games_oldest_to_latest_8_columns.csv `
  --from 2025-01-01 `
  --to 2026-08-05 `
  --output-dir analysis_output
```

`--latest-draws` cannot be combined with `--from` or `--to`. If only one date boundary is supplied, the other boundary defaults to the beginning or end of the available archive. The selected sample controls every calculation and generated combination.

Open `analysis_output/lottery_analysis_report.html` in a browser. The self-contained report embeds the available archive, so users can switch games and reanalyze either the latest 1-5 draws or an inclusive date range without rerunning Python. Its responsive layout, large controls, compact charts, and expandable detail tables are designed to remain usable on a phone. The report covers nine logical games, combining the three daily draw times for 2D and 3D while retaining time-level counts.

Included analyses:

- frequency of every number, including expected frequency, deviation, z-score, sample hot/cold labels, absence, draws since last appearance, and average appearance gap
- even-versus-odd totals and the full per-draw composition, such as four even plus two odd
- chronological number scatter plots and draw-time counts
- exact-position frequency heatmaps for ordered digit games
- frequent unordered pairs and triples for jackpot games, plus adjacent transitions and triples for ordered games
- draw-sum distributions and averages
- low-versus-high composition using the midpoint of each game's number range
- consecutive-number counts
- repeated values from the previous draw, including exact-position repeats for ordered games
- rolling number frequency over the selected history
- source-reported jackpot/prize and winner statistics when usable values are available
- separate Rambolito grouping for 2D/3D and PERM grouping for 4D

Each section includes a plain-language narrative that explains what was observed, what the sample size means, and where the source data is incomplete. Detailed tables remain available for users who want to inspect the calculations.

### Generated combinations

The report generates a combination for every game and can show another deterministic candidate on request. Candidates are selected for how closely they fit the chosen sample's descriptive profile: frequency, position where applicable, parity, low/high balance, and sum. This is not a machine-learning model.

These are **historical-profile fits, not predictions or more-likely lottery outcomes**. In a fair draw, every valid combination for a game has the same theoretical chance of being drawn. A five-draw sample is especially small; it is the fast default for exploring the interface, not evidence of a predictive pattern. Use the date-range mode when a larger descriptive sample is wanted.

Verified rule handling follows the [PCSO-branded LottoMatik Game Manual](https://lottomatik-backend.api-lottomatik.workers.dev/download/Game%20Manual.pdf):

- 2D uses two ordered values from 1 to 31, with repeats allowed.
- 3D, 4D, and 6D use ordered digits from 0 to 9, with repeats allowed.
- 2D and 3D have Rambolito; 4D has PERM (plus separate ROLL plays that this analyzer does not model); 6D does not list an unordered play.
- 6/42, 6/45, 6/49, 6/55, and 6/58 use six unique numbers and ticket order does not matter.

## Reliability notes

- The LottoMatik history begins in late December 2023.
- Live verification on August 6, 2026 found occasional missing digit-game draw slots, lagging jackpot values, and older zero placeholders.
- The client paginates with a short delay. Avoid high-frequency polling.

## Tests

```powershell
pytest
```
