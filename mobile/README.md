# GO Transit mobile

Expo + React Native + TypeScript. The core transit UI follows the TransitFlow Base44 reference: a green header, overlapping trip planner, rounded cards, and bottom navigation.

Home includes trip planning, a tracked journey, home/work shortcuts, service notices, and network status. The bottom navigation contains Home, Stations, Schedules, and Alerts. Stations includes search, line filters, and persistent favorites. Station details show upcoming departures and notices. Schedules includes line timetables; the Union departure board opens from Home. Journey results include legs and fares. Tickets, accounts, and the AI assistant are deferred.

The main flow is **Search Trips → choose a departure → Track trip**. Home/work shortcuts fill the planner's stations. Edit those stations through the header preferences button. Saved routes are no longer part of the app; existing home/work stations, favorites, and tracked journeys still load from local storage.

The planner defaults to **Depart at**. Choose **Arrive by** to use the selected date/time as an arrival target. Results exclude departures before the current Toronto time and include scheduled arrivals from one hour before to 30 minutes after the chosen time, inclusive. A local clock removes cached options as their departure times pass without additional search requests. Options scheduled after the target carry an after-target badge. Journeys appear with the latest departure first; direct/transfer filters preserve that ordering. Live status and available stop predictions still appear, but delays can affect whether a journey meets the deadline. Overnight results show their departure date, and details/tracking use the journey's actual departure date. Departure and arrival searches have distinct query cache keys. Arrival search uses cached full timetables and introduces no background polling.

Open a journey and tap **Track trip** to pin that specific dated journey. One journey is tracked at a time; selecting another replaces it. Home shows its scheduled/predicted endpoint times, live status, line badges, and boarding platforms when supplied by the API. Tap the tracked card for all stops and transfers, or its close button to stop tracking. Tracking persists across restarts and expires two hours after scheduled arrival. It uses the existing shared status/prediction queries with the same eligibility window and foreground refresh intervals; it does not track the device's location or send background notifications.

While a journey is tracked, the header bell shows the count of service and information alerts affecting its train/bus lines. Transfer journeys include every leg's line; a notice affecting several legs is counted once. Tapping the bell opens those lines' alerts, with a Show All Lines option. The count uses the shared one-minute alerts query, shows zero when no matching notices are reported, and hides when current data is unavailable. With no tracked journey, the bell opens all alerts.

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
