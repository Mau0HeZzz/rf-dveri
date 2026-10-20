/**
 * @fileOverview Конфигурация Vite 8 для MPA-шаблона ванильной вёрстки
 */
import { resolve } from 'path'
import { defineConfig } from "vite";
import posthtml from '@vituum/vite-plugin-posthtml';
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import { DEFAULT_OPTIONS } from './config/imageOptimizerConfig';
import ViteFontsAuto from 'vite-plugin-fonts-auto';

import pages from './vitejs/pages.config'

const pagesInput = {}

pages.forEach((page => {
    pagesInput[page.name] = page.path
}));


/**
 * @returns {import('vite').Plugin}
 */
function htmlPartialsHmr() {
  const partialsDir = resolve(__dirname, 'src/html')

  return {
    name: 'html-partials-hmr',
    configureServer(server) {
      server.watcher.add(partialsDir)
    },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(partialsDir) && file.endsWith('.html')) {
        server.ws.send({ type: 'full-reload' })
        return []
      }
    },
  }
}

/**
 * Делает пути к шрифтам в собранном CSS относительными: url(/fonts/...) → url(../fonts/...).
 * fonts.scss генерирует vite-plugin-fonts-auto с зашитым абсолютным путём, поэтому правим результат сборки
 * (CSS лежит в dist/assets, шрифты — в dist/fonts)
 * @returns {import('vite').Plugin}
 */
function relativeFontUrls() {
  return {
    name: 'relative-font-urls',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue
        file.source = String(file.source).replace(/url\((["']?)\/fonts\//g, 'url($1../fonts/')
      }
    },
  }
}

export default defineConfig({
  build: {
    target: 'es2017',
    outDir: 'dist',
    rolldownOptions: {
      input: {
        ...pagesInput
      },
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name == 'app.css') {
            return 'assets/style.css';
          }

          return 'assets/'+assetInfo.name;
        },
        chunkFileNames: (chunkInfo) => {
          console.log(chunkInfo);
          return "assets/[name].js"
        }
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    },
    devSourcemap: true,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: true,
    // API боевого сайта (подсказки поиска) — в разработке запросы уходят на прод без CORS
    proxy: {
      '/udata': {
        target: 'https://www.rf-dveri.ru',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    htmlPartialsHmr(),
    relativeFontUrls(),
    ViteFontsAuto({
      sourceDir: 'public/fonts',
      destDir: 'public/fonts',
      cssFile: 'src/scss/fonts/fonts.scss',
      preload: true,
      logs: true,
    }),
    ViteImageOptimizer(DEFAULT_OPTIONS),
    posthtml({
      root: resolve(__dirname),
    }),
  ],
})