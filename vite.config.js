import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{rollupOptions:{output:{manualChunks:{three:["three"]}}},chunkSizeWarningLimit:650},test:{include:['tests/**/*.test.js']}});
