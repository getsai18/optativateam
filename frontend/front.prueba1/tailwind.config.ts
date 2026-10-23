import type { Config } from 'tailwindcss';

/** Theme colours live in CSS variables (src/index.css) as RGB triplets, so `/opacity` modifiers keep working. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    fontFamily: {
      sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
    },
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['14px', '20px'],
      base: ['16px', '24px'],
      xl: ['20px', '28px'],
      display: ['28px', '36px'],
    },
    borderRadius: {
      none: '0',
      sm: '6px',
      control: '10px',
      panel: '16px',
      xl: '20px',
      full: '9999px',
    },
    extend: {
      colors: {
        paper: v('paper'),
        surface: v('surface'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        primary: { DEFAULT: v('primary'), hover: v('primary-hover'), light: v('primary-light'), soft: v('primary-soft') },
        accent: { DEFAULT: v('accent'), soft: v('accent-soft') },
        sidebar: { DEFAULT: v('surface'), line: v('line'), text: v('muted') },
        status: {
          draft: v('status-draft'),
          'draft-bg': v('status-draft-bg'),
          issued: v('status-issued'),
          'issued-bg': v('status-issued-bg'),
          paid: v('status-paid'),
          'paid-bg': v('status-paid-bg'),
          cancelled: v('status-cancelled'),
          'cancelled-bg': v('status-cancelled-bg'),
        },
      },
      spacing: { sidebar: '248px', topbar: '56px' },
      maxWidth: { content: '1280px' },
      boxShadow: {
        card: '0 1px 2px rgba(16,32,30,0.04), 0 8px 24px -8px rgba(16,32,30,0.08)',
        pop: '0 2px 4px rgba(16,32,30,0.06), 0 16px 40px -8px rgba(16,32,30,0.18)',
        btn: '0 1px 2px rgba(11,107,94,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #14A38F 0%, #0B6B5E 55%, #08463E 100%)',
        'brand-soft': 'linear-gradient(180deg, #14A38F 0%, #0B6B5E 100%)',
      },
      keyframes: {
        shimmer: { '0%': { opacity: '1' }, '50%': { opacity: '0.5' }, '100%': { opacity: '1' } },
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s ease-in-out infinite',
        'slide-in': 'slide-in 180ms ease-out',
        'fade-in': 'fade-in 120ms ease-out',
        rise: 'rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
