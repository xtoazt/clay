import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#1e1e2e',
          fg: '#cdd6f4',
          cursor: '#cba6f7',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;


