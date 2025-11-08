import { defineConfig } from 'vite';

// 使用者倉庫名稱 (GitHub Pages 需要 base 為 /<repo>/ )
// 如果你 fork 或改名，記得同步更新。
const repoName = 'halftone_generator';

export default defineConfig({
  base: `/${repoName}/`,
  server: {
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
  }
});
