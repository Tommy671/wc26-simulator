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
    knockoutWinners: {},
    lastQualKey: null,
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
    if (!team) return '<span class="flag-emoji">🏳️</span>';
    const code =
      (typeof FLAG_CODE_BY_TEAM_ID !== 'undefined' &&
        FLAG_CODE_BY_TEAM_ID[team.id]) || null;
    if (!code) {
      const flag = team.flag || '🏳️';
      return `<span class="flag-emoji">${flag}</span>`;
    }
    const url = `https://flagcdn.com/24x18/${code}.png`;
    return `<img class="flag-img" src="${url}" alt="${team.name}" loading="lazy" />`;
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

  // --- Плей‑офф для нормального режима ---

  const ROUND_OF_32_TEMPLATE_TG = [
    {
      id: 'R32-1',
      home: { type: 'winner', groups: ['E'] },
      away: { type: 'third', groups: ['A', 'B', 'C', 'D', 'F'] },
    },
    {
      id: 'R32-2',
      home: { type: 'winner', groups: ['I'] },
      away: { type: 'third', groups: ['C', 'D', 'F', 'G', 'H'] },
    },
    {
      id: 'R32-3',
      home: { type: 'second', groups: ['A'] },
      away: { type: 'second', groups: ['B'] },
    },
    {
      id: 'R32-4',
      home: { type: 'winner', groups: ['F'] },
      away: { type: 'second', groups: ['C'] },
    },
    {
      id: 'R32-5',
      home: { type: 'second', groups: ['K'] },
      away: { type: 'second', groups: ['L'] },
    },
    {
      id: 'R32-6',
      home: { type: 'winner', groups: ['H'] },
      away: { type: 'second', groups: ['J'] },
    },
    {
      id: 'R32-7',
      home: { type: 'winner', groups: ['D'] },
      away: { type: 'third', groups: ['B', 'E', 'F', 'I', 'J'] },
    },
    {
      id: 'R32-8',
      home: { type: 'winner', groups: ['G'] },
      away: { type: 'third', groups: ['A', 'E', 'H', 'I', 'J'] },
    },
    {
      id: 'R32-9',
      home: { type: 'winner', groups: ['C'] },
      away: { type: 'second', groups: ['F'] },
    },
    {
      id: 'R32-10',
      home: { type: 'second', groups: ['E'] },
      away: { type: 'second', groups: ['I'] },
    },
    {
      id: 'R32-11',
      home: { type: 'winner', groups: ['A'] },
      away: { type: 'third', groups: ['C', 'E', 'F', 'H', 'I'] },
    },
    {
      id: 'R32-12',
      home: { type: 'winner', groups: ['L'] },
      away: { type: 'third', groups: ['E', 'H', 'I', 'J', 'K'] },
    },
    {
      id: 'R32-13',
      home: { type: 'winner', groups: ['J'] },
      away: { type: 'second', groups: ['H'] },
    },
    {
      id: 'R32-14',
      home: { type: 'second', groups: ['D'] },
      away: { type: 'second', groups: ['G'] },
    },
    {
      id: 'R32-15',
      home: { type: 'winner', groups: ['B'] },
      away: { type: 'third', groups: ['E', 'F', 'G', 'I', 'J'] },
    },
    {
      id: 'R32-16',
      home: { type: 'winner', groups: ['K'] },
      away: { type: 'third', groups: ['D', 'E', 'I', 'J', 'L'] },
    },
  ];

  function calcQualifiersNormalFromState() {
    ensureNormalGroupOrder();
    const standingsByGroup = {};
    const bestThirds = (normalState.bestThirds || []).map((x) => ({ ...x }));

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const order =
        normalState.groupOrder[group.id] || group.teams.map((t) => t.id);
      const arr = order.map((teamId) => ({
        teamId,
        groupId: group.id,
      }));
      standingsByGroup[group.id] = arr;
    }

    return { standingsByGroup, bestThirds };
  }

  function buildBracketNormal(qualifiers) {
    const rounds = {
      R32: [],
      R16: [],
      QF: [],
      SF: [],
      FINAL: [],
      THIRD: [],
    };

    const firstByGroup = {};
    const secondByGroup = {};
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const st = qualifiers.standingsByGroup[group.id] || [];
      if (st[0]) firstByGroup[group.id] = st[0];
      if (st[1]) secondByGroup[group.id] = st[1];
    }

    const bestThirds = qualifiers.bestThirds || [];
    const usedThird = new Set();

    function pickThird(allowedGroups) {
      for (let i = 0; i < bestThirds.length; i++) {
        if (usedThird.has(i)) continue;
        const cand = bestThirds[i];
        if (allowedGroups.includes(cand.groupId)) {
          usedThird.add(i);
          return cand;
        }
      }
      for (let i = 0; i < bestThirds.length; i++) {
        if (usedThird.has(i)) continue;
        const cand = bestThirds[i];
        usedThird.add(i);
        return cand;
      }
      return null;
    }

    function resolveSide(slot) {
      if (slot.type === 'winner') {
        const row = firstByGroup[slot.groups[0]];
        return row ? row.teamId : null;
      }
      if (slot.type === 'second') {
        const row = secondByGroup[slot.groups[0]];
        return row ? row.teamId : null;
      }
      if (slot.type === 'third') {
        const picked = pickThird(slot.groups);
        return picked ? picked.teamId : null;
      }
      return null;
    }

    ROUND_OF_32_TEMPLATE_TG.forEach((tpl) => {
      const homeTeamId = resolveSide(tpl.home);
      const awayTeamId = resolveSide(tpl.away);
      const match = {
        id: tpl.id,
        round: 'R32',
        homeTeamId,
        awayTeamId,
      };
      rounds.R32.push(match);
    });

    // Дальнейшие раунды — простая сетка 16 → 8 → 4 → 2 + матч за третье
    for (let i = 0; i < 8; i++) {
      const match = {
        id: `R16-${i + 1}`,
        round: 'R16',
        homeSource: { round: 'R32', index: i * 2 },
        awaySource: { round: 'R32', index: i * 2 + 1 },
      };
      rounds.R16.push(match);
    }

    for (let i = 0; i < 4; i++) {
      const match = {
        id: `QF-${i + 1}`,
        round: 'QF',
        homeSource: { round: 'R16', index: i * 2 },
        awaySource: { round: 'R16', index: i * 2 + 1 },
      };
      rounds.QF.push(match);
    }

    for (let i = 0; i < 2; i++) {
      const match = {
        id: `SF-${i + 1}`,
        round: 'SF',
        homeSource: { round: 'QF', index: i * 2 },
        awaySource: { round: 'QF', index: i * 2 + 1 },
      };
      rounds.SF.push(match);
    }

    rounds.FINAL.push({
      id: 'FINAL-1',
      round: 'FINAL',
      homeSource: { round: 'SF', index: 0 },
      awaySource: { round: 'SF', index: 1 },
    });

    rounds.THIRD.push({
      id: 'THIRD-1',
      round: 'THIRD',
      homeSource: { round: 'SF', index: 0, loser: true },
      awaySource: { round: 'SF', index: 1, loser: true },
    });

    return rounds;
  }

  function getMatchTeamsNormal(match, rounds, winners) {
    if (match.round === 'R32') {
      return { homeId: match.homeTeamId, awayId: match.awayTeamId };
    }
    const { homeSource, awaySource } = match;
    function resolveSource(src) {
      const srcMatch = rounds[src.round][src.index];
      if (!srcMatch) return null;
      const winner = winners[srcMatch.id];
      if (!winner) return null;
      if (!src.loser) return winner;
      const t = getMatchTeamsNormal(srcMatch, rounds, winners);
      if (!t.homeId || !t.awayId) return null;
      return winner === t.homeId ? t.awayId : t.homeId;
    }
    return {
      homeId: resolveSource(homeSource),
      awayId: resolveSource(awaySource),
    };
  }

  function renderKnockoutNormal(rounds) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tg-ko-grid';

    const roundDefs = [
      { id: 'R32', label: '1/16 финала' },
      { id: 'R16', label: '1/8 финала' },
      { id: 'QF', label: '1/4 финала' },
      { id: 'SF', label: 'Полуфиналы' },
      { id: 'FINAL', label: 'Финал' },
      { id: 'THIRD', label: 'Матч за 3‑е место' },
    ];

    roundDefs.forEach((rdef) => {
      const col = document.createElement('div');
      col.className = 'tg-ko-column';

      const head = document.createElement('div');
      head.className = 'tg-ko-column-title';
      head.textContent = rdef.label;
      col.appendChild(head);

      const list = document.createElement('div');
      list.className = 'tg-ko-column-matches';

      const matches = rounds[rdef.id] || [];
      matches.forEach((match) => {
        const teams = getMatchTeamsNormal(match, rounds, normalState.knockoutWinners);
        const homeTeam = teams.homeId ? findTeamById(teams.homeId) : null;
        const awayTeam = teams.awayId ? findTeamById(teams.awayId) : null;

        const card = document.createElement('div');
        card.className = 'tg-ko-match';

        function makeRow(team) {
          const btn = document.createElement('button');
          btn.className = 'tg-ko-team';
          if (!team) {
            btn.disabled = true;
            btn.textContent = '—';
            return btn;
          }
          const isWinner = normalState.knockoutWinners[match.id] === team.id;
          if (isWinner) btn.classList.add('tg-ko-team-winner');
          btn.innerHTML = `
            <span class="flag-wrap">${renderFlagHtmlSimple(team)}</span>
            <span class="team-name">${team.name}</span>
            <span class="tg-ko-pick">✓</span>
          `;
          btn.addEventListener('click', (e) => {
            if (!e.target.closest('.tg-ko-pick')) return;
            const gridEl = document.querySelector('.tg-ko-grid');
            const scrollLeft = gridEl ? gridEl.scrollLeft : 0;
            normalState.knockoutWinners[match.id] = team.id;
            renderNormalMode();
            const newGrid = document.querySelector('.tg-ko-grid');
            if (newGrid) newGrid.scrollLeft = scrollLeft;
          });
          return btn;
        }

        card.appendChild(makeRow(homeTeam));
        card.appendChild(makeRow(awayTeam));

        list.appendChild(card);
      });

      col.appendChild(list);
      wrapper.appendChild(col);
    });

    // Итоги турнира (чемпион / 2-е / 3-е место)
    const finalMatch = (rounds.FINAL && rounds.FINAL[0]) || null;
    const thirdMatch = (rounds.THIRD && rounds.THIRD[0]) || null;

    if (finalMatch) {
      const finalTeams = getMatchTeamsNormal(
        finalMatch,
        rounds,
        normalState.knockoutWinners
      );
      const winnerId = normalState.knockoutWinners[finalMatch.id];
      if (winnerId && finalTeams.homeId && finalTeams.awayId) {
        const champion = findTeamById(winnerId);
        const runnerUpId =
          winnerId === finalTeams.homeId ? finalTeams.awayId : finalTeams.homeId;
        const runnerUp = findTeamById(runnerUpId);

        let thirdPlace = null;
        if (thirdMatch) {
          const thirdTeams = getMatchTeamsNormal(
            thirdMatch,
            rounds,
            normalState.knockoutWinners
          );
          const thirdWinnerId = normalState.knockoutWinners[thirdMatch.id];
          if (
            thirdWinnerId &&
            thirdTeams.homeId &&
            thirdTeams.awayId &&
            (thirdWinnerId === thirdTeams.homeId ||
              thirdWinnerId === thirdTeams.awayId)
          ) {
            thirdPlace = findTeamById(thirdWinnerId);
          }
        }

        const summary = document.createElement('div');
        summary.className = 'tg-ko-summary';

        const sTitle = document.createElement('div');
        sTitle.className = 'tg-ko-summary-title';
        sTitle.textContent = 'Итоги турнира';
        summary.appendChild(sTitle);

        function addLine(label, team) {
          const line = document.createElement('div');
          line.className = 'tg-ko-summary-line';

          const lbl = document.createElement('span');
          lbl.className = 'tg-ko-summary-label';
          lbl.textContent = label;
          line.appendChild(lbl);

          if (team) {
            const t = document.createElement('span');
            t.className = 'tg-ko-summary-team';
            t.innerHTML = `${renderFlagHtmlSimple(team)}<span>${team.name}</span>`;
            line.appendChild(t);
          } else {
            const t = document.createElement('span');
            t.textContent = '—';
            line.appendChild(t);
          }

          summary.appendChild(line);
        }

        addLine('Чемпион', champion);
        addLine('2-е место', runnerUp);
        addLine('3-е место', thirdPlace);

        wrapper.appendChild(summary);
      }
    }

    return wrapper;
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

    // Ключ для отслеживания изменения групп/третьих мест
    const qualKey = JSON.stringify({
      groupOrder: normalState.groupOrder,
      bestThirds: selected,
    });
    if (normalState.lastQualKey !== qualKey) {
      normalState.knockoutWinners = {};
      normalState.lastQualKey = qualKey;
    }
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

    // Плей‑офф (нормальный режим) — появляется, когда выбраны 8 третьих мест
    if (selected.length === 8) {
      const koWrapper = document.createElement('div');
      koWrapper.className = 'tg-ko-wrapper';

      const koTitle = document.createElement('h2');
      koTitle.className = 'tg-title';
      koTitle.textContent = 'Плей‑офф';
      koWrapper.appendChild(koTitle);

      const qualifiers = calcQualifiersNormalFromState();
      const bracket = buildBracketNormal(qualifiers);
      const koGrid = renderKnockoutNormal(bracket);
      koWrapper.appendChild(koGrid);

      container.appendChild(koWrapper);
    }

    root.appendChild(container);

    // Перестановка команд тапами (удобно на телефоне, работает и с мышью)
    let selectedTeamId = null;
    let selectedGroupId = null;

    groupsGrid.querySelectorAll('.team-card').forEach((row) => {
      row.addEventListener('click', () => {
        const teamId = row.dataset.teamId;
        const groupId = row.dataset.groupId;

        // первый тап — выбор
        if (!selectedTeamId || selectedGroupId !== groupId || selectedTeamId === teamId) {
          selectedTeamId = teamId;
          selectedGroupId = groupId;

          groupsGrid.querySelectorAll('.team-card').forEach((r) =>
            r.classList.remove('team-card-selected')
          );
          row.classList.add('team-card-selected');
          return;
        }

        // второй тап по другой команде в той же группе — обмен местами
        const arr = normalState.groupOrder[groupId] || [];
        const from = arr.indexOf(selectedTeamId);
        const to = arr.indexOf(teamId);
        if (from === -1 || to === -1) {
          selectedTeamId = null;
          selectedGroupId = null;
          groupsGrid.querySelectorAll('.team-card').forEach((r) =>
            r.classList.remove('team-card-selected')
          );
          return;
        }
        const tmp = arr[from];
        arr[from] = arr[to];
        arr[to] = tmp;

        selectedTeamId = null;
        selectedGroupId = null;
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

