import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function buildStamp(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim();
    return `${sha}-${Date.now()}`;
  } catch {
    return `dev-${Date.now()}`;
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    // Identifies the bundled data snapshot, so a localStorage copy written
    // before a correcting deploy is discarded rather than trusted.
    __BUILD_STAMP__: JSON.stringify(buildStamp()),
  },
});
