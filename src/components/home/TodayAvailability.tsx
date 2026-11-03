import { useProducts, useStoreStatus } from '@/lib/hooks';
import AvailabilityCard from '@/components/AvailabilityCard';
import SectionHeading from '@/components/SectionHeading';
import { Clock } from 'lucide-react';

export default function TodayAvailability() {
  const { data, loading, error } = useProducts();
  const { computed } = useStoreStatus();
  const isOpen = computed.isOpen;

  return (
    <section className="bg-spice-100/40 section-pad">
      <div className="container-max">
        <SectionHeading
          eyebrow={isOpen ? "Today's Availability" : 'Menu Preview'}
          title={isOpen ? "What's Cooking Right Now" : 'Our Signature Fresh Menu'}
          subtitle={
            isOpen
              ? 'Live availability of our two signature items, updated in real time.'
              : `Stall is currently closed (${computed.nextOpenText}). Preview our freshly made items below.`
          }
        />

        {!isOpen && (
          <div className="max-w-md mx-auto mt-4 mb-8 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-spice-200/80 px-4 py-1.5 text-xs font-semibold text-charcoal-700">
              <Clock size={14} className="text-spice-600" />
              {computed.nextOpenText}
            </span>
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 max-w-3xl mx-auto">
          {error ? (
            <div className="sm:col-span-2 card p-8 text-center">
              <p className="text-charcoal-600">Availability will be updated soon.</p>
            </div>
          ) : (
            (data ?? []).map((p) => <AvailabilityCard key={p.id} product={p} loading={loading} />)
          )}
        </div>
      </div>
    </section>
  );
}
