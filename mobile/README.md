# PCSO Live Lotto Results and Analysis

An Expo/React Native mobile app for browsing Philippine lottery results, checking saved picks against draw history, and exploring descriptive statistics. It targets Android and iOS and includes a web preview for quick development and review.

## Included now

- **Results** — a date-based PCSO-blue-and-red results view ordered from Ultra Lotto 6/58 through 2D Lotto, with locally bundled game logos, compact previous/next navigation, prizes, and winner counts. The 2D and 3D cards keep their 2 PM, 5 PM, and 9 PM draws together.
- **Pick** — choose a game, enter a valid combination, choose a draw slot when relevant, and compare it with the latest result and available archive. Saved picks persist on the device.
- **Analysis** — choose a game and analyze the latest 10 draws by default, any positive draw count, or an inclusive date range. The report explains number frequency, parity, sums, low/high balance, absence/gaps, positions, pairs/triples, consecutive values, previous-draw overlap, a draw scatter chart, rolling frequency, and a historical-profile candidate in plain language.
- **Advertising** — Google Mobile Ads banners, native result cards, and a frequency-capped Analysis interstitial are integrated. Localhost renders labelled placement previews; native development builds use Google test ads until production IDs are configured.

The candidate generator is not a prediction model. In a fair lottery, every valid combination has the same theoretical chance. The app labels candidates as descriptive historical-profile fits and never treats a cross-check as official prize validation. The app is intended only for adults aged 18 and older; play responsibly.

## Run the app

Requirements: a current Node.js LTS release and npm.

```powershell
cd mobile
npm install
npm start
```

For the localhost browser preview:

```powershell
npm run web
```

Open `http://localhost:8081`. Google Mobile Ads is a native SDK, so the browser shows labelled ad previews rather than live ads.

For live reload with real test ads on Android, create and install a development build once:

```powershell
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client
```

Scan the development-server QR code with the installed development build. Expo Go cannot load the AdMob native module. A native iOS build requires macOS/Xcode, but the same source targets iOS.

Useful commands:

```powershell
npm run android
npm run web
npm run typecheck
npm test
npm run export:web
npm run smoke:web
```

For the browser smoke test, first serve `dist` and set `LOTTO_APP_URL` if it is not running at the script's default address.

## Result data

The app ships with 7,916 archived LottoMatik records so it remains useful offline. It refreshes on launch and whenever the app returns to the foreground. While open, it also checks the 2 PM, 5 PM, and 9 PM Manila publication windows and retries at 5-minute intervals through 15 minutes after each draw time. Valid records are merged with the cache and bundled archive, with safe fallback if a refresh is unavailable.

Rebuild the bundled archive after replacing the root CSV:

```powershell
npm run data:build
```

The generator reads `../lotto_results_all_games_oldest_to_latest_8_columns.csv` and writes `src/data/lottery-results.json`.

## Advertising configuration

Development and unconfigured builds use Google's safe sample App IDs and test ad units. Before a public release, replace `androidAppId` and `iosAppId` in `app.json` with the App IDs from your AdMob account and configure the applicable unit IDs:

```text
EXPO_PUBLIC_ADMOB_BANNER_TOP_ANDROID_ID
EXPO_PUBLIC_ADMOB_BANNER_BOTTOM_ANDROID_ID
EXPO_PUBLIC_ADMOB_NATIVE_RESULTS_ANDROID_ID
EXPO_PUBLIC_ADMOB_NATIVE_HISTORY_ANDROID_ID
EXPO_PUBLIC_ADMOB_ANALYSIS_INTERSTITIAL_ANDROID_ID
```

Equivalent `_IOS_ID` variables are supported. Generic top, bottom, results, and history fallbacks are also supported where documented in the ad components. The app requests UMP consent before native ad requests. The free pre-release Remove ads preference hides every placement; no billing flow exists yet.

## Project map

```text
src/app/(tabs)/       Results, Pick, and Analysis screens
src/components/       Reusable mobile UI
src/data/             Bundled archive and LottoMatik repository
src/domain/           Game rules, pick comparison, and analysis engine
src/providers/        App-wide draw state and refresh lifecycle
scripts/              Archive builder and browser smoke test
```

## Known tooling note

The dependency audit currently reports moderate transitive build-tool advisories. An automatic force fix was not applied because it can introduce incompatible major-version changes.

Before publishing, replace the test AdMob identifiers, publish the privacy policy at a public URL, complete consent and store advertising declarations, confirm the Android/iOS package identifiers, and test signed builds on real devices.
