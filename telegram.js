document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app-root');

  // Сообщаем Telegram, что мини‑приложение готово (если запущено в Telegram)
  if (window.Telegram && window.Telegram.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    } catch (e) {
      console.warn('Telegram WebApp init error:', e);
    }
  }

  const LEVELS = [
    {
      id: 'easy',
      title: 'Лёгкий',
      subtitle: 'Автосимуляция турнира',
      description: 'Один клик — и мы сами просчитаем весь турнир: от групп до финала.',
    },
    {
      id: 'normal',
      title: 'Нормальный',
      subtitle: 'Ручной выбор победителей',
      description: 'Выбирай, кто проходит дальше в плей‑офф, без ввода счёта.',
    },
    {
      id: 'hard',
      title: 'Сложный',
      subtitle: 'Полный контроль',
      description: 'Стыки, группы и плей‑офф со счётом и таблицами — как в большой версии.',
    },
    {
      id: 'hardcore',
      title: 'Хардкор',
      subtitle: 'В разработке',
      description: 'Особый режим для самых упоротых. Появится позже.',
      disabled: true,
    },
  ];

  function renderLevelStub(level) {
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tg-screen tg-level-screen';

    const back = document.createElement('button');
    back.className = 'tg-back-button';
    back.textContent = '← Назад к выбору уровня';
    back.addEventListener('click', renderStartScreen);

    const title = document.createElement('h1');
    title.className = 'tg-title';
    title.textContent = `Режим: ${level.title}`;

    const subtitle = document.createElement('p');
    subtitle.className = 'tg-subtitle';
    subtitle.textContent = level.subtitle;

    const hint = document.createElement('p');
    hint.className = 'tg-hint';
    hint.textContent =
      'Пока здесь только заглушка, дальше подключим полноценный симулятор для этого режима.';

    container.appendChild(back);
    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(hint);

    root.appendChild(container);
  }

  function renderStartScreen() {
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tg-screen tg-start-screen';

    const header = document.createElement('div');
    header.className = 'tg-header';

    const title = document.createElement('h1');
    title.className = 'tg-title';
    title.textContent = 'Симулятор ЧМ‑2026';

    const subtitle = document.createElement('p');
    subtitle.className = 'tg-subtitle';
    subtitle.textContent = 'Выбери уровень сложности, с которого хочешь начать.';

    header.appendChild(title);
    header.appendChild(subtitle);

    const grid = document.createElement('div');
    grid.className = 'tg-level-grid';

    LEVELS.forEach((level) => {
      const card = document.createElement('button');
      card.className = 'tg-level-card';
      if (level.disabled) {
        card.classList.add('tg-level-card-disabled');
      }

      const lvlTitle = document.createElement('div');
      lvlTitle.className = 'tg-level-title';
      lvlTitle.textContent = level.title;

      const lvlSubtitle = document.createElement('div');
      lvlSubtitle.className = 'tg-level-subtitle';
      lvlSubtitle.textContent = level.subtitle;

      const lvlDesc = document.createElement('div');
      lvlDesc.className = 'tg-level-description';
      lvlDesc.textContent = level.description;

      card.appendChild(lvlTitle);
      card.appendChild(lvlSubtitle);
      card.appendChild(lvlDesc);

      if (!level.disabled) {
        card.addEventListener('click', () => renderLevelStub(level));
      }

      grid.appendChild(card);
    });

    container.appendChild(header);
    container.appendChild(grid);

    root.appendChild(container);
  }

  renderStartScreen();
});

