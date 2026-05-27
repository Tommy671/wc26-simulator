/**
 * Движок автосимуляции для лёгкого режима Telegram.
 * Зависит от: data.js, team-ratings.js
 */
const SimEngine = (function () {
  const DEFAULT_POINTS = 1500;
  const DEFAULT_FORM = 'DDDDDDDDDD';
  const HOME_ATTACK_BOOST = 1.1;
  /** Среднее голов за матч на ЧМ (~2.5) */
  const BASE_MATCH_GOALS = 2.45;

  function getRatingEntry(teamId) {
    return (typeof TEAM_RATINGS !== 'undefined' && TEAM_RATINGS[teamId]) || {};
  }

  function formToScore(formStr) {
    const s = (formStr || DEFAULT_FORM).toUpperCase().replace(/[^WDL]/g, '');
    if (!s.length) return 0.5;
    let pts = 0;
    for (const ch of s.slice(0, 10)) {
      if (ch === 'W') pts += 3;
      else if (ch === 'D') pts += 1;
    }
    const maxPts = Math.min(s.length, 10) * 3;
    return maxPts ? pts / maxPts : 0.5;
  }

  /** Сила команды: очки FIFA + бонус формы. */
  function getTeamStrength(teamId) {
    const entry = getRatingEntry(teamId);
    let base = DEFAULT_POINTS;

    if (entry.fifaPoints != null) {
      base = entry.fifaPoints;
    } else if (entry.fifaRank != null) {
      base = 2150 - 9 * entry.fifaRank;
    }

    const formBonus = (formToScore(entry.form) - 0.5) * 50;
    return base + formBonus;
  }

  function hasConfiguredRatings() {
    if (typeof TEAM_RATINGS === 'undefined') return false;
    return Object.values(TEAM_RATINGS).some(
      (r) => r && (r.fifaPoints != null || r.fifaRank != null)
    );
  }

  function randomPoisson(lambda) {
    const L = Math.exp(-Math.max(0.04, lambda));
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  function isHost(teamId) {
    return typeof HOST_TEAM_IDS !== 'undefined' && HOST_TEAM_IDS.has(teamId);
  }

  /** Доля «атакующего потенциала» дома (логистика по Elo). */
  function homeAttackShare(homeStr, awayStr) {
    return 1 / (1 + Math.pow(10, (awayStr - homeStr) / 400));
  }

  /**
   * Голы через Пуассон: сила → ожидаемая доля голов → λ.
   * Большой разрыв (GER–CUW) даёт редкие крупные счета; близкие — упорные матчи.
   */
  function simulateGoals(homeId, awayId, opts) {
    const knockout = !!(opts && opts.knockout);
    const homeStr = getTeamStrength(homeId);
    const awayStr = getTeamStrength(awayId);
    const gap = homeStr - awayStr;
    const share = homeAttackShare(homeStr, awayStr);

    // Раньше диапазон давал слишком много низовых матчей (0:0/1:0).
    const variance = 0.7 + Math.random() * 0.8;
    const totalGoals = BASE_MATCH_GOALS * variance;

    let lambdaHome = Math.max(0.14, totalGoals * share * 1.08);
    let lambdaAway = Math.max(0.14, totalGoals * (1 - share));

    if (gap > 120) {
      const blowout = Math.min(1.2, (gap - 120) / 450);
      lambdaHome *= 1 + blowout;
      lambdaAway *= Math.max(0.15, 1 - blowout * 1.15);
    } else if (gap < -120) {
      const blowout = Math.min(1.2, (-gap - 120) / 450);
      lambdaAway *= 1 + blowout;
      lambdaHome *= Math.max(0.15, 1 - blowout * 1.15);
    }

    if (isHost(homeId)) lambdaHome *= HOME_ATTACK_BOOST;

    let homeGoals = randomPoisson(lambdaHome);
    let awayGoals = randomPoisson(lambdaAway);

    if (knockout && homeGoals === awayGoals) {
      const pHome = homeAttackShare(homeStr, awayStr);
      if (Math.random() < pHome) homeGoals += 1;
      else awayGoals += 1;
    }

    return { homeGoals, awayGoals };
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

  function calcStandingsForGroup(groupId, matches) {
    const group = WORLD_CUP_2026_CONFIG.groups.find((g) => g.id === groupId);
    if (!group) return [];

    const stats = {};
    for (const t of group.teams) {
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

    for (const m of matches) {
      if (m.homeGoals == null || m.awayGoals == null) continue;
      const home = stats[m.homeTeamId];
      const away = stats[m.awayTeamId];
      if (!home || !away) continue;

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

    const teamName = (id) => {
      const t = group.teams.find((x) => x.id === id);
      return t ? t.name : id;
    };

    return Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return teamName(a.teamId).localeCompare(teamName(b.teamId), 'ru');
    });
  }

  function simulateGroup(groupId) {
    const group = WORLD_CUP_2026_CONFIG.groups.find((g) => g.id === groupId);
    if (!group) return { matches: [], standings: [] };

    const matches = generateGroupMatchesForGroup(group);
    for (const m of matches) {
      const score = simulateGoals(m.homeTeamId, m.awayTeamId, { knockout: false });
      m.homeGoals = score.homeGoals;
      m.awayGoals = score.awayGoals;
    }

    return {
      matches,
      standings: calcStandingsForGroup(groupId, matches),
    };
  }

  function sortThirdCandidates(a, b, nameFn) {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return nameFn(a.teamId).localeCompare(nameFn(b.teamId), 'ru');
  }

  function pickBestThirds(standingsByGroup) {
    const thirds = [];
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const st = standingsByGroup[group.id] || [];
      if (st[2]) thirds.push({ ...st[2], position: 3 });
    }

    const nameById = {};
    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      for (const t of group.teams) nameById[t.id] = t.name;
    }

    thirds.sort((a, b) => sortThirdCandidates(a, b, (id) => nameById[id] || id));
    return thirds.slice(0, 8).map((row) => ({
      groupId: row.groupId,
      teamId: row.teamId,
      points: row.points,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
    }));
  }

  function simulateKnockoutRound(rounds, winners, results) {
    const roundOrder = ['R32', 'R16', 'QF', 'SF', 'FINAL', 'THIRD'];

    function getTeams(match) {
      if (match.round === 'R32') {
        return { homeId: match.homeTeamId, awayId: match.awayTeamId };
      }
      function resolveSource(src) {
        const srcMatch = rounds[src.round][src.index];
        if (!srcMatch) return null;
        const winner = winners[srcMatch.id];
        if (!winner) return null;
        if (!src.loser) return winner;
        const t =
          srcMatch.round === 'R32'
            ? { homeId: srcMatch.homeTeamId, awayId: srcMatch.awayTeamId }
            : getTeams(srcMatch);
        if (!t.homeId || !t.awayId) return null;
        return winner === t.homeId ? t.awayId : t.homeId;
      }
      return {
        homeId: resolveSource(match.homeSource),
        awayId: resolveSource(match.awaySource),
      };
    }

    for (const roundId of roundOrder) {
      const list = rounds[roundId] || [];
      for (const match of list) {
        const teams = getTeams(match);
        if (!teams.homeId || !teams.awayId) continue;

        const score = simulateGoals(teams.homeId, teams.awayId, { knockout: true });
        const winnerId =
          score.homeGoals > score.awayGoals ? teams.homeId : teams.awayId;

        results[match.id] = {
          homeGoals: score.homeGoals,
          awayGoals: score.awayGoals,
          winnerId,
        };
        winners[match.id] = winnerId;
      }
    }
  }

  function runTournament(buildBracket) {
    if (typeof WORLD_CUP_2026_CONFIG === 'undefined') {
      throw new Error('WORLD_CUP_2026_CONFIG не загружен');
    }

    const groupMatches = [];
    const standingsByGroup = {};

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const sim = simulateGroup(group.id);
      groupMatches.push(...sim.matches);
      standingsByGroup[group.id] = sim.standings;
    }

    const bestThirds = pickBestThirds(standingsByGroup);

    const qualifiers = {
      standingsByGroup: {},
      bestThirds,
    };

    for (const group of WORLD_CUP_2026_CONFIG.groups) {
      const st = standingsByGroup[group.id] || [];
      qualifiers.standingsByGroup[group.id] = st.map((row) => ({
        teamId: row.teamId,
        groupId: row.groupId,
      }));
    }

    const rounds = buildBracket(qualifiers);
    const knockoutResults = {};
    const knockoutWinners = {};
    simulateKnockoutRound(rounds, knockoutWinners, knockoutResults);

    return {
      groupMatches,
      standingsByGroup,
      bestThirds,
      qualifiers,
      rounds,
      knockoutResults,
      knockoutWinners,
      ratingsConfigured: hasConfiguredRatings(),
    };
  }

  return {
    runTournament,
    getTeamStrength,
    hasConfiguredRatings,
  };
})();
