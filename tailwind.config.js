/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // 用 class 控制深色模式：App 會按系統設定或者用戶揀選，喺 <html> 加 / 減 "dark"
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
        num: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      colors: {
        // 主色：青綠色；漲跌用美股習慣（綠升紅跌）
        brand: { 50: '#ecf7f4', 100: '#d2ede6', 200: '#a6dbcd', 300: '#6fc1ab', 400: '#3fa48b', 500: '#1f8670', 600: '#156b5a', 700: '#13574a', 800: '#12463c', 900: '#0f3a33' },
        ink: { 50: '#f4f6f5', 100: '#e7ebe9', 200: '#d0d8d4', 300: '#aab7b1', 400: '#7d8e87', 500: '#5d6e67', 600: '#475651', 700: '#36423e', 800: '#222b28', 900: '#161d1b', 950: '#0e1312' },
        up: '#16a34a',
        down: '#dc2626',
      },
    },
  },
  plugins: [],
};
