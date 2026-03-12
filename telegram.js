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
      subtitle: 'Для самых упоротых',
      description: 'Экспериментальный режим. Логику продумем позже, сейчас заглушка.',
    },
  ];

  // Простое состояние для нормального режима (без localStorage)
  const normalState = {
    groupOrder: {},
    bestThirds: [],
  };

  function findTeamById(teamId) {
    if (typeof WORLD_CUP_2026_CONFIG === 'undefined') return null;
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const team = group.teams.find((t) => t.id === teamId);
      if (team) return team;
    }
    return null;
  }

  function renderFlagHtmlSimple(team) {
    const flag = team && team.flag ? team.flag : '🏳️';
    return `<span class="flag-emoji">${flag}</span>`;
  }

  function ensureNormalGroupOrder() {
    if (typeof WORLD_CUP_2026_CONFIG === 'undefined') return;
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      if (!normalState.groupOrder[group.id]) {
        normalState.groupOrder[group.id] = group.teams.map((t) => t.id);
      }
    }
    if (!Array.isArray(normalState.bestThirds)) {
      normalState.bestThirds = [];
    }
  }

  function renderNormalMode() {
    ensureNormalGroupOrder();
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'tg-screen tg-level-screen';

    const back = document.createElement('button');
    back.className = 'tg-back-button';
    back.textContent = '← Назад к выбору уровня';
    back.addEventListener('click', renderStartScreen);

    const title = document.createElement('h1');
    title.className = 'tg-title';
    title.textContent = 'Нормальный режим';

    const subtitle = document.createElement('p');
    subtitle.className = 'tg-subtitle';
    subtitle.textContent =
      'Перетаскивай команды внутри группы (1–4 места) и выбирай 8 лучших третьих.';

    const groupsGrid = document.createElement('div');
    groupsGrid.className = 'groups-grid';

    // Рендер групп
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const card = document.createElement('div');
      card.className = 'group-card';

      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML = `
        <div>
          <div class="group-title">${group.name}</div>
          <div class="group-subtitle">Перетащи команды в порядке 1–4 места</div>
        </div>
      `;
      card.appendChild(header);

      const list = document.createElement('div');
      list.className = 'group-teams-list';

      const order = normalState.groupOrder[group.id] || group.teams.map((t) => t.id);

      order.forEach((teamId, index) => {
        const team = findTeamById(teamId);
        if (!team) return;
        const row = document.createElement('div');
        row.className = 'team-card';
        row.draggable = true;
        row.dataset.groupId = group.id;
        row.dataset.teamId = teamId;
        row.innerHTML = `
          <span class="team-position">${index + 1}</span>
          <div class="standings-team">
            ${renderFlagHtmlSimple(team)}
            <span class="team-name">${team.name}</span>
          </div>
        `;
        list.appendChild(row);
      });

      card.appendChild(list);
      groupsGrid.appendChild(card);
    }

    // Панель выбора 8 лучших третьих мест
    const thirdsPanel = document.createElement('div');
    thirdsPanel.className = 'thirds-panel';

    // Нормализуем выбор третьих мест под текущее расположение команд
    const currentThirdByGroup = {};
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const order = normalState.groupOrder[group.id] || group.teams.map((t) => t.id);
      if (order[2]) currentThirdByGroup[group.id] = order[2];
    }
    if (!Array.isArray(normalState.bestThirds)) {
      normalState.bestThirds = [];
    } else {
      normalState.bestThirds = normalState.bestThirds.filter(
        (x) => currentThirdByGroup[x.groupId] === x.teamId
      );
    }
    const selected = normalState.bestThirds;
    const header = document.createElement('div');
    header.className = 'thirds-header';
    header.innerHTML = `
      <span class="thirds-title">Выбор 8 лучших третьих мест</span>
      <span class="badge">${selected.length} из 8 выбрано</span>
    `;
    thirdsPanel.appendChild(header);

    const listThirds = document.createElement('div');
    listThirds.className = 'thirds-list';

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const order = normalState.groupOrder[group.id] || group.teams.map((t) => t.id);
      const thirdTeamId = order[2];
      if (!thirdTeamId) continue;
      const team = findTeamById(thirdTeamId);
      if (!team) continue;
      const isSelected = selected.some(
        (x) => x.groupId === group.id && x.teamId === thirdTeamId
      );
      const pill = document.createElement('button');
      pill.className = 'third-pill' + (isSelected ? ' third-pill-selected' : '');
      pill.dataset.groupId = group.id;
      pill.dataset.teamId = thirdTeamId;
      pill.innerHTML = `
        <span class="badge">${group.id}-3</span>
        ${renderFlagHtmlSimple(team)}
        <span class="team-name">${team.name}</span>
      `;
      listThirds.appendChild(pill);
    }

    thirdsPanel.appendChild(listThirds);

    container.appendChild(back);
    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(groupsGrid);
    container.appendChild(thirdsPanel);

    root.appendChild(container);

    // Drag & drop внутри группы
    let dragTeamId = null;
    let dragGroupId = null;

    groupsGrid.querySelectorAll('.team-card').forEach((row) => {
      row.addEventListener('dragstart', (e) => {
        dragTeamId = row.dataset.teamId;
        dragGroupId = row.dataset.groupId;
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const targetTeamId = row.dataset.teamId;
        const targetGroupId = row.dataset.groupId;
        if (!dragTeamId || !dragGroupId || dragGroupId !== targetGroupId) return;
        if (dragTeamId === targetTeamId) return;
        const arr = normalState.groupOrder[targetGroupId] || [];
        const from = arr.indexOf(dragTeamId);
        const to = arr.indexOf(targetTeamId);
        if (from === -1 || to === -1) return;
        arr.splice(from, 1);
        arr.splice(to, 0, dragTeamId);
        dragTeamId = null;
        dragGroupId = null;
        renderNormalMode();
      });
    });

    // Клики по третьим местам
    thirdsPanel.querySelectorAll('.third-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const groupId = pill.dataset.groupId;
        const teamId = pill.dataset.teamId;
        if (!Array.isArray(normalState.bestThirds)) {
          normalState.bestThirds = [];
        }
        const arr = normalState.bestThirds;
        const idx = arr.findIndex((x) => x.groupId === groupId && x.teamId === teamId);
        if (idx !== -1) {
          arr.splice(idx, 1);
          renderNormalMode();
          return;
        }
        if (arr.length >= 8) {
          alert('Можно выбрать максимум 8 команд.');
          return;
        }
        const existingIdx = arr.findIndex((x) => x.groupId === groupId);
        if (existingIdx !== -1) arr.splice(existingIdx, 1);
        arr.push({ groupId, teamId });
        renderNormalMode();
      });
    });
  }

  function renderLevelStub(level) {
    if (level.id === 'normal') {
      renderNormalMode();
      return;
    }
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

    container.appendChild(back);
    container.appendChild(title);
    container.appendChild(subtitle);

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

