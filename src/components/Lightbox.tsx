import { useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GalleryImage } from '@/lib/types';

type Props = {
  images: GalleryImage[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export default function Lightbox({ images, index, onClose, onNavigate }: Props) {
  const next = useCallback(() => onNavigate((index + 1) % images.length), [index, images.length, onNavigate]);
  const prev = useCallback(() => onNavigate((index - 1 + images.length) % images.length), [index, images.length, onNavigate]);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;

    // Only horizontal swipe if diffX is significantly larger than diffY
    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0) {
        next();
      } else {
        prev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, next, prev]);

  const img = images[index];
  if (!img) return null;

  const hasMultiple = images.length > 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal-950/95 backdrop-blur-md animate-fade-in p-2 sm:p-6 select-none"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={img.alt}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 sm:top-5 sm:right-5 z-20 grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 active:scale-95 transition-all tap-target cursor-pointer"
        aria-label="Close modal"
      >
        <X size={22} />
      </button>

      {/* Prev button */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full bg-charcoal-900/70 border border-white/10 text-white hover:bg-spice-600 active:scale-95 transition-all tap-target cursor-pointer shadow-lg"
          aria-label="Previous image"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Media Content */}
      <figure
        className="max-w-4xl max-h-[88vh] w-full flex flex-col items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {img.media_type === 'video' ||
        img.src.toLowerCase().endsWith('.mp4') ||
        img.src.toLowerCase().endsWith('.webm') ||
        img.src.startsWith('data:video/') ? (
          <div className="relative max-h-[72vh] max-w-full flex flex-col items-center justify-center">
            <video
              key={img.src}
              src={img.src}
              controls
              autoPlay
              muted
              playsInline
              preload="auto"
              className="max-h-[68vh] max-w-full rounded-xl sm:rounded-2xl shadow-2xl bg-black animate-scale-in object-contain"
            >
              <source src={img.src} type="video/mp4" />
              Your browser does not support playing this video.
            </video>
            <span className="mt-2 text-[10px] sm:text-[11px] text-spice-100/80 flex items-center gap-1.5 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
              🔊 Tap speaker icon on video controls to unmute sound
            </span>
          </div>
        ) : img.media_type === 'audio' ||
          img.src.toLowerCase().endsWith('.mp3') ||
          img.src.toLowerCase().endsWith('.wav') ||
          img.src.toLowerCase().endsWith('.ogg') ||
          img.src.startsWith('data:audio/') ? (
          <div className="card p-6 sm:p-8 bg-charcoal-900 border border-spice-500/30 text-white flex flex-col items-center gap-4 w-full max-w-sm sm:max-w-md shadow-2xl rounded-2xl animate-scale-in">
            <span className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-spice-600/30 text-spice-400 grid place-items-center text-3xl border border-spice-500/30">
              🎵
            </span>
            <div className="text-center">
              <h4 className="font-display text-base sm:text-lg font-bold">{img.caption || img.alt}</h4>
              <p className="text-xs text-spice-200/70 mt-0.5">Paras Kachoriwala Audio</p>
            </div>
            <audio src={img.src} controls autoPlay className="w-full mt-2" />
          </div>
        ) : (
          <div className="relative max-h-[74vh] max-w-full flex items-center justify-center">
            <img
              src={img.src}
              alt={img.alt}
              decoding="async"
              className="max-h-[74vh] max-w-full object-contain rounded-xl sm:rounded-2xl shadow-2xl animate-scale-in"
            />
          </div>
        )}

        {img.caption && (
          <figcaption className="mt-3 sm:mt-4 text-center text-spice-50/95 text-xs sm:text-sm font-semibold tracking-wide max-w-md truncate px-3">
            {img.caption}
          </figcaption>
        )}

        {hasMultiple && (
          <p className="mt-1 text-[11px] sm:text-xs text-spice-100/60 font-medium">
            {index + 1} of {images.length}
            <span className="hidden sm:inline text-spice-200/40 ml-2">(Swipe or use arrow keys)</span>
          </p>
        )}
      </figure>

      {/* Next button */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full bg-charcoal-900/70 border border-white/10 text-white hover:bg-spice-600 active:scale-95 transition-all tap-target cursor-pointer shadow-lg"
          aria-label="Next image"
        >
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  );
}
