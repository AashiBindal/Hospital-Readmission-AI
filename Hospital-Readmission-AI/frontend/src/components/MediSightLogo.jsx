import React from 'react';

export default function MediSightLogo({
  variant = 'dark', // 'dark' (on dark surfaces: Medi is white) | 'light' (on light surfaces: Medi is navy)
  iconOnly = false,
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  showTagline = false,
  className = ''
}) {
  const sizeConfig = {
    sm: {
      iconBox: 'w-7 h-7 rounded-lg',
      iconInner: 'w-4 h-4',
      text: 'text-base',
      tagline: 'text-[10px]'
    },
    md: {
      iconBox: 'w-9 h-9 rounded-xl',
      iconInner: 'w-5 h-5',
      text: 'text-lg',
      tagline: 'text-[11px]'
    },
    lg: {
      iconBox: 'w-11 h-11 rounded-xl',
      iconInner: 'w-6 h-6',
      text: 'text-2xl',
      tagline: 'text-xs'
    },
    xl: {
      iconBox: 'w-13 h-13 rounded-2xl',
      iconInner: 'w-7 h-7',
      text: 'text-3xl',
      tagline: 'text-xs'
    }
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  const mediColor = variant === 'dark' ? 'text-white' : 'text-[#0F172A]';
  const sightColor = 'text-[#0D9488]';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Teal rounded-square icon with white eye-with-heartbeat symbol */}
      <div
        className={`${currentSize.iconBox} bg-[#0D9488] flex items-center justify-center shrink-0 shadow-sm transition-transform hover:scale-105`}
        title="MediSight"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`${currentSize.iconInner} text-white`}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Eye outline */}
          <path
            d="M2 12C4.5 7.5 8 5 12 5C16 5 19.5 7.5 22 12C19.5 16.5 16 19 12 19C8 19 4.5 16.5 2 12Z"
            strokeWidth="1.9"
          />
          {/* Heartbeat pulse across center */}
          <path
            d="M6 12H9L10.5 9L13.5 15L15 11L16 12H18"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Wordmark: Medi (white/navy) + Sight (teal) */}
      {!iconOnly && (
        <div className="flex flex-col justify-center min-w-0">
          <span className={`font-extrabold tracking-tight leading-none ${currentSize.text}`}>
            <span className={mediColor}>Medi</span>
            <span className={sightColor}>Sight</span>
          </span>
          {showTagline && (
            <span
              className={`font-medium tracking-normal mt-1 leading-tight truncate ${currentSize.tagline} ${
                variant === 'dark' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              Smart Healthcare. Better Decisions.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
