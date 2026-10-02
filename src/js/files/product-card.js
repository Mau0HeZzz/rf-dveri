/**
 * Переключает фото в карточках товара по положению курсора над галереей
 */
function initCardGalleries() {
  document.querySelectorAll('[data-card-gallery]').forEach((gallery) => {
    const card = gallery.closest('.product-card');
    const images = gallery.querySelectorAll('.product-card__image');
    const dots = card.querySelectorAll('.product-card__dot');
    if (images.length < 2) return;

    let current = 0;
    const show = (index) => {
      if (index === current) return;
      images[current].classList.remove('is-active');
      dots[current]?.classList.remove('is-active');
      images[index].classList.add('is-active');
      dots[index]?.classList.add('is-active');
      current = index;
    };

    // Слушаем карточку: поверх галереи лежит ссылка на весь блок
    card.addEventListener('mousemove', (e) => {
      const rect = gallery.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      const index = Math.floor(((e.clientX - rect.left) / rect.width) * images.length);
      show(Math.min(images.length - 1, Math.max(0, index)));
    });
    card.addEventListener('mouseleave', () => show(0));
  });
}

/**
 * Переключает состояние кнопок «В избранное» в карточках товара
 */
function initFavButtons() {
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.product-card__fav');
    if (!button) return;
    const pressed = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!pressed));
  });
}

initCardGalleries();
initFavButtons();
