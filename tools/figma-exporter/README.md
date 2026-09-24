# Figma → .design

Локальный плагин выгружает из Figma всё, что нужно для вёрстки. У Plugin API нет лимитов, как у MCP/REST.

## Запуск

1. `npm run figma:server`: сервер на `http://localhost:3717`, файлы пишутся в `.design/`.
2. Figma Desktop → Plugins → Development → **Import plugin from manifest…** → `tools/figma-exporter/plugin/manifest.json` (один раз).
3. Выделить фреймы (Desktop + Mobile) → Plugins → Development → **Экспорт для вёрстки** → «Экспорт».

Если сервер не запущен, плагин скачает `figma-export.zip`. Его нужно распаковать в `.design/`.

## Что получится

```
.design/<страница>/
  manifest.json          фреймы, секции с координатами, шрифты, список картинок
  tokens.json            стили цветов/текста/эффектов/сеток, переменные (+ использованные из библиотек)
  <фрейм>/tree.json      дерево слоёв: размеры, auto layout, заливки, тексты, CSS из Dev Mode
  <фрейм>/preview.png    весь фрейм
  <фрейм>/sections/*.png каждая секция отдельно
  assets/svg/            иконки и векторная графика (дубли убраны)
  assets/img/            исходники картинок из заливок
  assets/export/         то, что дизайнер отметил на экспорт
```
