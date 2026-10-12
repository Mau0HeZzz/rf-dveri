// Задержка после ввода перед запросом подсказок, мс
const INPUT_DELAY = 300;
// Минимальная длина запроса, если у формы нет data-hints-min-length
const DEFAULT_MIN_LENGTH = 3;
// Группы ответа API: ключ в JSON и подпись под подсказкой (категории — первыми)
const HINT_GROUPS = [
  { key: 'hintsCategory', note: 'Категория' },
  { key: 'hintsOften', note: 'Популярный запрос' },
];

/**
 * Собирает подсказки из ответа API в плоский список
 * @param {object} data — ответ getSearchHints
 * @returns {{name: string, link: string, note: string}[]} подсказки
 */
function parseHints(data) {
  return HINT_GROUPS.flatMap(({ key, note }) =>
    Object.values(data?.[key]?.result ?? {})
      .filter((hint) => hint?.name && hint?.link)
      .map((hint) => ({ name: hint.name, link: hint.link, note })),
  );
}

/**
 * Подключает подсказки к форме поиска: запрос к API из data-hints-link, отрисовка и управление с клавиатуры
 * @param {HTMLFormElement} form — форма с data-search-hints
 */
function initSearchHints(form) {
  const input = form.querySelector('input[type="search"]');
  const box = form.querySelector('.search-hints');
  const linkTemplate = form.dataset.hintsLink;
  if (!input || !box || !linkTemplate) return;

  const minLength = Number(form.dataset.hintsMinLength) || DEFAULT_MIN_LENGTH;
  let timer = null;
  let controller = null;
  let activeIndex = -1;

  /**
   * Возвращает ссылки подсказок вместе с «Показать все результаты»
   * @returns {HTMLAnchorElement[]} ссылки по порядку
   */
  const getOptions = () => [...box.querySelectorAll('a')];

  /**
   * Подсвечивает подсказку по номеру (-1 — ни одной)
   * @param {number} index — номер в getOptions()
   */
  const setActive = (index) => {
    const options = getOptions();
    activeIndex = index;
    options.forEach((option, i) => option.classList.toggle('is-active', i === index));
    if (options[index]) input.setAttribute('aria-activedescendant', options[index].id);
    else input.removeAttribute('aria-activedescendant');
  };

  /**
   * Показывает или прячет список
   * @param {boolean} open — нужное состояние
   */
  const setOpen = (open) => {
    box.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (!open) setActive(-1);
  };

  /**
   * Отрисовывает подсказки и ссылку на все результаты
   * @param {{name: string, link: string, note: string}[]} hints — подсказки
   * @param {string} query — введённый текст
   */
  const render = (hints, query) => {
    box.replaceChildren();
    if (!hints.length) {
      setOpen(false);
      return;
    }

    const title = document.createElement('p');
    title.className = 'search-hints__title';
    title.textContent = 'Предложения';
    box.append(title);

    hints.forEach((hint, i) => {
      const item = document.createElement('a');
      item.className = 'search-hints__item';
      item.id = `search-hint-${i}`;
      item.href = hint.link;
      item.setAttribute('role', 'option');
      item.innerHTML = '<span class="search-hints__text"><span></span><span class="search-hints__note"></span></span>';
      const [name, note] = item.querySelectorAll('.search-hints__text > span');
      name.textContent = hint.name;
      note.textContent = hint.note;
      box.append(item);
    });

    const all = document.createElement('a');
    all.className = 'search-hints__all';
    all.id = 'search-hint-all';
    all.href = `${form.getAttribute('action')}?${new URLSearchParams({ [input.name]: query })}`;
    all.setAttribute('role', 'option');
    all.textContent = 'Показать все результаты';
    box.append(all);

    setOpen(true);
  };

  /**
   * Запрашивает подсказки для текущего текста поля
   */
  const request = async () => {
    const query = input.value.trim();
    controller?.abort();
    if (query.length < minLength) {
      setOpen(false);
      return;
    }

    controller = new AbortController();
    try {
      const url = linkTemplate.replace('{query}', encodeURIComponent(query));
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(parseHints(await response.json()), query);
    } catch (error) {
      if (error.name !== 'AbortError') setOpen(false);
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(request, INPUT_DELAY);
  });

  input.addEventListener('focus', () => {
    if (box.childElementCount) setOpen(true);
  });

  input.addEventListener('keydown', (e) => {
    const options = getOptions();
    if (box.hidden || !options.length) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + step + options.length) % options.length);
    } else if (e.key === 'Enter' && options[activeIndex]) {
      e.preventDefault();
      options[activeIndex].click();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  });

  box.addEventListener('mousemove', (e) => {
    const option = e.target.closest('a');
    if (option) setActive(getOptions().indexOf(option));
  });

  // Клик вне формы закрывает подсказки
  document.addEventListener('click', (e) => {
    if (!form.contains(e.target)) setOpen(false);
  });
}

document.querySelectorAll('form[data-search-hints]').forEach(initSearchHints);
