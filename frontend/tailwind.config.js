/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1',
          dark: '#4F46E5',
          light: '#818CF8',
          50: '#EEF2FF',
          100: '#E0E7FF',
        },
        secondary: {
          DEFAULT: '#8B5CF6',
          dark: '#7C3AED',
          light: '#A78BFA',
        },
        accent: {
          DEFAULT: '#EC4899',
          dark: '#DB2777',
          light: '#F472B6',
        },
        success: {
          DEFAULT: '#10B981',
          dark: '#059669',
          light: '#34D399',
        },
        warning: {
          DEFAULT: '#F59E0B',
          dark: '#D97706',
          light: '#FBBF24',
        },
        background: {
          DEFAULT: '#0F172A',
          light: '#1E293B',
          lighter: '#334155',
          card: '#1E293B',
          gradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        },
        editor: {
          DEFAULT: '#0F172A',
          gutter: '#1E293B',
          active: '#334155',
          selection: 'rgba(99, 102, 241, 0.2)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'gradient': 'gradient 8s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        gradient: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 90deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-pattern': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%236366F1' fill-opacity='0.05'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 20.83l2.83-2.83 1.41 1.41L1.41 22.24H0v-1.41zM0 3.06l2.83-2.83 1.41 1.41L1.41 4.47H0V3.06zm20.83 17.77l2.83-2.83 1.41 1.41-2.83 2.83h-1.41v-1.41zM20.83 0l2.83 2.83 1.41-1.41L22.24 0h-1.41v1.41zM3.06 0l2.83 2.83 1.41-1.41L4.47 0H3.06v1.41zM38.59 0l2.83 2.83 1.41-1.41L40 0h-1.41v1.41zM20.83 38.59l2.83-2.83 1.41 1.41-2.83 2.83h-1.41v-1.41zM3.06 38.59l2.83-2.83 1.41 1.41-2.83 2.83H3.06v-1.41zM38.59 20.83l2.83-2.83 1.41 1.41-2.83 2.83h-1.41v-1.41zM38.59 3.06l2.83-2.83 1.41 1.41-2.83 2.83h-1.41V3.06z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'glow': '0 0 15px rgba(99, 102, 241, 0.5)',
        'glow-lg': '0 0 25px rgba(99, 102, 241, 0.5)',
      },
    },
  },
  plugins: [],
}; 