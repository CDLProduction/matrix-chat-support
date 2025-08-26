import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isWidget = mode === 'widget'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    css: {
      modules: {
        localsConvention: 'camelCaseOnly',
        generateScopedName: isWidget 
          ? 'matrix-chat-[hash:base64:8]' 
          : '[name]__[local]___[hash:base64:5]'
      }
    },
    build: isWidget ? {
      lib: {
        entry: resolve(__dirname, 'src/widget.tsx'),
        name: 'MatrixChatWidget',
        fileName: 'matrix-chat-widget',
        formats: ['iife']
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          manualChunks: undefined
        }
      },
      outDir: 'dist/widget'
    } : {
      outDir: 'dist/demo'
    },
    server: {
      port: 3000,
      open: true
    }
  }
})