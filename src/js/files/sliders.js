import {Splide} from '@splidejs/splide';
// Только базовые стили, оформление — в SCSS блоков
import '@splidejs/splide/css/core';

// Подписи Splide для скринридеров на русском
const SPLIDE_I18N_RU = {
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
    gap: 20,
    speed: 600,
    arrows: false,
    pagination: true,
    autoplay: true,
    interval: 6000,
    pauseOnHover: true,
    i18n: SPLIDE_I18N_RU,
  }).mount();
}

/**
 * Запускает все слайдеры страницы
 */
function initSliders() {
  initHeroSlider();
}

window.addEventListener("load", function (e) {
	initSliders();
});
