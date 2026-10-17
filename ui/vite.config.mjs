import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'

export default defineConfig({
    plugins: [vue()],
    server: {
        host: '0.0.0.0',
        allowedHosts: ['.ts.net'],
        proxy: { '/api': process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:4001' }
    },
    preview: {
        host: '0.0.0.0',
        allowedHosts: ['.ts.net'],
        proxy: { '/api': process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:4001' }
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }
})
