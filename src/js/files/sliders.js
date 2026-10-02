import {Splide} from '@splidejs/splide';
// Только базовые стили, оформление — в SCSS блоков
import '@splidejs/splide/css/core';

// Подписи Splide для скринридеров на русском
export const SPLIDE_I18N_RU = {
  prev: 'Предыдущий слайд',
  next: 'Следующий слайд',
  first: 'К первому слайду',
  last: 'К последнему слайду',
  slideX: 'К слайду %s',
  pageX: 'К странице %s',
  play: 'Запустить автопрокрутку',
  pause: 'Остановить автопрокрутку',
  carousel: 'карусель',
  select: 'Выберите слайд',
  slide: 'слайд',
  slideLabel: '%s из %s',
};

/**
 * Запускает слайдер акций в hero-блоке главной
 */
function initHeroSlider() {
  const slider = document.querySelector('.hero__slider');
  if (!slider) return;

  new Splide(slider, {
    type: 'loop',
    perPage: 1,
    gap: '1.25rem',
    speed: 600,
    arrows: false,
    pagination: true,
    autoplay: true,
    interval: 6000,
    pauseOnHover: true,
    i18n: SPLIDE_I18N_RU,
  }).mount();
}

// Классы пагинации-полосок для слайдеров товаров
const PRODUCT_PAGINATION_CLASSES = {
  pagination: 'splide__pagination slider-pagination',
  page: 'splide__pagination__page slider-pagination__page',
};

/**
 * Запускает слайдер «Хиты продаж»: 6 карточек на десктопе, по 3 на 520–768 и по 2 на телефонах
 */
function initHitsSlider() {
  const slider = document.querySelector('.hits__slider');
  if (!slider) return;

  new Splide(slider, {
    type: 'slide',
    perPage: 6,
    gap: '1.25rem',
    padding: '0.75rem',
    arrows: false,
    pagination: true,
    classes: PRODUCT_PAGINATION_CLASSES,
    i18n: SPLIDE_I18N_RU,
    breakpoints: {
      1439.98: { perPage: 5 },
      1199.98: { perPage: 4 },
      991.98: { perPage: 3 },
      767.98: { perPage: 3, gap: '0.75rem', padding: 0 },
      519.98: { perPage: 2 },
    },
  }).mount();
}

/**
 * Запускает слайдер «Новинки»: 8 карточек на десктопе, по 3 на 520–768 и по 2 на телефонах
 */
function initNoveltiesSlider() {
  const slider = document.querySelector('.novelties__slider');
  if (!slider) return;

  new Splide(slider, {
    type: 'slide',
    perPage: 8,
    gap: '1.25rem',
    padding: '0.75rem',
    arrows: false,
    pagination: true,
    classes: PRODUCT_PAGINATION_CLASSES,
    i18n: SPLIDE_I18N_RU,
    breakpoints: {
      1599.98: { perPage: 7 },
      1439.98: { perPage: 6 },
      1199.98: { perPage: 5 },
      991.98: { perPage: 4 },
      767.98: { perPage: 3, gap: '0.75rem', padding: 0 },
      519.98: { perPage: 2 },
    },
  }).mount();
}

/**
 * Запускает слайдер «Скидки и акции»: 3 карточки на десктопе, 2 на планшете, 1 на телефонах
 */
function initPromosSlider() {
  const slider = document.querySelector('.promos__slider');
  if (!slider) return;

  new Splide(slider, {
    type: 'slide',
    perPage: 3,
    gap: '1.25rem',
    arrows: false,
    pagination: true,
    classes: PRODUCT_PAGINATION_CLASSES,
    i18n: SPLIDE_I18N_RU,
    breakpoints: {
      991.98: { perPage: 2 },
      767.98: { perPage: 2, gap: '0.75rem' },
      519.98: { perPage: 1 },
    },
  }).mount();
}

/**
 * Запускает слайдер «Наш TV»: 4 видео на десктопе, дальше 3, 2 и 1
 */
function initTvSlider() {
  const slider = document.querySelector('.tv__slider');
  if (!slider) return;

  new Splide(slider, {
    // Без клонов (не loop), чтобы lightGallery не видел дубли видео
    type: 'slide',
    perPage: 4,
    gap: '1.25rem',
    arrows: false,
    pagination: true,
    classes: PRODUCT_PAGINATION_CLASSES,
    i18n: SPLIDE_I18N_RU,
    breakpoints: {
      1199.98: { perPage: 3 },
      991.98: { perPage: 2 },
      767.98: { perPage: 2, gap: '0.75rem' },
      519.98: { perPage: 1 },
    },
  }).mount();
}

/**
 * Запускает слайдер «Производители дверей»: слайд — колонка из 3 карточек, 6 колонок на десктопе
 */
function initMakersSlider() {
  const slider = document.querySelector('.makers__slider');
  if (!slider) return;

  new Splide(slider, {
    type: 'slide',
    perPage: 6,
    gap: '1.25rem',
    padding: '0.75rem',
    arrows: false,
    pagination: true,
    classes: PRODUCT_PAGINATION_CLASSES,
    i18n: SPLIDE_I18N_RU,
    breakpoints: {
      1439.98: { perPage: 5 },
      1199.98: { perPage: 4 },
      991.98: { perPage: 3 },
      767.98: { perPage: 3, gap: '0.75rem' },
      519.98: { perPage: 2 },
    },
  }).mount();
}

/**
 * Запускает все слайдеры страницы
 */
function initSliders() {
  initHeroSlider();
  initHitsSlider();
  initNoveltiesSlider();
  initPromosSlider();
  initTvSlider();
  initMakersSlider();
}

window.addEventListener("load", function (e) {
	initSliders();
});
