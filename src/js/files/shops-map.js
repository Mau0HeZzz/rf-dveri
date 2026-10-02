/**
 * @fileOverview Карта магазинов на Яндекс Картах (API v3): метки с балунами.
 * Данные магазинов берутся из <script type="application/json" id="shops-data">, координаты в формате [долгота, широта]
 */

// Отступы карты от меток при подгонке под bounds, px: [сверху, справа, снизу, слева]
const BOUNDS_MARGIN = [60, 40, 30, 40];
// Отступы при открытом балуне: метки опускаются вниз, чтобы над ними поместился балун
const BALLOON_MARGIN = [280, 40, 30, 40];
// То же для раскрытой маленькой карты: по бокам и снизу места меньше
const BALLOON_MARGIN_SMALL = [280, 20, 20, 20];
// Высота карты, ниже которой балун не помещается и карта раскрывается, px
const SMALL_MAP_HEIGHT = 400;
// Длительность анимации перемещения карты, мс
const MOVE_DURATION = 500;

/**
 * Возвращает границы карты [[лево, верх], [право, низ]] по списку координат
 */
function getBounds(points) {
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return [
    [Math.min(...lons), Math.max(...lats)],
    [Math.max(...lons), Math.min(...lats)],
  ];
}

/**
 * Создаёт элемент с заданным классом и текстом
 */
function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

/**
 * Возвращает DOM-элемент метки с иконкой и балуном
 */
function createMarkerElement(shop, shifted) {
  const marker = createEl('div', `shops-marker${shifted ? ' shops-marker--shifted' : ''}`);

  const icon = createEl('button', 'shops-marker__icon');
  icon.type = 'button';
  icon.setAttribute('aria-label', shop.name);
  const img = createEl('img');
  img.src = shop.icon;
  img.alt = '';
  icon.append(img);

  const balloon = createEl('div', 'shops-balloon');
  const close = createEl('button', 'shops-balloon__close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрыть');
  balloon.append(close, createEl('div', 'shops-balloon__name', shop.name), createEl('div', '', shop.address));

  (shop.phones || []).forEach((phone) => {
    const link = createEl('a', '', phone);
    link.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
    balloon.append(link);
  });

  const hours = createEl('div');
  hours.append(createEl('strong', '', 'Режим работы:'), ` ${shop.hours}`);
  balloon.append(hours);

  if (shop.email) {
    const mail = createEl('a', '', shop.email);
    mail.href = `mailto:${shop.email}`;
    balloon.append(mail);
  }

  // Не даём карте начинать перетаскивание при работе с балуном
  balloon.addEventListener('pointerdown', (e) => e.stopPropagation());

  marker.append(icon, balloon);
  return marker;
}

/**
 * Запускает карту магазинов с метками и балунами
 */
async function initShopsMap() {
  const container = document.getElementById('shops-map');
  const dataEl = document.getElementById('shops-data');
  if (!container || !dataEl || typeof ymaps3 === 'undefined') return;

  await ymaps3.ready;
  const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapControls } = ymaps3;
  const shops = JSON.parse(dataEl.textContent);
  const bounds = getBounds(shops.map((s) => s.coords));

  const map = new YMap(container, {
    location: { bounds },
    margin: BOUNDS_MARGIN,
    // Без зума колесом, чтобы карта не перехватывала прокрутку страницы
    behaviors: ['drag', 'pinchZoom', 'dblClick'],
  });
  map.addChild(new YMapDefaultSchemeLayer({}));
  map.addChild(new YMapDefaultFeaturesLayer({}));

  /**
   * Подгоняет карту под все метки с текущими отступами
   */
  const fitBounds = (duration = 0) => map.setLocation({ bounds, duration });

  // Размер контейнера меняется (ресайз окна, раскрытие под балун) — заново подгоняем под метки
  new ResizeObserver(() => fitBounds()).observe(container);

  // Кнопки зума: пакет контролов подгружается отдельно, без него карта работает
  try {
    const { YMapZoomControl } = await ymaps3.import('@yandex/ymaps3-controls@0.0.1');
    map.addChild(new YMapControls({ position: 'left' }).addChild(new YMapZoomControl({})));
  } catch (e) {
    // Контролы не обязательны
  }

  const markers = new Map();
  const usedCoords = new Set();
  let balloonOpen = false;

  /**
   * Закрывает все балуны, кроме переданной метки; если закрыты все — возвращает карте обычный вид
   */
  const closeAll = (except) => {
    markers.forEach(({ el }) => {
      if (el !== except) el.classList.remove('is-open');
    });
    if (except || !balloonOpen) return;
    balloonOpen = false;
    container.classList.remove('is-balloon-open');
    map.update({ margin: BOUNDS_MARGIN });
    // Свёрнутую карту подгонит ResizeObserver после смены размера
    if (container.classList.contains('is-expanded')) container.classList.remove('is-expanded');
    else fitBounds(MOVE_DURATION);
  };

  /**
   * Открывает балун магазина: метки опускаются через отступ bounds, маленькая карта раскрывается
   */
  const openShop = (item) => {
    closeAll(item.el);
    item.el.classList.add('is-open');
    if (balloonOpen) return;
    balloonOpen = true;
    container.classList.add('is-balloon-open');
    const small = container.clientHeight < SMALL_MAP_HEIGHT;
    map.update({ margin: small ? BALLOON_MARGIN_SMALL : BALLOON_MARGIN });
    // Раскрытую карту подгонит ResizeObserver после смены размера
    if (small) container.classList.add('is-expanded');
    else fitBounds(MOVE_DURATION);
  };

  shops.forEach((shop) => {
    const key = shop.coords.join();
    const el = createMarkerElement(shop, usedCoords.has(key));
    usedCoords.add(key);
    const item = { el, shop };

    el.querySelector('.shops-marker__icon').addEventListener('click', () => {
      if (el.classList.contains('is-open')) closeAll();
      else openShop(item);
    });
    el.querySelector('.shops-balloon__close').addEventListener('click', () => closeAll());

    map.addChild(new YMapMarker({ coordinates: shop.coords }, el));
    markers.set(shop.id, item);
  });

  // Клик мимо меток закрывает балуны
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.shops-marker')) closeAll();
  });
}

initShopsMap();
