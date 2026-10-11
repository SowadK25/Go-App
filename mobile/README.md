# GO Transit mobile

Expo + React Native + TypeScript. The core transit UI follows the TransitFlow Base44 reference: a green header, overlapping trip planner, rounded cards, and bottom navigation.

Home includes trip planning, home/work shortcuts, service notices, and network status. Stations includes search, line filters, and persistent favorites. Station details show upcoming departures and notices. Schedules includes line timetables and the Union departure board. Journey results include legs and fares. Tickets, accounts, and the AI assistant are deferred.

## Local setup

Start the backend using [its setup instructions](../backend/README.md). From `mobile`:

```powershell
npm.cmd ci
if (!(Test-Path -LiteralPath .env.local)) {
    Copy-Item -LiteralPath .env.example -Destination .env.local
}
npm.cmd start
```

Edit `.env.local` to set `EXPO_PUBLIC_API_URL` to your backend address:

| Device | Address |
| --- | --- |
| Physical Android or iPhone | `http://<computer-LAN-IP>:8000` |
| Android Studio emulator | `http://10.0.2.2:8000` |
| iOS simulator on a Mac | `http://localhost:8000` |

Use `ipconfig` to find your Wi-Fi IPv4 address. For physical devices, use the same network as the computer and allow the backend on your private network if Windows Firewall blocks it. A Metro tunnel only tunnels Expo traffic; the backend must still be reachable separately.

The project uses Expo SDK 57. Install a compatible Expo Go build from <https://expo.dev/go>. Windows can run an Android emulator or serve the app to a physical iPhone; the iOS simulator requires macOS. For custom native modules later, use an Expo development build.

The app reads `process.env.EXPO_PUBLIC_API_URL` through Expo's environment variable support. These variables are public; the Metrolinx key belongs only in the backend. Restart Expo and reload the app after changing the address. See [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).

## Verify the connection

1. Open `http://<computer-LAN-IP>:8000/health` in your phone browser.
2. Open the project in compatible Expo Go.
3. Open Stations and confirm stations load. Health checks cache connectivity; stations verify Metrolinx access.
4. Search for a station and tap it to load departures.
5. Pull down to refresh. Departures also refresh every 30 seconds while the screen and app are active.
6. Save a favorite, reload the app, and confirm it remains saved.
7. On Home, choose origin and destination stations, a date and departure time, then search for journeys.

The screens handle empty results, API failures, loading, offline requests, and stale data. Navigation passes the station code and name. No Metrolinx credentials are bundled.

## API types and checks

Journey cards and each transfer leg show live train/bus status from the service feeds, including delays, early running, and cancellations. The feeds are shared between cards and details, refresh live service data every 60 seconds and cancellation feeds every two minutes while the trip view is active, and pause on Fares or when leaving the screen. Matching uses trip number, line, mode, and the leg's calendar date. Polling is limited to legs within 30 minutes of boarding until 90 minutes after their scheduled arrival, allowing for delays. Far-future and finished trips do not poll. Pull to refresh results or details for a manual update; live queries do not automatically retry failed requests. Future services show Scheduled; missing or stale live records show Status unavailable. Opening a current journey fetches stop-level predictions for its unique trip numbers, refreshing once a minute while visible. Result cards only reuse those cached predictions and do not fetch every result. Real predictions appear as scheduled-to-updated times with red for late and green for early; missing estimates keep the planned time. Arrival and departure predictions are matched to their own events, rather than applying a trip-wide delay to every stop.

Generated types are committed in `src/api/generated.ts`. After changing backend response models, regenerate them from the backend's OpenAPI schema:

```powershell
npm.cmd run api:generate
npm.cmd run api:check
npm.cmd run typecheck
npm.cmd test
npm.cmd run format:check
```

Generation uses the project Python virtual environment, requires the backend dependencies, and needs no running server, Redis, or API key. The generator supports the schema forms currently emitted by this backend and fails on unsupported forms.

From the project root, run backend regression tests:

```powershell
.\venv\Scripts\python.exe -m unittest discover -s backend/tests
```

## Structure

- `src/api`: centralized timeout/error/cancellation handling, generated types, and transit API functions.
- `src/query`: TanStack Query caching, retry policy, app focus, and network reconnect handling.
- `src/navigation`: typed React Navigation screen parameters.
- `src/screens`: Home, Stations, Departures, Schedules, Alerts, journey results, and saved-station preferences.
- `src/components/ui`: cards, buttons, icons, headings, line badges, and status badges.
- `src/components/transit`: trip planner, station picker, station rows, departure rows, and service status cards.
- `src/components/layout`: shared app header and screen layout.
- `src/theme`: shared colors, radii, and shadows.
- `src/storage`: persistent favorites and home/work stations.
- `src/hooks`: shared transit queries.

Styles belong in `.styles.ts` files; TSX components contain rendering and interaction logic. Use `npm.cmd run format` to apply the shared Prettier configuration. Generated API types are excluded from formatting and stay owned by their generator.

Stations cache for a day; departures become stale after 15 seconds. Failed refreshes preserve existing data with an error message. Requests time out after 15 seconds. Client validation and rate limits are not automatically retried. Transit query cache is in memory; favorites and home/work stations persist locally using AsyncStorage.

This setup targets native Android and iOS. Web dependencies are installed for browser layout previews. Direct browser access to the backend still requires CORS configuration, and the date/time picker targets native devices.
