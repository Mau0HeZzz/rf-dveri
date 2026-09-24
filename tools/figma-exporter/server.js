/**
 * @fileOverview Локальный сервер, принимающий файлы от Figma-плагина «Экспорт для вёрстки» и сохраняющий их в .design
 */
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'

// Порт сервера (должен совпадать с devAllowedDomains в manifest.json плагина)
const PORT = Number(process.env.FIGMA_EXPORT_PORT) || 3717
// Папка, куда сохраняются выгруженные файлы
const OUT_DIR = path.resolve(import.meta.dirname, '../../.design')
// Заголовки CORS для запросов из iframe плагина (origin null)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Private-Network': 'true',
}

// Количество сохранённых за сессию файлов
let savedCount = 0

/**
 * Отправляет JSON-ответ с CORS-заголовками
 */
function sendJson(res, status, body) {
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/**
 * Возвращает тело запроса целиком в виде Buffer
 */
async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

/**
 * Возвращает абсолютный путь внутри OUT_DIR или null, если путь выходит за её пределы
 */
function resolveInside(relPath) {
  const target = path.resolve(OUT_DIR, relPath)
  return target.startsWith(OUT_DIR + path.sep) ? target : null
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/ping') {
    sendJson(res, 200, { ok: true, outDir: OUT_DIR })
    return
  }

  if (req.method === 'POST' && url.pathname === '/clear') {
    const target = resolveInside(url.searchParams.get('path') || '')
    if (!target) {
      sendJson(res, 400, { ok: false, error: 'bad path' })
      return
    }
    await fs.rm(target, { recursive: true, force: true })
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'POST' && url.pathname === '/file') {
    const target = resolveInside(url.searchParams.get('path') || '')
    if (!target) {
      sendJson(res, 400, { ok: false, error: 'bad path' })
      return
    }
    try {
      const body = await readBody(req)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, body)
      savedCount++
      if (savedCount % 25 === 0) console.log(`  сохранено файлов: ${savedCount}`)
      sendJson(res, 200, { ok: true })
    } catch (e) {
      console.error(e)
      sendJson(res, 500, { ok: false, error: String(e) })
    }
    return
  }

  sendJson(res, 404, { ok: false })
})

server.listen(PORT, () => {
  console.log(`Figma export server: http://localhost:${PORT}`)
  console.log(`Файлы сохраняются в ${OUT_DIR}`)
})
