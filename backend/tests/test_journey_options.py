import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.models.journeys import JourneyService, JourneyTrip
from app.utils.journeys import remove_unnecessary_transfers


def leg(number, origin, destination):
    return JourneyTrip(number=number, display="Kitchener", line="GT", direction="E", vehicle_type="T", depart_from_code=origin, destination_stop_code=destination)


def journey(arrival, transfers=0, number="3860", departure="2026-10-13 08:08:00", destination="UN"):
    legs = [leg(number, "KI", destination)] if not transfers else [leg(number, "KI", "BE"), leg("3012", "BE", destination)]
    return JourneyService(start_time=departure, end_time=arrival, transfer_count=transfers, trips=legs)


class JourneyOptionTests(unittest.TestCase):
    def test_removes_reported_bramalea_detour(self):
        direct = journey("2026-10-13 09:47:00")
        detour = journey("2026-10-13 10:05:00", transfers=1)
        self.assertEqual(remove_unnecessary_transfers([detour, direct]), [direct])

    def test_keeps_faster_connections(self):
        direct = journey("2026-10-13 09:47:00")
        faster = journey("2026-10-13 09:40:00", transfers=1)
        self.assertEqual(remove_unnecessary_transfers([direct, faster]), [direct, faster])

    def test_keeps_longer_train_bus_trip(self):
        direct = journey("2026-10-13 09:47:00")
        alternative = journey("2026-10-13 10:35:00", transfers=1)
        alternative.trips[1].vehicle_type = "B"
        self.assertEqual(remove_unnecessary_transfers([direct, alternative]), [direct, alternative])

    def test_keeps_longer_train_bus_train_trip(self):
        direct = journey("2026-10-13 09:47:00")
        alternative = journey("2026-10-13 10:35:00", transfers=2)
        alternative.trips = [leg("3860", "KI", "GE"), leg("33262", "GE", "BR"), leg("3862", "BR", "UN")]
        alternative.trips[1].vehicle_type = "B"
        self.assertEqual(remove_unnecessary_transfers([direct, alternative]), [direct, alternative])

    def test_keeps_longer_connection_on_different_line(self):
        direct = journey("2026-10-13 09:47:00")
        alternative = journey("2026-10-13 10:35:00", transfers=1)
        alternative.trips[1].line = "LW"
        self.assertEqual(remove_unnecessary_transfers([direct, alternative]), [direct, alternative])

    def test_keeps_connection_between_different_stations(self):
        direct = journey("2026-10-13 09:47:00")
        alternative = journey("2026-10-13 10:35:00", transfers=1)
        alternative.trips[1].depart_from_code = "BR"
        self.assertEqual(remove_unnecessary_transfers([direct, alternative]), [direct, alternative])

    def test_keeps_bus_only_connections(self):
        direct = journey("2026-10-13 09:47:00")
        alternative = journey("2026-10-13 10:35:00", transfers=1)
        for item in [direct, alternative]:
            for trip in item.trips:
                trip.vehicle_type = "B"
        self.assertEqual(remove_unnecessary_transfers([direct, alternative]), [direct, alternative])

    def test_removes_equal_arrival_transfer(self):
        direct = journey("2026-10-13 09:47:00")
        self.assertEqual(remove_unnecessary_transfers([direct, journey(direct.end_time, transfers=1)]), [direct])

    def test_keeps_different_boarding_service_or_departure(self):
        direct = journey("2026-10-13 09:47:00")
        different_train = journey("2026-10-13 10:05:00", transfers=1, number="3862")
        different_time = journey("2026-10-13 10:05:00", transfers=1, departure="2026-10-13 08:36:00")
        options = [direct, different_train, different_time]
        self.assertEqual(remove_unnecessary_transfers(options), options)

    def test_keeps_different_destinations(self):
        options = [journey("2026-10-13 09:47:00"), journey("2026-10-13 10:05:00", transfers=1, destination="OA")]
        self.assertEqual(remove_unnecessary_transfers(options), options)

    def test_keeps_transfer_when_no_direct_is_returned(self):
        connection = journey("2026-10-13 10:05:00", transfers=1)
        self.assertEqual(remove_unnecessary_transfers([connection]), [connection])

    def test_keeps_unknown_destination(self):
        direct = journey("2026-10-13 09:47:00", destination="")
        connection = journey("2026-10-13 10:05:00", transfers=1, destination="")
        self.assertEqual(remove_unnecessary_transfers([direct, connection]), [direct, connection])

    def test_keeps_unknown_times_and_trip_numbers(self):
        direct = journey("2026-10-13 09:47:00")
        missing_time = journey("", transfers=1)
        missing_number = journey("2026-10-13 10:05:00", transfers=1, number="")
        options = [direct, missing_time, missing_number]
        self.assertEqual(remove_unnecessary_transfers(options), options)

    def test_compares_arrivals_across_midnight(self):
        direct = journey("2026-10-13 23:59:00")
        detour = journey("2026-10-14 00:05:00", transfers=1)
        self.assertEqual(remove_unnecessary_transfers([direct, detour]), [direct])

    def test_preserves_stops_and_input_list(self):
        direct = journey("2026-10-13 09:47:00")
        detour = journey("2026-10-13 10:05:00", transfers=1)
        options = [direct, detour]
        result = remove_unnecessary_transfers(options)
        self.assertEqual(len(options), 2)
        self.assertIs(result[0], direct)


if __name__ == "__main__":
    unittest.main()
