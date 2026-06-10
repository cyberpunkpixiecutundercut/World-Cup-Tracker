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
      "round32",      // ⭐ NEW ONLY FOR 48
      "round16",
      "quarterfinals",
      "semifinals",
      "thirdplace",
      "final"
    ];
  }
  // 24 & 32 stay the same
  return [
    "groupstage",
    "round16",
    "quarterfinals",
    "semifinals",
    "thirdplace",
    "final"
  ];
}

let ROUND_KEYS = getRoundKeysForFormat(32); // default, replaced dynamically

const ROUND_LABELS = {
  groupstage: "Group Stage",
  round32: "Round of 32",     // ⭐ NEW
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
function computeSingleMatchStats(teamId, match) {
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

  const isHome = match.team1 === teamId;
  const gf = isHome ? match.score1 : match.score2;
  const ga = isHome ? match.score2 : match.score1;

  let wins = 0, draws = 0, losses = 0, points = 0;

  if (gf > ga) {
    wins = 1;
    points = 3;
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

function computeGroupTable(teamIds, teamList, matches) {
  const table = {};

  // Initialize table rows
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

  // Process matches
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
      home.wins++; home.points += 3;
      away.losses++;
    } else if (m.score2 > m.score1) {
      away.wins++; away.points += 3;
      home.losses++;
    } else {
      home.draws++; away.draws++;
      home.points++; away.points++;
    }
  });

  return Object.values(table);
}


function sortGroupTable(table) {
  return table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });
}

/* ============================================================
   GROUP STANDINGS
============================================================ */
function computeGroupStandingsGeneric(groupId, teams, matches) {
  const table = {};
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
      t2.losses++;
      t1.points += 3;
    } else if (score1 < score2) {
      t2.wins++;
      t1.losses++;
      t2.points += 3;
    } else {
      t1.draws++;
      t2.draws++;
      t1.points += 1;
      t2.points += 1;
    }
  });

  const rows = Object.values(table);
  rows.sort((a, b) => {
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (b.points !== a.points) return b.points - a.points;
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

function computeAllGroupStandings(worldcup) {
  const groups = worldcup?.teams?.groups || [];
  const matches = worldcup?.season?.groupstage?.matches || [];

  const standings = [];

  groups.forEach(group => {
    const teamIds = (group.teams || []).map(t => t.id);

    // Build table for this group
    const table = computeGroupTable(teamIds, group.teams, matches);

    // Sort table
    const sorted = sortGroupTable(table);

    standings.push({
      groupId: group.id,
      table: sorted
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

function processWorldCupAuto(worldcup) {
  const format = detectWorldCupFormat(worldcup);
  const groupStandings = computeAllGroupStandings(worldcup);
  const matches = worldcup?.season?.groupstage?.matches || [];

  const hasAnyScore = matches.some(
    m => m.score1 != null && m.score2 != null
  );

  if (!hasAnyScore) {
    return {
      format: { teams: format },
      groups: groupStandings,
      qualifiers: {
        round32: { direct: [], thirds: [] },
        round16: { direct: [], thirds: [] },
        eliminatedGroups: []
      }
    };
  }

  const qualifiers = {
    round32: { direct: [], thirds: [] },
    round16: { direct: [], thirds: [] },
    eliminatedGroups: []
  };

  /* ============================================================
     ⭐ 24‑TEAM FORMAT
     - Top 2 auto
     - Best 4 third‑place by PTS, GD, GF
  ============================================================ */
  if (format === 24) {
    const thirds = [];

    groupStandings.forEach(g => {
      const t = g.table;

      qualifiers.round16.direct.push(t[0].id, t[1].id);
      thirds.push(t[2]);
      qualifiers.eliminatedGroups.push(t[3].id);
    });

    thirds.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    });

    thirds.forEach((t, idx) => {
      if (idx < 4) qualifiers.round16.thirds.push(t.id);
      else qualifiers.eliminatedGroups.push(t.id);
    });
  }

  /* ============================================================
     ⭐ 32‑TEAM FORMAT
     - Top 2 only
     - No 3rd‑place ranking
  ============================================================ */
  else if (format === 32) {
    groupStandings.forEach(g => {
      const t = g.table;

      qualifiers.round16.direct.push(t[0].id, t[1].id);
      qualifiers.eliminatedGroups.push(t[2].id, t[3].id);
    });
  }

  /* ============================================================
     ⭐ 48‑TEAM FORMAT
     - Top 2 auto
     - Best 8 third‑place by PTS, GD, GF
  ============================================================ */
  else if (format === 48) {
    const thirds = [];

    groupStandings.forEach(g => {
      const t = g.table;

      qualifiers.round32.direct.push(t[0].id, t[1].id);
      thirds.push(t[2]);
      qualifiers.eliminatedGroups.push(t[3].id);
    });

    thirds.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    });

    thirds.forEach((t, idx) => {
      if (idx < 8) qualifiers.round32.thirds.push(t.id);
      else qualifiers.eliminatedGroups.push(t.id);
    });
  }

  return {
    format: { teams: format },
    groups: groupStandings,
    qualifiers
  };
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
  // No normal-time score → no winner
  if (m.score1 == null || m.score2 == null) return null;

  // 1. Normal time
  if (m.score1 > m.score2) return m.team1;
  if (m.score2 > m.score1) return m.team2;

  // 2. Extra time (support both string "x-y" and numeric et1/et2)
  if (m.extraTime && m.extraTime.includes("-")) {
    const parts = m.extraTime.split("-");
    if (parts.length === 2) {
      const et1 = parseInt(parts[0], 10);
      const et2 = parseInt(parts[1], 10);
      if (et1 > et2) return m.team1;
      if (et2 > et1) return m.team2;
    }
  } else if (m.et1 != null && m.et2 != null) {
    if (m.et1 > m.et2) return m.team1;
    if (m.et2 > m.et1) return m.team2;
  }

  // 3. Penalties (support both string "x-y" and numeric pen1/pen2)
  if (m.penalty && m.penalty.includes("-")) {
    const parts = m.penalty.split("-");
    if (parts.length === 2) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      if (p1 > p2) return m.team1;
      if (p2 > p1) return m.team2;
    }
  } else if (m.pen1 != null && m.pen2 != null) {
    if (m.pen1 > m.pen2) return m.team1;
    if (m.pen2 > m.pen1) return m.team2;
  }

  return null;
}

/* ============================================================
   ⭐ NEW: GENERATE ROUND OF 32 (48‑TEAM FORMAT ONLY)
============================================================ */
function generateRound32FromEngine(worldcup, engine) {
  const ids = [
    ...engine.qualifiers.round32.direct,
    ...engine.qualifiers.round32.thirds
  ];

  const matches = [];
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

  worldcup.season.round32 = { label: "Round of 32", matches };
}

/* ============================================================
   ROUND OF 16 (USED BY ALL FORMATS)
============================================================ */
function generateRound16FromEngine(worldcup, engine) {
  const ids = [
    ...engine.qualifiers.round16.direct,
    ...engine.qualifiers.round16.thirds
  ];
  const matches = [];

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

  worldcup.season.round16 = { label: "Round of 16", matches };
}

/* ============================================================
   GENERIC NEXT ROUND (QF, SF)
============================================================ */
function generateNextKnockoutRound(worldcup, fromKey, toKey, label) {
  const fromRound = worldcup.season[fromKey];
  if (!fromRound || !fromRound.matches) return;

  const winners = [];
  fromRound.matches.forEach(m => {
    const w = getMatchWinner(m);
    if (w) winners.push(w);
  });

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

/* ============================================================
   ⭐ UPDATED ensureKnockoutGenerated (NOW SUPPORTS ROUND32)
============================================================ */
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
      generateRound32FromEngine(worldcup, getEngine());
    }
    return;
  }

  // ROUND OF 16
  if (roundKey === "round16") {
    if (hasMatches(worldcup.season.round16)) return;

    if (fmt === 48) {
      ensureKnockoutGenerated(worldcup, "round32");
      generateNextKnockoutRound(worldcup, "round32", "round16", "Round of 16");
    } else {
      generateRound16FromEngine(worldcup, getEngine());
    }
    return;
  }

  // QUARTERFINALS
  if (roundKey === "quarterfinals") {
    if (hasMatches(worldcup.season.quarterfinals)) return;

    ensureKnockoutGenerated(worldcup, "round16");
    generateNextKnockoutRound(worldcup, "round16", "quarterfinals", "Quarterfinals");
    return;
  }

  // SEMIFINALS
  if (roundKey === "semifinals") {
    if (hasMatches(worldcup.season.semifinals)) return;

    ensureKnockoutGenerated(worldcup, "quarterfinals");
    generateNextKnockoutRound(worldcup, "quarterfinals", "semifinals", "Semifinals");
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

  // Global check: any real score in group stage?
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

    // MATCH ROWS + MATCH TABLES
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

      const homeStats = computeSingleMatchStats(m.team1, m);
      const awayStats = computeSingleMatchStats(m.team2, m);

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

    // GROUP STANDINGS TABLE
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

    if (!hasAnyScore) {
      // No matches played at all → use original group order
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
      // Use engine standings with conditional sort
      const standings = engine.groups.find(g => g.groupId == group.id);
      if (standings) {
        const anyPoints = standings.table.some(t => t.points > 0);
        const sorted = anyPoints
          ? [...standings.table].sort((a, b) => {
              if (b.points !== a.points) return b.points - a.points;
              if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
              if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
              return a.name.localeCompare(b.name);
            })
          : standings.table;

        sorted.forEach(row => {
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
    panel.appendChild(groupBox);
  });

  renderGroupStageQualificationBoxes(worldcup, engine, panel);
}


/* ============================================================
   ⭐ UPDATED QUALIFICATION BOXES (24 / 32 / 48)
============================================================ */
function renderGroupStageQualificationBoxes(worldcup, engine, container) {
  const formatTeams = engine.format.teams;
  const qual = engine.qualifiers;

  const wrapper = document.createElement("div");
  wrapper.className = "qual-boxes";

  // ⭐ Detect if any match has a score
  const matches = worldcup?.season?.groupstage?.matches || [];
  const hasAnyScore = matches.some(m => m.score1 != null && m.score2 != null);

  /* -----------------------------
     24 & 48 TEAM FORMATS
  ----------------------------- */
  if (formatTeams === 24 || formatTeams === 48) {
    const boxAuto = document.createElement("div");
    boxAuto.className = "qual-box";
    boxAuto.innerHTML =
      "<h4>1st & 2nd (Auto)</h4>" +
      (formatTeams === 48
        ? qual.round32.direct.map(id => `<div>${findTeamName(worldcup, id)}</div>`).join("")
        : qual.round16.direct.map(id => `<div>${findTeamName(worldcup, id)}</div>`).join("")
      );

    const box3Pass = document.createElement("div");
    box3Pass.className = "qual-box";
    box3Pass.innerHTML =
      "<h4>3rd Qualified</h4>" +
      (formatTeams === 48
        ? qual.round32.thirds.map(id => `<div>${findTeamName(worldcup, id)}</div>`).join("")
        : qual.round16.thirds.map(id => `<div>${findTeamName(worldcup, id)}</div>`).join("")
      );

    const boxElim = document.createElement("div");
    boxElim.className = "qual-box";

    /* ⭐ FINAL FIX:
       24-team format:
       - No scores → empty eliminated
       - Scores exist → show eliminated normally
    */
    if (formatTeams === 24) {
      if (!hasAnyScore) {
        // No scores → empty eliminated
        boxElim.innerHTML = "<h4>Eliminated</h4>";
      } else {
        // Scores exist → show eliminated list
        boxElim.innerHTML =
          "<h4>Eliminated</h4>" +
          (engine.groups || [])
            .flatMap(g => g.table || [])
            .filter(r =>
              !qual.round16.direct.includes(r.id) &&
              !qual.round16.thirds.includes(r.id)
            )
            .map(r => `<div>${r.name}</div>`)
            .join("");
      }
    }

    /* ⭐ 48-team format unchanged */
    else {
      boxElim.innerHTML =
        "<h4>Eliminated</h4>" +
        engine.groups
          .flatMap(g => g.table || [])
          .filter(r =>
            !qual.round32.direct.includes(r.id) &&
            !qual.round32.thirds.includes(r.id)
          )
          .map(r => `<div>${r.name}</div>`)
          .join("");
    }

    wrapper.appendChild(boxAuto);
    wrapper.appendChild(box3Pass);
    wrapper.appendChild(boxElim);
  }

  /* -----------------------------
     32 TEAM FORMAT (unchanged)
  ----------------------------- */
  else {
    const boxTop = document.createElement("div");
    boxTop.className = "qual-box";
    boxTop.innerHTML =
      "<h4>Round of 16 (Advance)</h4>" +
      qual.round16.direct.map(id => `<div>${findTeamName(worldcup, id)}</div>`).join("");

    const boxElim = document.createElement("div");
    boxElim.className = "qual-box";
    boxElim.innerHTML =
      "<h4>Eliminated</h4>" +
      qual.eliminatedGroups.map(id => `<div>${findTeamName(worldcup, id)}</div>`).join("");

    wrapper.appendChild(boxTop);
    wrapper.appendChild(boxElim);
  }

  container.appendChild(wrapper);
}

/* ============================================================
   KNOCKOUT RENDERING (ROUND32 / ROUND16 / QF / SF)
============================================================ */
function renderKnockoutRound(worldcup, roundKey, container, editable) {
  if (editable) ensureKnockoutGenerated(worldcup, roundKey);

  const round = worldcup?.season?.[roundKey];
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

    // Normalize scores
    if (m.score1 === "") m.score1 = null;
    if (m.score2 === "") m.score2 = null;
    if (typeof m.score1 === "string" && m.score1 !== "") m.score1 = parseInt(m.score1, 10);
    if (typeof m.score2 === "string" && m.score2 !== "") m.score2 = parseInt(m.score2, 10);

    const t1 = findTeamName(worldcup, m.team1);
    const t2 = findTeamName(worldcup, m.team2);

    // Extract ET and PEN from JSON ("0-0", "4-3")
    let etH = "", etA = "";
    if (m.extraTime && m.extraTime.includes("-")) {
      const [h, a] = m.extraTime.split("-");
      etH = h;
      etA = a;
    }

    let penH = "", penA = "";
    if (m.penalty && m.penalty.includes("-")) {
      const [h, a] = m.penalty.split("-");
      penH = h;
      penA = a;
    }

    // Editable vs View mode
    if (editable) {
      row.innerHTML = `
        <span class="team-name">${t1}</span>
        <span class="score-separator">
          <input type="number" class="score-input" data-round="${roundKey}" data-index="${idx}" data-field="score1" value="${m.score1 ?? ""}">
          <span class="score-line"></span>
          <input type="number" class="score-input" data-round="${roundKey}" data-index="${idx}" data-field="score2" value="${m.score2 ?? ""}">
        </span>
        <span class="team-name">${t2}</span>

        <input type="text" class="et-input" data-round="${roundKey}" data-index="${idx}" data-field="extraTimeHome" value="${etH}">
        <input type="text" class="et-input" data-round="${roundKey}" data-index="${idx}" data-field="extraTimeAway" value="${etA}">

        <input type="text" class="pen-input" data-round="${roundKey}" data-index="${idx}" data-field="penaltyHome" value="${penH}">
        <input type="text" class="pen-input" data-round="${roundKey}" data-index="${idx}" data-field="penaltyAway" value="${penA}">
      `;
    } else {
      row.innerHTML = `
        <span class="team-name">${t1}</span>
        <span class="score-separator">
          <span>${m.score1 == null ? "" : m.score1}</span>
          <span class="score-line"></span>
          <span>${m.score2 == null ? "" : m.score2}</span>
        </span>
        <span class="team-name">${t2}</span>
        <span>${etH}</span>
        <span>${etA}</span>
        <span>${penH}</span>
        <span>${penA}</span>
      `;
    }

    panel.appendChild(row);

    // Winner detection (Normal → ET → Penalty)
    if (m.score1 != null && m.score2 != null) {
      const t1Name = findTeamName(worldcup, m.team1);
      const t2Name = findTeamName(worldcup, m.team2);
      let w = null, l = null;

      if (m.score1 > m.score2) {
        w = t1Name; l = t2Name;
      } else if (m.score2 > m.score1) {
        w = t2Name; l = t1Name;
      } else {
        if (m.extraTime && m.extraTime.includes("-")) {
          const [et1, et2] = m.extraTime.split("-").map(Number);
          if (et1 > et2) { w = t1Name; l = t2Name; }
          else if (et2 > et1) { w = t2Name; l = t1Name; }
        }
        if (!w && m.penalty && m.penalty.includes("-")) {
          const [p1, p2] = m.penalty.split("-").map(Number);
          if (p1 > p2) { w = t1Name; l = t2Name; }
          else if (p2 > p1) { w = t2Name; l = t1Name; }
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
    (roundKey === "thirdplace" || roundKey === "final")
      ? "WINNERS"
      : "WINNERS (advance)";

  const summary = document.createElement("div");
  summary.className = "knockout-summary";
  summary.innerHTML = `
    <h3>Match Reports / Results</h3>
    <div class="summary-block">
      <h4>${winnersLabel}</h4>
      ${winners.map(t => `<div>${t}</div>`).join("")}
    </div>
    <div class="summary-block">
      <h4>ELIMINATED</h4>
      ${losers.map(t => `<div>${t}</div>`).join("")}
    </div>
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
  }

  else {
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

  ROUND_KEYS = getRoundKeysForFormat(worldcup.format);

  root.innerHTML = "";

  const tabs = document.createElement("div");
  tabs.id = "finishedSeasonTabs";

  const content = document.createElement("div");
  content.id = "finishedSeasonContent";

  ROUND_KEYS.forEach(key => {
    const tab = document.createElement("div");
    tab.className =
      "season-tab" + (finishedCurrentRound === key ? " active" : "");
    tab.textContent = ROUND_LABELS[key];
    tab.onclick = () => {
      finishedCurrentRound = key;
      renderFinishedWorldCupTabs(worldcup, editable);
    };
    tabs.appendChild(tab);
  });

  root.appendChild(tabs);
  root.appendChild(content);

  // ⭐ Hook in the correct renderer
  if (finishedCurrentRound === "groupstage") {
    renderGroupStage(worldcup, content, editable);
  } else {
    renderKnockoutRound(worldcup, finishedCurrentRound, content, editable);
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

  // ⭐ UPDATED: 24 → A–F, 32 → A–H, 48 → A–L
  const groupIds =
    editFormat === 24
      ? ["A", "B", "C", "D", "E", "F"]
      : editFormat === 32
      ? ["A", "B", "C", "D", "E", "F", "G", "H"]
      : ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]; // ⭐ 48 teams

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

  // ⭐ UPDATED: Add round32 only for 48-team format
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
  // Default to groupstage on first load
  finishedCurrentRound = finishedCurrentRound || "groupstage";
  renderFinishedWorldCupTabs(worldcup, editable);
}

/* ============================================================
   LOAD FINISHED WORLD CUP (TEAMS + ROUND JSON)
============================================================ */
function loadWorldCupData(wc) {
  const paths = wc.paths || {};
  const teamsPath = paths.teams;
  const seasonPaths = paths.season || paths.rounds || {};

  if (!teamsPath || !seasonPaths.groupstage) {
    console.error("Invalid paths in worldcups.json for year", wc.year);
    return;
  }

  // ⭐ Load round32 whenever it exists in worldcups.json (no format check)
  const fetches = [
    fetch(teamsPath).then(r => r.json()),
    fetch(seasonPaths.groupstage).then(r => r.json()),
    seasonPaths.round32
      ? fetch(seasonPaths.round32).then(r => r.json())
      : Promise.resolve(null),
    fetch(seasonPaths.round16).then(r => r.json()),
    fetch(seasonPaths.quarterfinals).then(r => r.json()),
    fetch(seasonPaths.semifinals).then(r => r.json()),
    fetch(seasonPaths.thirdplace).then(r => r.json()),
    fetch(seasonPaths.final).then(r => r.json())
  ];

  Promise.all(fetches)
    .then(
      ([
        teamsJson,
        groupstage,
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

            // ⭐ If round32.json exists, load it. Do NOT auto-generate.
            ...(round32 ? { round32 } : {}),

            round16,
            quarterfinals,
            semifinals,
            thirdplace,
            final
          }
        };

        currentWorldCup = worldcup;
        editYear = worldcup.year;
        editFormat = worldcup.format;
        editTeams = worldcup.teams;
        editSeason = worldcup.season;

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

      if (!editSeason) {
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
      }

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

function saveTeamsJSON() {
  if (!editTeams) return;

  const data = {
    year: editYear,
    format: editFormat,
    teams: editTeams
  };

  downloadJSON(data, `teams_${editYear || "new"}.json`);
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

/* ============================================================
   LOAD / SAVE SINGLE ROUND
============================================================ */
function loadSeasonRoundJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let json = JSON.parse(reader.result);

      if (Array.isArray(json)) {
        json = {
          label: ROUND_LABELS[finishedCurrentRound],
          matches: json
        };
      }

      if (!currentWorldCup) {
        currentWorldCup = {
          year: editYear || null,
          format: editFormat || null,
          teams: editTeams || { groups: [] },
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
          }
        };
        editSeason = currentWorldCup.season;
      }

      if (!currentWorldCup.season) {
        currentWorldCup.season = {
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
      }

      currentWorldCup.season[finishedCurrentRound] = json;
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

  downloadJSON(
    roundObj,
    `${finishedCurrentRound}_${currentWorldCup.year || "new"}.json`
  );
}

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
