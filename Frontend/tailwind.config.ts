import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tema Carnicería — Rojo Carmín Primario
        carmin: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#dc2626',   // Primario
          600: '#b91c1c',
          700: '#991b1b',   // Hover / Active
          800: '#7f1d1d',
          900: '#450a0a',
        },
        // Ámbar para alertas y advertencias
        ambar: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',   // Alertas
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Grises neutros para fondos y textos
        neutro: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Fuentes ergonómicas para POS táctil (>= 48px para botones principales)
        'pos-sm': ['1rem', { lineHeight: '1.5rem' }],
        'pos-base': ['1.25rem', { lineHeight: '1.75rem' }],
        'pos-lg': ['1.5rem', { lineHeight: '2rem' }],
        'pos-xl': ['2rem', { lineHeight: '2.5rem' }],
        'pos-2xl': ['3rem', { lineHeight: '3.5rem' }],
      },
      minHeight: {
        'touch': '48px',     // Mínimo táctil WCAG
        'touch-lg': '64px',  // Botones POS principales
      },
      minWidth: {
        'touch': '48px',
        'touch-lg': '64px',
      },
    },
  },
  plugins: [],
};

export default config;
