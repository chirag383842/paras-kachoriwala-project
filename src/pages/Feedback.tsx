import { useState, useRef } from 'react';
import { CheckCircle2, Loader2, Send, AlertCircle } from 'lucide-react';
import StarRating from '@/components/StarRating';
import { submitFeedback, type FeedbackPayload } from '@/lib/hooks';

type Field = 'overall' | 'food' | 'service' | 'cleanliness';

const RATING_FIELDS: { key: Field; label: string }[] = [
  { key: 'overall', label: 'Overall Experience' },
  { key: 'food', label: 'Food Quality' },
  { key: 'service', label: 'Service' },
  { key: 'cleanliness', label: 'Cleanliness' },
];

export default function Feedback() {
  const [ratings, setRatings] = useState<Record<Field, number>>({ overall: 0, food: 0, service: 0, cleanliness: 0 });
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [touched, setTouched] = useState(false);
  const isSubmittingRef = useRef(false);

  const overallValid = ratings.overall >= 1;
  const messageValid = message.trim().length >= 5;
  const formValid = overallValid && messageValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || status === 'submitting') return;

    setTouched(true);
    if (!formValid) return;

    isSubmittingRef.current = true;
    setStatus('submitting');
    setErrorMsg('');

    const payload: FeedbackPayload = {
      overall_rating: ratings.overall,
      food_rating: ratings.food || 0,
      service_rating: ratings.service || 0,
      cleanliness_rating: ratings.cleanliness || 0,
      message: message.trim(),
      customer_name: name.trim(),
    };

    try {
      const result = await submitFeedback(payload);
      if (result.success) {
        setStatus('success');
        setRatings({ overall: 0, food: 0, service: 0, cleanliness: 0 });
        setMessage('');
        setName('');
        setTouched(false);
      } else {
        setStatus('error');
        setErrorMsg(result.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  if (status === 'success') {
    return (
      <div className="pt-20 sm:pt-24">
        <section className="container-max section-pad">
          <div className="card max-w-lg mx-auto p-10 text-center animate-scale-in">
            <span className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-leaf-500/10 text-leaf-600">
              <CheckCircle2 size={36} />
            </span>
            <h2 className="mt-6 font-display text-3xl font-bold text-charcoal-900">Thank You!</h2>
            <p className="mt-3 text-charcoal-600">
              Your feedback means a lot to us. It is waiting for the owner to feature it on the home page.
            </p>
            <button
              onClick={() => {
                isSubmittingRef.current = false;
                setStatus('idle');
              }}
              className="btn-outline mt-8"
            >
              Share Another Review
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pt-20 sm:pt-24">
      <section className="container-max section-pad">
        <div className="text-center max-w-2xl mx-auto">
          <div className="eyebrow justify-center mb-3">
            <span className="h-px w-8 bg-spice-400" /> Feedback <span className="h-px w-8 bg-spice-400" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-charcoal-900 text-balance">
            How Was Your Experience?
          </h1>
          <p className="mt-4 text-lg text-charcoal-600 text-balance">
            Tell us about your experience at Paras Kachoriwala. Your honest feedback helps us improve.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 sm:mt-12 max-w-2xl mx-auto card p-5 sm:p-8 md:p-10 space-y-6 sm:space-y-8" noValidate>
          {RATING_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-bold text-charcoal-800 mb-2 sm:mb-3">
                {f.label} <span className="text-spice-600" aria-hidden>*</span>
              </label>
              <StarRating
                value={ratings[f.key]}
                size={28}
                interactive
                onChange={(v) => setRatings((r) => ({ ...r, [f.key]: v }))}
              />
              {touched && f.key === 'overall' && !overallValid && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle size={14} /> Please rate your overall experience.
                </p>
              )}
            </div>
          ))}

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label htmlFor="message" className="block text-sm font-bold text-charcoal-800">
                Your Feedback <span className="text-spice-600" aria-hidden>*</span>
              </label>
              <span className="text-xs text-charcoal-400 font-medium">
                {message.length}/1000
              </span>
            </div>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about your experience at Paras Kachoriwala (taste, service, favorites)..."
              className="w-full min-h-[140px] sm:min-h-[160px] rounded-2xl border border-spice-200 bg-spice-50/50 p-3.5 sm:p-4 text-base sm:text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:border-spice-500 focus:bg-white transition-colors resize-y leading-relaxed break-words"
              maxLength={1000}
            />
            {touched && !messageValid && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle size={14} /> Please share a few words (at least 5 characters).
              </p>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-bold text-charcoal-800 mb-2">
              Your Name <span className="text-charcoal-400 font-normal">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul"
              className="w-full rounded-2xl border border-spice-200 bg-spice-50/50 px-4 py-3 text-charcoal-900 placeholder:text-charcoal-400 focus:border-spice-500 focus:bg-white transition-colors"
              maxLength={80}
            />
          </div>

          {status === 'error' && errorMsg && (
            <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /> {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting' || isSubmittingRef.current}
            className="btn-primary w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send size={17} /> Submit Feedback
              </>
            )}
          </button>

          <p className="text-xs text-charcoal-400 leading-relaxed">
            Your feedback is stored securely and never shared publicly without your approval. Only your first name (if provided) and rating may be shown.
          </p>
        </form>
      </section>
    </div>
  );
}
