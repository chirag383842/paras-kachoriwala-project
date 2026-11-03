import { MapPin, Navigation, Clock } from 'lucide-react';
import { BRAND, STORE_HOURS, formatTimeStr } from '@/lib/constants';
import { useStoreStatus } from '@/lib/hooks';
import StatusBadge from '@/components/StatusBadge';
import SectionHeading from '@/components/SectionHeading';

export default function LocationSection() {
  const { computed } = useStoreStatus();
  const open = computed.isOpen;
  const today = STORE_HOURS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  return (
    <section id="find-us" className="container-max section-pad">
      <SectionHeading
        eyebrow="Find Us"
        title="Find Paras Kachoriwala"
        subtitle="Use the exact Google Maps pin below for turn-by-turn directions to our stall."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <a
            href={BRAND.mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block aspect-[4/3] lg:aspect-auto lg:h-full min-h-[300px] overflow-hidden bg-charcoal-950"
            aria-label="Open the exact Paras Kachoriwala location in Google Maps"
          >
            <img
              src="/images/lari_pic.webp"
              alt="Paras Kachoriwala food cart at the shop location"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/75 via-charcoal-950/10 to-transparent" />
            <span className="absolute bottom-3 sm:bottom-4 md:bottom-5 left-3 sm:left-4 md:left-5 right-3 sm:right-4 md:right-5 flex items-center justify-between gap-2 rounded-xl sm:rounded-2xl bg-white/95 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold text-spice-700 shadow-lg group-hover:bg-marigold-400 group-hover:text-charcoal-950 transition-colors">
              <span className="flex items-center gap-2 min-w-0">
                <Navigation size={16} className="shrink-0 sm:h-[18px] sm:w-[18px]" />
                <span className="truncate sm:overflow-visible">Open Live Pin in Google Maps</span>
              </span>
              <Navigation size={15} className="shrink-0 sm:h-4 sm:w-4 rotate-45" />
            </span>
          </a>
        </div>

        <div className="card p-5 sm:p-7 md:p-9 flex flex-col">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-spice-100 text-spice-700">
              <MapPin size={22} />
            </span>
            <div>
              <h3 className="font-display text-xl font-bold text-charcoal-900">Our Location</h3>
              <p className="mt-1 text-xs sm:text-sm text-charcoal-600 leading-relaxed break-words">{BRAND.address}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <StatusBadge open={open} size="md" />
            <span className="text-sm text-charcoal-500 font-medium">
              Today: {formatTimeStr(today.open)} – {formatTimeStr(today.close)}
            </span>
          </div>

          <div className="mt-6 flex items-start gap-4 pt-6 border-t border-spice-100">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-spice-100 text-spice-700">
              <Clock size={22} />
            </span>
            <div className="flex-1">
              <h3 className="font-display text-xl font-bold text-charcoal-900">Opening Hours</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {STORE_HOURS.map((h) => (
                  <li key={h.day} className="flex justify-between gap-4">
                    <span className="text-charcoal-600">{h.day}</span>
                    <span className="tabular-nums font-semibold text-charcoal-800">
                      {h.display ?? `${formatTimeStr(h.open)} – ${formatTimeStr(h.close)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <a
            href={BRAND.mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-7 w-full sm:w-auto self-start group"
          >
            <Navigation size={18} />
            Get Directions
          </a>
        </div>
      </div>
    </section>
  );
}
