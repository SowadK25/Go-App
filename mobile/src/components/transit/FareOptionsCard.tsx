import { Linking, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { transitApi } from '../../api/transit';
import { Card } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { RequestState } from '../RequestState';
import { styles } from './FareOptionsCard.styles';
import { ActionButton } from '../ui/ActionButton';

export function FareOptionsCard({
  fromCode,
  toCode,
  date,
  hasUp = false,
}: {
  fromCode: string;
  toCode: string;
  date: string;
  hasUp?: boolean;
}) {
  const airport = fromCode === 'PA' || toCode === 'PA';
  const fares = useQuery({
    queryKey: ['fares', fromCode, toCode, date],
    queryFn: ({ signal }) => transitApi.fares(fromCode, toCode, date, signal),
    staleTime: 86400000,
  });
  return (
    <Card>
      <SectionHeading title="Fare options" />
      {(hasUp || airport) && (
        <>
          <Text style={styles.note}>
            UP Express charges a separate fare. GO Transit fares do not cover UP Express legs. Check
            UP Express for current prices and payment options.
          </Text>
          <ActionButton
            title="View UP Express fares"
            secondary
            onPress={() => void Linking.openURL('https://www.upexpress.com/en/ways-to-pay')}
          />
        </>
      )}
      <Text style={styles.note}>
        GO Transit fares for these stations and travel date, by rider category and payment method.
        These apply to GO-only journeys.
      </Text>
      {airport && (
        <Text style={styles.note}>
          For journeys connecting GO Transit and UP Express, a separate GO fare also applies. A
          combined fare estimate is not available in the app.
        </Text>
      )}
      {fares.isPending && (
        <RequestState
          loading={fares.fetchStatus === 'fetching'}
          message={
            fares.fetchStatus === 'paused' ? 'Reconnect to check fares.' : 'Checking fares...'
          }
        />
      )}
      {fares.isError && (
        <RequestState
          message={fares.error.message}
          onRetry={() => {
            void fares.refetch();
          }}
        />
      )}
      {fares.data?.fares?.map((fare, index) => (
        <View style={styles.row} key={`${fare.rider_type}-${fare.payment_type}-${index}`}>
          <View style={styles.details}>
            <Text style={styles.title}>
              {fare.rider_type} - {fare.payment_type}
            </Text>
            <Text style={styles.note}>{fare.fare_type}</Text>
          </View>
          <Text style={styles.price}>
            ${fare.amount.toFixed(2)} {fare.currency ?? 'CAD'}
          </Text>
        </View>
      ))}
      {fares.data && !fares.data.fares?.length && (
        <Text style={styles.note}>No fare information is available for this route.</Text>
      )}
    </Card>
  );
}
