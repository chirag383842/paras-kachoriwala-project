import { useState } from 'react';
import { MapPin, Navigation, Clock, Copy, Check, ExternalLink, Sparkles, Banknote } from 'lucide-react';
import { BRAND, STORE_HOURS, formatTimeStr } from '@/lib/constants';
import { useStoreStatus } from '@/lib/hooks';
import StatusBadge from '@/components/StatusBadge';

export default function Directions() {
  const [copied, setCopied] = useState(false);
  const { computed } = useStoreStatus();
  const open = computed.isOpen;
  const today = STORE_HOURS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(BRAND.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pt-20 sm:pt-24">
      <section className="container-max section-pad">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow justify-center mb-3">
            <span className="h-px w-8 bg-spice-400" /> Location & Directions <span className="h-px w-8 bg-spice-400" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-charcoal-900 text-balance">
            Find Paras Kachoriwala
          </h1>
          <p className="mt-4 text-lg text-charcoal-600 text-balance">
            Visit us in person for fresh Kachori (Regular, Jain &amp; Swaminarayan) and signature Bhel prepared fresh from 7:30 PM to 12:00 AM daily.
          </p>
          <div className="mt-6 flex justify-center">
            <StatusBadge open={open} size="md" />
          </div>
        </div>

        {/* Cash Only & Token System Banner */}
        <div className="mt-8 max-w-4xl mx-auto rounded-2xl bg-spice-100/70 border border-spice-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <Banknote size={20} className="text-spice-700 shrink-0" />
            <span className="text-sm font-bold text-charcoal-900">
              Payment & Service: Cash Payment Only • Token System at Counter
            </span>
          </div>
          <span className="text-xs text-charcoal-600 font-medium">
            Collect your token at the stall counter for fresh service
          </span>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-12 max-w-6xl mx-auto items-start">
          {/* Main Visual Card */}
          <div className="lg:col-span-6 card overflow-hidden flex flex-col">
            <a
              href={BRAND.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-[4/3] sm:aspect-[16/10] overflow-hidden bg-charcoal-950"
              aria-label="Open the exact Paras Kachoriwala location in Google Maps"
            >
              <img
                src="./images/lari_pic.webp"
                alt="Paras Kachoriwala food cart at the shop location"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-charcoal-950/20 to-transparent" />
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-charcoal-900/80 backdrop-blur-md border border-white/20 px-3.5 py-1.5 text-xs font-bold text-marigold-300 shadow-lg">
                  <Sparkles size={13} className="text-marigold-400" />
                  Official Stall Location
                </span>
              </div>
              <span className="absolute bottom-3 sm:bottom-4 md:bottom-5 left-3 sm:left-4 md:left-5 right-3 sm:right-4 md:right-5 flex items-center justify-between gap-2 rounded-xl sm:rounded-2xl bg-white/95 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold text-spice-700 shadow-xl group-hover:bg-marigold-400 group-hover:text-charcoal-950 transition-colors">
                <span className="flex items-center gap-2 min-w-0">
                  <Navigation size={16} className="shrink-0 sm:h-[18px] sm:w-[18px]" />
                  <span className="truncate sm:overflow-visible">Open Live Pin in Google Maps</span>
                </span>
                <ExternalLink size={15} className="shrink-0 sm:h-4 sm:w-4" />
              </span>
            </a>

            <div className="p-5 sm:p-7 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-charcoal-900">{BRAND.name}</h3>
                  <p className="text-xs sm:text-sm text-charcoal-600 mt-1 leading-relaxed break-words">{BRAND.address}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-spice-100">
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="btn-outline text-xs sm:text-sm py-2.5 px-3 flex items-center justify-center gap-1.5 w-full font-bold shadow-sm cursor-pointer"
                >
                  {copied ? <Check size={15} className="text-leaf-600 shrink-0" /> : <Copy size={15} className="shrink-0" />}
                  <span>{copied ? 'Address Copied!' : 'Copy Address'}</span>
                </button>
                <a
                  href={BRAND.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-xs sm:text-sm py-2.5 px-3.5 flex items-center justify-center gap-1.5 w-full font-bold shadow-sm"
                >
                  <Navigation size={15} className="shrink-0" />
                  <span>Start Navigation</span>
                </a>
              </div>
            </div>
          </div>

          {/* Details & Hours Card */}
          <div className="lg:col-span-6 space-y-6">
            <div className="card p-7 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-spice-100 text-spice-700">
                  <MapPin size={22} />
                </span>
                <div>
                  <h3 className="font-display text-xl font-bold text-charcoal-900">How to Reach Us</h3>
                  <p className="mt-1 text-sm text-charcoal-600 leading-relaxed">
                    Look for our famous food stall. Tap below to navigate directly with your phone's GPS.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href={BRAND.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full justify-center flex items-center gap-2"
                >
                  <Navigation size={18} />
                  Open in Google Maps
                </a>
              </div>
            </div>

            <div className="card p-7 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-spice-100 text-spice-700">
                  <Clock size={22} />
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold text-charcoal-900">Store Hours</h3>
                    <StatusBadge open={open} size="sm" />
                  </div>
                  <p className="text-xs text-spice-600 font-semibold mt-1">
                    Open Evening & Night: {formatTimeStr(today.open)} – {formatTimeStr(today.close)}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm divide-y divide-spice-100/60">
                    {STORE_HOURS.map((h) => (
                      <li key={h.day} className="flex justify-between items-center pt-2 first:pt-0">
                        <span className="text-charcoal-700 font-medium">{h.day}</span>
                        <span className="tabular-nums font-semibold text-charcoal-900">
                          {h.display ?? `${formatTimeStr(h.open)} – ${formatTimeStr(h.close)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
