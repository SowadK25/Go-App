import type { Alert, JourneyService } from '../api/generated';
import { canonicalLineCode } from './transit';

export function journeyLineCodes(journey: JourneyService) {
  return [
    ...new Set(
      journey.trips?.map((leg) => canonicalLineCode(leg.line.trim())).filter(Boolean) ?? [],
    ),
  ];
}

export function filterAlertsByLines(alerts: Alert[], lineCodes: string[]) {
  const lines = new Set(lineCodes.map((code) => canonicalLineCode(code.trim())));
  const unique = new Map<string, Alert>();
  for (const alert of alerts) {
    if (
      !lines.size ||
      alert.affected_lines?.some((code) => lines.has(canonicalLineCode(code.trim())))
    ) {
      unique.set(`${alert.alert_type}:${alert.code}`, alert);
    }
  }
  return [...unique.values()];
}
