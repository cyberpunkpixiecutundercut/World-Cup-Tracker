// app.js — ROUND ENGINE (24 / 32 / 48 TEAMS)
// WORLD CUP TRACKER / EDITOR (GROUP STATS + KNOCKOUTS)
"use strict";

/* ============================================================
   DYNAMIC ROUND KEYS (24 / 32 / 48)
============================================================ */
function getRoundKeysForFormat(fmt) {
  if (fmt === 48) {
    return [
      "groupstage",
      "round32",
      "round16",
      "quarterfinals",
      "semifinals",
      "thirdplace",
      "final"
    ];
  }
  return [
    "groupstage",
    "round16",
    "quarterfinals",
    "semifinals",
    "thirdplace",
    "final"
  ];
}

let ROUND_KEYS = getRoundKeysForFormat(32);

const ROUND_LABELS = {
  groupstage: "Group Stage",
  round32: "Round of 32",
  round16: "Round of 16",
  quarterfinals: "Quarterfinals",
  semifinals: "Semifinals",
  thirdplace: "Third Place",
  final: "Final"
};

/* ============================================================
   GLOBAL STATE
============================================================ */
let worldCupsList = [];
let currentWorldCup = null;

let finishedCurrentRound = "groupstage";

let editYear = null;
let editFormat = null;
let editTeams = null;
let editSeason = null;
let editPaths = null;

/* ============================================================
   DOM HELPERS
============================================================ */
function $(id) {
  return document.getElementById(id);
}

/* ============================================================
   TEAM HELPERS
============================================================ */
function getAllTeams(worldcup) {
  const res = [];
  const groups = worldcup?.teams?.groups || [];
  groups.forEach(g => {
    (g.teams || []).forEach(t => res.push({ id: t.id, name: t.name, group: g.id }));
  });
  return res;
}

function findTeamName(worldcup, id) {
  if (!id) return "";
  const groups = worldcup?.teams?.groups || [];
  for (const g of groups) {
    for (const t of g.teams) {
      if (t.id === id) return t.name;
    }
  }
  return id || "";
}

/* ============================================================
   SINGLE MATCH STATS
============================================================ */
function computeSingleMatchStats(teamId, match, format) {
  if (!match || match.score1 == null || match.score2 == null) {
    return {
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0
    };
  }

  const f = Number(format);
  const pointsPerWin = (f === 24 ? 2 : 3);

  const isHome = match.team1 === teamId;
  const gf = isHome ? match.score1 : match.score2;
  const ga = isHome ? match.score2 : match.score1;

  let wins = 0, draws = 0, losses = 0, points = 0;

  if (gf > ga) {
    wins = 1;
    points = pointsPerWin;
  } else if (gf < ga) {
    losses = 1;
    points = 0;
  } else {
    draws = 1;
    points = 1;
  }

  return {
    wins,
    draws,
    losses,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDiff: gf - ga,
    points
  };
}

/* ============================================================
   GROUP TABLE (RAW)
============================================================ */
function computeGroupTable(teamIds, teamList, matches, format) {
  const table = {};

  const f = Number(format);
  const pointsPerWin = (f === 24 ? 2 : 3);

  teamList.forEach(t => {
    table[t.id] = {
      id: t.id,
      name: t.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0
    };
  });

  matches.forEach(m => {
    if (!teamIds.includes(m.team1) || !teamIds.includes(m.team2)) return;
    if (m.score1 == null || m.score2 == null) return;

    const home = table[m.team1];
    const away = table[m.team2];

    home.played++;
    away.played++;

    home.goalsFor += m.score1;
    home.goalsAgainst += m.score2;
    home.goalDiff = home.goalsFor - home.goalsAgainst;

    away.goalsFor += m.score2;
    away.goalsAgainst += m.score1;
    away.goalDiff = away.goalsFor - away.goalsAgainst;

    if (m.score1 > m.score2) {
      home.wins++;
      home.points += pointsPerWin;
      away.losses++;
    } else if (m.score2 > m.score1) {
      away.wins++;
      away.points += pointsPerWin;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    }
  });

  return Object.values(table);
}

/* ============================================================
   DEFAULT GROUP SORT (NO DRAWING LOTS)
============================================================ */
function sortGroupTable(table) {
  return table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });
}

/* ============================================================
   GROUP STANDINGS GENERIC (NO DRAWING LOTS)
============================================================ */
function computeGroupStandingsGeneric(groupId, teams, matches, format) {
  const table = {};
  const f = Number(format);
  const pointsPerWin = (f === 24 ? 2 : 3);

  teams.forEach(t => {
    table[t.id] = {
      id: t.id,
      name: t.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0
    };
  });

  matches.forEach(m => {
    const { team1, score1, team2, score2 } = m;
    if (score1 == null || score2 == null) return;
    if (!table[team1] || !table[team2]) return;

    const t1 = table[team1];
    const t2 = table[team2];

    t1.played++;
    t2.played++;

    t1.goalsFor += score1;
    t1.goalsAgainst += score2;
    t2.goalsFor += score2;
    t2.goalsAgainst += score1;

    if (score1 > score2) {
      t1.wins++;
      t1.points += pointsPerWin;
      t2.losses++;
    } else if (score1 < score2) {
      t2.wins++;
      t2.points += pointsPerWin;
      t1.losses++;
    } else {
      t1.draws++;
      t2.draws++;
      t1.points++;
      t2.points++;
    }
  });

  const rows = Object.values(table);
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  rows.forEach((r, idx) => {
    r.rank = idx + 1;
    r.goalDiff = r.goalsFor - r.goalsAgainst;
  });

  return { groupId, table: rows };
}

/* ============================================================
   ALL GROUP STANDINGS (WITH DRAWING LOTS OVERRIDE)
============================================================ */
function computeAllGroupStandings(worldcup) {
  const groups = worldcup?.teams?.groups || [];
  const matches = worldcup?.season?.groupstage?.matches || [];
  const format = worldcup?.format || 32;

  const standings = [];
  const dlArray = Array.isArray(worldcup.drawingLotsData)
    ? worldcup.drawingLotsData
    : (worldcup.drawingLotsData ? [worldcup.drawingLotsData] : []);

  groups.forEach(group => {
    const teamIds = (group.teams || []).map(t => t.id);

    // RAW TABLE
    const table = computeGroupTable(teamIds, group.teams, matches, format);

    // DEFAULT SORT
    const sorted = sortGroupTable([...table]);
    table.length = 0;
    table.push(...sorted);

    // DRAWING LOTS OVERRIDE (IF ANY)
    const dl = dlArray.find(x => x.groupId === group.id);
    if (dl) {
      const winner = table.find(r => r.name === dl.winner);
      const loser = table.find(
        r => r.name !== dl.winner && dl.teams.includes(r.name)
      );

      if (winner && loser) {
        table.forEach((row, index) => {
          row.place = group.id + (index + 1);
          row.groupId = group.id;
        });

        winner.place = group.id + "2";
        loser.place = group.id + "3";

        table.sort((a, b) => a.place.localeCompare(b.place));
      }
    }

    standings.push({
      groupId: group.id,
      table: table
    });
  });

  return standings;
}


/* ============================================================
   FORMAT DETECTOR + UNIVERSAL PROCESSOR
============================================================ */
function detectWorldCupFormat(worldcup) {
  const groups = worldcup?.teams?.groups || [];
  const totalTeams = groups.reduce(
    (sum, g) => sum + (g.teams?.length || 0),
    0
  );
  if (totalTeams === 24) return 24;
  if (totalTeams === 32) return 32;
  if (totalTeams === 48) return 48;
  return null;
}

// ============================================================
// 24‑TEAM FIFA KNOCKOUT MATRIX (OFFICIAL)
// ============================================================
const matrixThirdPlaces = {
  "A+B+C+D": [
    { team1: "A3", team2: "C3" },
    { team1: "B3", team2: "D3" }
  ],
  "A+B+C+E": [
    { team1: "A3", team2: "C3" },
    { team1: "B3", team2: "E3" }
  ],
  "A+B+C+F": [
    { team1: "A3", team2: "C3" },
    { team1: "B3", team2: "F3" }
  ],
  "A+B+D+E": [
    { team1: "A3", team2: "D3" },
    { team1: "B3", team2: "E3" }
  ],
  "A+B+D+F": [
    { team1: "A3", team2: "D3" },
    { team1: "B3", team2: "F3" }
  ],
  "A+B+E+F": [
    { team1: "A3", team2: "E3" },
    { team1: "B3", team2: "F3" }
  ],
  "A+C+D+E": [
    { team1: "C3", team2: "D3" },
    { team1: "A3", team2: "E3" }
  ],
  "A+C+D+F": [
    { team1: "C3", team2: "D3" },
    { team1: "A3", team2: "F3" }
  ],
  "A+C+E+F": [
    { team1: "C3", team2: "E3" },
    { team1: "A3", team2: "F3" }
  ],
  "A+D+E+F": [
    { team1: "D3", team2: "E3" },
    { team1: "A3", team2: "F3" }
  ],
  "B+C+D+E": [
    { team1: "C3", team2: "D3" },
    { team1: "B3", team2: "E3" }
  ],
  "B+C+D+F": [
    { team1: "C3", team2: "D3" },
    { team1: "B3", team2: "F3" }
  ],
  "B+C+E+F": [
    { team1: "C3", team2: "E3" },
    { team1: "B3", team2: "F3" }
  ],
  "B+D+E+F": [
    { team1: "D3", team2: "E3" },
    { team1: "B3", team2: "F3" }
  ],
  "C+D+E+F": [
    { team1: "D3", team2: "E3" },
    { team1: "C3", team2: "F3" }
  ]
};


// =======================
// GROUP ENGINE + PLACE MAP
// =======================
function processWorldCupAuto(worldcup) {
  const format = detectWorldCupFormat(worldcup);

  const groupStandings = computeAllGroupStandings({
    ...worldcup,
    format
  });

  const matches = worldcup?.season?.groupstage?.matches || [];
  const hasAnyScore = matches.some(m => m.score1 != null && m.score2 != null);

  const qualifiers = {
    round32: { direct: [], thirds: [], matrixThirdPlaces: [] },
    round16: { direct: [], thirds: [], matrixThirdPlaces: [] },
    eliminatedGroups: []
  };

  const drawingLots = {
    needed: false,
    groupId: null,
    teams: [],
    winner: null
  };

  if (!hasAnyScore) {
    return {
      format: { teams: format },
      groups: groupStandings,
      qualifiers,
      placeMap: {},
      memory: { auto: [], thirdsOrdered: [], bestThirdsOrdered: [] },
      drawingLots
    };
  }

  /* ============================================================
     24‑TEAM FORMAT
  ============================================================ */
  if (format === 24) {

    // STEP 1 — assign place codes and auto qualifiers
    groupStandings.forEach(g => {
      const t = g.table;

      t.forEach((row, index) => {
        row.place = g.groupId + (index + 1);
        row.groupId = g.groupId;
      });

      qualifiers.round16.direct.push(t[0].place);
      qualifiers.round16.direct.push(t[1].place);

      qualifiers.eliminatedGroups.push(t[3].id);
    });

    // STEP 1B — APPLY drawinglots.json OVERRIDE (OBJECT OR ARRAY)
    if (worldcup.drawingLotsData) {
      const dlArray = Array.isArray(worldcup.drawingLotsData)
        ? worldcup.drawingLotsData
        : [worldcup.drawingLotsData];

      dlArray.forEach(dl => {
        const g = groupStandings.find(x => x.groupId === dl.groupId);
        if (!g) return;

        const t = g.table;

        const winner = t.find(r => r.name === dl.winner);
        const loser = t.find(
          r => r.name !== dl.winner && dl.teams.includes(r.name)
        );

        if (winner && loser) {
          const winnerOldPlace = winner.place;
          const loserOldPlace = loser.place;

          winner.place = dl.groupId + "2";
          loser.place = dl.groupId + "3";

          g.table.sort((a, b) => a.place.localeCompare(b.place));

          drawingLots.needed = false;
          drawingLots.groupId = dl.groupId;
          drawingLots.teams = dl.teams;
          drawingLots.winner = dl.winner;

          qualifiers.round16.direct = qualifiers.round16.direct.map(p => {
            if (p === loserOldPlace) return loser.place;
            if (p === winnerOldPlace) return winner.place;
            return p;
          });
        }
      });
    }

    // STEP 1C — DETECT TIES WHEN NO drawinglots.json → UI DOWNLOAD BUTTON
    if (!worldcup.drawingLotsData) {
      for (const g of groupStandings) {
        // RAW TABLE (unsorted) to preserve tie
        const rawTable = computeGroupTable(
          g.table.map(r => r.id),
          (worldcup.teams.groups.find(x => x.id === g.groupId) || {}).teams || [],
          matches,
          format
        );

        for (let i = 0; i < rawTable.length; i++) {
          for (let j = i + 1; j < rawTable.length; j++) {
            const A = rawTable[i];
            const B = rawTable[j];

            const equal =
              A.points === B.points &&
              A.goalDiff === B.goalDiff &&
              A.goalsFor === B.goalsFor;

            if (equal) {
              drawingLots.needed = true;
              drawingLots.groupId = g.groupId;
              drawingLots.teams = [A.name, B.name];
              drawingLots.winner = null;
              break;
            }
          }
          if (drawingLots.needed) break;
        }
        if (drawingLots.needed) break;
      }
    }

    // STEP 2 — collect A3..F3
    const thirdPlaces = groupStandings.map(g => {
      const r = g.table[2];
      return {
        id: r.id,
        name: r.name,
        groupId: r.groupId,
        points: r.points,
        goalDiff: r.goalDiff,
        goalsFor: r.goalsFor,
        place: r.place
      };
    });

    // STEP 3 — sort by FIFA rules
    thirdPlaces.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    });

    // STEP 4 — pick best 4
    const bestFour = thirdPlaces.slice(0, 4);

    // STEP 5 — build matrix key
    const matrixKey = bestFour
      .map(t => t.groupId)
      .sort()
      .join("+");

    // STEP 6 — apply FIFA matrix
    const row = matrixThirdPlaces[matrixKey] || [];

    const assignedThirds = row
      .flatMap(m => [m.team1, m.team2])
      .filter(p => p.endsWith("3"))
      .slice(0, 4);

    qualifiers.round16.thirds = assignedThirds;
    qualifiers.round16.matrixThirdPlaces = [...assignedThirds];

    // STEP 7 — eliminate unassigned 3rd-place teams
    const allThirdPlaces = thirdPlaces.map(t => t.place);
    const unassigned = allThirdPlaces.filter(p => !assignedThirds.includes(p));

    unassigned.forEach(p => {
      const teamId = groupStandings
        .flatMap(g => g.table)
        .find(r => r.place === p)?.id;
      if (teamId) qualifiers.eliminatedGroups.push(teamId);
    });

    const memory = {
      auto: [...qualifiers.round16.direct],
      thirdsOrdered: thirdPlaces.map(t => t.place),
      bestThirdsOrdered: bestFour.map(t => t.place)
    };

    const placeMap = {};
    const qualifiedPlaces = [
      ...qualifiers.round16.direct,
      ...qualifiers.round16.thirds
    ];

    groupStandings.forEach(g => {
      g.table.forEach(r => {
        if (qualifiedPlaces.includes(r.place)) {
          placeMap[r.place] = r.id;
        }
      });
    });

    return {
      format: { teams: format },
      groups: groupStandings,
      qualifiers,
      placeMap,
      memory,
      drawingLots
    };
  }

  /* ============================================================
     32‑TEAM FORMAT
  ============================================================ */
  if (format === 32) {
    groupStandings.forEach(g => {
      const t = g.table;

      t.forEach((row, index) => {
        row.place = g.groupId + (index + 1);
        row.groupId = g.groupId;
      });

      qualifiers.round16.direct.push(t[0].place);
      qualifiers.round16.direct.push(t[1].place);
      qualifiers.eliminatedGroups.push(t[2].id, t[3].id);
    });

    const placeMap = {};
    qualifiers.round16.direct.forEach(p => {
      const teamId = groupStandings
        .flatMap(g => g.table)
        .find(r => r.place === p)?.id;
      if (teamId) placeMap[p] = teamId;
    });

    return {
      format: { teams: format },
      groups: groupStandings,
      qualifiers,
      placeMap,
      memory: { auto: [...qualifiers.round16.direct] },
      drawingLots
    };
  }

  /* ============================================================
     48‑TEAM FORMAT
  ============================================================ */
  if (format === 48) {
    const thirds = [];

    groupStandings.forEach(g => {
      const t = g.table;

      t.forEach((row, index) => {
        row.place = g.groupId + (index + 1);
        row.groupId = g.groupId;
      });

      qualifiers.round32.direct.push(t[0].place);
      qualifiers.round32.direct.push(t[1].place);

      thirds.push({
        id: t[2].id,
        name: t[2].name,
        groupId: g.groupId,
        points: t[2].points,
        goalDiff: t[2].goalDiff,
        goalsFor: t[2].goalsFor,
        place: t[2].place
      });

      qualifiers.eliminatedGroups.push(t[3].id);
    });

    thirds.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    });

    const bestThirds = thirds.slice(0, 8);
    qualifiers.round32.thirds = bestThirds.map(t => t.place);

    const placeMap = {};
    [...qualifiers.round32.direct, ...qualifiers.round32.thirds].forEach(p => {
      const teamId = groupStandings
        .flatMap(g => g.table)
        .find(r => r.place === p)?.id;
      if (teamId) placeMap[p] = teamId;
    });

    return {
      format: { teams: format },
      groups: groupStandings,
      qualifiers,
      placeMap,
      memory: { auto: [...qualifiers.round32.direct] },
      drawingLots
    };
  }
}



/* ============================================================
   AUTO GENERATE GROUP FIXTURES
============================================================ */
function generateGroupFixtures(teamsData) {
  const matches = [];
  const groups = teamsData?.groups || [];

  groups.forEach(group => {
    const t = group.teams || [];
    if (t.length < 4) return;

    const [t1, t2, t3, t4] = t.map(x => x.id);

    const add = (a, b) => {
      matches.push({
        stage: "groupstage",
        groupId: group.id,
        team1: a,
        team2: b,
        score1: null,
        score2: null,
        extraTime: "",
        penalty: ""
      });
    };

    add(t1, t2);
    add(t3, t4);
    add(t1, t3);
    add(t2, t4);
    add(t1, t4);
    add(t2, t3);
  });

  return matches;
}

/* ============================================================
   KNOCKOUT GENERATION (ROUND32 → ROUND16 → ...)
============================================================ */
function getMatchWinner(m) {
  if (m.score1 == null || m.score2 == null) return null;

  if (m.score1 > m.score2) return m.team1;
  if (m.score2 > m.score1) return m.team2;

  if (m.extraTime && m.extraTime.includes("-")) {
    const [et1, et2] = m.extraTime.split("-").map(n => parseInt(n, 10));
    if (et1 > et2) return m.team1;
    if (et2 > et1) return m.team2;
  } else if (m.et1 != null && m.et2 != null) {
    if (m.et1 > m.et2) return m.team1;
    if (m.et2 > m.et1) return m.team2;
  }

  if (m.penalty && m.penalty.includes("-")) {
    const [p1, p2] = m.penalty.split("-").map(n => parseInt(n, 10));
    if (p1 > p2) return m.team1;
    if (p2 > p1) return m.team2;
  } else if (m.pen1 != null && m.pen2 != null) {
    if (m.pen1 > m.pen2) return m.team1;
    if (m.pen2 > m.pen1) return m.team2;
  }

  return null;
}

/* ============================================================
   UNIVERSAL KNOCKOUT ROUND GENERATOR (24, 32, 48)
============================================================ */
function generateKnockoutRound(worldcup, engine, fromKey, toKey, label) {
  const fmt = worldcup.format;
  let ids = [];
  const matches = [];

  if (fmt === 48 && toKey === "round32") {
    ids = [
      ...engine.qualifiers.round32.direct,
      ...engine.qualifiers.round32.thirds
    ];
  } else if (toKey === "round16") {
    ids = [
      ...engine.qualifiers.round16.direct,
      ...engine.qualifiers.round16.thirds
    ];
  } else {
    const fromRound = worldcup.season[fromKey];
    if (!fromRound || !fromRound.matches) return;

    const winners = [];
    fromRound.matches.forEach(m => {
      const w = getMatchWinner(m);
      if (w) winners.push(w);
    });

    for (let i = 0; i + 1 < winners.length; i += 2) {
      matches.push({
        team1: winners[i],
        team2: winners[i + 1],
        score1: null,
        score2: null,
        extraTime: "",
        penalty: ""
      });
    }

    worldcup.season[toKey] = { label, matches };
    return;
  }

  for (let i = 0; i + 1 < ids.length; i += 2) {
    matches.push({
      team1: ids[i],
      team2: ids[i + 1],
      score1: null,
      score2: null,
      extraTime: "",
      penalty: ""
    });
  }

  worldcup.season[toKey] = { label, matches };
}

/* ============================================================
   THIRD PLACE + FINAL
============================================================ */
function generateThirdPlaceAndFinal(worldcup) {
  const semis = worldcup.season.semifinals;
  if (!semis || !semis.matches || semis.matches.length < 2) return;

  const winners = [];
  const losers = [];

  semis.matches.forEach(m => {
    const w = getMatchWinner(m);
    if (w) {
      winners.push(w);
      const l = w === m.team1 ? m.team2 : m.team1;
      if (l) losers.push(l);
    }
  });

  worldcup.season.thirdplace = {
    label: "Third Place",
    matches: [
      {
        team1: losers[0],
        team2: losers[1],
        score1: null,
        score2: null,
        extraTime: "",
        penalty: ""
      }
    ]
  };

  worldcup.season.final = {
    label: "Final",
    matches: [
      {
        team1: winners[0],
        team2: winners[1],
        score1: null,
        score2: null,
        extraTime: "",
        penalty: ""
      }
    ]
  };
}

function generateGroupStageMatches(groups) {
  const matches = [];

  groups.forEach(g => {
    const t = g.teams;

    matches.push({ team1: t[0].id, score1: null, team2: t[1].id, score2: null });
    matches.push({ team1: t[0].id, score1: null, team2: t[2].id, score2: null });
    matches.push({ team1: t[0].id, score1: null, team2: t[3].id, score2: null });

    matches.push({ team1: t[1].id, score1: null, team2: t[2].id, score2: null });
    matches.push({ team1: t[1].id, score1: null, team2: t[3].id, score2: null });

    matches.push({ team1: t[2].id, score1: null, team2: t[3].id, score2: null });
  });

  return matches;
}

function getMatrixKey(thirdPlaces) {
  return thirdPlaces
    .map(tp => tp[0])
    .sort()
    .join(" ");
}

const ROUND16_MATRIX_24 = {

  "A B C D": [
    { team1: "A1", team2: "C2" },
    { team1: "B1", team2: "A3" },
    { team1: "C1", team2: "D3" },
    { team1: "D1", team2: "B3" },
    { team1: "A2", team2: "F2" },
    { team1: "E1", team2: "F3" },
    { team1: "F1", team2: "E2" },
    { team1: "C3", team2: "D2" }
  ],

  "A B C E": [
    { team1: "A1", team2: "C2" },
    { team1: "B1", team2: "A3" },
    { team1: "C1", team2: "E3" },
    { team1: "E1", team2: "B3" },
    { team1: "A2", team2: "F2" },
    { team1: "D1", team2: "F3" },
    { team1: "F1", team2: "D2" },
    { team1: "C3", team2: "D3" }
  ],

  "A B C F": [
    { team1: "A1", team2: "C2" },
    { team1: "B1", team2: "A3" },
    { team1: "C1", team2: "F3" },
    { team1: "F1", team2: "B3" },
    { team1: "A2", team2: "E2" },
    { team1: "D1", team2: "E3" },
    { team1: "E1", team2: "D3" },
    { team1: "C3", team2: "D2" }
  ],

  "A B D E": [
    { team1: "A1", team2: "D3" },
    { team1: "B1", team2: "A3" },
    { team1: "D1", team2: "C2" },
    { team1: "E1", team2: "B3" },
    { team1: "A2", team2: "F2" },
    { team1: "C1", team2: "F3" },
    { team1: "F1", team2: "E2" },
    { team1: "C3", team2: "D2" }
  ],

  "A B D F": [
    { team1: "A1", team2: "D3" },
    { team1: "B1", team2: "A3" },
    { team1: "D1", team2: "C2" },
    { team1: "F1", team2: "B3" },
    { team1: "A2", team2: "E2" },
    { team1: "C1", team2: "E3" },
    { team1: "E1", team2: "F3" },
    { team1: "C3", team2: "D2" }
  ],

  "A B E F": [
    { team1: "A1", team2: "E3" },
    { team1: "B1", team2: "A3" },
    { team1: "E1", team2: "B3" },
    { team1: "F1", team2: "C2" },
    { team1: "A2", team2: "D2" },
    { team1: "C1", team2: "D3" },
    { team1: "D1", team2: "F3" },
    { team1: "C3", team2: "E2" }
  ],

  "A C D E": [
    { team1: "A1", team2: "D3" },
    { team1: "C1", team2: "E3" },
    { team1: "D1", team2: "B3" },
    { team1: "E1", team2: "A3" },
    { team1: "A2", team2: "F2" },
    { team1: "B1", team2: "F3" },
    { team1: "F1", team2: "E2" },
    { team1: "C3", team2: "D2" }
  ],

  "A C D F": [
    { team1: "A1", team2: "D3" },
    { team1: "C1", team2: "F3" },
    { team1: "D1", team2: "B3" },
    { team1: "F1", team2: "A3" },
    { team1: "A2", team2: "E2" },
    { team1: "B1", team2: "E3" },
    { team1: "E1", team2: "F2" },
    { team1: "C3", team2: "D2" }
  ],

  "A C E F": [
    { team1: "A1", team2: "E3" },
    { team1: "C1", team2: "F3" },
    { team1: "E1", team2: "A3" },
    { team1: "F1", team2: "C2" },
    { team1: "A2", team2: "D2" },
    { team1: "B1", team2: "D3" },
    { team1: "D1", team2: "F2" },
    { team1: "C3", team2: "E2" }
  ],

  "A D E F": [
    { team1: "A1", team2: "E3" },
    { team1: "D1", team2: "C2" },
    { team1: "E1", team2: "B3" },
    { team1: "F1", team2: "A3" },
    { team1: "A2", team2: "D2" },
    { team1: "B1", team2: "F3" },
    { team1: "C1", team2: "E2" },
    { team1: "C3", team2: "D3" }
  ],

  "B C D E": [
    { team1: "B1", team2: "D3" },
    { team1: "C1", team2: "E3" },
    { team1: "D1", team2: "A3" },
    { team1: "E1", team2: "B3" },
    { team1: "A1", team2: "C2" },
    { team1: "F1", team2: "E2" },
    { team1: "E3", team2: "F3" },
    { team1: "C3", team2: "D2" }
  ],

  "B C D F": [
    { team1: "B1", team2: "D3" },
    { team1: "C1", team2: "F3" },
    { team1: "D1", team2: "A3" },
    { team1: "F1", team2: "B3" },
    { team1: "A1", team2: "C2" },
    { team1: "E1", team2: "E2" },
    { team1: "E3", team2: "F2" },
    { team1: "C3", team2: "D2" }
  ],

  "B C E F": [
    { team1: "B1", team2: "A3" },
    { team1: "C1", team2: "F3" },
    { team1: "E1", team2: "B3" },
    { team1: "F1", team2: "D3" },
    { team1: "A1", team2: "C2" },
    { team1: "D1", team2: "E3" },
    { team1: "E2", team2: "F2" },
    { team1: "C3", team2: "D2" }
  ],

"B D E F": [
  { team1: "B1", team2: "D3" }, // Cameroon vs Colombia
  { team1: "A2", team2: "C2" }, // Czechoslovakia vs Costa Rica
  { team1: "D1", team2: "F2" }, // West Germany vs Netherlands
  { team1: "A1", team2: "E3" }, // Italy vs Uruguay
  { team1: "F3", team2: "B2" }, // Republic of Ireland vs Romania
  { team1: "E1", team2: "D2" }, // Spain vs Yugoslavia
  { team1: "C1", team2: "B3" }, // Brazil vs Argentina
  { team1: "F1", team2: "E2" }  // England vs Belgium
],



  "C D E F": [
    { team1: "C1", team2: "E3" },
    { team1: "D1", team2: "F3" },
    { team1: "E1", team2: "A3" },
    { team1: "F1", team2: "C2" },
    { team1: "A1", team2: "D2" },
    { team1: "B1", team2: "E2" },
    { team1: "E3", team2: "F2" },
    { team1: "C3", team2: "D3" }
  ]
};

function resolve(code, engine) {
  const teamId = engine.placeMap[code];
  if (!teamId) {
    console.error("Cannot resolve place:", code);
    return null;
  }

  return {
    teamId,
    groupId: code[0],
    place: code
  };
}

// use ENGINE, do NOT call processWorldCupAuto here
function computeMatrixKeyAndFilter(engine) {
  const { qualifiers, placeMap } = engine;

  // best 4 third‑place teams, e.g. ["B3","D3","E3","F3"]
  const bestThirds = qualifiers.round16.thirds || [];

  // matrix key: "B D E F"
  const matrixKey = bestThirds
    .map(p => p[0])
    .sort()
    .join(" ");

  // all qualified places = 1st, 2nd, + best thirds
  const qualifiedPlaces = [
    ...(qualifiers.round16.direct || []),
    ...bestThirds
  ];

  // filter placeMap to qualified only
  const filteredPlaceMap = {};
  qualifiedPlaces.forEach(p => {
    if (placeMap && placeMap[p]) filteredPlaceMap[p] = placeMap[p];
  });

  return { matrixKey, filteredPlaceMap };
}

function generateRoundOf16(thirdPlaceCodes, matrix, engine) {
  // use provided thirdPlaceCodes to build key
  const matrixKey = getMatrixKey(thirdPlaceCodes);

  // filter placeMap to qualified teams only
  const qualifiedPlaces = [
    ...(engine.qualifiers.round16.direct || []),
    ...(engine.qualifiers.round16.thirds || [])
  ];

  const filteredPlaceMap = {};
  qualifiedPlaces.forEach(p => {
    if (engine.placeMap && engine.placeMap[p]) filteredPlaceMap[p] = engine.placeMap[p];
  });

  const row = matrix[matrixKey];
  if (!row) {
    console.error("Invalid combination:", matrixKey);
    return [];
  }

  return row.map(m => ({
    team1: filteredPlaceMap[m.team1] || null,
    team2: filteredPlaceMap[m.team2] || null,
    place1: m.team1,
    place2: m.team2,
    score1: null,
    score2: null,
    extraTime: "",
    penalty: ""
  }));
}





// 32‑TEAM ROUND OF 16 (direct from qualifiers)
function generateRound16_FIFA32(worldcup, engine) {
  const d = engine.qualifiers.round16.direct;

  const matches = [
    { team1: d[0], team2: d[9],  score1: null, score2: null, extraTime: "", penalty: "" },
    { team1: d[1], team2: d[8],  score1: null, score2: null, extraTime: "", penalty: "" },
    { team1: d[2], team2: d[11], score1: null, score2: null, extraTime: "", penalty: "" },
    { team1: d[3], team2: d[10], score1: null, score2: null, extraTime: "", penalty: "" },
    { team1: d[4], team2: d[13], score1: null, score2: null, extraTime: "", penalty: "" },
    { team1: d[5], team2: d[12], score1: null, score2: null, extraTime: "", penalty: "" },
    { team1: d[6], team2: d[15], score1: null, score2: null, extraTime: "", penalty: "" },
    { team1: d[7], team2: d[14], score1: null, score2: null, extraTime: "", penalty: "" }
  ];

  worldcup.season.round16 = { label: "Round of 16", matches };
}

// 48‑TEAM ROUND OF 32 / 16 (using place codes + placeMap)
function generateRound32_FIFA48(qualified) {
  const q = qualified;

  const base = [
    { id: "R32-M1",  team1: q.A1, team2: q.E3 },
    { id: "R32-M2",  team1: q.C2, team2: q.D2 },

    { id: "R32-M3",  team1: q.B1, team2: q.A3 },
    { id: "R32-M4",  team1: q.F2, team2: q.E2 },

    { id: "R32-M5",  team1: q.C1, team2: q.D3 },
    { id: "R32-M6",  team1: q.A2, team2: q.B2 },

    { id: "R32-M7",  team1: q.D1, team2: q.F3 },
    { id: "R32-M8",  team1: q.E1, team2: q.C3 },

    { id: "R32-M9",  team1: q.F1, team2: q.B3 },
    { id: "R32-M10", team1: q.G2, team2: q.H2 },

    { id: "R32-M11", team1: q.G1, team2: q.H3 },
    { id: "R32-M12", team1: q.I2, team2: q.J2 },

    { id: "R32-M13", team1: q.H1, team2: q.I3 },
    { id: "R32-M14", team1: q.J1, team2: q.G3 },

    { id: "R32-M15", team1: q.K1, team2: q.L3 },
    { id: "R32-M16", team1: q.L1, team2: q.K3 }
  ];

  return base.map(m => ({
    id: m.id,
    team1: m.team1,
    team2: m.team2,
    score1: null,
    score2: null,
    extraTime: "",
    penalty: ""
  }));
}

function generateRound16_FIFA48(worldcup) {
  const round32Matches = worldcup.season.round32.matches || [];
  const winners = round32Matches.map(getMatchWinner).filter(Boolean);

  const matches = [];
  for (let i = 0; i + 1 < winners.length; i += 2) {
    matches.push({
      team1: winners[i],
      team2: winners[i + 1],
      score1: null,
      score2: null,
      extraTime: "",
      penalty: ""
    });
  }

  worldcup.season.round16 = { label: "Round of 16", matches };
}

// =======================
// KNOCKOUT GENERATION
// =======================
function ensureKnockoutGenerated(worldcup, roundKey) {
  const fmt = worldcup.format;

  let engine = null;
  function getEngine() {
    if (!engine) engine = processWorldCupAuto(worldcup);
    return engine;
  }

  function hasMatches(round) {
    return round && Array.isArray(round.matches) && round.matches.length > 0;
  }

  // ROUND OF 32 (48 only)
  if (roundKey === "round32") {
    if (!hasMatches(worldcup.season.round32)) {
      const engine = getEngine();

      const q = {};
      Object.keys(engine.placeMap).forEach(place => {
        q[place] = engine.placeMap[place];
      });

      const r32 = generateRound32_FIFA48(q);
      worldcup.season.round32 = { label: "Round of 32", matches: r32 };
    }
    return;
  }

  // ROUND OF 16
  if (roundKey === "round16") {
    if (hasMatches(worldcup.season.round16)) return;

    const engine = getEngine();

    if (fmt === 48) {
      ensureKnockoutGenerated(worldcup, "round32");
      generateRound16_FIFA48(worldcup);
    } else if (fmt === 32) {
      generateRound16_FIFA32(worldcup, engine);
    } else {
      const thirdPlaceCodes = engine.qualifiers.round16.matrixThirdPlaces;
      const rawMatches = generateRoundOf16(thirdPlaceCodes, ROUND16_MATRIX_24, engine);

      worldcup.season.round16 = {
        label: "Round of 16",
        matches: rawMatches
      };
    }

    return;
  }

  // QUARTERFINALS
  if (roundKey === "quarterfinals") {
    if (hasMatches(worldcup.season.quarterfinals)) return;

    ensureKnockoutGenerated(worldcup, "round16");
    generateKnockoutRound(worldcup, getEngine(), "round16", "quarterfinals", "Quarterfinals");
    return;
  }

  // SEMIFINALS
  if (roundKey === "semifinals") {
    if (hasMatches(worldcup.season.semifinals)) return;

    ensureKnockoutGenerated(worldcup, "quarterfinals");
    generateKnockoutRound(worldcup, getEngine(), "quarterfinals", "semifinals", "Semifinals");
    return;
  }

  // THIRD PLACE
  if (roundKey === "thirdplace") {
    if (hasMatches(worldcup.season.thirdplace)) return;

    ensureKnockoutGenerated(worldcup, "semifinals");
    generateThirdPlaceAndFinal(worldcup);
    return;
  }

  // FINAL
  if (roundKey === "final") {
    if (hasMatches(worldcup.season.final)) return;

    ensureKnockoutGenerated(worldcup, "semifinals");
    generateThirdPlaceAndFinal(worldcup);
    return;
  }
}

/* ============================================================
   TEAM DROPDOWN
============================================================ */
function createTeamDropdown(worldcup, value, onChange) {
  const teamsList = getAllTeams(worldcup);

  const wrapper = document.createElement("div");
  wrapper.className = "team-dropdown";

  const nameSpan = document.createElement("span");
  nameSpan.className = "team-name";
  const current = teamsList.find(t => t.id === value);
  nameSpan.textContent = current ? current.name : (value || "Select team");

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "epic-slash");
  icon.setAttribute("viewBox", "0 0 14 14");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "2");
  line.setAttribute("y1", "12");
  line.setAttribute("x2", "12");
  line.setAttribute("y2", "2");
  icon.appendChild(line);

  const menu = document.createElement("div");
  menu.className = "team-menu";

  teamsList.forEach(t => {
    const item = document.createElement("div");
    item.textContent = `Group ${t.group} - ${t.name}`;
    item.onclick = () => {
      onChange(t.id);
      nameSpan.textContent = t.name;
      wrapper.classList.remove("open");
    };
    menu.appendChild(item);
  });

  wrapper.appendChild(nameSpan);
  wrapper.appendChild(icon);
  wrapper.appendChild(menu);

  wrapper.onclick = () => {
    wrapper.classList.toggle("open");
  };

  return wrapper;
}

/* ============================================================
   GROUP STAGE RENDERING
============================================================ */
function renderGroupStage(worldcup, container, editable) {
  const season = worldcup?.season?.groupstage;
  if (!season || !season.matches) return;

  const matches = season.matches;
  const groups = worldcup?.teams?.groups || [];
  const groupOrder = groups.map(g => g.id);

  const hasAnyScore = matches.some(
    m =>
      m.score1 != null &&
      m.score2 != null &&
      (m.score1 !== 0 || m.score2 !== 0)
  );

  const engine = processWorldCupAuto(worldcup);

  const panel = document.createElement("div");
  panel.className = "groupstage-panel";
  panel.innerHTML = `<h2 class="round-title">${ROUND_LABELS.groupstage}</h2>`;
  container.appendChild(panel);

  groupOrder.forEach(groupId => {
    const group = groups.find(g => g.id == groupId);
    if (!group) return;

    const groupBox = document.createElement("div");
    groupBox.className = "group-box fullwidth";

    const header = document.createElement("div");
    header.className = "group-header";
    header.textContent = `Group ${group.id}`;
    groupBox.appendChild(header);

    const headerRow = document.createElement("div");
    headerRow.className = "match-row s1 match-header";
    headerRow.innerHTML = `
      <div class="header-home">HOME</div>
      <div class="header-score">SCORE</div>
      <div class="header-away">AWAY</div>
    `;
    groupBox.appendChild(headerRow);

    const groupTeamIds = new Set((group.teams || []).map(t => t.id));
    const groupMatches = matches.filter(
      m => groupTeamIds.has(m.team1) && groupTeamIds.has(m.team2)
    );

    groupMatches.forEach(m => {
      const homeName = findTeamName(worldcup, m.team1);
      const awayName = findTeamName(worldcup, m.team2);

      const row = document.createElement("div");
      row.className = "match-row s1 centered-row";

      if (editable) {
        const homeDD = createTeamDropdown(worldcup, m.team1, id => m.team1 = id);
        const awayDD = createTeamDropdown(worldcup, m.team2, id => m.team2 = id);

        const scoreBox = document.createElement("div");
        scoreBox.className = "score-box";

        const homeInput = document.createElement("input");
        homeInput.type = "number";
        homeInput.value = m.score1 ?? "";
        homeInput.oninput = e =>
          m.score1 = e.target.value === "" ? null : parseInt(e.target.value, 10);

        const dash = document.createElement("span");
        dash.className = "score-line";

        const awayInput = document.createElement("input");
        awayInput.type = "number";
        awayInput.value = m.score2 ?? "";
        awayInput.oninput = e =>
          m.score2 = e.target.value === "" ? null : parseInt(e.target.value, 10);

        scoreBox.appendChild(homeInput);
        scoreBox.appendChild(dash);
        scoreBox.appendChild(awayInput);

        row.appendChild(homeDD);
        row.appendChild(scoreBox);
        row.appendChild(awayDD);
      } else {
        row.innerHTML = `
          <div class="team-home">${homeName}</div>
          <div class="score-box">
            <span class="score-num">${m.score1 ?? ""}</span>
            <span class="score-line"></span>
            <span class="score-num">${m.score2 ?? ""}</span>
          </div>
          <div class="team-away">${awayName}</div>
        `;
      }

      groupBox.appendChild(row);

      const homeStats = computeSingleMatchStats(m.team1, m, worldcup.format);
      const awayStats = computeSingleMatchStats(m.team2, m, worldcup.format);

      const matchTable = document.createElement("table");
      matchTable.className = "group-table match";

      matchTable.innerHTML = `
        <tr>
          <th>Team</th>
          <th>P</th>
          <th>W</th>
          <th>D</th>
          <th>L</th>
          <th>GF</th>
          <th>GA</th>
          <th>GD</th>
          <th>PTS</th>
        </tr>
        <tr>
          <td>${homeName}</td>
          <td>1</td>
          <td>${homeStats.wins}</td>
          <td>${homeStats.draws}</td>
          <td>${homeStats.losses}</td>
          <td>${homeStats.goalsFor}</td>
          <td>${homeStats.goalsAgainst}</td>
          <td>${homeStats.goalDiff}</td>
          <td>${homeStats.points}</td>
        </tr>
        <tr>
          <td>${awayName}</td>
          <td>1</td>
          <td>${awayStats.wins}</td>
          <td>${awayStats.draws}</td>
          <td>${awayStats.losses}</td>
          <td>${awayStats.goalsFor}</td>
          <td>${awayStats.goalsAgainst}</td>
          <td>${awayStats.goalDiff}</td>
          <td>${awayStats.points}</td>
        </tr>
      `;

      groupBox.appendChild(matchTable);
    });

    const title = document.createElement("div");
    title.className = "standings-title";
    title.textContent = "Standings";
    groupBox.appendChild(title);

    const tableEl = document.createElement("table");
    tableEl.className = "group-table total";

    tableEl.innerHTML = `
      <tr>
        <th>Team</th>
        <th>P</th>
        <th>W</th>
        <th>D</th>
        <th>L</th>
        <th>GF</th>
        <th>GA</th>
        <th>GD</th>
        <th>PTS</th>
      </tr>
    `;

    let standings = null;

    if (!hasAnyScore) {
      (group.teams || []).forEach(t => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${t.name}</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
          <td>0</td>
        `;
        tableEl.appendChild(tr);
      });
    } else {
      standings = engine.groups.find(g => g.groupId == group.id);
      if (standings) {
        standings.table.forEach(row => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${row.name}</td>
            <td>${row.played}</td>
            <td>${row.wins}</td>
            <td>${row.draws}</td>
            <td>${row.losses}</td>
            <td>${row.goalsFor}</td>
            <td>${row.goalsAgainst}</td>
            <td>${row.goalDiff}</td>
            <td>${row.points}</td>
          `;
          tableEl.appendChild(tr);
        });
      }
    }

    groupBox.appendChild(tableEl);

    /* ============================================================
       ⭐ TIE DETECTION FOR UI (DOWNLOAD BUTTON)
       ⭐ FIXED: USE RAW TABLE (NOT SORTED)
    ============================================================ */

    let tieDetectedUI = false;
    let tieTeamsUI = [];

    if (!worldcup.drawingLotsData && standings) {

      // RAW UNSORTED TABLE — preserves tie
      const rawTable = computeGroupTable(
        group.teams.map(t => t.id),
        group.teams,
        matches,
        worldcup.format
      );

      for (let i = 0; i < rawTable.length; i++) {
        for (let j = i + 1; j < rawTable.length; j++) {
          const A = rawTable[i];
          const B = rawTable[j];

          const equal =
            A.points === B.points &&
            A.goalDiff === B.goalDiff &&
            A.goalsFor === B.goalsFor;

          if (equal) {
            tieDetectedUI = true;
            tieTeamsUI = [A.name, B.name];
            break;
          }
        }
        if (tieDetectedUI) break;
      }
    }

    /* ============================================================
       FINAL DRAWING OF LOTS SYSTEM
    ============================================================ */

    const dl = engine.drawingLots;

    if (tieDetectedUI || (dl && dl.groupId === group.id)) {
      const box = document.createElement("div");
      box.className = "drawing-lots-box";

      if (worldcup.drawingLotsData && worldcup.drawingLotsData.groupId === group.id) {
  box.innerHTML = `
    <div class="drawing-lots-result">
      <div class="title">Drawing of Lots Winner</div>
      <div class="group">${"Group " + group.id}, ${worldcup.drawingLotsData.winner}</div>
    </div>
  `;
}


      else if (tieDetectedUI && !worldcup.drawingLotsData) {
  box.innerHTML = `
    <div class="title" style="margin-bottom:6px;">Drawing of Lots</div>
    <div style="margin-bottom:8px;">Teams are fully tied, choose the winner:</div>

    <button class="btn-draw-lots auto-download" data-group="${group.id}" data-winner="${tieTeamsUI[0]}">
      ${tieTeamsUI[0]}
    </button>

    <button class="btn-draw-lots auto-download" data-group="${group.id}" data-winner="${tieTeamsUI[1]}" style="margin-left:6px;">
      ${tieTeamsUI[1]}
    </button>
  `;
}



      else if (dl && dl.winner && !worldcup.drawingLotsData) {
        box.innerHTML = `
          <div class="drawing-lots-result">
            <div class="title">Drawing of Lots Winner</div>
            <div class="group">Group ${group.id}</div>
            <div class="winner">${dl.winner}</div>
          </div>

          <div style="margin-top:10px;">
            <button class="btn-download-draw" data-group="${group.id}">
              Download drawinglots.json
            </button>
          </div>
        `;
      }

      groupBox.appendChild(box);
    }

    panel.appendChild(groupBox);
  });

  renderGroupStageQualificationBoxes(worldcup, engine, panel);
}




/* ============================================================
   UPDATED QUALIFICATION BOXES (24 / 32 / 48)
============================================================ */
function renderGroupStageQualificationBoxes(worldcup, engine, container) {
  const formatTeams = engine.format.teams;
  const qual = engine.qualifiers;

  const wrapper = document.createElement("div");
  wrapper.className = "qual-boxes";

  const matches = worldcup?.season?.groupstage?.matches || [];
  const hasAnyScore = matches.some(m => m.score1 != null && m.score2 != null);

  // Helper: find team name by place code
  const getNameByPlace = place => {
    const teamId = engine.placeMap[place];
    return findTeamName(worldcup, teamId);
  };

  // Helper: sorted standings for elimination box
  const sortedGroups = engine.groups.map(g => {
    const sorted = [...g.table].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    });
    return { groupId: g.groupId, table: sorted };
  });

  /* ============================================================
     24‑TEAM + 48‑TEAM FORMATS
  ============================================================ */
  if (formatTeams === 24 || formatTeams === 48) {

    /* -------------------------
       AUTO QUALIFIERS
    ------------------------- */
    const boxAuto = document.createElement("div");
    boxAuto.className = "qual-box";
    boxAuto.innerHTML =
      "<h4>1st & 2nd (Auto)</h4>" +
      (formatTeams === 48
        ? qual.round32.direct.map(p => `<div>${getNameByPlace(p)}</div>`).join("")
        : qual.round16.direct.map(p => `<div>${getNameByPlace(p)}</div>`).join("")
      );

    /* -------------------------
       3RD QUALIFIED
       24 teams: show FIFA ranking order (bestThirdsOrdered)
       48 teams: show best 8 thirds (round32.thirds)
    ------------------------- */
    const box3Pass = document.createElement("div");
    box3Pass.className = "qual-box";

    if (formatTeams === 24) {
      const ordered = engine.memory?.bestThirdsOrdered || qual.round16.thirds || [];
      box3Pass.innerHTML =
        "<h4>3rd Qualified</h4>" +
        ordered.map(p => `<div>${getNameByPlace(p)}</div>`).join("");
    } else {
      box3Pass.innerHTML =
        "<h4>3rd Qualified</h4>" +
        qual.round32.thirds.map(p => `<div>${getNameByPlace(p)}</div>`).join("");
    }

    /* -------------------------
       ELIMINATED (sorted tables)
    ------------------------- */
    const boxElim = document.createElement("div");
    boxElim.className = "qual-box";

    if (!hasAnyScore) {
      boxElim.innerHTML = "<h4>Eliminated</h4>";
    } else {
      const eliminated = sortedGroups
        .flatMap(g => g.table)
        .filter(r =>
          !(formatTeams === 48
            ? qual.round32.direct.includes(r.place) ||
              qual.round32.thirds.includes(r.place)
            : qual.round16.direct.includes(r.place) ||
              qual.round16.thirds.includes(r.place)
          )
        )
        .map(r => `<div>${r.name}</div>`)
        .join("");

      boxElim.innerHTML = "<h4>Eliminated</h4>" + eliminated;
    }

    wrapper.appendChild(boxAuto);
    wrapper.appendChild(box3Pass);
    wrapper.appendChild(boxElim);
  }

  /* ============================================================
     32‑TEAM FORMAT
  ============================================================ */
  else {
    const boxTop = document.createElement("div");
    boxTop.className = "qual-box";
    boxTop.innerHTML =
      "<h4>Round of 16 (Advance)</h4>" +
      qual.round16.direct.map(p => `<div>${getNameByPlace(p)}</div>`).join("");

    const boxElim = document.createElement("div");
    boxElim.className = "qual-box";

    const eliminated = sortedGroups
      .flatMap(g => g.table)
      .filter(r => !qual.round16.direct.includes(r.place))
      .map(r => `<div>${r.name}</div>`)
      .join("");

    boxElim.innerHTML = "<h4>Eliminated</h4>" + eliminated;

    wrapper.appendChild(boxTop);
    wrapper.appendChild(boxElim);
  }

  container.appendChild(wrapper);
}


/* ============================================================
   KNOCKOUT RENDERING (ROUND32 / ROUND16 / QF / SF)
============================================================ */
function renderKnockoutRound(worldcup, roundKey, container, editable) {

  let round = worldcup?.season?.[roundKey];

  if (editable && (!round || !round.matches || round.matches.length === 0)) {
    ensureKnockoutGenerated(worldcup, roundKey);
    round = worldcup?.season?.[roundKey];
  }

  if (!round || !round.matches) return;

  const panel = document.createElement("div");
  panel.className = "knockout-panel";
  panel.innerHTML = `<h2 class="round-title">${ROUND_LABELS[roundKey]}</h2>`;
  container.appendChild(panel);

  const header = document.createElement("div");
  header.className = "match-row s2plus match-header";
  header.innerHTML = `
    <div>Home Team</div>
    <div>Score</div>
    <div>Away Team</div>
    <div>ET Home</div>
    <div>ET Away</div>
    <div>PEN Home</div>
    <div>PEN Away</div>
  `;
  panel.appendChild(header);

  const winners = [], losers = [], extraTime = [], penalties = [], results = [];

  round.matches.forEach((m, idx) => {
    const row = document.createElement("div");
    row.className = "match-row s2plus";

    if (m.score1 === "") m.score1 = null;
    if (m.score2 === "") m.score2 = null;
    if (typeof m.score1 === "string" && m.score1 !== "") m.score1 = parseInt(m.score1, 10);
    if (typeof m.score2 === "string" && m.score2 !== "") m.score2 = parseInt(m.score2, 10);

    const t1Name = findTeamName(worldcup, m.team1);
    const t2Name = findTeamName(worldcup, m.team2);

    let etH = "", etA = "";
    if (m.extraTime && m.extraTime.includes("-")) {
      const [h, a] = m.extraTime.split("-");
      etH = h; etA = a;
    }

    let penH = "", penA = "";
    if (m.penalty && m.penalty.includes("-")) {
      const [h, a] = m.penalty.split("-");
      penH = h; penA = a;
    }

    if (editable) {
      const homeDD = createTeamDropdown(worldcup, m.team1, id => m.team1 = id);
      const awayDD = createTeamDropdown(worldcup, m.team2, id => m.team2 = id);

      const scoreBox = document.createElement("div");
      scoreBox.className = "score-box";

      const homeInput = document.createElement("input");
      homeInput.type = "number";
      homeInput.value = m.score1 ?? "";
      homeInput.oninput = e =>
        m.score1 = e.target.value === "" ? null : parseInt(e.target.value, 10);

      const dash = document.createElement("span");
      dash.className = "score-line";

      const awayInput = document.createElement("input");
      awayInput.type = "number";
      awayInput.value = m.score2 ?? "";
      awayInput.oninput = e =>
        m.score2 = e.target.value === "" ? null : parseInt(e.target.value, 10);

      scoreBox.appendChild(homeInput);
      scoreBox.appendChild(dash);
      scoreBox.appendChild(awayInput);

      row.appendChild(homeDD);
      row.appendChild(scoreBox);
      row.appendChild(awayDD);

      const etHome = document.createElement("input");
      etHome.type = "text";
      etHome.className = "et-input";
      etHome.value = etH;
      etHome.oninput = e => {
        const v = e.target.value.trim();
        m.extraTime = v && etA ? `${v}-${etA}` : v ? `${v}-0` : "";
      };

      const etAway = document.createElement("input");
      etAway.type = "text";
      etAway.className = "et-input";
      etAway.value = etA;
      etAway.oninput = e => {
        const v = e.target.value.trim();
        m.extraTime = etH && v ? `${etH}-${v}` : v ? `0-${v}` : "";
      };

      const penHome = document.createElement("input");
      penHome.type = "text";
      penHome.className = "pen-input";
      penHome.value = penH;
      penHome.oninput = e => {
        const v = e.target.value.trim();
        m.penalty = v && penA ? `${v}-${penA}` : v ? `${v}-0` : "";
      };

      const penAway = document.createElement("input");
      penAway.type = "text";
      penAway.className = "pen-input";
      penAway.value = penA;
      penAway.oninput = e => {
        const v = e.target.value.trim();
        m.penalty = penH && v ? `${penH}-${v}` : v ? `0-${v}` : "";
      };

      row.appendChild(etHome);
      row.appendChild(etAway);
      row.appendChild(penHome);
      row.appendChild(penAway);

    } else {
      row.innerHTML = `
        <span class="team-name">${t1Name}</span>
        <div class="score-box">
          <span>${m.score1 ?? ""}</span>
          <span class="score-line"></span>
          <span>${m.score2 ?? ""}</span>
        </div>
        <span class="team-name">${t2Name}</span>
        <span>${etH}</span>
        <span>${etA}</span>
        <span>${penH}</span>
        <span>${penA}</span>
      `;
    }

    panel.appendChild(row);

    if (m.score1 != null && m.score2 != null) {
      let w = null, l = null;

      if (m.score1 > m.score2) {
        w = t1Name; l = t2Name;
      } else if (m.score2 > m.score1) {
        w = t2Name; l = t1Name;
      } else {
        if (m.extraTime && m.extraTime.includes("-")) {
          const [a, b] = m.extraTime.split("-").map(Number);
          if (a > b) { w = t1Name; l = t2Name; }
          else if (b > a) { w = t2Name; l = t1Name; }
        }
        if (!w && m.penalty && m.penalty.includes("-")) {
          const [a, b] = m.penalty.split("-").map(Number);
          if (a > b) { w = t1Name; l = t2Name; }
          else if (b > a) { w = t2Name; l = t1Name; }
        }
      }

      if (w && l) {
        winners.push(w);
        losers.push(l);
      }

      const label = `${t1Name} ${m.score1}-${m.score2} ${t2Name}`;
      results.push(label);

      if (m.extraTime) extraTime.push(`${label} | ET: ${m.extraTime}`);
      if (m.penalty) penalties.push(`${label} | PEN: ${m.penalty}`);
    }
  });

  const winnersLabel =
    roundKey === "final"
      ? "WINNER"
      : roundKey === "thirdplace"
      ? "Third Place"
      : "WINNERS";

  let loserLabel = null;
  if (roundKey === "final") {
    loserLabel = "Runner-Up";
  } else if (roundKey === "thirdplace") {
    loserLabel = null;
  } else {
    loserLabel = "Eliminated";
  }

  const summary = document.createElement("div");
  summary.className = "knockout-summary";

  summary.innerHTML = `
    <h3>Match Reports / Results</h3>
    <div class="summary-block">
      <h4>${winnersLabel}</h4>
      ${winners.map(t => `<div>${t}</div>`).join("")}
    </div>
  `;

  if (loserLabel) {
    summary.innerHTML += `
      <div class="summary-block">
        <h4>${loserLabel}</h4>
        ${losers.map(t => `<div>${t}</div>`).join("")}
      </div>
    `;
  }

  summary.innerHTML += `
    <div class="summary-block">
      <h4>EXTRA TIME</h4>
      ${extraTime.length ? extraTime.map(x => `<div>${x}</div>`).join("") : "<div>None</div>"}
    </div>
    <div class="summary-block">
      <h4>PENALTIES</h4>
      ${penalties.length ? penalties.map(x => `<div>${x}</div>`).join("") : "<div>None</div>"}
    </div>
    <div class="summary-block">
      <h4>MATCH RESULTS</h4>
      ${results.map(x => `<div>${x}</div>`).join("")}
    </div>
  `;

  if (roundKey === "final" && winners.length) {
    const champBlock = document.createElement("div");
    champBlock.className = "summary-block champion-block";
    champBlock.innerHTML = `
      <h4 class="champion-title">Champion</h4>
      <div class="champion-name">${winners[0]}</div>
    `;
    summary.appendChild(champBlock);
  }

  panel.appendChild(summary);
}

/* ============================================================
   FINAL PANEL (CHAMPION)
============================================================ */
function renderFinalPanel(worldcup, container, editable) {
  ensureKnockoutGenerated(worldcup, "final");

  const final = worldcup?.season?.final;
  if (!final || !final.matches || !final.matches[0]) return;

  const m = final.matches[0];
  const t1 = findTeamName(worldcup, m.team1);
  const t2 = findTeamName(worldcup, m.team2);

  const championId = getMatchWinner(m);
  const championName = championId ? findTeamName(worldcup, championId) : "";

  const panel = document.createElement("div");
  panel.className = "final-panel";
  panel.innerHTML = `<h2 class="round-title">${ROUND_LABELS.final}</h2>`;
  container.appendChild(panel);

  const header = document.createElement("div");
  header.className = "match-row s2plus match-header";
  header.innerHTML = `
    <div>Home Team</div>
    <div>Score</div>
    <div>Away Team</div>
    <div>ET Home</div>
    <div>ET Away</div>
    <div>PEN Home</div>
    <div>PEN Away</div>
  `;
  panel.appendChild(header);

  const row = document.createElement("div");
  row.className = "match-row s2plus";

  if (editable) {
    const homeDD = createTeamDropdown(worldcup, m.team1 || "", id => {
      m.team1 = id;
    });

    const awayDD = createTeamDropdown(worldcup, m.team2 || "", id => {
      m.team2 = id;
    });

    const scoreBox = document.createElement("span");
    scoreBox.className = "score-separator";

    const homeScoreInput = document.createElement("input");
    homeScoreInput.type = "number";
    homeScoreInput.value = m.score1 ?? "";
    homeScoreInput.oninput = e => {
      m.score1 = e.target.value === "" ? null : parseInt(e.target.value, 10);
    };

    const dash = document.createElement("span");
    dash.className = "score-line";

    const awayScoreInput = document.createElement("input");
    awayScoreInput.type = "number";
    awayScoreInput.value = m.score2 ?? "";
    awayScoreInput.oninput = e => {
      m.score2 = e.target.value === "" ? null : parseInt(e.target.value, 10);
    };

    scoreBox.appendChild(homeScoreInput);
    scoreBox.appendChild(dash);
    scoreBox.appendChild(awayScoreInput);

    let etH = "";
    let etA = "";
    if (m.extraTime && m.extraTime.includes("-")) {
      const p = m.extraTime.split("-");
      etH = p[0];
      etA = p[1];
    }

    const etHomeInput = document.createElement("input");
    etHomeInput.type = "number";
    etHomeInput.value = etH;
    etHomeInput.oninput = e => {
      const h = e.target.value;
      const a = etA;
      m.extraTime = h === "" && a === "" ? "" : `${h || 0}-${a || 0}`;
    };

    const etAwayInput = document.createElement("input");
    etAwayInput.type = "number";
    etAwayInput.value = etA;
    etAwayInput.oninput = e => {
      const a = e.target.value;
      const h = etHomeInput.value;
      m.extraTime = h === "" && a === "" ? "" : `${h || 0}-${a || 0}`;
    };

    let penH = "";
    let penA = "";
    if (m.penalty && m.penalty.includes("-")) {
      const p = m.penalty.split("-");
      penH = p[0];
      penA = p[1];
    }

    const penHomeInput = document.createElement("input");
    penHomeInput.type = "number";
    penHomeInput.value = penH;
    penHomeInput.oninput = e => {
      const h = e.target.value;
      const a = penA;
      m.penalty = h === "" && a === "" ? "" : `${h || 0}-${a || 0}`;
    };

    const penAwayInput = document.createElement("input");
    penAwayInput.type = "number";
    penAwayInput.value = penA;
    penAwayInput.oninput = e => {
      const a = e.target.value;
      const h = penHomeInput.value;
      m.penalty = h === "" && a === "" ? "" : `${h || 0}-${a || 0}`;
    };

    row.appendChild(homeDD);
    row.appendChild(scoreBox);
    row.appendChild(awayDD);
    row.appendChild(etHomeInput);
    row.appendChild(etAwayInput);
    row.appendChild(penHomeInput);
    row.appendChild(penAwayInput);
  } else {
    let etH = "";
    let etA = "";
    if (m.extraTime && m.extraTime.includes("-")) {
      const p = m.extraTime.split("-");
      etH = p[0];
      etA = p[1];
    }

    let penH = "";
    let penA = "";
    if (m.penalty && m.penalty.includes("-")) {
      const p = m.penalty.split("-");
      penH = p[0];
      penA = p[1];
    }

    row.innerHTML = `
      <span class="team-name">${t1}</span>

      <span class="score-separator">
        <span>${m.score1 ?? ""}</span>
        <span class="score-line"></span>
        <span>${m.score2 ?? ""}</span>
      </span>

      <span class="team-name">${t2}</span>

      <span>${etH}</span>
      <span>${etA}</span>
      <span>${penH}</span>
      <span>${penA}</span>
    `;
  }

  panel.appendChild(row);

  const box = document.createElement("div");
  box.className = "final-summary-box";

  if (m.extraTime) {
    const etRow = document.createElement("div");
    etRow.className = "summary-row";
    etRow.textContent = `Extra Time: ${m.extraTime}`;
    box.appendChild(etRow);
  }

  if (m.penalty) {
    const penRow = document.createElement("div");
    penRow.className = "summary-row";
    penRow.textContent = `Penalty: ${m.penalty}`;
    box.appendChild(penRow);
  }

  const champBlock = document.createElement("div");
  champBlock.className = "champion-label";
  champBlock.innerHTML = `
    <span class="champion-title">Champion</span>
    <span class="champion-name">${championName}</span>
  `;
  box.appendChild(champBlock);

  panel.appendChild(box);
}

/* ============================================================
   FINISHED VIEW — TABS (DYNAMIC FOR 48)
============================================================ */
function renderFinishedWorldCupTabs(worldcup, editable) {
  const root = $("finishedView");
  if (!root) return;

  // Always use the latest global WC object
  const wc = currentWorldCup;

  // Determine which rounds exist for this format
  ROUND_KEYS = getRoundKeysForFormat(wc.format);

  // Reset UI
  root.innerHTML = "";

  const tabs = document.createElement("div");
  tabs.id = "finishedSeasonTabs";

  const content = document.createElement("div");
  content.id = "finishedSeasonContent";

  // Build tabs
  ROUND_KEYS.forEach(key => {
    const tab = document.createElement("div");
    tab.className =
      "season-tab" + (finishedCurrentRound === key ? " active" : "");
    tab.textContent = ROUND_LABELS[key];

    tab.onclick = () => {
      finishedCurrentRound = key;

      // Update active tab
      Array.from(tabs.children).forEach(t => {
        t.classList.toggle(
          "active",
          t.textContent === ROUND_LABELS[finishedCurrentRound]
        );
      });

      // Re-render content only
      content.innerHTML = "";

      if (finishedCurrentRound === "groupstage") {
        renderGroupStage(wc, content, editable, wc.format);
      } else {
        renderKnockoutRound(wc, finishedCurrentRound, content, editable);
      }
    };

    tabs.appendChild(tab);
  });

  root.appendChild(tabs);
  root.appendChild(content);

  // Initial render
  if (finishedCurrentRound === "groupstage") {
    renderGroupStage(wc, content, editable, wc.format);
  } else {
    renderKnockoutRound(wc, finishedCurrentRound, content, editable);
  }
}


/* ============================================================
   TEAMS RENDERING (LEFT COLUMN)
============================================================ */
function renderTeams(teamsData, containerId) {
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = "";

  const groups = teamsData?.groups || [];
  groups.forEach(group => {
    const block = document.createElement("div");
    block.className = "group-block";

    const title = document.createElement("div");
    title.className = "group-title";
    title.textContent = group.label || `Group ${group.id}`;
    block.appendChild(title);

    (group.teams || []).forEach((t, idx) => {
      const row = document.createElement("div");
      row.className = "team-row";

      const input = document.createElement("input");
      input.type = "text";
      input.value = t.name || "";
      input.placeholder = `Team ${idx + 1}`;
      input.oninput = e => {
        t.name = e.target.value;
        if (!t.id) {
          t.id = group.id + (idx + 1);
        }
      };

      row.appendChild(input);
      block.appendChild(row);
    });

    const addBtn = document.createElement("button");
    addBtn.textContent = "ADD TEAM";
    addBtn.onclick = () => {
      group.teams.push({
        id: group.id + (group.teams.length + 1),
        name: ""
      });
      renderTeams(teamsData, containerId);
    };
    block.appendChild(addBtn);

    container.appendChild(block);
  });
}

/* ============================================================
   CREATE NEW WORLD CUP (EMPTY TEAMS + AUTO FIXTURES)
============================================================ */
function createNewWorldCup() {
  const yearStr = $("editYear").value.trim();
  const fmtStr = $("formatDropdown").value.trim();

  if (!yearStr || !fmtStr) {
    alert("Please enter NEW WORLD CUP YEAR and select FORMAT.");
    return;
  }

  editYear = parseInt(yearStr, 10);
  editFormat = parseInt(fmtStr, 10);

  const groupIds =
    editFormat === 24
      ? ["A", "B", "C", "D", "E", "F"]
      : editFormat === 32
      ? ["A", "B", "C", "D", "E", "F", "G", "H"]
      : ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  editTeams = {
    groups: groupIds.map(id => ({
      id,
      label: `Group ${id}`,
      teams: [
        { id: `${id}1`, name: "" },
        { id: `${id}2`, name: "" },
        { id: `${id}3`, name: "" },
        { id: `${id}4`, name: "" }
      ]
    }))
  };

  editSeason = {
    groupstage: { label: "Group Stage", matches: [] },
    ...(editFormat === 48
      ? { round32: { label: "Round of 32", matches: [] } }
      : {}),
    round16: { label: "Round of 16", matches: [] },
    quarterfinals: { label: "Quarterfinals", matches: [] },
    semifinals: { label: "Semifinals", matches: [] },
    thirdplace: { label: "Third Place", matches: [] },
    final: { label: "Final", matches: [] }
  };

  const worldcup = {
    year: editYear,
    format: editFormat,
    teams: editTeams,
    season: editSeason
  };

  worldcup.season.groupstage.matches = generateGroupFixtures(worldcup.teams);

  currentWorldCup = worldcup;

  renderTeams(editTeams, "editTeams");
  finishedCurrentRound = "groupstage";
  renderFinishedWorldCup(currentWorldCup, true);
}

/* ============================================================
   LOAD WORLDCUPS LIST + SELECT YEAR
============================================================ */
function loadWorldCupDropdown() {
  fetch("worldcups/worldcups.json")
    .then(res => res.json())
    .then(json => {
      worldCupsList = json.tournaments || json.worldcup || [];

      const dd = $("worldcupDropdown");
      if (!dd) return;

      dd.innerHTML = `<option value="">World Cup</option>`;
      worldCupsList.forEach(wc => {
        const opt = document.createElement("option");
        opt.value = wc.year;
        opt.textContent = wc.year;
        dd.appendChild(opt);
      });
    })
    .catch(err => console.error("Failed to load worldcups.json", err));
}

function onWorldCupSelect() {
  const dd = $("worldcupDropdown");
  if (!dd) return;

  const year = dd.value;
  if (!year) return;

  const wc = worldCupsList.find(w => String(w.year) === String(year));
  if (!wc) return;

  loadWorldCupData(wc);
}

function renderFinishedWorldCup(worldcup, editable) {
  finishedCurrentRound = finishedCurrentRound || "groupstage";
  renderFinishedWorldCupTabs(worldcup, editable);
}

/* ============================================================
   LOAD FINISHED WORLD CUP (TEAMS + ROUND JSON + DRAWINGLOTS)
============================================================ */
function loadWorldCupData(wc) {
  const paths = wc.paths || {};
  const teamsPath = paths.teams;
  const seasonPaths = paths.season || paths.rounds || {};

  if (!teamsPath || !seasonPaths.groupstage) {
    console.error("Invalid paths in worldcups.json for year", wc.year);
    return;
  }

  const safeFetchJSON = url =>
    fetch(url)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);

  const fetches = [
    safeFetchJSON(teamsPath),
    safeFetchJSON(seasonPaths.groupstage),

    seasonPaths.drawinglots
      ? safeFetchJSON(seasonPaths.drawinglots)
      : Promise.resolve(null),

    seasonPaths.round32
      ? safeFetchJSON(seasonPaths.round32)
      : Promise.resolve(null),

    safeFetchJSON(seasonPaths.round16),
    safeFetchJSON(seasonPaths.quarterfinals),
    safeFetchJSON(seasonPaths.semifinals),
    safeFetchJSON(seasonPaths.thirdplace),
    safeFetchJSON(seasonPaths.final)
  ];

  Promise.all(fetches)
    .then(
      ([
        teamsJson,
        groupstage,
        drawinglots,
        round32,
        round16,
        quarterfinals,
        semifinals,
        thirdplace,
        final
      ]) => {

        const teamsData = teamsJson.teams || teamsJson;

        const worldcup = {
          year: wc.year,
          format: wc.format || detectWorldCupFormat({ teams: teamsData }),
          teams: teamsData,
          season: {
            groupstage,
            ...(round32 ? { round32 } : {}),
            round16,
            quarterfinals,
            semifinals,
            thirdplace,
            final
          },

          // IMPORTANT:
          // null = no file → tie detection
          // object = file exists → override
          drawingLotsData: drawinglots || null
        };

        currentWorldCup = worldcup;

        editYear = worldcup.year;
        editFormat = worldcup.format;
        editTeams = worldcup.teams;
        editSeason = worldcup.season;
        editPaths = wc.paths;

        $("editYear").value = worldcup.year;
        if (editFormat) $("formatDropdown").value = String(editFormat);

        renderTeams(editTeams, "editTeams");
        finishedCurrentRound = "groupstage";
        renderFinishedWorldCup(currentWorldCup, false);
      }
    )
    .catch(err => {
      console.error("Failed to load finished worldcup from paths:", err);
      alert("Failed to load World Cup data");
    });
}


function loadFinishedWorldCup(worldcup) {
  const finishedView = document.getElementById("finishedView");
  finishedView.innerHTML = "";
  renderGroupStage(worldcup, finishedView, false);
}

/* ============================================================
   LOAD / SAVE HELPERS (TEAMS + FULL WORLD CUP + PER ROUND)
============================================================ */
function downloadJSON(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function loadTeamsJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const json = JSON.parse(reader.result);

      editYear = json.year || null;
      editFormat = json.format || null;
      editTeams = json.teams || json;

      if (editYear) $("editYear").value = editYear;
      if (editFormat) $("formatDropdown").value = String(editFormat);

      renderTeams(editTeams, "editTeams");

      editSeason = {
        groupstage: {
          label: "Group Stage",
          matches: generateGroupFixtures(editTeams)
        },
        ...(editFormat === 48
          ? { round32: { label: "Round of 32", matches: [] } }
          : {}),
        round16: { label: "Round of 16", matches: [] },
        quarterfinals: { label: "Quarterfinals", matches: [] },
        semifinals: { label: "Semifinals", matches: [] },
        thirdplace: { label: "Third Place", matches: [] },
        final: { label: "Final", matches: [] }
      };

      currentWorldCup = {
        year: editYear,
        format: editFormat || detectWorldCupFormat({ teams: editTeams }),
        teams: editTeams,
        season: editSeason
      };

      finishedCurrentRound = "groupstage";

      renderFinishedWorldCup(currentWorldCup, true);
    };

    reader.readAsText(file);
  };

  input.click();
}

function loadWorldCupJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const json = JSON.parse(reader.result);

      editYear = json.year;
      editFormat = json.format;
      editTeams = json.teams;
      editSeason = json.season;

      $("editYear").value = editYear;
      $("formatDropdown").value = String(editFormat);

      currentWorldCup = json;

      renderTeams(editTeams, "editTeams");
      finishedCurrentRound = "groupstage";
      renderFinishedWorldCup(currentWorldCup, true);
    };

    reader.readAsText(file);
  };

  input.click();
}

function saveWorldCupJSON() {
  if (!currentWorldCup) return;
  downloadJSON(
    currentWorldCup,
    `worldcup_${currentWorldCup.year || "new"}.json`
  );
}

function saveTeamsJSON() {
  if (!editTeams) return;

  const data = {
    year: editYear,
    format: editFormat,
    teams: editTeams
  };

  downloadJSON(data, `teams_${editYear || "new"}.json`);
}

function loadSeasonRoundJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      let json = JSON.parse(reader.result);

      if (Array.isArray(json)) {
        json = {
          label: ROUND_LABELS[finishedCurrentRound],
          matches: json
        };
      }

      /* ============================================================
         ⭐ LOAD drawinglots.json FROM WORLD CUP PATHS
      ============================================================ */
      let drawingLots = null;

      if (editPaths?.season?.drawinglots) {
        try {
          const dlReq = await fetch(editPaths.season.drawinglots);
          if (dlReq.ok) {
            drawingLots = await dlReq.json();
            console.log("Loaded drawinglots.json:", drawingLots);
          }
        } catch (err) {
          console.warn("drawinglots.json not found");
        }
      }

      /* ============================================================
         RESET WORLD CUP OBJECT (EDITOR MODE)
      ============================================================ */
      currentWorldCup = {
        year: editYear || null,
        format: editFormat || null,
        teams: editTeams,
        season: {
          groupstage: { label: "Group Stage", matches: [] },
          ...(editFormat === 48
            ? { round32: { label: "Round of 32", matches: [] } }
            : {}),
          round16: { label: "Round of 16", matches: [] },
          quarterfinals: { label: "Quarterfinals", matches: [] },
          semifinals: { label: "Semifinals", matches: [] },
          thirdplace: { label: "Third Place", matches: [] },
          final: { label: "Final", matches: [] }
        },

        // ⭐ EDITOR NOW HAS REAL DRAWINGLOTS.JSON
        drawingLotsData: drawingLots
      };

      currentWorldCup.season[finishedCurrentRound] = json;

      if (finishedCurrentRound === "groupstage") {
        const engine = processWorldCupAuto(currentWorldCup);
        ensureKnockoutGenerated(currentWorldCup, "round16");
      }

      editSeason = currentWorldCup.season;
      renderFinishedWorldCup(currentWorldCup, true);
    };

    reader.readAsText(file);
  };

  input.click();
}



function saveSeasonRoundJSON() {
  if (!currentWorldCup || !currentWorldCup.season) return;

  const roundObj = currentWorldCup.season[finishedCurrentRound];
  if (!roundObj) return;

  // ⭐ Ensure clean export (remove any injected fields)
  const clean = {
    label: roundObj.label || ROUND_LABELS[finishedCurrentRound],
    matches: Array.isArray(roundObj.matches) ? roundObj.matches : []
  };

  // ⭐ Download clean JSON
  downloadJSON(
    clean,
    `${finishedCurrentRound}_${currentWorldCup.year || "new"}.json`
  );
}


/* ============================================================
   UNIVERSAL DRAWING OF LOTS CLICK HANDLER
   - Saves winner
   - Auto-downloads drawinglots.json
   - Re-renders UI
============================================================ */
document.addEventListener("click", e => {
  const btn = e.target.closest(".btn-draw-lots");
  if (!btn) return;

  const winner = btn.getAttribute("data-winner");
  if (!winner) return;

  const worldcup = currentWorldCup;
  const engine = processWorldCupAuto(worldcup);

  const groupId = engine.drawingLots.groupId;
  const [teamA, teamB] = engine.drawingLots.teams;

  const data = {
    year: worldcup.year,
    groupId,
    teams: [teamA, teamB],
    winner
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `drawinglots.json`;
  a.click();

  URL.revokeObjectURL(url);

  const container = document.getElementById("group-stage-container");
  container.innerHTML = "";
  renderGroupStage(worldcup, container, false);
});

/* ============================================================
   INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadWorldCupDropdown();

  const dd = $("worldcupDropdown");
  if (dd) dd.addEventListener("change", onWorldCupSelect);

  const btnCreate = $("btnCreate");
  if (btnCreate) btnCreate.addEventListener("click", createNewWorldCup);

  const btnLoadTeams = $("btnLoadTeams");
  if (btnLoadTeams) btnLoadTeams.addEventListener("click", loadTeamsJSON);

  const btnSaveTeams = $("btnSaveTeams");
  if (btnSaveTeams) btnSaveTeams.addEventListener("click", saveTeamsJSON);

  const btnLoadWorldCup = $("btnLoadWorldCup");
  if (btnLoadWorldCup)
    btnLoadWorldCup.addEventListener("click", loadWorldCupJSON);

  const btnSaveWorldCup = $("btnSaveWorldCup");
  if (btnSaveWorldCup)
    btnSaveWorldCup.addEventListener("click", saveWorldCupJSON);

  const btnLoadSeason = $("btnLoadSeason");
  if (btnLoadSeason)
    btnLoadSeason.addEventListener("click", loadSeasonRoundJSON);

  const btnSaveSeason = $("btnSaveSeason");
  if (btnSaveSeason)
    btnSaveSeason.addEventListener("click", saveSeasonRoundJSON);
});
