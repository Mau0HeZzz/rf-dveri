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
 * Запускает слайдеры рядов карточек («Хиты продаж», «Распродажа»): на телефонах по 2 карточки,
 * с 520 — по 3; с 768 слайдер уничтожается и ряд становится сеткой по 6 (см. .product-rows)
 */
function initProductRows() {
  document.querySelectorAll('.product-rows__row').forEach((row) => {
    new Splide(row, {
      mediaQuery: 'min',
      type: 'slide',
      perPage: 2,
      gap: '0.75rem',
      arrows: false,
      pagination: true,
      classes: PRODUCT_PAGINATION_CLASSES,
      i18n: SPLIDE_I18N_RU,
      breakpoints: {
        520: { perPage: 3 },
        768: { destroy: true },
      },
    }).mount();
  });
}

/**
 * Запускает слайдер «Скидки и акции» на телефонах: 1 карточка, с 520 — 2; с 768 слайдер уничтожается
 * и карточки встают сеткой по 4 (см. .promos__slider)
 */
function initPromosSlider() {
  const slider = document.querySelector('.promos__slider');
  if (!slider) return;

  new Splide(slider, {
    mediaQuery: 'min',
    type: 'slide',
    perPage: 1,
    gap: '0.75rem',
    arrows: false,
    pagination: true,
    classes: PRODUCT_PAGINATION_CLASSES,
    i18n: SPLIDE_I18N_RU,
    breakpoints: {
      520: { perPage: 2 },
      768: { destroy: true },
    },
  }).mount();
}

/**
 * Запускает слайдер «Наш TV»: 4 видео вплоть до 768, на телефонах 2, ниже 520 — 1
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
      767.98: { perPage: 2, gap: '0.75rem' },
      519.98: { perPage: 1 },
    },
  }).mount();
}

/**
 * Запускает слайдер «Производители дверей»: слайд — колонка из 3 карточек, 6 колонок вплоть до 768,
 * на телефонах 3, ниже 520 — 2
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
      767.98: { perPage: 3, gap: '0.75rem' },
      519.98: { perPage: 2 },
    },
  }).mount();
}

/**
 * Запускает слайдер «Отзывы покупателей»: 4 карточки вплоть до 768, на телефонах 2, ниже 520 — 1
 */
function initReviewsSlider() {
  const slider = document.querySelector('.reviews__slider');
  if (!slider) return;

  new Splide(slider, {
    type: 'slide',
    perPage: 4,
    gap: '1.25rem',
    arrows: false,
    pagination: true,
    classes: PRODUCT_PAGINATION_CLASSES,
    i18n: SPLIDE_I18N_RU,
    breakpoints: {
      767.98: { perPage: 2, gap: '0.75rem' },
      519.98: { perPage: 1 },
    },
  }).mount();
}

/**
 * Запускает все слайдеры страницы
 */
function initSliders() {
  initHeroSlider();
  initProductRows();
  initPromosSlider();
  initTvSlider();
  initReviewsSlider();
  initMakersSlider();
}

window.addEventListener("load", function (e) {
	initSliders();
});
