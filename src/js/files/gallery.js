
/*
Документация по работе в шаблоне: https://www.lightgalleryjs.com/docs/
Документация плагина: https://www.lightgalleryjs.com/docs/
Сниппет(HTML):
*/

// Подключение функционала "Чертоги Фрилансера"
import { isMobile, FLS } from "./functions.js";
// Подключение списка активных модулей
import { mhzModules } from "./modules.js";

// Подключение базового набора функционала
import lightGallery from 'lightgallery';

// Плагины
// lgZoom, lgAutoplay, lgComment, lgFullscreen, lgHash, lgPager, lgRotate, lgShare, lgThumbnail, lgVideo, lgMediumZoom
// import lgThumbnail от 'lightgallery/plugins/thumbnail/lg-thumbnail.min.js'
//import lgZoom from 'lightgallery/plugins/zoom/lg-zoom.min.js'
import lgVideo from 'lightgallery/plugins/video';

// Стили проекта: ядро + видео, все фоны белые
import '../../scss/libs/gallery/lightgallery-white.scss';

// Базовые стили
// import '@scss/libs/gallery/lightgallery.scss';
// Стили дополнений
// import '@scss/libs/gallery/lg-thumbnail.scss';
// import '@scss/libs/gallery/lg-video.scss';
// import '@scss/libs/gallery/lg-autoplay.scss';
// import '@scss/libs/gallery/lg-zoom.scss';
// import '@scss/libs/gallery/lg-pager.scss';
// import '@scss/libs/gallery/lg-fullscreen.scss';
// import '@scss/libs/gallery/lg-share.scss';
// import '@scss/libs/gallery/lg-comments.scss';s
// import '@scss/libs/gallery/lg-rotate.scss';
// import '@scss/libs/gallery/lg-medium-zoom.scss';
// import '@scss/libs/gallery/lg-relative-caption.scss';

// Все стили
// import '@scss/libs/gallery/lightgallery-bundle.scss';

// Ссылка Rutube: «поделиться» (rutube.ru/video/ID/) или embed (rutube.ru/play/embed/ID/), ID — в группе 1
const RUTUBE_LINK = /^https?:\/\/(?:www\.)?rutube\.ru\/(?:video|play\/embed)\/([\w-]+)\/?(\?.*)?$/i;

/**
 * Переводит ссылки Rutube в элементах галереи в embed-адрес и включает для них режим iframe:
 * плагин видео lightGallery Rutube не знает и без этого бесконечно «грузит» ссылку как картинку
 * @param {HTMLElement} gallery — контейнер с data-gallery
 */
function prepareRutubeItems(gallery) {
	gallery.querySelectorAll('[data-src*="rutube.ru"]').forEach((item) => {
		const match = item.dataset.src.match(RUTUBE_LINK);
		if (!match) return;
		// Параметры ссылки (например, ?p= у закрытых видео) сохраняем
		item.dataset.src = `https://rutube.ru/play/embed/${match[1]}/${match[2] ?? ''}`;
		item.dataset.iframe = 'true';
	});
}

// Разрешения для iframe-видео: lightGallery собирает iframe строкой и атрибут allow не ставит
const IFRAME_ALLOW = 'autoplay; fullscreen; clipboard-write';

/**
 * Добавляет iframe слайда атрибут allow и перезапускает его загрузку:
 * разрешения применяются только к загрузке, начатой после их установки
 * @param {HTMLElement} slide — .lg-item, в который lightGallery только что вставил содержимое
 */
function allowIframeAutoplay(slide) {
	const iframe = slide?.querySelector('iframe.lg-object');
	if (!iframe || iframe.allow === IFRAME_ALLOW) return;
	iframe.allow = IFRAME_ALLOW;
	iframe.src = iframe.src;
}

// Запуск
const galleries = document.querySelectorAll('[data-gallery]');
if (galleries.length) {
	let galleyItems = [];
	galleries.forEach(gallery => {
		prepareRutubeItems(gallery);
		const galleryClass = lightGallery(gallery, {
			plugins: [lgVideo],
			licenseKey: '7EC452A9-0CFD441C-BD984C7C-17C8456E',
			speed: 500,
			// Если элементы помечены [data-gallery-item] (например, внутри слайдера), берём только их
			selector: gallery.querySelector('[data-gallery-item]') ? '[data-gallery-item]' : '',
			// Видео стартует сразу при открытии
			autoplayFirstVideo: true,
			// Iframe (Rutube) как обычное видео: 16:9 (пропорции — в lightgallery-white.scss), вписан в экран по высоте
			iframeWidth: '100%',
			iframeHeight: 'auto',
			iframeMaxWidth: 'calc((100dvh - 9rem) * 16 / 9)',
			iframeMaxHeight: '100%',
		});
		// Событие срабатывает сразу после вставки содержимого слайда, iframe уже в DOM
		gallery.addEventListener('lgAfterAppendSlide', (e) => {
			allowIframeAutoplay(galleryClass.getSlideItem(e.detail.index).get());
		});
		galleyItems.push({ gallery, galleryClass });
	});
	// Добавляем в объект модулей
	mhzModules.gallery = galleyItems;
}
