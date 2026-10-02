
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

// Запуск
const galleries = document.querySelectorAll('[data-gallery]');
if (galleries.length) {
	let galleyItems = [];
	galleries.forEach(gallery => {
		galleyItems.push({
			gallery,
			galleryClass: lightGallery(gallery, {
				plugins: [lgVideo],
				licenseKey: '7EC452A9-0CFD441C-BD984C7C-17C8456E',
				speed: 500,
				// Если элементы помечены [data-gallery-item] (например, внутри слайдера), берём только их
				selector: gallery.querySelector('[data-gallery-item]') ? '[data-gallery-item]' : '',
				// Видео стартует сразу при открытии
				autoplayFirstVideo: true,
			})
		})
	});
	// Добавляем в объект модулей
	mhzModules.gallery = galleyItems;
}





