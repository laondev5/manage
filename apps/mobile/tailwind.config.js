/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: '#101D35',
        'navy-raised': '#1A2A49',
        'navy-muted': '#33425F',
        cobalt: '#2457D6',
        'cobalt-pressed': '#1C46AD',
        'cobalt-soft': '#E9EFFD',
        'cobalt-border': '#C9D8FA',
        canvas: '#F5F7FB',
        surface: '#FFFFFF',
        ink: '#14213D',
        muted: '#526078',
        faint: '#7C89A0',
        line: '#E3E8F1',
        'line-strong': '#CBD4E3',
        amber: '#B54708',
        'amber-soft': '#FEF0C7',
        'amber-border': '#F7D28A',
        danger: '#B42318',
        'danger-soft': '#FEE4E2',
        'danger-border': '#F5B9B4',
      },
    },
  },
  plugins: [],
};
