import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` 會輸出一般網站（dist/）。
// `npm run build:single` 會將所有 JS/CSS 塞入一個 index.html（方便離線或單檔分享），
// 股價快照（public/data）仍然係獨立 JSON 檔。
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}));
