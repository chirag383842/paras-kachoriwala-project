import { BRAND } from '@/lib/constants';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon-only' | 'light';
  className?: string;
  onClick?: () => void;
};

const LOGO_SRC = '/images/logo.png';

export default function Logo({ size = 'md', variant = 'full', className = '', onClick }: Props) {
  const iconDimensions = {
    sm: 'h-10 w-10 min-w-[2.5rem]',
    md: 'h-11 w-11 min-w-[2.75rem] sm:h-12 sm:w-12 sm:min-w-[3rem]',
    lg: 'h-14 w-14 min-w-[3.5rem] sm:h-16 sm:w-16 sm:min-w-[4rem]',
  };

  const titleSizes = {
    sm: 'text-base font-bold tracking-tight',
    md: 'text-lg sm:text-xl font-bold tracking-tight',
    lg: 'text-2xl sm:text-3xl font-bold tracking-tight',
  };

  const taglineSizes = {
    sm: 'text-[9px] font-bold tracking-[0.16em]',
    md: 'text-[10px] sm:text-[11px] font-bold tracking-[0.18em]',
    lg: 'text-xs font-bold tracking-[0.2em]',
  };

  const isLight = variant === 'light';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`inline-flex items-center gap-3 group select-none transition-all duration-300 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      aria-label={`${BRAND.name} — Home`}
    >
      <div
        className={`relative shrink-0 overflow-hidden rounded-2xl aspect-square shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg ${
          isLight
            ? 'border border-amber-500/30 group-hover:border-amber-400 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]'
            : 'border border-spice-200 group-hover:border-spice-400 group-hover:shadow-[0_0_20px_rgba(217,119,6,0.2)]'
        } ${iconDimensions[size]}`}
      >
        <img
          src={LOGO_SRC}
          alt=""
          className="block h-full w-full max-w-full object-contain object-center"
          draggable={false}
        />
      </div>

      {variant !== 'icon-only' && (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={`truncate font-display font-bold transition-colors duration-200 ${
              isLight
                ? 'text-white group-hover:text-amber-300'
                : 'text-charcoal-900 group-hover:text-spice-700'
            } ${titleSizes[size]}`}
          >
            {BRAND.name}
          </span>
          <span
            className={`mt-1 truncate font-bold uppercase tracking-wider transition-colors duration-200 ${
              isLight ? 'text-amber-300/90 group-hover:text-amber-200' : 'text-spice-600 group-hover:text-spice-700'
            } ${taglineSizes[size]}`}
          >
            {BRAND.tagline}
          </span>
        </span>
      )}
    </div>
  );
}
