import FeatureComingSoon from '@/src/components/FeatureComingSoon';
import { BUS_COMING_SOON } from '@/src/data/service-availability.mjs';
export default function BusComingSoonScreen() {
  return <FeatureComingSoon title="Bus service" icon="bus-outline" description={BUS_COMING_SOON} />;
}
