import { defineConfig } from 'vite'

export default defineConfig({
  envDir: '..',
  server: {
    host: process.env.VITE_HOST || '0.0.0.0',
    port: parseInt(process.env.VITE_PORT) || 5004,
    strictPort: true,
    allowedHosts: ['dovclocknote.ndma.gov.pk'],
    proxy: {
      // WMS raster tiles  →  172.18.0.5:8080/geoserver/regional_dew/wms
      '/wms-proxy': {
        target: 'http://172.18.0.5:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wms-proxy/, '/geoserver/regional_dew/wms'),
      },
      // TMS vector tiles + WFS GeoJSON  →  172.18.1.168:8080/geoserver
      '/geo-proxy': {
        target: 'http://172.18.1.168:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/geo-proxy/, '/geoserver'),
      },
    },
  },
  preview: {
    host: process.env.VITE_HOST || '0.0.0.0',
    port: parseInt(process.env.VITE_PORT) || 5004,
    strictPort: true,
    allowedHosts: ['dovclocknote.ndma.gov.pk'],
    proxy: {
      '/wms-proxy': {
        target: 'http://172.18.0.5:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wms-proxy/, '/geoserver/regional_dew/wms'),
      },
      '/geo-proxy': {
        target: 'http://172.18.1.168:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/geo-proxy/, '/geoserver'),
      },
    },
  },
})
