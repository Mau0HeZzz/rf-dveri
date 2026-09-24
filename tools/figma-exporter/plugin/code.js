/**
 * @fileOverview Figma-плагин «Экспорт для вёрстки»: выгружает дерево выделенных фреймов,
 * PNG-превью страниц и секций, SVG/растровые ассеты и дизайн-токены
 */

// Максимальная ширина PNG-превью в пикселях
const PREVIEW_MAX_WIDTH = 1920;
// Максимальный масштаб PNG-превью
const PREVIEW_MAX_SCALE = 2;
// Типы «настоящих» векторных узлов
const VECTOR_TYPES = ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'POLYGON', 'REGULAR_POLYGON'];
// Типы простых фигур, допустимых внутри векторной группы (иконки)
const SHAPE_TYPES = VECTOR_TYPES.concat(['ELLIPSE', 'RECTANGLE']);
// Типы контейнеров, которые могут оказаться векторной группой (иконкой)
const CONTAINER_TYPES = ['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT'];
// Поля стилизованных сегментов текста
const TEXT_SEGMENT_FIELDS = ['fontName', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textCase', 'textDecoration', 'fills', 'textStyleId', 'hyperlink', 'listOptions'];
// Запасной набор полей сегментов, если расширенный не поддерживается
const TEXT_SEGMENT_FIELDS_FALLBACK = ['fontName', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textCase', 'textDecoration', 'fills'];
// Таблица транслитерации кириллицы для имён файлов
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

// Состояние текущего экспорта
let ctx = null;

figma.showUI(__html__, { width: 380, height: 480, themeColors: true });

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'export') return;
  try {
    await runExport(msg.options || {});
  } catch (e) {
    post({ type: 'error', text: String((e && e.stack) || e) });
  }
};

/**
 * Отправляет сообщение в UI плагина
 */
function post(msg) {
  figma.ui.postMessage(msg);
}

/**
 * Отправляет файл в UI для сохранения на диск
 */
function sendFile(path, data) {
  ctx.fileCount++;
  post({ type: 'file', path, data });
}

/**
 * Возвращает число, округлённое до сотых
 */
function r(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Возвращает свойство узла или undefined, если у узла его нет (mixed превращается в 'MIXED')
 */
function g(node, prop) {
  try {
    const v = node[prop];
    return v === figma.mixed ? 'MIXED' : v;
  } catch (e) {
    return undefined;
  }
}

/**
 * Возвращает безопасное для файловой системы имя в латинице
 */
function slug(str) {
  const s = String(str)
    .toLowerCase()
    .split('')
    .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return s || 'node';
}

/**
 * Возвращает уникальное в пределах набора имя, добавляя числовой суффикс
 */
function unique(set, base) {
  let name = base;
  let i = 2;
  while (set.has(name)) name = `${base}-${i++}`;
  set.add(name);
  return name;
}

/**
 * Возвращает цвет в виде #RRGGBB или rgba(...), если есть прозрачность
 */
function color(c, alpha) {
  const a = alpha === undefined ? (c.a === undefined ? 1 : c.a) : alpha;
  const to255 = (v) => Math.round(v * 255);
  if (a >= 0.999) {
    return '#' + [c.r, c.g, c.b].map((v) => to255(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  return `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${r(a)})`;
}

/**
 * Возвращает хеш массива байт для дедупликации ассетов
 */
function hashBytes(bytes) {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16) + ':' + bytes.length;
}

/**
 * Возвращает путь для нового ассета внутри папки страницы
 */
function assetPath(kind, name, ext) {
  const key = kind + '.' + ext;
  if (!ctx.assetNames[key]) ctx.assetNames[key] = new Set();
  return `${ctx.base}/assets/${kind}/${unique(ctx.assetNames[key], slug(name))}.${ext}`;
}

/**
 * Возвращает видимых детей узла
 */
function visibleChildren(node) {
  return 'children' in node ? node.children.filter((c) => c.visible !== false) : [];
}

/**
 * Выгружает выделенные фреймы: дерево, превью, ассеты, токены и манифест
 */
async function runExport(options) {
  const selection = figma.currentPage.selection;
  if (!selection.length) {
    post({ type: 'error', text: 'Выделите один или несколько фреймов (например, Desktop и Mobile).' });
    return;
  }

  ctx = {
    options,
    base: slug(figma.currentPage.name),
    styleCache: new Map(),
    varCache: new Map(),
    collectionCache: new Map(),
    usedStyles: {},
    usedVariables: {},
    fonts: new Set(),
    images: new Map(),
    imageList: [],
    svgs: new Map(),
    exportsCache: new Map(),
    assetNames: {},
    nodeCount: 0,
    fileCount: 0,
    svgSkipped: 0,
  };

  const frameDirs = new Set();
  const frames = [];

  for (const root of selection) {
    const dir = `${ctx.base}/${unique(frameDirs, slug(root.name))}`;
    const rootBox = root.absoluteBoundingBox || { x: root.x, y: root.y };
    // Удаляем файлы прошлой выгрузки этого фрейма, чтобы не остались устаревшие секции
    post({ type: 'clear', path: dir });
    post({ type: 'progress', text: `Разбираю «${root.name}»…` });

    const tree = await serializeNode(root, rootBox, false);
    sendFile(`${dir}/tree.json`, JSON.stringify(tree, null, 1));

    const frameInfo = { name: root.name, id: root.id, dir, width: r(root.width), height: r(root.height) };
    if (options.previews) {
      post({ type: 'progress', text: `Экспортирую превью «${root.name}»…` });
      Object.assign(frameInfo, await exportPreviews(root, rootBox, dir));
    }
    frames.push(frameInfo);
    // Описание фрейма рядом с его файлами: manifest.json перезаписывается при частичном экспорте
    sendFile(`${dir}/frame.json`, JSON.stringify(frameInfo, null, 1));
  }

  post({ type: 'progress', text: 'Собираю токены…' });
  const tokens = await collectTokens();
  tokens.usedStyles = ctx.usedStyles;
  tokens.usedVariables = ctx.usedVariables;
  sendFile(`${ctx.base}/tokens.json`, JSON.stringify(tokens, null, 1));

  const manifest = {
    exportedAt: new Date().toISOString(),
    file: figma.root.name,
    page: figma.currentPage.name,
    frames,
    fonts: Array.from(ctx.fonts).sort(),
    images: ctx.imageList,
    svgCount: ctx.svgs.size,
    nodeCount: ctx.nodeCount,
  };
  sendFile(`${ctx.base}/manifest.json`, JSON.stringify(manifest, null, 1));

  if (ctx.svgSkipped) {
    post({ type: 'log', text: `Пропущено SVG: ${ctx.svgSkipped} (слои обрезаны родителем и не видны — это нормально)` });
  }

  post({
    type: 'done',
    text: `Узлов: ${ctx.nodeCount}, файлов: ${ctx.fileCount}, SVG: ${ctx.svgs.size}, картинок: ${ctx.imageList.length}`,
  });
}

/**
 * Возвращает JSON-описание узла со всеми детьми
 */
async function serializeNode(node, rootBox, inAsset) {
  ctx.nodeCount++;
  if (ctx.nodeCount % 100 === 0) post({ type: 'progress', text: `Обработано узлов: ${ctx.nodeCount}` });

  const o = { id: node.id, name: node.name, type: node.type };
  const box = g(node, 'absoluteBoundingBox');
  if (box) {
    o.x = r(box.x - rootBox.x);
    o.y = r(box.y - rootBox.y);
    o.w = r(box.width);
    o.h = r(box.height);
  }
  if (node.rotation) {
    o.rotation = r(node.rotation);
    o.size = [r(node.width), r(node.height)];
  }
  if (g(node, 'opacity') !== undefined && node.opacity !== 1) o.opacity = r(node.opacity);
  const blend = g(node, 'blendMode');
  if (blend && blend !== 'PASS_THROUGH' && blend !== 'NORMAL') o.blendMode = blend;
  if (g(node, 'isMask')) o.isMask = true;

  addLayout(node, o);
  await addVisual(node, o);
  if (node.type === 'TEXT') await addText(node, o);
  if (node.type === 'INSTANCE') await addInstance(node, o);
  await addVariables(node, o);
  await addDesignerExports(node, o);

  if (ctx.options.css) {
    try {
      o.css = await node.getCSSAsync();
    } catch (e) {
      // У некоторых типов узлов CSS недоступен
    }
  }

  let childInAsset = inAsset;
  if (!inAsset && isVectorAsset(node)) {
    const svg = await exportSvg(node);
    if (svg) o.svg = svg;
    childInAsset = true;
  }

  if ('children' in node) {
    const kids = [];
    for (const child of node.children) {
      if (child.visible === false) continue;
      kids.push(await serializeNode(child, rootBox, childInAsset));
    }
    if (kids.length) o.children = kids;
    const hidden = node.children.length - kids.length;
    if (hidden) o.hiddenChildren = hidden;
  }
  return o;
}

/**
 * Добавляет в описание auto layout, размеры, констрейнты и сетки
 */
function addLayout(node, o) {
  const mode = g(node, 'layoutMode');
  if (mode && mode !== 'NONE') {
    const L = {
      mode,
      gap: g(node, 'itemSpacing'),
      padding: [g(node, 'paddingTop'), g(node, 'paddingRight'), g(node, 'paddingBottom'), g(node, 'paddingLeft')],
      justify: g(node, 'primaryAxisAlignItems'),
      align: g(node, 'counterAxisAlignItems'),
      sizing: [g(node, 'primaryAxisSizingMode'), g(node, 'counterAxisSizingMode')],
    };
    if (g(node, 'layoutWrap') === 'WRAP') {
      L.wrap = true;
      L.rowGap = g(node, 'counterAxisSpacing');
      L.alignContent = g(node, 'counterAxisAlignContent');
    }
    if (g(node, 'itemReverseZIndex')) L.reverseZ = true;
    if (g(node, 'strokesIncludedInLayout')) L.strokesIncluded = true;
    if (mode === 'GRID') {
      L.rows = g(node, 'gridRowCount');
      L.columns = g(node, 'gridColumnCount');
      L.rowGap = g(node, 'gridRowGap');
      L.columnGap = g(node, 'gridColumnGap');
      const colSizes = g(node, 'gridColumnSizes');
      const rowSizes = g(node, 'gridRowSizes');
      if (colSizes) L.columnSizes = JSON.parse(JSON.stringify(colSizes));
      if (rowSizes) L.rowSizes = JSON.parse(JSON.stringify(rowSizes));
    }
    o.layout = L;
  }

  const sh = g(node, 'layoutSizingHorizontal');
  const sv = g(node, 'layoutSizingVertical');
  if (sh || sv) o.sizing = [sh, sv];
  if (g(node, 'layoutPositioning') === 'ABSOLUTE') o.absolute = true;
  if (g(node, 'layoutGrow')) o.grow = g(node, 'layoutGrow');
  if (g(node, 'layoutAlign') === 'STRETCH') o.stretch = true;

  const limits = {};
  ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].forEach((p) => {
    const v = g(node, p);
    if (v !== undefined && v !== null) limits[p] = v;
  });
  if (Object.keys(limits).length) o.limits = limits;

  const cons = g(node, 'constraints');
  if (cons && (cons.horizontal !== 'MIN' || cons.vertical !== 'MIN')) o.constraints = [cons.horizontal, cons.vertical];
  if (g(node, 'clipsContent')) o.clip = true;

  const grids = g(node, 'layoutGrids');
  if (Array.isArray(grids) && grids.length) o.grids = JSON.parse(JSON.stringify(grids));
}

/**
 * Добавляет в описание заливки, обводки, скругления и эффекты
 */
async function addVisual(node, o) {
  const fills = g(node, 'fills');
  if (Array.isArray(fills) && fills.length) {
    o.fills = [];
    for (const p of fills) o.fills.push(await serPaint(p, node.name));
  } else if (fills === 'MIXED') {
    o.fills = 'MIXED';
  }
  const fillStyleId = g(node, 'fillStyleId');
  if (fillStyleId && fillStyleId !== 'MIXED') o.fillStyle = await styleName(fillStyleId);

  const strokes = g(node, 'strokes');
  if (Array.isArray(strokes) && strokes.length) {
    o.strokes = [];
    for (const p of strokes) o.strokes.push(await serPaint(p, node.name));
    const weight = g(node, 'strokeWeight');
    o.strokeWeight = weight === 'MIXED'
      ? [g(node, 'strokeTopWeight'), g(node, 'strokeRightWeight'), g(node, 'strokeBottomWeight'), g(node, 'strokeLeftWeight')]
      : weight;
    o.strokeAlign = g(node, 'strokeAlign');
    const dash = g(node, 'dashPattern');
    if (Array.isArray(dash) && dash.length) o.dash = dash.slice();
    const strokeStyleId = g(node, 'strokeStyleId');
    if (strokeStyleId && strokeStyleId !== 'MIXED') o.strokeStyle = await styleName(strokeStyleId);
  }

  const radius = g(node, 'cornerRadius');
  if (radius === 'MIXED') {
    o.radius = [g(node, 'topLeftRadius'), g(node, 'topRightRadius'), g(node, 'bottomRightRadius'), g(node, 'bottomLeftRadius')];
  } else if (radius) {
    o.radius = r(radius);
  }
  if (g(node, 'cornerSmoothing')) o.cornerSmoothing = r(node.cornerSmoothing);

  const effects = g(node, 'effects');
  if (Array.isArray(effects) && effects.length) {
    const visible = effects.filter((e) => e.visible !== false);
    if (visible.length) o.effects = visible.map(serEffect);
  }
  const effectStyleId = g(node, 'effectStyleId');
  if (effectStyleId && effectStyleId !== 'MIXED') o.effectStyle = await styleName(effectStyleId);
}

/**
 * Возвращает описание заливки/обводки; картинки сохраняет как ассеты
 */
async function serPaint(p, assetName) {
  const o = { type: p.type };
  const opacity = p.opacity === undefined ? 1 : p.opacity;
  if (p.visible === false) o.visible = false;
  if (opacity !== 1) o.opacity = r(opacity);
  if (p.blendMode && p.blendMode !== 'NORMAL') o.blendMode = p.blendMode;

  if (p.type === 'SOLID') {
    o.color = color(p.color, opacity);
  } else if (p.type.indexOf('GRADIENT') === 0) {
    o.stops = p.gradientStops.map((s) => ({ color: color(s.color, s.color.a * opacity), pos: r(s.position) }));
    o.transform = p.gradientTransform.map((row) => row.map((v) => Math.round(v * 10000) / 10000));
  } else if (p.type === 'IMAGE') {
    o.scaleMode = p.scaleMode;
    if (p.imageHash) o.src = await saveImage(p.imageHash, assetName);
    if (p.imageTransform) o.imageTransform = JSON.parse(JSON.stringify(p.imageTransform));
    if (p.scalingFactor && p.scalingFactor !== 1) o.scalingFactor = p.scalingFactor;
    if (p.rotation) o.rotation = p.rotation;
    if (p.filters) {
      const f = {};
      Object.keys(p.filters).forEach((k) => {
        if (p.filters[k]) f[k] = p.filters[k];
      });
      if (Object.keys(f).length) o.filters = f;
    }
  }
  if (p.boundVariables && Object.keys(p.boundVariables).length) o.vars = await resolveAliases(p.boundVariables);
  return o;
}

/**
 * Возвращает описание эффекта (тени, размытия)
 */
function serEffect(e) {
  const o = { type: e.type };
  if (e.color) o.color = color(e.color, e.color.a);
  if (e.offset) {
    o.x = r(e.offset.x);
    o.y = r(e.offset.y);
  }
  if (typeof e.radius === 'number') o.blur = r(e.radius);
  if (e.spread) o.spread = r(e.spread);
  if (e.blendMode && e.blendMode !== 'NORMAL') o.blendMode = e.blendMode;
  return o;
}

/**
 * Возвращает строковое значение межстрочного интервала
 */
function lineHeight(lh) {
  if (!lh || lh.unit === 'AUTO') return 'auto';
  return lh.unit === 'PIXELS' ? `${r(lh.value)}px` : `${r(lh.value)}%`;
}

/**
 * Возвращает строковое значение межбуквенного интервала (проценты переводятся в em)
 */
function letterSpacing(ls) {
  if (!ls || !ls.value) return undefined;
  return ls.unit === 'PIXELS' ? `${r(ls.value)}px` : `${Math.round(ls.value * 10) / 1000}em`;
}

/**
 * Возвращает свойства сегмента текста и регистрирует использованный шрифт
 */
async function textSegmentProps(s) {
  const o = {};
  if (s.fontName) {
    o.font = s.fontName.family;
    o.style = s.fontName.style;
  }
  if (s.fontWeight !== undefined) o.weight = s.fontWeight;
  if (s.fontSize !== undefined) o.size = r(s.fontSize);
  if (s.lineHeight) o.lineHeight = lineHeight(s.lineHeight);
  const ls = letterSpacing(s.letterSpacing);
  if (ls) o.letterSpacing = ls;
  if (s.textCase && s.textCase !== 'ORIGINAL') o.case = s.textCase;
  if (s.textDecoration && s.textDecoration !== 'NONE') o.decoration = s.textDecoration;
  if (Array.isArray(s.fills)) {
    const colors = s.fills
      .filter((p) => p.visible !== false)
      .map((p) => (p.type === 'SOLID' ? color(p.color, p.opacity === undefined ? 1 : p.opacity) : p.type));
    if (colors.length) o.color = colors.length === 1 ? colors[0] : colors;
  }
  if (s.textStyleId) o.textStyle = await styleName(s.textStyleId);
  if (s.hyperlink) o.link = s.hyperlink.type === 'URL' ? s.hyperlink.value : `node:${s.hyperlink.value}`;
  if (s.listOptions && s.listOptions.type !== 'NONE') o.list = s.listOptions.type;
  if (s.fontName) ctx.fonts.add(`${s.fontName.family} — ${s.fontName.style}${s.fontWeight ? ` (${s.fontWeight})` : ''}`);
  return o;
}

/**
 * Добавляет в описание текст и его стили (с разбивкой на сегменты, если стили смешаны)
 */
async function addText(node, o) {
  const t = {
    chars: node.characters,
    align: [node.textAlignHorizontal, node.textAlignVertical],
    autoResize: node.textAutoResize,
  };
  if (g(node, 'textTruncation') === 'ENDING') {
    t.truncate = true;
    t.maxLines = g(node, 'maxLines');
  }
  if (g(node, 'paragraphSpacing')) t.paragraphSpacing = node.paragraphSpacing;
  if (g(node, 'paragraphIndent')) t.paragraphIndent = node.paragraphIndent;
  const trim = g(node, 'leadingTrim');
  if (trim && trim !== 'NONE') t.leadingTrim = trim;

  let segments;
  try {
    segments = node.getStyledTextSegments(TEXT_SEGMENT_FIELDS);
  } catch (e) {
    segments = node.getStyledTextSegments(TEXT_SEGMENT_FIELDS_FALLBACK);
  }
  if (segments.length === 1) {
    Object.assign(t, await textSegmentProps(segments[0]));
  } else {
    t.segments = [];
    for (const s of segments) {
      const so = await textSegmentProps(s);
      so.chars = s.characters;
      t.segments.push(so);
    }
  }
  o.text = t;
}

/**
 * Добавляет в описание имя компонента и значения его свойств
 */
async function addInstance(node, o) {
  try {
    const main = await node.getMainComponentAsync();
    if (main) {
      o.component = main.name;
      if (main.parent && main.parent.type === 'COMPONENT_SET') o.componentSet = main.parent.name;
    }
  } catch (e) {
    // Компонент может быть недоступен (удалённая библиотека)
  }
  const props = g(node, 'componentProperties');
  if (props && Object.keys(props).length) {
    o.props = {};
    Object.keys(props).forEach((k) => {
      o.props[k.replace(/#[^#]*$/, '')] = props[k].value;
    });
  }
}

/**
 * Добавляет в описание имена переменных, привязанных к свойствам узла
 */
async function addVariables(node, o) {
  const bv = g(node, 'boundVariables');
  if (!bv) return;
  const keys = Object.keys(bv).filter((k) => k !== 'fills' && k !== 'strokes');
  if (!keys.length) return;
  o.vars = {};
  for (const k of keys) o.vars[k] = await resolveAliases(bv[k]);
}

/**
 * Возвращает структуру, в которой ссылки на переменные заменены их именами
 */
async function resolveAliases(v) {
  if (!v) return v;
  if (Array.isArray(v)) {
    const out = [];
    for (const item of v) out.push(await resolveAliases(item));
    return out;
  }
  if (v.type === 'VARIABLE_ALIAS') return await variableName(v.id);
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = await resolveAliases(v[k]);
    return out;
  }
  return v;
}

/**
 * Возвращает имя переменной и запоминает её значения для tokens.json
 */
async function variableName(id) {
  if (ctx.varCache.has(id)) return ctx.varCache.get(id);
  ctx.varCache.set(id, id);
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (!variable) return id;
    ctx.varCache.set(id, variable.name);
    ctx.usedVariables[variable.name] = await serVariable(variable);
    return variable.name;
  } catch (e) {
    return id;
  }
}

/**
 * Возвращает описание переменной со значениями по всем режимам
 */
async function serVariable(variable) {
  const o = { type: variable.resolvedType, values: {} };
  let collection = ctx.collectionCache.get(variable.variableCollectionId);
  if (collection === undefined) {
    collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    ctx.collectionCache.set(variable.variableCollectionId, collection);
  }
  if (collection) o.collection = collection.name;
  if (variable.description) o.description = variable.description;
  if (variable.scopes && variable.scopes.length) o.scopes = variable.scopes.slice();

  for (const modeId of Object.keys(variable.valuesByMode)) {
    const mode = collection ? collection.modes.find((m) => m.modeId === modeId) : null;
    const value = variable.valuesByMode[modeId];
    let out = value;
    if (value && value.type === 'VARIABLE_ALIAS') out = '→ ' + (await variableName(value.id));
    else if (value && typeof value === 'object' && 'r' in value) out = color(value);
    o.values[mode ? mode.name : modeId] = out;
  }
  return o;
}

/**
 * Возвращает имя стиля и запоминает его значения для tokens.json
 */
async function styleName(id) {
  if (ctx.styleCache.has(id)) return ctx.styleCache.get(id);
  ctx.styleCache.set(id, id);
  try {
    const style = await figma.getStyleByIdAsync(id);
    if (!style) return id;
    ctx.styleCache.set(id, style.name);
    ctx.usedStyles[style.name] = await serStyle(style);
    return style.name;
  } catch (e) {
    return id;
  }
}

/**
 * Возвращает значения стиля (цвет, текст, эффект, сетка)
 */
async function serStyle(style) {
  const o = { type: style.type };
  if (style.description) o.description = style.description;
  if (style.type === 'PAINT') {
    o.paints = [];
    for (const p of style.paints) o.paints.push(await serPaint(p, style.name));
  } else if (style.type === 'TEXT') {
    o.font = style.fontName.family;
    o.style = style.fontName.style;
    o.size = style.fontSize;
    o.lineHeight = lineHeight(style.lineHeight);
    const ls = letterSpacing(style.letterSpacing);
    if (ls) o.letterSpacing = ls;
    if (style.textCase && style.textCase !== 'ORIGINAL') o.case = style.textCase;
    if (style.textDecoration && style.textDecoration !== 'NONE') o.decoration = style.textDecoration;
    if (style.paragraphSpacing) o.paragraphSpacing = style.paragraphSpacing;
  } else if (style.type === 'EFFECT') {
    o.effects = style.effects.filter((e) => e.visible !== false).map(serEffect);
  } else if (style.type === 'GRID') {
    o.grids = JSON.parse(JSON.stringify(style.layoutGrids));
  }
  return o;
}

/**
 * Возвращает true, если узел — векторная группа (иконка, логотип, декоративная графика)
 */
function isVectorAsset(node) {
  if (VECTOR_TYPES.indexOf(node.type) !== -1) return true;
  if (CONTAINER_TYPES.indexOf(node.type) === -1) return false;
  const kids = visibleChildren(node);
  if (!kids.length) return false;
  // Auto layout с несколькими детьми — это раскладка, а не иконка
  const mode = g(node, 'layoutMode');
  if (mode && mode !== 'NONE' && kids.length > 1) return false;

  const state = { hasVector: false };
  return kids.every((k) => onlyShapes(k, state)) && state.hasVector;
}

/**
 * Проверяет, что поддерево состоит только из фигур без текста и картинок
 */
function onlyShapes(node, state) {
  if (node.visible === false) return true;
  if (node.type === 'TEXT') return false;
  const fills = g(node, 'fills');
  if (Array.isArray(fills) && fills.some((p) => p.type === 'IMAGE' || p.type === 'VIDEO')) return false;
  if (VECTOR_TYPES.indexOf(node.type) !== -1) {
    state.hasVector = true;
    return true;
  }
  if (SHAPE_TYPES.indexOf(node.type) !== -1) return true;
  if (CONTAINER_TYPES.indexOf(node.type) !== -1) return node.children.every((c) => onlyShapes(c, state));
  return false;
}

/**
 * Экспортирует узел в SVG (с дедупликацией по содержимому) и возвращает путь к файлу
 */
async function exportSvg(node) {
  let name = node.name;
  if (node.type === 'INSTANCE') {
    try {
      const main = await node.getMainComponentAsync();
      if (main) name = main.parent && main.parent.type === 'COMPONENT_SET' ? `${main.parent.name}-${main.name}` : main.name;
    } catch (e) {
      // Оставляем имя слоя
    }
  }
  const settings = { format: 'SVG', svgIdAttribute: false, svgOutlineText: true };
  try {
    let bytes;
    try {
      bytes = await node.exportAsync(settings);
    } catch (e) {
      // Слой обрезан clip-предком — пробуем экспортировать вынесенную копию
      bytes = await exportDetached(node, settings);
    }
    const hash = hashBytes(bytes);
    if (ctx.svgs.has(hash)) return ctx.svgs.get(hash);
    const path = assetPath('svg', name, 'svg');
    ctx.svgs.set(hash, path);
    sendFile(path, bytes);
    return path;
  } catch (e) {
    // Обычно это слои, целиком обрезанные родителем (вторые страницы каруселей и т. п.)
    ctx.svgSkipped++;
    return null;
  }
}

/**
 * Сохраняет исходник картинки из заливки и возвращает путь к файлу
 */
async function saveImage(hash, name) {
  if (ctx.images.has(hash)) return ctx.images.get(hash);
  ctx.images.set(hash, null);
  try {
    const image = figma.getImageByHash(hash);
    if (!image) return null;
    const bytes = await image.getBytesAsync();
    let ext = 'bin';
    if (bytes[0] === 0x89) ext = 'png';
    else if (bytes[0] === 0xff) ext = 'jpg';
    else if (bytes[0] === 0x47) ext = 'gif';
    else if (bytes[0] === 0x52) ext = 'webp';
    const path = assetPath('img', name, ext);
    const size = await image.getSizeAsync();
    ctx.images.set(hash, path);
    ctx.imageList.push({ path, width: size.width, height: size.height, kb: Math.round(bytes.length / 1024) });
    sendFile(path, bytes);
    return path;
  } catch (e) {
    post({ type: 'log', text: `Картинка не сохранена: «${name}» (${e.message || e})` });
    return null;
  }
}

/**
 * Экспортирует узел по настройкам экспорта, заданным дизайнером, и добавляет пути в описание
 */
async function addDesignerExports(node, o) {
  const settings = g(node, 'exportSettings');
  if (!Array.isArray(settings) || !settings.length) return;
  o.exports = [];
  for (const s of settings) {
    const ext = s.format === 'JPG' ? 'jpg' : s.format.toLowerCase();
    try {
      const bytes = await node.exportAsync(s);
      const hash = hashBytes(bytes);
      let path = ctx.exportsCache.get(hash);
      if (!path) {
        path = assetPath('export', `${node.name}${s.suffix || ''}`, ext);
        ctx.exportsCache.set(hash, path);
        sendFile(path, bytes);
      }
      o.exports.push(path);
    } catch (e) {
      post({ type: 'log', text: `Экспорт не удался: «${node.name}» ${s.format} (${e.message || e})` });
    }
  }
}

/**
 * Возвращает секции фрейма: спускается через одиночные обёртки и раскрывает обёртку,
 * занимающую большую часть высоты (например, «Frame 100» со всем контентом страницы)
 */
function findSections(root) {
  let node = root;
  let kids = visibleChildren(node);
  while (kids.length === 1 && 'children' in kids[0]) {
    node = kids[0];
    kids = visibleChildren(node);
  }
  const result = [];
  for (const kid of kids) {
    if ('children' in kid && kid.height > node.height * 0.6 && visibleChildren(kid).length > 1) {
      result.push(...findSections(kid));
    } else {
      result.push(kid);
    }
  }
  return result;
}

/**
 * Возвращает прокручиваемый контент внутри фрейма-экрана (самый высокий потомок, который выше фрейма)
 * или null, если весь контент и так виден
 */
function findScrollContent(root) {
  let best = null;
  let level = visibleChildren(root);
  for (let depth = 0; depth < 5 && level.length; depth++) {
    const next = [];
    for (const n of level) {
      if (n.height > root.height * 1.2 && n.width >= root.width * 0.8 && (!best || n.height > best.height)) best = n;
      next.push(...visibleChildren(n));
    }
    level = next;
  }
  return best;
}

/**
 * Экспортирует временную копию узла, вынесенную на холст страницы, и возвращает байты.
 * Figma обрезает экспорт по clip-предкам, копия вне их выгружается целиком
 */
async function exportDetached(node, settings) {
  let clone = null;
  try {
    clone = node.clone();
    figma.currentPage.appendChild(clone);
    clone.x = -100000;
    clone.y = -100000;
    return await clone.exportAsync(settings);
  } finally {
    if (clone && !clone.removed) clone.remove();
  }
}

/**
 * Экспортирует узел в PNG с масштабом по ширине и возвращает использованный масштаб
 */
async function exportPng(node, path, detach) {
  let scale = Math.min(PREVIEW_MAX_SCALE, PREVIEW_MAX_WIDTH / node.width);
  for (let attempt = 0; attempt < 3; attempt++) {
    const settings = { format: 'PNG', constraint: { type: 'SCALE', value: scale } };
    if (detach) {
      try {
        sendFile(path, await exportDetached(node, settings));
        return r(scale);
      } catch (e) {
        // Копию сделать нельзя (Dev Mode, слой внутри инстанса) — экспортируем как есть
      }
    }
    try {
      sendFile(path, await node.exportAsync(settings));
      return r(scale);
    } catch (e) {
      scale /= 2;
    }
  }
  post({ type: 'log', text: `PNG не экспортирован: «${node.name}»` });
  return null;
}

/**
 * Экспортирует превью всего фрейма и каждой секции, возвращает их описание для манифеста
 */
async function exportPreviews(root, rootBox, dir) {
  const previewScale = await exportPng(root, `${dir}/preview.png`);
  const result = { preview: `${dir}/preview.png`, previewScale };

  // Фрейм-экран с прокруткой: превью показывает только первый экран, выгружаем контент целиком
  const scrollContent = findScrollContent(root);
  if (scrollContent) {
    result.previewFull = `${dir}/preview-full.png`;
    result.previewFullScale = await exportPng(scrollContent, result.previewFull, true);
    result.previewFullNode = { name: scrollContent.name, id: scrollContent.id };
  }

  const sections = [];
  const names = new Set();
  let i = 0;
  for (const s of findSections(scrollContent || root)) {
    i++;
    const file = `${dir}/sections/${String(i).padStart(2, '0')}-${unique(names, slug(s.name))}.png`;
    const scale = await exportPng(s, file, Boolean(scrollContent));
    const b = s.absoluteBoundingBox;
    sections.push({
      index: i,
      name: s.name,
      id: s.id,
      file,
      scale,
      x: b ? r(b.x - rootBox.x) : null,
      y: b ? r(b.y - rootBox.y) : null,
      w: r(s.width),
      h: r(s.height),
    });
  }
  result.sections = sections;
  return result;
}

/**
 * Возвращает локальные стили и переменные файла
 */
async function collectTokens() {
  const t = { paintStyles: [], textStyles: [], effectStyles: [], gridStyles: [], variables: {} };
  const groups = [
    ['paintStyles', figma.getLocalPaintStylesAsync],
    ['textStyles', figma.getLocalTextStylesAsync],
    ['effectStyles', figma.getLocalEffectStylesAsync],
    ['gridStyles', figma.getLocalGridStylesAsync],
  ];
  for (const [key, getter] of groups) {
    try {
      const styles = await getter.call(figma);
      for (const s of styles) {
        const value = await serStyle(s);
        value.name = s.name;
        t[key].push(value);
      }
    } catch (e) {
      post({ type: 'log', text: `Не удалось прочитать ${key}: ${e.message || e}` });
    }
  }
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    for (const col of collections) {
      for (const id of col.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(id);
        if (variable) t.variables[variable.name] = await serVariable(variable);
      }
    }
  } catch (e) {
    post({ type: 'log', text: `Не удалось прочитать переменные: ${e.message || e}` });
  }
  return t;
}
