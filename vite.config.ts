import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vscode from '@tomjs/vite-plugin-vscode';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    vscode({
      recommended: true,
      extension: {
        entry: 'src/extension.ts',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'webview'),
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'webview/index.html'),
    },
  },
});
