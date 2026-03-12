const STORAGE_KEY = "wc26_simulator_state_v1";

const ROUNDS = [
  { id: "R32", label: "1/16 финала" },
  { id: "R16", label: "1/8 финала" },
  { id: "QF", label: "1/4 финала" },
  { id: "SF", label: "Полуфиналы" },
  { id: "FINAL", label: "Финал" },
  { id: "THIRD", label: "Матч за 3‑е место" },
];

// Слоты, которые заполняются победителями стыков
const PLAYOFF_SLOT_IDS = new Set([
  "EU_PO_A_WIN",
  "EU_PO_B_WIN",
  "EU_PO_C_WIN",
  "EU_PO_D_WIN",
  "IC_PO1_WIN",
  "IC_PO2_WIN",
]);

// Официальная сетка 1/16 финала (по группам и типу места)
const ROUND_OF_32_TEMPLATE = [
  {
    id: "R32-1",
    home: { type: "winner", groups: ["E"] },
    away: { type: "third", groups: ["A", "B", "C", "D", "F"] },
  },
  {
    id: "R32-2",
    home: { type: "winner", groups: ["I"] },
    away: { type: "third", groups: ["C", "D", "F", "G", "H"] },
  },
  {
    id: "R32-3",
    home: { type: "second", groups: ["A"] },
    away: { type: "second", groups: ["B"] },
  },
  {
    id: "R32-4",
    home: { type: "winner", groups: ["F"] },
    away: { type: "second", groups: ["C"] },
  },
  {
    id: "R32-5",
    home: { type: "second", groups: ["K"] },
    away: { type: "second", groups: ["L"] },
  },
  {
    id: "R32-6",
    home: { type: "winner", groups: ["H"] },
    away: { type: "second", groups: ["J"] },
  },
  {
    id: "R32-7",
    home: { type: "winner", groups: ["D"] },
    away: { type: "third", groups: ["B", "E", "F", "I", "J"] },
  },
  {
    id: "R32-8",
    home: { type: "winner", groups: ["G"] },
    away: { type: "third", groups: ["A", "E", "H", "I", "J"] },
  },
  {
    id: "R32-9",
    home: { type: "winner", groups: ["C"] },
    away: { type: "second", groups: ["F"] },
  },
  {
    id: "R32-10",
    home: { type: "second", groups: ["E"] },
    away: { type: "second", groups: ["I"] },
  },
  {
    id: "R32-11",
    home: { type: "winner", groups: ["A"] },
    away: { type: "third", groups: ["C", "E", "F", "H", "I"] },
  },
  {
    id: "R32-12",
    home: { type: "winner", groups: ["L"] },
    away: { type: "third", groups: ["E", "H", "I", "J", "K"] },
  },
  {
    id: "R32-13",
    home: { type: "winner", groups: ["J"] },
    away: { type: "second", groups: ["H"] },
  },
  {
    id: "R32-14",
    home: { type: "second", groups: ["D"] },
    away: { type: "second", groups: ["G"] },
  },
  {
    id: "R32-15",
    home: { type: "winner", groups: ["B"] },
    away: { type: "third", groups: ["E", "F", "G", "I", "J"] },
  },
  {
    id: "R32-16",
    home: { type: "winner", groups: ["K"] },
    away: { type: "third", groups: ["D", "E", "I", "J", "L"] },
  },
];

// Позиционирование матчей в сетке плей‑офф (CSS grid)
const KO_GRID_COLUMNS = {
  R32: 1,
  R16: 2,
  QF: 3,
  SF: 4,
  FINAL: 5,
  THIRD: 5,
};

const KO_GRID_ROWS = {
  // 16 матчей 1/16
  R32: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32],
  // 8 матчей 1/8 – строго по центру между парами 1/16
  R16: [3, 7, 11, 15, 19, 23, 27, 31],
  // 4 четвертьфинала
  QF: [5, 13, 21, 29],
  // 2 полуфинала
  SF: [9, 25],
  // финал и матч за 3‑е место
  FINAL: [17],
  THIRD: [21],
};

let appState = {
  scenarios: [],
  activeScenarioId: null,
};

function generateId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
  ).toUpperCase();
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.scenarios)) {
      appState = parsed;
    }
  } catch (e) {
    console.warn("Не удалось загрузить состояние:", e);
  }
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn("Не удалось сохранить состояние:", e);
  }
}

function getAllTeamsMap() {
  const map = {};
  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    for (const team of group.teams) {
      map[team.id] = { ...team, groupId: group.id };
    }
  }
  if (Array.isArray(PLAYOFF_TEAMS)) {
    for (const team of PLAYOFF_TEAMS) {
      if (!map[team.id]) {
        map[team.id] = { ...team, groupId: null };
      }
    }
  }
  return map;
}

const TEAMS_BY_ID = getAllTeamsMap();

function ensureGroupOrderForScenario(scenario) {
  if (!scenario) return;
  if (!scenario.groupOrder) {
    scenario.groupOrder = {};
  }
  if (typeof scenario.playoffsLocked !== "boolean") {
    scenario.playoffsLocked = false;
  }
  if (typeof scenario.groupsLocked !== "boolean") {
    scenario.groupsLocked = false;
  }
  let changed = false;
  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    if (!scenario.groupOrder[group.id]) {
      scenario.groupOrder[group.id] = group.teams.map((t) => t.id);
      changed = true;
    }
  }
  if (!scenario.bestThirdsManual) {
    scenario.bestThirdsManual = [];
    changed = true;
  }
  if (changed) {
    saveState();
  }
}

// Создание массива матчей стыков на основе PLAYOFFS_CONFIG
function generatePlayoffMatches() {
  const matches = [];
  if (!PLAYOFFS_CONFIG || !Array.isArray(PLAYOFFS_CONFIG.paths)) return matches;
  for (const path of PLAYOFFS_CONFIG.paths) {
    const pathId = path.id;
    if (Array.isArray(path.semifinals)) {
      for (const sf of path.semifinals) {
        matches.push({
          id: sf.id,
          pathId,
          round: "SF",
          homeTeamId: sf.homeTeamId,
          awayTeamId: sf.awayTeamId,
          homeGoals: null,
          awayGoals: null,
        });
      }
    }
    if (path.final) {
      matches.push({
        id: path.final.id,
        pathId,
        round: "F",
        homeTeamId: path.final.homeTeamId || null,
        awayTeamId: path.final.awayTeamId || null,
        homeFromId: path.final.homeFromId || null,
        awayFromId: path.final.awayFromId || null,
        homeGoals: null,
        awayGoals: null,
      });
    }
  }
  return matches;
}

// Победитель конкретного стыкового матча
function getPlayoffMatchWinner(match) {
  if (!match) return null;
  if (match.homeGoals == null || match.awayGoals == null) return null;
  if (match.homeGoals === match.awayGoals) return null;
  return match.homeGoals > match.awayGoals
    ? match.homeTeamId
    : match.awayTeamId;
}

// Карта: слот группы -> id команды, выигравшей соответствующий путь стыков
function getPlayoffSlotWinnersMap(scenario) {
  const result = {};
  if (!PLAYOFFS_CONFIG || !Array.isArray(PLAYOFFS_CONFIG.paths)) return result;
  const allMatches = scenario.playoffMatches || [];
  const byId = {};
  for (const m of allMatches) {
    byId[m.id] = m;
  }

  for (const path of PLAYOFFS_CONFIG.paths) {
    const finalCfg = path.final;
    if (!finalCfg) continue;
    const finalMatch = byId[finalCfg.id];
    if (!finalMatch) continue;

    let homeTeamId = finalMatch.homeTeamId || null;
    let awayTeamId = finalMatch.awayTeamId || null;

    if (!homeTeamId && finalCfg.homeFromId) {
      const sfMatch = byId[finalCfg.homeFromId];
      homeTeamId = getPlayoffMatchWinner(sfMatch);
    }
    if (!awayTeamId && finalCfg.awayFromId) {
      const sfMatch = byId[finalCfg.awayFromId];
      awayTeamId = getPlayoffMatchWinner(sfMatch);
    }

    if (!homeTeamId || !awayTeamId) continue;
    const winnerId = getPlayoffMatchWinner({
      ...finalMatch,
      homeTeamId,
      awayTeamId,
    });
    if (!winnerId) continue;
    result[path.slotId] = winnerId;
  }
  return result;
}

// Отображаемые имя и флаг команды с учётом победителей стыков
function getDisplayTeam(teamId, scenario) {
  const base = TEAMS_BY_ID[teamId] || {
    id: teamId,
    name: teamId,
    flag: "❓",
  };
  if (!PLAYOFF_SLOT_IDS.has(teamId)) {
    const code =
      (typeof FLAG_CODE_BY_TEAM_ID !== "undefined" &&
        FLAG_CODE_BY_TEAM_ID[teamId]) ||
      null;
    return {
      ...base,
      flagCode: code,
      flagImg: code
        ? `https://flagcdn.com/h20/${code}.png`
        : null,
    };
  }
  const winners = getPlayoffSlotWinnersMap(scenario || getActiveScenario() || {});
  const realId = winners[teamId];
  if (!realId) {
    const codeSlot =
      (typeof FLAG_CODE_BY_TEAM_ID !== "undefined" &&
        FLAG_CODE_BY_TEAM_ID[teamId]) ||
      null;
    return {
      ...base,
      flagCode: codeSlot,
      flagImg: codeSlot
        ? `https://flagcdn.com/h20/${codeSlot}.png`
        : null,
    };
  }
  const real = TEAMS_BY_ID[realId] || base;
  const codeReal =
    (typeof FLAG_CODE_BY_TEAM_ID !== "undefined" &&
      FLAG_CODE_BY_TEAM_ID[realId]) ||
    null;
  return {
    ...base,
    name: real.name,
    flag: real.flag,
    flagCode: codeReal,
    flagImg: codeReal
      ? `https://flagcdn.com/h20/${codeReal}.png`
      : null,
  };
}

function renderFlagHtml(team) {
  if (!team) {
    return '<span class="flag">❓</span>';
  }
  if (team.flagImg) {
    return `<img class="flag-img" src="${team.flagImg}" alt="" />`;
  }
  if (team.flag) {
    return `<span class="flag">${team.flag}</span>`;
  }
  return '<span class="flag">❓</span>';
}

function generateGroupMatchesForGroup(group) {
  const teamIds = group.teams.map((t) => t.id);
  const pairs = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
  ];
  return pairs.map(([i, j], idx) => ({
    id: `${group.id}-${idx + 1}`,
    groupId: group.id,
    homeTeamId: teamIds[i],
    awayTeamId: teamIds[j],
    homeGoals: null,
    awayGoals: null,
  }));
}

function generateAllGroupMatches() {
  const matches = [];
  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    matches.push(...generateGroupMatchesForGroup(group));
  }
  return matches;
}

function createEmptyScenario(
  name = "Новый прогноз",
  author = "",
  difficulty = "normal"
) {
  const scenario = {
    id: generateId(),
    name,
    author,
    createdAt: new Date().toISOString(),
    difficulty,
    groupMatches: generateAllGroupMatches(),
    playoffMatches: generatePlayoffMatches(),
    knockoutResults: {},
    groupOrder: {},
    bestThirdsManual: [],
  };

  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    scenario.groupOrder[group.id] = group.teams.map((t) => t.id);
  }

  return scenario;
}

function getActiveScenario() {
  return appState.scenarios.find((s) => s.id === appState.activeScenarioId);
}

function setActiveScenario(id) {
  appState.activeScenarioId = id;
  saveState();
  renderAll();
}

function addScenario(name, author) {
  const scenario = createEmptyScenario(name, author);
  appState.scenarios.push(scenario);
  appState.activeScenarioId = scenario.id;
  saveState();
  renderAll();
}

function deleteActiveScenario() {
  const idx = appState.scenarios.findIndex(
    (s) => s.id === appState.activeScenarioId
  );
  if (idx === -1) return;
  appState.scenarios.splice(idx, 1);
  if (appState.scenarios.length) {
    appState.activeScenarioId = appState.scenarios[0].id;
  } else {
    appState.activeScenarioId = null;
  }
  saveState();
  renderAll();
}

function renameActiveScenario(newName) {
  const s = getActiveScenario();
  if (!s) return;
  s.name = newName;
  saveState();
  renderScenarioSelector();
}

function updateActiveScenario(updater) {
  const s = getActiveScenario();
  if (!s) return;
  updater(s);
  saveState();
  renderAll();
}

function calcStandingsForGroup(groupId, scenario) {
  const teams = WORLD_CUP_2026_CONFIG.groups.find(
    (g) => g.id === groupId
  ).teams;
  const stats = {};
  for (const t of teams) {
    stats[t.id] = {
      teamId: t.id,
      groupId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    };
  }

  const matches = scenario.groupMatches.filter((m) => m.groupId === groupId);
  for (const m of matches) {
    if (m.homeGoals == null || m.awayGoals == null) continue;
    const home = stats[m.homeTeamId];
    const away = stats[m.awayTeamId];
    home.played += 1;
    away.played += 1;
    home.goalsFor += m.homeGoals;
    home.goalsAgainst += m.awayGoals;
    away.goalsFor += m.awayGoals;
    away.goalsAgainst += m.homeGoals;
    if (m.homeGoals > m.awayGoals) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (m.homeGoals < m.awayGoals) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const arr = Object.values(stats);
  arr.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const nameA = TEAMS_BY_ID[a.teamId].name;
    const nameB = TEAMS_BY_ID[b.teamId].name;
    return nameA.localeCompare(nameB, "ru");
  });
  return arr;
}

function calcQualifiers(scenario) {
  const standingsByGroup = {};
  const direct = [];
  const thirds = [];

  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    const st = calcStandingsForGroup(group.id, scenario);
    standingsByGroup[group.id] = st;
    if (st[0]) direct.push({ ...st[0], position: 1 });
    if (st[1]) direct.push({ ...st[1], position: 2 });
    if (st[2]) thirds.push({ ...st[2], position: 3 });
  }

  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const nameA = TEAMS_BY_ID[a.teamId].name;
    const nameB = TEAMS_BY_ID[b.teamId].name;
    return nameA.localeCompare(nameB, "ru");
  });

  const bestThirds = thirds.slice(0, 8);

  const all32 = [...direct, ...bestThirds];
  all32.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const nameA = TEAMS_BY_ID[a.teamId].name;
    const nameB = TEAMS_BY_ID[b.teamId].name;
    return nameA.localeCompare(nameB, "ru");
  });

  return {
    standingsByGroup,
    direct,
    bestThirds,
    ranked32: all32,
  };
}

function calcQualifiersNormal(scenario) {
  ensureGroupOrderForScenario(scenario);
  const standingsByGroup = {};
  const direct = [];
  const bestThirds = (scenario.bestThirdsManual || []).map((x) => ({
    ...x,
  }));

  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    const orderRaw =
      (scenario.groupOrder && scenario.groupOrder[group.id]) ||
      group.teams.map((t) => t.id);
    const winnersMap = getPlayoffSlotWinnersMap(scenario);
    const order = orderRaw.map((id) =>
      PLAYOFF_SLOT_IDS.has(id) && winnersMap[id] ? winnersMap[id] : id
    );
    const arr = order.map((teamId) => ({
      teamId,
      groupId: group.id,
    }));
    standingsByGroup[group.id] = arr;
    if (arr[0]) direct.push({ ...arr[0], position: 1 });
    if (arr[1]) direct.push({ ...arr[1], position: 2 });
  }

  return {
    standingsByGroup,
    direct,
    bestThirds,
    ranked32: [],
  };
}

function calcQualifiersForScenario(scenario) {
  if (scenario.difficulty === "normal") {
    return calcQualifiersNormal(scenario);
  }
  return calcQualifiers(scenario);
}

// Построение официальной сетки плей‑офф (1/16 и далее) по результатам групп
function buildBracket(qualifiers) {
  const rounds = {
    R32: [],
    R16: [],
    QF: [],
    SF: [],
    FINAL: [],
    THIRD: [],
  };
  const matchById = {};

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
    // Сначала пытаемся найти третью команду из разрешённых групп
    for (let i = 0; i < bestThirds.length; i++) {
      if (usedThird.has(i)) continue;
      const cand = bestThirds[i];
      if (allowedGroups.includes(cand.groupId)) {
        usedThird.add(i);
        return cand;
      }
    }
    // Если не нашли ни одной — берём первую ещё не использованную,
    // чтобы все 8 выбранных третьих точно попали в сетку
    for (let i = 0; i < bestThirds.length; i++) {
      if (usedThird.has(i)) continue;
      const cand = bestThirds[i];
      usedThird.add(i);
      return cand;
    }
    return null;
  }

  function resolveSide(slot) {
    if (slot.type === "winner") {
      const row = firstByGroup[slot.groups[0]];
      return row ? row.teamId : null;
    }
    if (slot.type === "second") {
      const row = secondByGroup[slot.groups[0]];
      return row ? row.teamId : null;
    }
    if (slot.type === "third") {
      const picked = pickThird(slot.groups);
      return picked ? picked.teamId : null;
    }
    return null;
  }

  ROUND_OF_32_TEMPLATE.forEach((tpl) => {
    const homeTeamId = resolveSide(tpl.home);
    const awayTeamId = resolveSide(tpl.away);
    const match = {
      id: tpl.id,
      round: "R32",
      homeTeamId,
      awayTeamId,
    };
    rounds.R32.push(match);
    matchById[tpl.id] = match;
  });

  // дальнейшие раунды строим по простой сетке из 16 матчей 1/16

  for (let i = 0; i < 8; i++) {
    const id = `R16-${i + 1}`;
    const match = {
      id,
      round: "R16",
      homeSource: { round: "R32", index: i * 2 },
      awaySource: { round: "R32", index: i * 2 + 1 },
    };
    rounds.R16.push(match);
    matchById[id] = match;
  }

  for (let i = 0; i < 4; i++) {
    const id = `QF-${i + 1}`;
    const match = {
      id,
      round: "QF",
      homeSource: { round: "R16", index: i * 2 },
      awaySource: { round: "R16", index: i * 2 + 1 },
    };
    rounds.QF.push(match);
    matchById[id] = match;
  }

  for (let i = 0; i < 2; i++) {
    const id = `SF-${i + 1}`;
    const match = {
      id,
      round: "SF",
      homeSource: { round: "QF", index: i * 2 },
      awaySource: { round: "QF", index: i * 2 + 1 },
    };
    rounds.SF.push(match);
    matchById[id] = match;
  }

  const finalMatch = {
    id: "FINAL-1",
    round: "FINAL",
    homeSource: { round: "SF", index: 0 },
    awaySource: { round: "SF", index: 1 },
  };
  rounds.FINAL.push(finalMatch);
  matchById[finalMatch.id] = finalMatch;

  const thirdMatch = {
    id: "THIRD-1",
    round: "THIRD",
    homeSource: { round: "SF", index: 0, loser: true },
    awaySource: { round: "SF", index: 1, loser: true },
  };
  rounds.THIRD.push(thirdMatch);
  matchById[thirdMatch.id] = thirdMatch;

  return { rounds, matchById };
}

function getWinnerTeamId(matchId, knockoutResults, matchDef) {
  const res = knockoutResults[matchId];
  if (!res) return null;
  const { homeGoals, awayGoals } = res;
  if (homeGoals == null || awayGoals == null) return null;
  if (homeGoals === awayGoals) return null;
  return homeGoals > awayGoals
    ? matchDef.homeTeamId
    : matchDef.awayTeamId;
}

function resolveSideTeam(matchDef, sideKey, bracket, knockoutResults, scenario) {
  const side = matchDef[sideKey];
  if (!side) {
    const teamId = matchDef[sideKey === "homeSource" ? "homeTeamId" : "awayTeamId"];
    return teamId ? getDisplayTeam(teamId, scenario || getActiveScenario()) : null;
  }

  if (side.teamId) {
    return getDisplayTeam(side.teamId, scenario || getActiveScenario()) || null;
  }

  const prevMatch =
    bracket.rounds[side.round] && bracket.rounds[side.round][side.index];
  if (!prevMatch) return null;

  const prev = { ...prevMatch };
  if (!prev.homeTeamId || !prev.awayTeamId) {
    prev.homeTeamId =
      resolveSideTeam(
        prevMatch,
        "homeSource",
        bracket,
        knockoutResults,
        scenario
      )?.id;
    prev.awayTeamId =
      resolveSideTeam(
        prevMatch,
        "awaySource",
        bracket,
        knockoutResults,
        scenario
      )?.id;
  }

  const res = knockoutResults[prev.id];
  if (!res) return null;

  if (side.loser) {
    if (res.homeGoals == null || res.awayGoals == null) return null;
    if (res.homeGoals === res.awayGoals) return null;
    const loserId =
      res.homeGoals < res.awayGoals
        ? prev.homeTeamId
        : prev.awayTeamId;
    return loserId
      ? getDisplayTeam(loserId, scenario || getActiveScenario())
      : null;
  }

  const winnerId = getWinnerTeamId(prev.id, knockoutResults, prev);
  return winnerId
    ? getDisplayTeam(winnerId, scenario || getActiveScenario())
    : null;
}

function renderScenarioSelector() {
  const select = document.getElementById("scenario-select");
  select.innerHTML = "";
  if (!appState.scenarios.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Нет сценариев — создайте новый";
    opt.disabled = true;
    opt.selected = true;
    select.appendChild(opt);
    return;
  }
  for (const s of appState.scenarios) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.author
      ? `${s.name} — ${s.author}`
      : s.name;
    if (s.id === appState.activeScenarioId) opt.selected = true;
    select.appendChild(opt);
  }
}

function renderGroupsView() {
  const container = document.getElementById("groups-container");
  const scenario = getActiveScenario();
  container.innerHTML = "";
  if (!scenario) {
    return;
  }

  if (scenario.difficulty === "normal") {
    ensureGroupOrderForScenario(scenario);
    renderGroupsViewNormal(scenario);
    return;
  }
  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    const card = document.createElement("div");
    card.className = "group-card";
    card.dataset.groupId = group.id;

    const header = document.createElement("div");
    header.className = "group-header";
    header.innerHTML = `
      <div>
        <div class="group-title">${group.name}</div>
        <div class="group-subtitle">Нажми, чтобы ввести результаты матчей</div>
      </div>
    `;
    card.appendChild(header);

    const standings = calcStandingsForGroup(group.id, scenario);
    const table = document.createElement("table");
    table.className = "standings-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Команда</th>
          <th>И</th>
          <th>В</th>
          <th>Н</th>
          <th>П</th>
          <th>З</th>
          <th>П</th>
          <th>+/-</th>
          <th>О</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");
    standings.forEach((row, idx) => {
      const team = getDisplayTeam(row.teamId, scenario);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>
          <div class="standings-team">
            ${renderFlagHtml(team)}
            <span class="team-name">${team.name}</span>
          </div>
        </td>
        <td style="text-align:center">${row.played}</td>
        <td style="text-align:center">${row.wins}</td>
        <td style="text-align:center">${row.draws}</td>
        <td style="text-align:center">${row.losses}</td>
        <td style="text-align:center">${row.goalsFor}</td>
        <td style="text-align:center">${row.goalsAgainst}</td>
        <td style="text-align:center">${row.goalsFor - row.goalsAgainst}</td>
        <td style="text-align:center">${row.points}</td>
      `;
      tbody.appendChild(tr);
    });
    card.appendChild(table);

    container.appendChild(card);
  }

  container.querySelectorAll(".group-card").forEach((card) => {
    card.addEventListener("click", () => {
      const groupId = card.dataset.groupId;
      openGroupModal(groupId);
    });
  });
}

function renderGroupsViewNormal(scenario) {
  const container = document.getElementById("groups-container");
  container.innerHTML = "";

  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    const card = document.createElement("div");
    card.className = "group-card";

    const header = document.createElement("div");
    header.className = "group-header";
    header.innerHTML = `
      <div>
        <div class="group-title">${group.name}</div>
        <div class="group-subtitle">Перетащи команды в порядке 1–4 места</div>
      </div>
    `;
    card.appendChild(header);

    const list = document.createElement("div");
    list.className = "group-teams-list";

    const order = (scenario.groupOrder && scenario.groupOrder[group.id]) ||
      group.teams.map((t) => t.id);

    order.forEach((teamId, index) => {
      const team = getDisplayTeam(teamId, scenario);
      const row = document.createElement("div");
      row.className = "team-card";
      row.draggable = true;
      row.dataset.groupId = group.id;
      row.dataset.teamId = teamId;
      row.innerHTML = `
        <span class="team-position">${index + 1}</span>
        <div class="standings-team">
          ${renderFlagHtml(team)}
          <span class="team-name">${team.name}</span>
        </div>
      `;
      list.appendChild(row);
    });

    card.appendChild(list);
    container.appendChild(card);
  }

  // Drag & drop внутри группы
  let dragTeamId = null;
  let dragGroupId = null;

  container.querySelectorAll(".team-card").forEach((row) => {
    row.addEventListener("dragstart", (e) => {
      dragTeamId = row.dataset.teamId;
      dragGroupId = row.dataset.groupId;
      e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over");
    });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-over");
      const targetTeamId = row.dataset.teamId;
      const targetGroupId = row.dataset.groupId;
      if (!dragTeamId || !dragGroupId || dragGroupId !== targetGroupId) return;
      if (dragTeamId === targetTeamId) return;
      updateActiveScenario((s) => {
        ensureGroupOrderForScenario(s);
        const arr = s.groupOrder[targetGroupId] || [];
        const from = arr.indexOf(dragTeamId);
        const to = arr.indexOf(targetTeamId);
        if (from === -1 || to === -1) return;
        arr.splice(from, 1);
        arr.splice(to, 0, dragTeamId);
      });
      dragTeamId = null;
      dragGroupId = null;
    });
  });

  renderBestThirdsPanelNormal(scenario);
}

function renderBestThirdsPanelNormal(scenario) {
  const container = document.getElementById("groups-container");
  const panel = document.createElement("div");
  panel.className = "thirds-panel";

  const selected = scenario.bestThirdsManual || [];
  const header = document.createElement("div");
  header.className = "thirds-header";
  header.innerHTML = `
    <span class="thirds-title">Выбор 8 лучших третьих мест</span>
    <span class="badge">${selected.length} из 8 выбрано</span>
  `;
  panel.appendChild(header);

  const list = document.createElement("div");
  list.className = "thirds-list";

  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    const order = (scenario.groupOrder && scenario.groupOrder[group.id]) ||
      group.teams.map((t) => t.id);
    const thirdTeamId = order[2];
    if (!thirdTeamId) continue;
    const team = getDisplayTeam(thirdTeamId, scenario);
    const isSelected = selected.some(
      (x) => x.groupId === group.id && x.teamId === thirdTeamId
    );
    const pill = document.createElement("button");
    pill.className = "third-pill" + (isSelected ? " third-pill-selected" : "");
    pill.dataset.groupId = group.id;
    pill.dataset.teamId = thirdTeamId;
    pill.innerHTML = `
      <span class="badge">${group.id}-3</span>
      ${renderFlagHtml(team)}
      <span class="team-name">${team.name}</span>
    `;
    list.appendChild(pill);
  }

  panel.appendChild(list);
  container.appendChild(panel);

  panel.querySelectorAll(".third-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const groupId = pill.dataset.groupId;
      const teamId = pill.dataset.teamId;
      updateActiveScenario((s) => {
        ensureGroupOrderForScenario(s);
        if (!s.bestThirdsManual) s.bestThirdsManual = [];
        const arr = s.bestThirdsManual;
        const idx = arr.findIndex(
          (x) => x.groupId === groupId && x.teamId === teamId
        );
        if (idx !== -1) {
          arr.splice(idx, 1);
          return;
        }
        if (arr.length >= 8) {
          alert("Можно выбрать максимум 8 команд.");
          return;
        }
        // Убедимся, что от этой группы только одна третья
        const existingIdx = arr.findIndex((x) => x.groupId === groupId);
        if (existingIdx !== -1) arr.splice(existingIdx, 1);
        arr.push({ groupId, teamId });
      });
    });
  });
}


function renderKnockoutView() {
  const container = document.getElementById("knockout-container");
  const scenario = getActiveScenario();
  container.innerHTML = "";
  if (!scenario) return;

  const qualifiers = calcQualifiersForScenario(scenario);
  const bracket = buildBracket(qualifiers);

  // Заголовки раундов
  const roundLabels = [
    { col: KO_GRID_COLUMNS.R32, text: "1/16 финала" },
    { col: KO_GRID_COLUMNS.R16, text: "1/8 финала" },
    { col: KO_GRID_COLUMNS.QF, text: "1/4 финала" },
    { col: KO_GRID_COLUMNS.SF, text: "Полуфиналы" },
    { col: KO_GRID_COLUMNS.FINAL, text: "Финал и матч за 3‑е место" },
  ];

  for (const label of roundLabels) {
    const el = document.createElement("div");
    el.className = "round-title";
    el.textContent = label.text;
    el.style.gridColumn = label.col;
    el.style.gridRow = "1";
    container.appendChild(el);
  }

  const counters = {
    R32: 0,
    R16: 0,
    QF: 0,
    SF: 0,
    FINAL: 0,
    THIRD: 0,
  };

  function placeMatches(roundId, matches) {
    for (const match of matches) {
      const col = KO_GRID_COLUMNS[roundId];
      const rows = KO_GRID_ROWS[roundId];
      const idx = counters[roundId]++;
      const row = rows && rows[idx] ? rows[idx] : rows[rows.length - 1];
      renderKnockoutMatch(
        match,
        container,
        scenario,
        bracket,
        { col, row }
      );
    }
  }

  placeMatches("R32", bracket.rounds.R32);
  placeMatches("R16", bracket.rounds.R16);
  placeMatches("QF", bracket.rounds.QF);
  placeMatches("SF", bracket.rounds.SF);
  placeMatches("FINAL", bracket.rounds.FINAL);
  placeMatches("THIRD", bracket.rounds.THIRD);

  container.querySelectorAll(".score-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const matchId = e.target.dataset.matchId;
      const side = e.target.dataset.side;
      const raw = e.target.value;
      const value = raw === "" ? null : Math.max(0, Number(raw));
      updateActiveScenario((s) => {
        if (!s.knockoutResults) s.knockoutResults = {};
        if (!s.knockoutResults[matchId]) {
          s.knockoutResults[matchId] = { homeGoals: null, awayGoals: null };
        }
        if (side === "home") s.knockoutResults[matchId].homeGoals = value;
        else s.knockoutResults[matchId].awayGoals = value;
      });
    });
  });

  renderKnockoutSummary(scenario, bracket);
}

function renderKnockoutSummary(scenario, bracket) {
  const summaryEl = document.getElementById("knockout-summary");
  if (!summaryEl) return;
  summaryEl.innerHTML = "";

  const results = scenario.knockoutResults || {};
  const finalDef = bracket.matchById && bracket.matchById["FINAL-1"];
  const thirdDef = bracket.matchById && bracket.matchById["THIRD-1"];

  let championId = null;
  if (finalDef) {
    const finalMatch = { ...finalDef };
    finalMatch.homeTeamId =
      finalMatch.homeTeamId ||
      resolveSideTeam(
        finalDef,
        "homeSource",
        bracket,
        results,
        scenario
      )?.id;
    finalMatch.awayTeamId =
      finalMatch.awayTeamId ||
      resolveSideTeam(
        finalDef,
        "awaySource",
        bracket,
        results,
        scenario
      )?.id;
    if (finalMatch.homeTeamId && finalMatch.awayTeamId) {
      championId = getWinnerTeamId("FINAL-1", results, finalMatch);
    }
  }

  let thirdId = null;
  if (thirdDef) {
    const thirdMatch = { ...thirdDef };
    thirdMatch.homeTeamId =
      thirdMatch.homeTeamId ||
      resolveSideTeam(
        thirdDef,
        "homeSource",
        bracket,
        results,
        scenario
      )?.id;
    thirdMatch.awayTeamId =
      thirdMatch.awayTeamId ||
      resolveSideTeam(
        thirdDef,
        "awaySource",
        bracket,
        results,
        scenario
      )?.id;
    if (thirdMatch.homeTeamId && thirdMatch.awayTeamId) {
      thirdId = getWinnerTeamId("THIRD-1", results, thirdMatch);
    }
  }

  const title = document.createElement("div");
  title.className = "knockout-summary-title";
  title.textContent = "Итоги турнира";
  summaryEl.appendChild(title);

  if (championId) {
    const champTeam = getDisplayTeam(championId, scenario);
    const champ = document.createElement("div");
    champ.className = "champion-card";
    champ.innerHTML = `
      <span>🥇 Чемпион:</span>
      ${renderFlagHtml(champTeam)}
      <span class="team-name">${champTeam.name}</span>
    `;
    summaryEl.appendChild(champ);

    // Второе место — финалист, уступивший чемпиону
    if (finalDef) {
      const finalMatch = { ...finalDef };
      finalMatch.homeTeamId =
        finalMatch.homeTeamId ||
        resolveSideTeam(
          finalDef,
          "homeSource",
          bracket,
          results,
          scenario
        )?.id;
      finalMatch.awayTeamId =
        finalMatch.awayTeamId ||
        resolveSideTeam(
          finalDef,
          "awaySource",
          bracket,
          results,
          scenario
        )?.id;
      const { homeTeamId, awayTeamId } = finalMatch;
      if (homeTeamId && awayTeamId) {
        const runnerUpId =
          championId === homeTeamId ? awayTeamId : homeTeamId;
        const runnerTeam = getDisplayTeam(runnerUpId, scenario);
        const second = document.createElement("div");
        second.className = "second-card";
        second.innerHTML = `
          <span>🥈 2‑е место:</span>
          ${renderFlagHtml(runnerTeam)}
          <span class="team-name">${runnerTeam.name}</span>
        `;
        summaryEl.appendChild(second);
      }
    }
  } else {
    const champPlaceholder = document.createElement("div");
    champPlaceholder.className = "champion-card";
    champPlaceholder.innerHTML = `<span>🥇 Чемпион ещё не определён</span>`;
    summaryEl.appendChild(champPlaceholder);
  }

  if (thirdId) {
    const team = getDisplayTeam(thirdId, scenario);
    const third = document.createElement("div");
    third.className = "third-card";
    third.innerHTML = `
      <span>🥉 3‑е место:</span>
      ${renderFlagHtml(team)}
      <span class="team-name">${team.name}</span>
    `;
    summaryEl.appendChild(third);
  }
}

function renderKnockoutMatch(matchDef, roundContainer, scenario, bracket, gridPos) {
  if (!scenario.knockoutResults) scenario.knockoutResults = {};
  const res = scenario.knockoutResults[matchDef.id] || {
    homeGoals: null,
    awayGoals: null,
  };
  const canEdit = scenario.groupsLocked && areGroupsComplete(scenario);
  const isNormal = scenario.difficulty === "normal";

  let homeTeam = matchDef.homeTeamId
    ? getDisplayTeam(matchDef.homeTeamId, scenario)
    : resolveSideTeam(
        matchDef,
        "homeSource",
        bracket,
        scenario.knockoutResults,
        scenario
      );
  let awayTeam = matchDef.awayTeamId
    ? getDisplayTeam(matchDef.awayTeamId, scenario)
    : resolveSideTeam(
        matchDef,
        "awaySource",
        bracket,
        scenario.knockoutResults,
        scenario
      );

  const wrapper = document.createElement("div");
  wrapper.className = "knockout-match";

  const header = document.createElement("div");
  header.className = "knockout-match-header";
  header.innerHTML = `
    <span>${matchDef.id}</span>
    <span>${homeTeam && awayTeam ? "" : "ожидание участников"}</span>
  `;
  wrapper.appendChild(header);

  const body = document.createElement("div");

  const homeLabel = homeTeam ? homeTeam.name : "—";
  const awayLabel = awayTeam ? awayTeam.name : "—";

  const winnerId =
    homeTeam && awayTeam
      ? getWinnerTeamId(matchDef.id, scenario.knockoutResults, {
          ...matchDef,
          homeTeamId: homeTeam?.id,
          awayTeamId: awayTeam?.id,
        })
      : null;

  const homeRow = document.createElement("div");
  const homeIsWinner = winnerId && homeTeam && winnerId === homeTeam.id;
  homeRow.className = "knockout-team-row" + (homeIsWinner ? " winner" : "");
  const homeScoreCell = isNormal
    ? '<div class="knockout-score-placeholder"></div>'
    : `<div>
        <input class="score-input" type="number" min="0" data-match-id="${
          matchDef.id
        }" data-side="home" value="${res.homeGoals ?? ""}" ${
        canEdit ? "" : "disabled"
      } />
      </div>`;
  homeRow.innerHTML = `
    <div class="knockout-team-main">
      ${homeTeam ? renderFlagHtml(homeTeam) : '<span class="flag">🏆</span>'}
      <span class="${homeTeam ? "team-name" : "unknown-team"}">${homeLabel}</span>
      ${(() => {
        if (!homeIsWinner || !homeTeam) return "";
        if (matchDef.round === "FINAL") return '<span class="winner-pill">чемпион</span>';
        if (matchDef.round === "THIRD") return '<span class="winner-pill">3‑е место</span>';
        return '<span class="winner-pill">прошёл дальше</span>';
      })()}
    </div>
    ${homeScoreCell}
  `;

  const awayRow = document.createElement("div");
  const awayIsWinner = winnerId && awayTeam && winnerId === awayTeam.id;
  awayRow.className = "knockout-team-row" + (awayIsWinner ? " winner" : "");
  const awayScoreCell = isNormal
    ? '<div class="knockout-score-placeholder"></div>'
    : `<div>
        <input class="score-input" type="number" min="0" data-match-id="${
          matchDef.id
        }" data-side="away" value="${res.awayGoals ?? ""}" ${
        canEdit ? "" : "disabled"
      } />
      </div>`;
  awayRow.innerHTML = `
    <div class="knockout-team-main">
      ${awayTeam ? renderFlagHtml(awayTeam) : '<span class="flag">🏆</span>'}
      <span class="${awayTeam ? "team-name" : "unknown-team"}">${awayLabel}</span>
      ${(() => {
        if (!awayIsWinner || !awayTeam) return "";
        if (matchDef.round === "FINAL") return '<span class="winner-pill">чемпион</span>';
        if (matchDef.round === "THIRD") return '<span class="winner-pill">3‑е место</span>';
        return '<span class="winner-pill">прошёл дальше</span>';
      })()}
    </div>
    ${awayScoreCell}
  `;

  body.appendChild(homeRow);
  body.appendChild(awayRow);
  wrapper.appendChild(body);

  if (isNormal && canEdit && homeTeam && awayTeam) {
    const setWinner = (side) => {
      updateActiveScenario((s) => {
        if (!s.knockoutResults) s.knockoutResults = {};
        if (!s.knockoutResults[matchDef.id]) {
          s.knockoutResults[matchDef.id] = {
            homeGoals: null,
            awayGoals: null,
          };
        }
        if (side === "home") {
          s.knockoutResults[matchDef.id].homeGoals = 1;
          s.knockoutResults[matchDef.id].awayGoals = 0;
        } else {
          s.knockoutResults[matchDef.id].homeGoals = 0;
          s.knockoutResults[matchDef.id].awayGoals = 1;
        }
      });
    };
    homeRow.addEventListener("click", () => setWinner("home"));
    awayRow.addEventListener("click", () => setWinner("away"));
  }

  if (gridPos) {
    wrapper.style.gridColumn = gridPos.col;
    wrapper.style.gridRow = gridPos.row;
  }

  roundContainer.appendChild(wrapper);
}

function bindTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      const scenario = getActiveScenario();

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document.getElementById(`tab-${tabId}`).classList.add("active");
      if (tabId === "knockout") {
        renderKnockoutView();
      } else if (tabId === "playoffs") {
        renderPlayoffsView();
      } else if (tabId === "groups") {
        renderGroupsView();
      }
    });
  });
}

function bindScenarioControls() {
  const select = document.getElementById("scenario-select");
  select.addEventListener("change", () => {
    setActiveScenario(select.value);
  });

  document.getElementById("scenario-new").addEventListener("click", () => {
    const name =
      prompt("Название сценария:", "Прогноз с другом") || "Новый прогноз";
    const author = prompt("Автор (ваше имя или ник):", "") || "";
    addScenario(name, author);
  });

  document
    .getElementById("scenario-rename")
    .addEventListener("click", () => {
      const s = getActiveScenario();
      if (!s) return;
      const name = prompt("Новое название сценария:", s.name);
      if (!name) return;
      renameActiveScenario(name);
    });

  document
    .getElementById("scenario-delete")
    .addEventListener("click", () => {
      if (!confirm("Удалить текущий сценарий?")) return;
      deleteActiveScenario();
    });

  document
    .getElementById("scenario-export")
    .addEventListener("click", () => {
      const dataStr = JSON.stringify(appState, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wc26-simulations.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

  const importInput = document.getElementById("scenario-import-input");

  document
    .getElementById("scenario-import")
    .addEventListener("click", () => {
      importInput.click();
    });

  importInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed && Array.isArray(parsed.scenarios)) {
          appState = parsed;
          if (appState.scenarios.length && !appState.activeScenarioId) {
            appState.activeScenarioId = appState.scenarios[0].id;
          } else if (!appState.scenarios.length) {
            appState.activeScenarioId = null;
          }
          saveState();
          renderAll();
          alert("Импорт завершён. Сценарии обновлены.");
        } else {
          alert("Файл не похож на экспорт симулятора.");
        }
      } catch (err) {
        console.error(err);
        alert("Не удалось прочитать файл JSON.");
      } finally {
        importInput.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  });

  // Кнопки пустого состояния
  const emptyNewBtn = document.getElementById("empty-new");
  const emptyImportBtn = document.getElementById("empty-import");
  const emptyCreateBtn = document.getElementById("empty-create");
  const emptyNewForm = document.getElementById("empty-new-form");
  const emptyCancelBtn = document.getElementById("empty-cancel");
  const difficultyHintEl = document.getElementById("difficulty-hint");
  const emptyActions = document.querySelector(".empty-actions");

  if (emptyNewBtn && emptyCreateBtn && emptyNewForm) {
    let currentDifficulty = "normal";

    emptyNewBtn.addEventListener("click", () => {
      emptyNewForm.classList.remove("hidden");
      if (emptyActions) emptyActions.classList.add("hidden");
      const nameInput = document.getElementById("empty-scenario-name");
      if (nameInput) nameInput.focus();
    });

    emptyCreateBtn.addEventListener("click", () => {
      const nameInput = document.getElementById("empty-scenario-name");
      const authorInput = document.getElementById("empty-scenario-author");
      if (!nameInput || !authorInput) return;
      const name = nameInput.value.trim() || "Новый прогноз";
      const author = authorInput.value.trim();
      const scenario = createEmptyScenario(name, author, currentDifficulty);
      appState.scenarios.push(scenario);
      appState.activeScenarioId = scenario.id;
      saveState();
      renderAll();
      nameInput.value = "";
      authorInput.value = "";
      emptyNewForm.classList.add("hidden");
    });

    if (emptyCancelBtn) {
      emptyCancelBtn.addEventListener("click", () => {
        emptyNewForm.classList.add("hidden");
        if (emptyActions) emptyActions.classList.remove("hidden");
      });
    }

    const diffButtons = document.querySelectorAll(".difficulty-btn");
    const difficultyHints = {
      normal:
        "Нормально — быстрый режим: перетаскиваешь команды в группах, выбираешь 8 лучших третьих и кликом отмечаешь победителей стыков и плей‑офф без счёта.",
      hard:
        "Сложно — полный режим: вводишь счёт во всех матчах стыков, групп и плей‑офф, таблицы и выход считаются по очкам и разнице мячей.",
    };
    diffButtons.forEach((btn) => {
      const value = btn.dataset.difficulty;
      if (!value) return;
      if (btn.classList.contains("locked")) {
        btn.addEventListener("mouseenter", () => {
          if (difficultyHintEl) {
            difficultyHintEl.textContent = "В разработке";
          }
        });
        btn.addEventListener("mouseleave", () => {
          if (difficultyHintEl) {
            difficultyHintEl.textContent = "";
          }
        });
        return;
      }

      btn.addEventListener("click", () => {
        currentDifficulty = value;
        diffButtons.forEach((b2) => b2.classList.remove("active"));
        btn.classList.add("active");
        if (difficultyHintEl) {
          difficultyHintEl.textContent = difficultyHints[value] || "";
        }
      });

      btn.addEventListener("mouseenter", () => {
        if (difficultyHintEl) {
          difficultyHintEl.textContent = difficultyHints[value] || "";
        }
      });
      btn.addEventListener("mouseleave", () => {
        // оставляем последний выбранный хинт, ничего не очищаем
      });
    });
  }

  if (emptyImportBtn && importInput) {
    emptyImportBtn.addEventListener("click", () => {
      importInput.click();
    });
  }

  // Кнопки сохранения этапов
  const playoffsSaveBtn = document.getElementById("playoffs-save");
  const playoffsResetBtn = document.getElementById("playoffs-reset");
  const groupsSaveBtn = document.getElementById("groups-save");
  const groupsResetBtn = document.getElementById("groups-reset");

  if (playoffsSaveBtn) {
    playoffsSaveBtn.addEventListener("click", () => {
      const s = getActiveScenario();
      if (!s) return;
      ensureGroupOrderForScenario(s);
      if (s.playoffsLocked) {
        alert("Стыки уже сохранены.");
        return;
      }
      if (!arePlayoffsComplete(s)) {
        alert("Сначала заполните все стыковые матчи.");
        return;
      }
      s.playoffsLocked = true;
      saveState();
      renderAll();
    });
  }

  if (playoffsResetBtn) {
    playoffsResetBtn.addEventListener("click", () => {
      const s = getActiveScenario();
      if (!s) return;
      if (
        !confirm(
          "Сбросить стыки? Группы и плей‑офф также будут очищены для этого сценария."
        )
      ) {
        return;
      }
      resetPlayoffsAndLater(s);
      saveState();
      renderAll();
    });
  }

  if (groupsSaveBtn) {
    groupsSaveBtn.addEventListener("click", () => {
      const s = getActiveScenario();
      if (!s) return;
      ensureGroupOrderForScenario(s);
      if (!s.playoffsLocked) {
        alert("Сначала сохраните стыки.");
        return;
      }
      if (s.groupsLocked) {
        alert("Группы уже сохранены.");
        return;
      }
      if (!areGroupsComplete(s)) {
        alert(
          "Сначала завершите групповой этап: заполните все матчи или выберите 8 третьих мест."
        );
        return;
      }
      s.groupsLocked = true;
      saveState();
      renderAll();
    });
  }

  if (groupsResetBtn) {
    groupsResetBtn.addEventListener("click", () => {
      const s = getActiveScenario();
      if (!s) return;
      if (
        !confirm(
          "Сбросить группы? Результаты плей‑офф будут очищены для этого сценария."
        )
      ) {
        return;
      }
      resetGroupsAndLater(s);
      saveState();
      renderAll();
    });
  }
}

// Рендер стыковых матчей
function renderPlayoffsView() {
  const container = document.getElementById("playoffs-container");
  const scenario = getActiveScenario();
  container.innerHTML = "";
  if (!scenario) return;
  if (!scenario.playoffMatches) {
    scenario.playoffMatches = generatePlayoffMatches();
  }

  const allMatches = scenario.playoffMatches;
  const matchesById = {};
  for (const m of allMatches) {
    matchesById[m.id] = m;
  }

  for (const path of PLAYOFFS_CONFIG.paths) {
    const card = document.createElement("div");
    card.className = "round-column";
    card.innerHTML = `<div class="round-title">${path.label}</div>`;

    if (Array.isArray(path.semifinals)) {
      for (const sf of path.semifinals) {
        const m = matchesById[sf.id];
        if (m) {
          card.appendChild(
            createPlayoffMatchRow(
              m,
              sf.homeTeamId,
              sf.awayTeamId,
              undefined,
              !scenario.playoffsLocked
            )
          );
        }
      }
    }

    if (path.final) {
      const fm = matchesById[path.final.id];
      if (fm) {
        let homeTeamId = fm.homeTeamId;
        let awayTeamId = fm.awayTeamId;
        if (!homeTeamId && path.final.homeFromId) {
          const sfMatch = matchesById[path.final.homeFromId];
          homeTeamId = getPlayoffMatchWinner(sfMatch);
        }
        if (!awayTeamId && path.final.awayFromId) {
          const sfMatch = matchesById[path.final.awayFromId];
          awayTeamId = getPlayoffMatchWinner(sfMatch);
        }
        card.appendChild(
          createPlayoffMatchRow(
            fm,
            homeTeamId,
            awayTeamId,
            "Финал пути",
            !scenario.playoffsLocked
          )
        );
      }
    }

    container.appendChild(card);
  }

  container.querySelectorAll(".score-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const matchId = e.target.dataset.matchId;
      const side = e.target.dataset.side;
      const raw = e.target.value;
      const value = raw === "" ? null : Math.max(0, Number(raw));
      updateActiveScenario((s) => {
        if (!s.playoffMatches) s.playoffMatches = generatePlayoffMatches();
        const match = s.playoffMatches.find((m) => m.id === matchId);
        if (!match) return;
        if (side === "home") match.homeGoals = value;
        else match.awayGoals = value;
      });
    });
  });
}

function createPlayoffMatchRow(
  match,
  homeTeamId,
  awayTeamId,
  title,
  canEdit = true
) {
  const wrapper = document.createElement("div");
  wrapper.className = "knockout-match";

  const header = document.createElement("div");
  header.className = "knockout-match-header";
  header.innerHTML = `
    <span>${title || "Полуфинал пути"}</span>
    <span>${match.id}</span>
  `;
  wrapper.appendChild(header);

  const body = document.createElement("div");

  const scenario = getActiveScenario();
  const isNormal = scenario && scenario.difficulty === "normal";
  const home = homeTeamId ? getDisplayTeam(homeTeamId, scenario) : null;
  const away = awayTeamId ? getDisplayTeam(awayTeamId, scenario) : null;
  const homeLabel = home ? home.name : "—";
  const awayLabel = away ? away.name : "—";

  let winnerSide = null;
  if (match.homeGoals != null && match.awayGoals != null) {
    if (match.homeGoals > match.awayGoals) winnerSide = "home";
    else if (match.homeGoals < match.awayGoals) winnerSide = "away";
  }

  const homeRow = document.createElement("div");
  homeRow.className =
    "knockout-team-row" + (winnerSide === "home" ? " winner" : "");
  const homeScoreCell = isNormal
    ? '<div class="knockout-score-placeholder"></div>'
    : `<div>
        <input class="score-input" type="number" min="0" data-match-id="${
          match.id
        }" data-side="home" value="${match.homeGoals ?? ""}" ${
        canEdit ? "" : "disabled"
      } />
      </div>`;
  homeRow.innerHTML = `
    <div class="knockout-team-main">
      ${home ? renderFlagHtml(home) : '<span class="flag">🏆</span>'}
      <span class="${home ? "team-name" : "unknown-team"}">${homeLabel}</span>
    </div>
    ${homeScoreCell}
  `;

  const awayRow = document.createElement("div");
  awayRow.className =
    "knockout-team-row" + (winnerSide === "away" ? " winner" : "");
  const awayScoreCell = isNormal
    ? '<div class="knockout-score-placeholder"></div>'
    : `<div>
        <input class="score-input" type="number" min="0" data-match-id="${
          match.id
        }" data-side="away" value="${match.awayGoals ?? ""}" ${
        canEdit ? "" : "disabled"
      } />
      </div>`;
  awayRow.innerHTML = `
    <div class="knockout-team-main">
      ${away ? renderFlagHtml(away) : '<span class="flag">🏆</span>'}
      <span class="${away ? "team-name" : "unknown-team"}">${awayLabel}</span>
    </div>
    ${awayScoreCell}
  `;

  body.appendChild(homeRow);
  body.appendChild(awayRow);
  wrapper.appendChild(body);

  if (isNormal && canEdit && home && away) {
    const setWinner = (side) => {
      updateActiveScenario((s) => {
        if (!s.playoffMatches) s.playoffMatches = generatePlayoffMatches();
        const mm = s.playoffMatches.find((m2) => m2.id === match.id);
        if (!mm) return;
        if (side === "home") {
          mm.homeGoals = 1;
          mm.awayGoals = 0;
        } else {
          mm.homeGoals = 0;
          mm.awayGoals = 1;
        }
      });
    };
    homeRow.addEventListener("click", () => setWinner("home"));
    awayRow.addEventListener("click", () => setWinner("away"));
  }

  return wrapper;
}

// Проверки полноты этапов
function arePlayoffsComplete(scenario) {
  if (!scenario.playoffMatches || !scenario.playoffMatches.length) return false;
  const winners = getPlayoffSlotWinnersMap(scenario);
  return [...PLAYOFF_SLOT_IDS].every((slotId) => winners[slotId]);
}

function areGroupsComplete(scenario) {
  if (scenario.difficulty === "normal") {
    ensureGroupOrderForScenario(scenario);
    return (
      Array.isArray(scenario.bestThirdsManual) &&
      scenario.bestThirdsManual.length === 8
    );
  }
  if (!scenario.groupMatches || !scenario.groupMatches.length) return false;
  return scenario.groupMatches.every(
    (m) => m.homeGoals != null && m.awayGoals != null
  );
}

function resetPlayoffsAndLater(scenario) {
  ensureGroupOrderForScenario(scenario);
  scenario.playoffsLocked = false;
  scenario.groupsLocked = false;
  scenario.playoffMatches = generatePlayoffMatches();
  scenario.groupMatches = generateAllGroupMatches();
  scenario.knockoutResults = {};
  scenario.bestThirdsManual = [];
  scenario.groupOrder = {};
  for (const group of WORLD_CUP_2026_CONFIG.groups) {
    scenario.groupOrder[group.id] = group.teams.map((t) => t.id);
  }
}

function resetGroupsAndLater(scenario) {
  ensureGroupOrderForScenario(scenario);
  scenario.groupsLocked = false;
  scenario.knockoutResults = {};
  if (scenario.difficulty === "normal") {
    scenario.bestThirdsManual = [];
    scenario.groupOrder = {};
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      scenario.groupOrder[group.id] = group.teams.map((t) => t.id);
    }
  } else {
    scenario.groupMatches = generateAllGroupMatches();
  }
}

function renderAll() {
  renderScenarioSelector();

  const hasScenario = !!getActiveScenario();
  const tabsEl = document.querySelector(".tabs");
  const mainEl = document.querySelector(".app-main");
  const scenarioBarEl = document.querySelector(".scenario-bar");
  const emptyStateEl = document.getElementById("empty-state");

  if (!hasScenario) {
    if (tabsEl) tabsEl.classList.add("hidden");
    if (mainEl) mainEl.classList.add("hidden");
    if (scenarioBarEl) scenarioBarEl.classList.add("hidden");
    if (emptyStateEl) emptyStateEl.classList.remove("hidden");
    return;
  }

  if (tabsEl) tabsEl.classList.remove("hidden");
  if (mainEl) mainEl.classList.remove("hidden");
  if (scenarioBarEl) scenarioBarEl.classList.remove("hidden");
  if (emptyStateEl) emptyStateEl.classList.add("hidden");
  const knockoutTabActive = document
    .getElementById("tab-knockout")
    .classList.contains("active");
  const playoffsTabActive = document
    .getElementById("tab-playoffs")
    .classList.contains("active");
  if (knockoutTabActive) {
    renderKnockoutView();
  }
  if (playoffsTabActive) {
    renderPlayoffsView();
  }
  const groupsTabActive = document
    .getElementById("tab-groups")
    .classList.contains("active");
  if (groupsTabActive) {
    renderGroupsView();
  }
}

function initApp() {
  loadState();
  if (appState.scenarios.length && !appState.activeScenarioId) {
    appState.activeScenarioId = appState.scenarios[0].id;
  }
  bindTabs();
  bindScenarioControls();

  // Модальное окно группы
  const modal = document.getElementById("group-modal");
  modal.addEventListener("click", (e) => {
    if (e.target.dataset.modalClose === "true") {
      modal.classList.add("hidden");
    }
  });

  renderAll();
}

document.addEventListener("DOMContentLoaded", initApp);

// Открытие модального окна с матчами выбранной группы
function openGroupModal(groupId) {
  const scenario = getActiveScenario();
  if (!scenario) return;
  const group = WORLD_CUP_2026_CONFIG.groups.find((g) => g.id === groupId);
  if (!group) return;
  const canEdit =
    scenario.playoffsLocked && arePlayoffsComplete(scenario);

  const modal = document.getElementById("group-modal");
  const titleEl = document.getElementById("group-modal-title");
  const body = document.getElementById("group-modal-body");

  titleEl.textContent = `${group.name} — матчи и счёт`;

  const matches = scenario.groupMatches.filter((m) => m.groupId === group.id);

  const table = document.createElement("table");
  table.className = "matches-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Матч</th>
        <th style="width:70px;text-align:center">Счёт</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  for (const m of matches) {
    const home = getDisplayTeam(m.homeTeamId, scenario);
    const away = getDisplayTeam(m.awayTeamId, scenario);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="standings-team">
          ${renderFlagHtml(home)}
          <span class="team-name">${home.name}</span>
          <span style="margin:0 4px;color:#6b7280">vs</span>
          ${renderFlagHtml(away)}
          <span class="team-name">${away.name}</span>
        </div>
      </td>
      <td class="score-cell">
        <input class="score-input" type="number" min="0" data-match-id="${
          m.id
        }" data-side="home" value="${m.homeGoals ?? ""}" ${
          canEdit ? "" : "disabled"
        } />
        <span>:</span>
        <input class="score-input" type="number" min="0" data-match-id="${
          m.id
        }" data-side="away" value="${m.awayGoals ?? ""}" ${
          canEdit ? "" : "disabled"
        } />
      </td>
    `;
    tbody.appendChild(tr);
  }

  body.innerHTML = "";
  body.appendChild(table);

  body.querySelectorAll(".score-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const matchId = e.target.dataset.matchId;
      const side = e.target.dataset.side;
      const raw = e.target.value;
      const value = raw === "" ? null : Math.max(0, Number(raw));
      updateActiveScenario((s) => {
        const match = s.groupMatches.find((mm) => mm.id === matchId);
        if (!match) return;
        if (side === "home") match.homeGoals = value;
        else match.awayGoals = value;
      });
    });
  });

  modal.classList.remove("hidden");
}


