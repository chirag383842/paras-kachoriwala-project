import { Clock, Users, RefreshCw, Calendar, Navigation, Banknote, Ticket } from 'lucide-react';
import { useStoreStatus } from '@/lib/hooks';
import { CROWD_META, formatTime, type CrowdLevel } from '@/lib/constants';
import StatusBadge from '@/components/StatusBadge';
import { SectionError } from '@/components/SectionLoader';

export default function LiveStoreStatus() {
  const { data, loading, error, computed, refetch } = useStoreStatus();

  const isOpen = computed.isOpen;
  const isClosedForToday = computed.isClosedForToday;
  const crowd = (data?.crowd_level as CrowdLevel) ?? 'Moderate';
  const crowdMeta = CROWD_META[crowd] ?? CROWD_META.Moderate;
  const updated = data?.last_updated ? formatTime(new Date(data.last_updated)) : null;

  return (
    <section className="container-max section-pad">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-charcoal-900 to-charcoal-800 text-white shadow-warm">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-spice-500/10 blur-2xl" />
        <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-marigold-500/10 blur-2xl" />

        <div className="relative p-7 sm:p-10 lg:p-12">
          {error ? (
            <SectionError
              title="Unable to load store status"
              message="Live status couldn't be loaded. You can retry, and we'll show the schedule in the meantime."
              onRetry={refetch}
              compact
            />
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <p className="eyebrow text-marigold-400">
                  <span className="h-px w-6 bg-marigold-400/60" /> Store Status & Operating Schedule
                </p>
                <div className="mt-4 flex items-center gap-4">
                  {loading ? (
                    <div className="skeleton h-9 w-32 rounded-full" />
                  ) : (
                    <StatusBadge open={isOpen} size="lg" className="bg-white/10" />
                  )}
                </div>
              </div>

              {/* When OPEN: Show live crowd level & last updated meter */}
              {isOpen && (
                <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:gap-8 animate-fade-up">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10">
                      <Users size={20} className="text-marigold-300" />
                    </span>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-spice-100/60 font-semibold">Live Crowd</p>
                      {loading ? (
                        <div className="skeleton mt-1 h-5 w-20 rounded" />
                      ) : (
                        <p className={`text-base font-bold ${crowdMeta.color}`}>
                          <span className={`inline-block h-2 w-2 rounded-full ${crowdMeta.dot} mr-1.5`} />
                          {crowdMeta.label}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10">
                      <RefreshCw size={18} className="text-marigold-300" />
                    </span>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-spice-100/60 font-semibold">Updated</p>
                      {loading ? (
                        <div className="skeleton mt-1 h-5 w-20 rounded" />
                      ) : updated ? (
                        <p className="text-base font-bold text-white">{updated}</p>
                      ) : (
                        <p className="text-base font-bold text-spice-100/60">—</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* When CLOSED: Show next opening schedule */}
              {!isOpen && !loading && (
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 animate-fade-up">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-marigold-400/20 text-marigold-300">
                      <Calendar size={18} />
                    </span>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-spice-200/70 font-bold">Next Schedule</p>
                      <p className="text-sm font-bold text-white">{computed.nextOpenText}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-spice-500/20 text-spice-300">
                      <Clock size={18} />
                    </span>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-spice-200/70 font-bold">Daily Hours</p>
                      <p className="text-sm font-bold text-white">7:30 PM – 12:00 AM IST</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment & Token System info pill */}
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-spice-100/70">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-white font-medium">
                <Banknote size={14} className="text-marigold-300" />
                Cash Payment Only (No Online / UPI)
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-white font-medium">
                <Ticket size={14} className="text-marigold-300" />
                Token System at Counter
              </span>
            </div>
            <p className="text-[11px] text-spice-200/60">
              Fresh Kachori (Regular, Jain & Swaminarayan) • In-person stall service
            </p>
          </div>

          {/* Friendly closure message banner */}
          {!loading && !error && !isOpen && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-red-500/15 via-spice-500/10 to-transparent border border-red-500/25 p-4 text-sm text-red-100 animate-fade-up">
              <div className="flex items-center gap-3">
                <Clock size={18} className="shrink-0 text-red-400" />
                <span>
                  {isClosedForToday
                    ? computed.nextOpenText
                    : `We are currently closed • ${computed.nextOpenText} (Daily Hours: 7:30 PM – 12:00 AM).`}
                </span>
              </div>
              <a
                href="#find-us"
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-marigold-300 hover:text-white transition-colors shrink-0"
              >
                <Navigation size={13} />
                View Stall Location
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
