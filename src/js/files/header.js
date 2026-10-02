import { Splide } from '@splidejs/splide';
import { bodyLock, bodyUnlock } from './functions.js';
import { SPLIDE_I18N_RU } from './sliders.js';

// Ширина, с которой шапка десктопная (совпадает с $bpHeader в header.scss)
const DESKTOP_QUERY = '(min-width: 1199.98px)';
// Задержка перед сменой активного пункта в меню каталога, чтобы не перескакивать при движении курсора наискосок
const HOVER_DELAY = 80;
// Длительность выезда панелей мобильного меню, мс (совпадает с transition в header.scss)
const PANEL_DURATION = 300;

//====================================================================================================
// Большое меню каталога
//====================================================================================================

/**
 * Делает активным первый пункт списка и рекурсивно — первые пункты вложенных уровней
 * @param {HTMLElement|null} list — ul.catalog-menu__list
 */
function activateFirst(list) {
  const first = list?.firstElementChild;
  if (!first) return;
  first.classList.add('is-active');
  activateFirst(first.querySelector(':scope > .catalog-menu__list'));
}

/**
 * Делает пункт каскада активным: гасит соседей с их потомками и раскрывает первые пункты его уровня
 * @param {HTMLElement} item — li.catalog-menu__item
 */
function activateItem(item) {
  if (item.classList.contains('is-active')) return;
  item.parentElement.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
  item.classList.add('is-active');
  activateFirst(item.querySelector(':scope > .catalog-menu__list'));
}

/**
 * Делает раздел активным и сбрасывает его каскад к первым пунктам
 * @param {HTMLElement} section — li.catalog-menu__section
 */
function activateSection(section) {
  if (section.classList.contains('is-active')) return;
  section.parentElement.querySelectorAll('.catalog-menu__section.is-active').forEach((el) => el.classList.remove('is-active'));
  section.classList.add('is-active');
  section.querySelectorAll('.catalog-menu__item.is-active').forEach((el) => el.classList.remove('is-active'));
  activateFirst(section.querySelector('.catalog-menu__panel > .catalog-menu__list'));
}

/**
 * Запускает вертикальные слайдеры баннеров — у каждого раздела меню каталога свой
 * (автопрокрутка включается только у видимого, см. syncPromo)
 * @param {HTMLElement} menu — .catalog-menu
 * @returns {Map<HTMLElement, Splide>} слайдеры по разделам (li.catalog-menu__section)
 */
function initPromoSliders(menu) {
  const sliders = new Map();
  menu.querySelectorAll('.catalog-menu__promo').forEach((slider) => {
    sliders.set(slider.closest('.catalog-menu__section'), createPromoSlider(slider));
  });
  return sliders;
}

/**
 * Создаёт вертикальный слайдер баннеров раздела
 * @param {HTMLElement} slider — .catalog-menu__promo
 * @returns {Splide} экземпляр слайдера
 */
function createPromoSlider(slider) {
  return new Splide(slider, {
    type: 'loop',
    direction: 'ttb',
    // Два баннера 230 + промежуток 30
    height: '30.625rem',
    perPage: 2,
    gap: '1.875rem',
    arrows: false,
    pagination: false,
    wheel: true,
    releaseWheel: true,
    autoplay: 'pause',
    interval: 5000,
    pauseOnHover: true,
    i18n: SPLIDE_I18N_RU,
    breakpoints: {
      // Узкие баннеры 280: высота 177 + промежуток 30
      1439.98: { height: '23.75rem' },
    },
  }).mount();
}

/**
 * Подключает кнопку «Каталог» и каскад подкатегорий: наведение, фокус, закрытие по Esc и клику мимо
 */
function initCatalogMenu() {
  const button = document.querySelector('[data-catalog-toggle]');
  const menu = document.querySelector('[data-catalog-menu]');
  if (!button || !menu) return;

  const promoSliders = initPromoSliders(menu);
  const firstSection = menu.querySelector('.catalog-menu__section');
  let hoverTimer = null;

  /**
   * Пересчитывает и запускает слайдер активного раздела (пока он был скрыт, размеры не считались),
   * остальные ставит на паузу
   */
  const syncPromo = () => {
    const open = menu.classList.contains('is-open');
    promoSliders.forEach((slider, section) => {
      if (open && section.classList.contains('is-active')) {
        slider.refresh();
        slider.Components.Autoplay.play();
      } else {
        slider.Components.Autoplay.pause();
      }
    });
  };

  /**
   * Делает раздел активным и переключает слайдеры баннеров
   * @param {HTMLElement} section — li.catalog-menu__section
   */
  const selectSection = (section) => {
    if (section.classList.contains('is-active')) return;
    activateSection(section);
    syncPromo();
  };

  /**
   * Открывает или закрывает меню
   * @param {boolean} open — нужное состояние
   */
  const setOpen = (open) => {
    // Повторный вызов с тем же состоянием не должен снять чужую блокировку скролла
    if (menu.classList.contains('is-open') === open) return;

    menu.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('catalog-open', open);

    if (open) {
      bodyLock(0);
      menu.scrollTop = 0;
      if (firstSection) {
        firstSection.classList.remove('is-active');
        activateSection(firstSection);
      }
    } else {
      bodyUnlock(0);
    }
    syncPromo();
  };

  button.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));

  /**
   * Переключает раздел или пункт каскада под курсором или фокусом
   * @param {Event} e — mouseover или focusin
   * @param {number} delay — задержка, мс
   */
  const handleTarget = (e, delay) => {
    const item = e.target.closest('.catalog-menu__item');
    const section = e.target.closest('.catalog-menu__section-link')?.parentElement;
    if (!item && !section) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => (item ? activateItem(item) : selectSection(section)), delay);
  };

  menu.addEventListener('mouseover', (e) => handleTarget(e, HOVER_DELAY));
  menu.addEventListener('focusin', (e) => handleTarget(e, 0));

  // Клик по пустому месту меню или вне шапки закрывает его; клики в попапе, открытом из меню, не считаются
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('is-open')) return;
    const inside = e.target.closest('.catalog-menu__sidebar, .catalog-menu__panel, .catalog-menu__promo, [data-catalog-toggle], .popup');
    if (!inside) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    // Esc при открытом поверх меню попапе закрывает только попап
    if (document.documentElement.classList.contains('popup-show')) return;
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      setOpen(false);
      button.focus();
    }
  });

  // На мобильной ширине меню каталога нет — закрываем, чтобы не осталось открытым после поворота экрана
  window.matchMedia(DESKTOP_QUERY).addEventListener('change', (e) => {
    if (!e.matches) setOpen(false);
  });
}

//====================================================================================================
// Мобильное меню
//====================================================================================================

/**
 * Подключает мобильное меню: открытие, закрытие и подменю, собранные из разметки десктопных меню
 */
function initMobileMenu() {
  const root = document.querySelector('[data-mobile-menu]');
  if (!root) return;

  const drawer = root.querySelector('.mobile-menu__drawer');
  const rootPanel = root.querySelector('[data-menu-root]');
  // Открытые подменю, последнее — верхнее
  const stack = [];
  let lastOpener = null;

  /**
   * Создаёт панель подменю по вложенному списку
   * @param {string} title — название раздела для строки «назад»
   * @param {string} href — адрес страницы раздела
   * @param {HTMLElement} source — ul с пунктами (li > a и, возможно, li > ul)
   * @returns {HTMLElement} панель
   */
  const buildPanel = (title, href, source) => {
    const panel = document.createElement('div');
    panel.className = 'mobile-menu__panel mobile-menu__panel--sub';
    panel.innerHTML = `
      <div class="mobile-menu__top mobile-menu__top--sub">
        <button type="button" class="mobile-menu__close" data-menu-close aria-label="Закрыть меню"></button>
        <a href="${href}" class="mobile-menu__page-link">Перейти на страницу</a>
      </div>
      <button type="button" class="mobile-menu__link mobile-menu__link--back" data-menu-back></button>
      <ul class="mobile-menu__list"></ul>`;
    panel.querySelector('[data-menu-back]').textContent = title;

    const list = panel.querySelector('ul');
    source.querySelectorAll(':scope > li').forEach((li) => {
      const link = li.querySelector(':scope > a');
      if (!link) return;
      const nested = li.querySelector(':scope > ul');
      const item = document.createElement('li');
      const a = document.createElement('a');
      a.href = link.getAttribute('href');
      a.textContent = link.textContent.trim();
      a.className = nested ? 'mobile-menu__link' : 'mobile-menu__link mobile-menu__link--leaf';
      if (nested) a.submenuSource = nested;
      item.append(a);
      list.append(item);
    });

    return panel;
  };

  /**
   * Открывает подменю поверх текущей панели
   * @param {string} title — название раздела
   * @param {string} href — адрес страницы раздела
   * @param {HTMLElement} source — список пунктов
   */
  const openSubmenu = (title, href, source) => {
    const panel = buildPanel(title, href, source);
    drawer.append(panel);
    stack.push(panel);
    // Два кадра, чтобы стартовое положение успело примениться и сработал transition
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('is-active')));
    panel.querySelector('[data-menu-back]').focus({ preventScroll: true });
  };

  /**
   * Закрывает верхнее подменю
   */
  const goBack = () => {
    const panel = stack.pop();
    if (!panel) return;
    panel.classList.remove('is-active');
    setTimeout(() => panel.remove(), PANEL_DURATION);
  };

  /**
   * Открывает меню
   * @param {HTMLElement} opener — элемент, по которому открыли (вернём на него фокус)
   */
  const open = (opener) => {
    if (root.classList.contains('is-open')) return;
    lastOpener = opener;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    bodyLock(0);
    rootPanel.querySelector('.mobile-menu__close')?.focus({ preventScroll: true });
  };

  /**
   * Закрывает меню и после анимации убирает подменю
   */
  const close = () => {
    if (!root.classList.contains('is-open')) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    bodyUnlock(0);
    lastOpener?.focus({ preventScroll: true });
    setTimeout(() => {
      stack.splice(0).forEach((panel) => panel.remove());
      rootPanel.scrollTop = 0;
    }, PANEL_DURATION);
  };

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-menu-open]');
    if (opener) {
      e.preventDefault();
      open(opener);
      return;
    }
    if (!root.contains(e.target)) return;

    if (e.target.closest('[data-menu-close]')) {
      close();
      return;
    }
    if (e.target.closest('[data-menu-back]')) {
      goBack();
      return;
    }

    const link = e.target.closest('.mobile-menu__link');
    if (!link) return;
    const source = link.submenuSource ?? (link.dataset.submenu ? document.querySelector(link.dataset.submenu) : null);
    if (source) {
      e.preventDefault();
      openSubmenu(link.textContent.trim(), link.getAttribute('href'), source);
    }
  });

  document.addEventListener('keydown', (e) => {
    // Esc при открытом поверх меню попапе закрывает только попап
    if (e.key !== 'Escape' || document.documentElement.classList.contains('popup-show')) return;
    if (stack.length) goBack();
    else close();
  });

  window.matchMedia(DESKTOP_QUERY).addEventListener('change', (e) => {
    if (e.matches) close();
  });
}

initCatalogMenu();
initMobileMenu();
