/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        dialog: {
          DEFAULT: 'hsl(var(--dialog))',
          foreground: 'hsl(var(--dialog-foreground))',
        },
        surface: {
          app: 'hsl(var(--surface-app) / <alpha-value>)',
          panel: 'hsl(var(--surface-panel) / <alpha-value>)',
          card: 'hsl(var(--surface-card) / <alpha-value>)',
          muted: 'hsl(var(--surface-muted) / <alpha-value>)',
          elevated: 'hsl(var(--surface-elevated) / <alpha-value>)',
          modal: 'hsl(var(--surface-modal) / <alpha-value>)',
        },
        text: {
          primary: 'hsl(var(--text-primary) / <alpha-value>)',
          secondary: 'hsl(var(--text-secondary) / <alpha-value>)',
          tertiary: 'hsl(var(--text-tertiary) / <alpha-value>)',
        },
        status: {
          running: {
            DEFAULT: 'hsl(var(--status-running) / <alpha-value>)',
            bg: 'hsl(var(--status-running-bg))',
            fg: 'hsl(var(--status-running-fg) / <alpha-value>)',
            border: 'hsl(var(--status-running-border))',
          },
          waiting: {
            DEFAULT: 'hsl(var(--status-waiting) / <alpha-value>)',
            bg: 'hsl(var(--status-waiting-bg))',
            fg: 'hsl(var(--status-waiting-fg) / <alpha-value>)',
            border: 'hsl(var(--status-waiting-border))',
          },
          success: {
            DEFAULT: 'hsl(var(--status-success) / <alpha-value>)',
            bg: 'hsl(var(--status-success-bg))',
            fg: 'hsl(var(--status-success-fg) / <alpha-value>)',
            border: 'hsl(var(--status-success-border))',
          },
          danger: {
            DEFAULT: 'hsl(var(--status-danger) / <alpha-value>)',
            bg: 'hsl(var(--status-danger-bg))',
            fg: 'hsl(var(--status-danger-fg) / <alpha-value>)',
            border: 'hsl(var(--status-danger-border))',
          },
          neutral: {
            DEFAULT: 'hsl(var(--status-neutral) / <alpha-value>)',
            bg: 'hsl(var(--status-neutral-bg) / <alpha-value>)',
            fg: 'hsl(var(--status-neutral-fg) / <alpha-value>)',
            border: 'hsl(var(--status-neutral-border) / <alpha-value>)',
          },
        },
        'border-subtle': 'hsl(var(--border-subtle) / <alpha-value>)',
        'border-strong': 'hsl(var(--border-strong) / <alpha-value>)',
        focus: 'hsl(var(--focus-ring) / <alpha-value>)',
        tooltip: {
          DEFAULT: 'hsl(var(--tooltip) / <alpha-value>)',
          foreground: 'hsl(var(--tooltip-foreground) / <alpha-value>)',
          muted: 'hsl(var(--tooltip-muted) / <alpha-value>)',
        },
        'content-area': 'hsl(var(--content-area) / <alpha-value>)',
      },
      borderRadius: {
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        panel: 'var(--shadow-panel)',
        modal: 'var(--shadow-modal)',
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        normal: 'var(--motion-normal)',
        slow: 'var(--motion-slow)',
        exit: 'var(--motion-exit)',
      },
      keyframes: {
        'slide-in-from-top': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-in-from-bottom': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-out-to-right': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'in': 'slide-in-from-top 0.3s ease-out',
        'out': 'slide-out-to-right 0.2s ease-in',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
}
