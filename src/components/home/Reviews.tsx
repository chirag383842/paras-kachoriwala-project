import { useState, useMemo } from 'react';
import { Quote, MessageSquarePlus, CheckCircle2, Star } from 'lucide-react';
import { useReviews } from '@/lib/hooks';
import StarRating from '@/components/StarRating';
import SectionHeading from '@/components/SectionHeading';
import { SectionSkeleton, SectionError } from '@/components/SectionLoader';
import type { Page } from '@/components/Navbar';
import type { Review } from '@/lib/types';

type Props = { onNavigate: (page: Page) => void };
type FilterTab = 'all' | 'justdial' | 'verified';

export default function Reviews({ onNavigate }: Props) {
  const { data: reviews, loading, error, refetch } = useReviews();
  const [filter, setFilter] = useState<FilterTab>('all');

  const { justdialReviews, verifiedReviews, displayReviews } = useMemo(() => {
    if (!reviews || reviews.length === 0) {
      return { justdialReviews: [], verifiedReviews: [], displayReviews: [] };
    }

    const jd = reviews.filter((r) => r.source === 'justdial' || r.id.startsWith('jd-'));
    const vf = reviews.filter((r) => r.source === 'verified' || !r.id.startsWith('jd-'));

    // Requirement #4: Always maintain format: First Justdial, then Verified reviews
    const combined = [...jd, ...vf];

    let filtered = combined;
    if (filter === 'justdial') filtered = jd;
    if (filter === 'verified') filtered = vf;

    return {
      justdialReviews: jd,
      verifiedReviews: vf,
      displayReviews: filtered,
    };
  }, [reviews, filter]);

  return (
    <section className="container-max section-pad">
      <SectionHeading
        eyebrow="Customer Reviews"
        title="What Our Customers Say"
        subtitle="Authentic feedback from Justdial ratings and our verified local customers."
      />

      <div className="mt-8">
        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === 'all'
                ? 'bg-spice-600 text-white shadow-sm'
                : 'bg-spice-50 text-charcoal-700 hover:bg-spice-100 border border-spice-200'
              }`}
          >
            All Reviews ({reviews?.length ?? 0})
          </button>
          <button
            onClick={() => setFilter('justdial')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === 'justdial'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
              }`}
          >
            <CheckCircle2 size={13} className={filter === 'justdial' ? 'text-white' : 'text-sky-600'} />
            1. Justdial Reviews ({justdialReviews.length})
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${filter === 'verified'
                ? 'bg-leaf-600 text-white shadow-sm'
                : 'bg-leaf-50 text-leaf-800 hover:bg-leaf-100 border border-leaf-200'
              }`}
          >
            <CheckCircle2 size={13} className={filter === 'verified' ? 'text-white' : 'text-leaf-600'} />
            2. Verified Customer Reviews ({verifiedReviews.length})
          </button>
        </div>

        {loading ? (
          <SectionSkeleton count={3} variant="grid" />
        ) : error ? (
          <SectionError
            title="Unable to load reviews"
            message="Customer reviews couldn't be loaded right now. Please try again in a moment."
            onRetry={refetch}
          />
        ) : displayReviews.length > 0 ? (
          <div className="space-y-12">
            {/* When 'all' is selected: Show format clearly with Justdial first, then Verified */}
            {filter === 'all' ? (
              <div className="space-y-12">
                {/* 1. Justdial Reviews Section */}
                {justdialReviews.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-sky-100">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 bg-sky-100 px-3 py-1 rounded-full">
                        <CheckCircle2 size={14} className="text-sky-600" />
                        First: Justdial Customer Reviews
                      </span>
                      <span className="text-xs text-charcoal-500">
                        {justdialReviews.length} Verified Justdial Ratings
                      </span>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {justdialReviews.map((r, i) => (
                        <ReviewCard key={r.id} review={r} index={i} isJustdial />
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Verified Customer Reviews Section */}
                {verifiedReviews.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6 pb-2 border-b border-leaf-100">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-leaf-800 bg-leaf-100 px-3 py-1 rounded-full">
                        <CheckCircle2 size={14} className="text-leaf-600" />
                        After That: Verified Customer Reviews
                      </span>
                      <span className="text-xs text-charcoal-500">
                        {verifiedReviews.length} Verified Submissions
                      </span>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {verifiedReviews.map((r, i) => (
                        <ReviewCard key={r.id} review={r} index={i} isJustdial={false} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* When filtered by tab */
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {displayReviews.map((r, i) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    index={i}
                    isJustdial={r.source === 'justdial' || r.id.startsWith('jd-')}
                  />
                ))}
              </div>
            )}

            <div className="text-center pt-4">
              <button
                onClick={() => onNavigate('feedback')}
                className="btn-outline group inline-flex items-center gap-2 shadow-sm hover:shadow-warm"
              >
                <MessageSquarePlus size={16} />
                Share Your Experience & Leave a Review
              </button>
            </div>
          </div>
        ) : (
          <div className="card p-12 text-center max-w-md mx-auto animate-scale-in">
            <p className="text-charcoal-700 text-lg font-display font-bold">Be the First to Review!</p>
            <p className="text-charcoal-500 text-sm mt-1">
              Have you tried our fresh Kachori or Bhel? Share your feedback with us!
            </p>
            <button
              onClick={() => onNavigate('feedback')}
              className="btn-primary mt-6 inline-flex items-center gap-2"
            >
              <MessageSquarePlus size={16} />
              Leave a Review
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewCard({ review: r, index: i, isJustdial }: { review: Review; index: number; isJustdial: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = r.message.length > 160;

  return (
    <article
      className="card p-5 sm:p-7 flex flex-col justify-between animate-fade-up hover:shadow-warm transition-all duration-300"
      style={{ animationDelay: `${i * 0.05}s` }}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <Quote size={24} className="text-spice-300 shrink-0" />
          {isJustdial ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full shrink-0">
              <CheckCircle2 size={12} className="text-sky-600" />
              Justdial
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-leaf-700 bg-leaf-50 border border-leaf-200 px-2.5 py-0.5 rounded-full shrink-0">
              <CheckCircle2 size={12} className="text-leaf-600" />
              Verified
            </span>
          )}
        </div>

        <StarRating value={r.rating} size={18} className="mt-3" />

        <div className="mt-3.5 sm:mt-4">
          <p className="text-charcoal-700 leading-relaxed italic text-sm sm:text-[15px] break-words [overflow-wrap:anywhere] whitespace-pre-line">
            &ldquo;{isLong && !isExpanded ? `${r.message.slice(0, 160)}...` : r.message}&rdquo;
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-xs font-bold text-spice-600 hover:text-spice-700 inline-flex items-center gap-1 cursor-pointer focus:outline-none"
            >
              {isExpanded ? 'Read Less ↑' : 'Read Full Comment ↓'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-spice-100 flex items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-bold text-spice-700 truncate">— {r.customer_name}</p>
        {r.created_at && (
          <span className="text-[11px] text-charcoal-400 shrink-0">
            {new Date(r.created_at).toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>
    </article>
  );
}
