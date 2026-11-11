/* Continuum atelier.
   A skill line fills to the furthest stage any scored work has reached.
   Each exercise, test, or project adds a mark, and one piece of work can mark several skills.
   Unobserved is an empty arc. It is not a low stage.
   Edges on the map join subjects to read together. They do not move a stage. */
(function () {
  const A = globalThis.ATELIER;
  const KEY = "continuum-atelier-v1";

  const ROUTES = ["dashboard", "fields", "model", "panel", "map", "projects", "workshops", "activities", "library", "plan", "cohort", "report", "search"];

  function blank() {
    return {
      role: "student",
      mentorId: "ibarra",
      studentId: "amina",
      competencyId: "PE",
      focus: { type: "competency", id: "PE" },
      layer: "caf",
      field: "all",
      skill: "all",
      medium: "all",
      route: "dashboard",
      param: "",
      logs: [],
      challenges: [],
      endorsements: {},
      mediaOverrides: {},
      drafts: {},
      reports: {},
      contributions: [],
      materialUses: {},
      materialRatings: {},
      planKind: "all",
      registrations: {},
      withdrawals: {},
      planned: [],
      moods: {},
      assistant: {},
      lang: "en",
    };
  }

  let state = blank();
  let libraryNotice = "";
  let planNotice = "";
  let searchActive = -1;
  let materialSerial = 0;
  let sittingSerial = 0;
  let cloudZoom = 1;
  let cloudFocus = "";
  let cloudStudentId = "";
  let offerCloudFocus = { parentId: "", skillId: "" };
  let fieldMarkId = "";
  let skillGraphId = "";
  let assistantDraft = "";
  let assistantBusy = false;
  let assistantBusyFor = "";
  let assistantNotice = "";
  let assistantToken = 0;
  let assistantOpen = false;

  const ASSISTANT_MOODS = [
    { id: "steady", label: "Steady" },
    { id: "curious", label: "Curious" },
    { id: "tired", label: "Tired" },
    { id: "stuck", label: "Stuck" },
    { id: "overwhelmed", label: "Overwhelmed" },
  ];
  const ASSISTANT_PROMPTS = [
    { id: "coming", label: "What is coming up for me?" },
    { id: "skills", label: "Which skills should I work on?" },
    { id: "task", label: "Suggest one task that would move a skill." },
    { id: "prepare", label: "What should I prepare before the next sitting?" },
  ];
  const CASELOAD_PROMPTS = [
    { id: "coach" },
    { id: "age" },
    { id: "week" },
  ];
  const COACH_RANK = { challenge: 0, stale: 1, intake: 2, workshops: 3, open: 4, withheld: 5, ready: 6, endorsed: 7 };

  const byId = (list, id) => list.find((item) => item.id === id);
  const student = (id) => byId(A.students, id);
  const current = () => student(state.studentId) || A.students[0];

  function t(key, vars) {
    const i18n = globalThis.ATELIER_I18N;
    if (!i18n || typeof i18n.t !== "function") return key;
    return i18n.t(state.lang === "fr" ? "fr" : "en", key, vars);
  }

  function extraOf(bucket, id) {
    if (state.lang !== "fr" || id == null) return null;
    const pack = globalThis.ATELIER_I18N && ATELIER_I18N.content && ATELIER_I18N.content.fr;
    return pack && pack[bucket] && pack[bucket][id] ? pack[bucket][id] : null;
  }

  function localize(bucket, item, nested) {
    if (!item) return item;
    const extra = extraOf(bucket, item.id != null ? item.id : item.n);
    if (!extra) return item;
    const out = Object.assign({}, item, extra);
    for (const key of nested || []) {
      if (!Array.isArray(item[key])) continue;
      const nest = extra[key];
      if (!nest || typeof nest !== "object") continue;
      out[key] = item[key].map((row) => {
        if (!row || row.id == null || !nest[row.id]) return row;
        return Object.assign({}, row, nest[row.id]);
      });
    }
    if (Array.isArray(extra.rules)) out.rules = extra.rules;
    if (extra.contributor && item.contributor) {
      out.contributor = Object.assign({}, item.contributor, extra.contributor);
    }
    return out;
  }

  const competency = (id) => localize("competencies", byId(A.competencies, id), ["parts"]);
  const person = (id) => localize("people", byId(A.people, id));
  const project = (id) => localize("projects", byId(A.projects, id), ["features", "activities"]);
  const workshop = (id) => localize("workshops", byId(A.workshops, id), ["activities"]);
  const field = (id) => localize("fields", byId(A.fields, id));

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function monthNames(kind) {
    const i18n = globalThis.ATELIER_I18N;
    const lang = state.lang === "fr" ? "fr" : "en";
    const table = kind === "short"
      ? (i18n && i18n.monthsShort) || {}
      : (i18n && i18n.months) || {};
    return table[lang] || table.en || [];
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const months = monthNames();
    if (!y || !m || !d || !months[m - 1]) return "";
    return `${d} ${months[m - 1]} ${y}`;
  }

  function formatMonth(iso) {
    const [y, m] = iso.split("-").map(Number);
    const months = monthNames();
    if (!y || !months[m - 1]) return "";
    return `${months[m - 1]} ${y}`;
  }

  function weekdayName(iso) {
    const stamp = Date.parse(iso + "T12:00:00Z");
    if (Number.isNaN(stamp)) return "";
    const i18n = globalThis.ATELIER_I18N;
    const lang = state.lang === "fr" ? "fr" : "en";
    const days = (i18n && i18n.weekdays && (i18n.weekdays[lang] || i18n.weekdays.en)) || [];
    return days[new Date(stamp).getUTCDay()] || "";
  }

  function normalizeTime(value) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return "";
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return "";
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  }

  function timeValue(value) {
    const normal = normalizeTime(value);
    if (!normal) return -1;
    const [hour, minute] = normal.split(":").map(Number);
    return hour * 60 + minute;
  }

  function formatWhen(iso) {
    if (!iso) return "";
    const date = iso.slice(0, 10);
    return formatDate(date);
  }

  function daysSince(iso) {
    const start = Date.parse(iso + "T12:00:00Z");
    const today = Date.parse(A.today + "T12:00:00Z");
    return Math.round((today - start) / 86400000);
  }

  function focusOk(focus) {
  if (!focus || !focus.type || !focus.id) return false;
  if (focus.type === "competency") return !!competency(focus.id);
  if (focus.type === "evidence") return !!byId(A.evidence, focus.id);
  if (focus.type === "feature") return project("coastal").features.some((item) => item.id === focus.id);
  return false;
}

  function levelLabel(n) {
    if (n == null) return t("level.unobserved");
    const extra = extraOf("levels", String(n));
    if (extra && extra.label) return extra.label;
    const row = A.levels.find((item) => item.n === n);
    return row ? row.label : String(n);
  }

  function mediaLabel(id) {
    const extra = extraOf("media", id);
    if (extra && extra.label) return extra.label;
    const row = A.media.find((item) => item.id === id);
    return row ? row.label : id;
  }

  function evidenceFor(studentId) {
    return A.evidence
      .filter((item) => item.studentId === studentId)
      .map((item) => localize("evidence", item));
  }

  function notesFor(studentId) {
    return A.notes
      .filter((item) => item.studentId === studentId)
      .map((item) => localize("notes", item));
  }

  function historyOf(studentId, competencyId) {
    const rows = [];
    for (const item of evidenceFor(studentId)) {
      const score = item.scores.find((entry) => entry.competencyId === competencyId);
      if (!score) continue;
      rows.push({ date: item.date, id: item.id, level: score.level, evidence: item });
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1)));
    return rows;
  }

  function levelOf(studentId, competencyId) {
    const rows = historyOf(studentId, competencyId);
    if (!rows.length) return null;
    return rows.reduce((furthest, row) => Math.max(furthest, row.level), 0);
  }

  function latestOf(studentId, competencyId) {
    const rows = historyOf(studentId, competencyId);
    if (!rows.length) return null;
    const row = rows[rows.length - 1];
    return { evidence: row.evidence, score: { competencyId, level: row.level } };
  }

  function fieldProgress(studentId, fieldId) {
    const claims = A.competencies.filter((claim) => claim.field === fieldId);
    const levels = claims.map((claim) => levelOf(studentId, claim.id)).filter((level) => level != null);
    if (!levels.length) return null;
    return levels.reduce((sum, level) => sum + level, 0) / levels.length;
  }

  function dayNumber(iso) {
    return Date.parse(iso + "T12:00:00Z") / 86400000;
  }

  // Field points are the sum of the furthest stage on each skill.
  // A later lower mark does not reduce the line, and a skill with no evidence adds nothing.
  function fieldSeries(studentId, fieldId) {
    const skills = A.competencies.filter((claim) => claim.field === fieldId);
    const ids = new Set(skills.map((claim) => claim.id));
    const events = evidenceFor(studentId)
      .filter((item) => item.scores.some((score) => ids.has(score.competencyId)))
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1)));
    const furthest = {};
    const steps = [];
    for (const item of events) {
      const moved = [];
      for (const score of item.scores) {
        if (!ids.has(score.competencyId)) continue;
        const before = furthest[score.competencyId] || 0;
        if (score.level > before) {
          furthest[score.competencyId] = score.level;
          moved.push(score.competencyId);
        }
      }
      const levels = {};
      for (const claim of skills) levels[claim.id] = furthest[claim.id] || 0;
      const total = skills.reduce((sum, claim) => sum + levels[claim.id], 0);
      steps.push({ date: item.date, id: item.id, title: item.title, total, moved, levels });
    }
    return { skills, steps, ceiling: skills.length * 4 };
  }

  function chartDomain(steps) {
    const first = dayNumber(steps[0].date);
    const end = Math.max(dayNumber(A.today), first + 1);
    const span = end - first;
    const pad = span < 21 ? Math.max(7, 21 - span) : Math.max(3, Math.round(span * 0.06));
    return { x0: first - pad, x1: end };
  }

  function placeXs(steps, domain, plotLeft, plotRight, minGap) {
    const span = domain.x1 - domain.x0;
    const xAt = (iso) => plotLeft + ((dayNumber(iso) - domain.x0) / span) * (plotRight - plotLeft);
    const raw = steps.map((step) => xAt(step.date));
    if (steps.length < 2) return raw;
    const gaps = [];
    for (let i = 1; i < steps.length; i++) gaps.push(Math.max(0, dayNumber(steps[i].date) - dayNumber(steps[i - 1].date)));
    const room = raw[raw.length - 1] - raw[0];
    const minTotal = minGap * gaps.length;
    if (room <= minTotal) {
      return raw.map((_, index) => raw[0] + room * index / gaps.length);
    }
    if (gaps.every((gap, index) => raw[index + 1] - raw[index] >= minGap)) return raw;
    const leftover = room - minTotal;
    const sum = gaps.reduce((total, gap) => total + gap, 0) || 1;
    const xs = [raw[0]];
    for (let i = 0; i < gaps.length; i++) xs.push(xs[i] + minGap + leftover * (gaps[i] / sum));
    return xs;
  }

  function stepPoints(totals, xs, yAt, xStart, xEnd) {
    const pts = [[xStart, yAt(0)]];
    for (let i = 0; i < totals.length; i++) {
      pts.push([xs[i], pts[pts.length - 1][1]]);
      pts.push([xs[i], yAt(totals[i])]);
    }
    pts.push([xEnd, pts[pts.length - 1][1]]);
    return pts;
  }

  function pathFrom(pts, close) {
    const line = pts.map((pt) => pt.map((n) => (Math.round(n * 10) / 10).toFixed(1)).join(" ")).join(" L ");
    if (!close) return `M ${line}`;
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `M ${line} L ${last[0].toFixed(1)} ${close.y0.toFixed(1)} L ${first[0].toFixed(1)} ${close.y0.toFixed(1)} Z`;
  }

  function alsoMoved(item, competencyId) {
    return item.scores
      .map((score) => score.competencyId)
      .filter((id) => id !== competencyId && competency(id));
  }

  function lastEvidenceItem(studentId) {
    let best = null;
    for (const item of evidenceFor(studentId)) {
      if (!best || item.date > best.date || (item.date === best.date && item.id > best.id)) best = item;
    }
    return best;
  }

  function meanFloor(personRecord) {
    const total = A.floorIds.reduce((sum, id) => sum + (levelOf(personRecord.id, id) ?? 0), 0);
    return total / A.floorIds.length;
  }

  function formatMean(n) {
    const rounded = Math.round(n * 100) / 100;
    return String(rounded);
  }

  function floorMet(personRecord) {
    return A.floorIds.every((id) => (levelOf(personRecord.id, id) ?? 0) >= A.gate);
  }

  function compensatoryMet(personRecord) {
    return meanFloor(personRecord) >= A.compensatoryMean;
  }

  function primaryOpenFloor(personRecord) {
    let best = null;
    for (const id of A.floorIds) {
      const level = levelOf(personRecord.id, id);
      const value = level == null ? -1 : level;
      if (value >= A.gate) continue;
      if (!best || value < best.value) best = { id, value };
    }
    return best;
  }

  function defaultCompetency(personRecord) {
    const open = primaryOpenFloor(personRecord);
    if (open) return open.id;
    const developing = A.competencies.find((item) => {
      const level = levelOf(personRecord.id, item.id);
      return level != null && level < A.gate;
    });
    return developing ? developing.id : "PE";
  }

  function workshopPhase(personRecord) {
    const values = Object.values(personRecord.workshops);
    if (values.every((value) => value === "done")) return "done";
    if (!evidenceFor(personRecord.id).length) return "intake";
    if (values.some((value) => value === "enrolled" || value === "upcoming")) return "workshops";
    return "done";
  }

  function openChallenges(studentId) {
    return state.challenges.filter((item) => item.studentId === studentId && item.status === "open");
  }

  function attention(personRecord) {
    if (openChallenges(personRecord.id).length) return { id: "challenge", label: t("flag.challenge") };
    const last = lastEvidenceItem(personRecord.id);
    if (last && daysSince(last.date) > A.staleDays) return { id: "stale", label: t("flag.stale") };
    const phase = workshopPhase(personRecord);
    if (phase === "intake") return { id: "intake", label: t("flag.intake") };
    if (phase === "workshops") return { id: "workshops", label: t("flag.workshops") };
    const decision = state.endorsements[personRecord.id];
    if (floorMet(personRecord) && decision && decision.decision === "withhold") {
      return { id: "withheld", label: t("flag.withheld") };
    }
    if (floorMet(personRecord) && decision && decision.decision === "endorse") {
      return { id: "endorsed", label: t("flag.endorsed") };
    }
    if (floorMet(personRecord)) return { id: "ready", label: t("flag.ready") };
    const gap = primaryOpenFloor(personRecord);
    if (!gap) return { id: "open", label: t("flag.open") };
    return { id: "open", label: `${competency(gap.id).name} · ${levelLabel(levelOf(personRecord.id, gap.id)).toLowerCase()}` };
  }

  function mediaOf(personRecord) {
    return state.mediaOverrides[personRecord.id] || personRecord.media;
  }

  function mediaSentence(personRecord) {
    const list = mediaOf(personRecord);
    if (!list.length) return t("media.none");
    if (list.length === 1) return t("media.prefersOne", { one: mediaLabel(list[0]).toLowerCase() });
    return t("media.prefersTwo", { one: mediaLabel(list[0]).toLowerCase(), two: mediaLabel(list[1]).toLowerCase() });
  }

  function firstName(personRecord) {
    return personRecord.name.split(" ")[0];
  }

  function neighbors(id) {
    const found = [];
    for (const [left, right] of A.edges) {
      if (left === id) found.push(right);
      if (right === id) found.push(left);
    }
    return found;
  }

  function allParts() {
    const rows = [];
    for (const claim of A.competencies) {
      for (const part of claim.parts || []) rows.push({ ...part, skillId: claim.id, fieldId: claim.field });
    }
    return rows;
  }

  function partById(id) {
    return allParts().find((part) => part.id === id) || null;
  }

  function canDecide(personRecord) {
    if (state.role === "director") return true;
    if (state.role === "mentor" && personRecord.mentorId === state.mentorId) return true;
    return false;
  }

  function actorName() {
    if (state.role === "director") return person("ortega").name;
    if (state.role === "mentor") return person(state.mentorId).name;
    return current().name;
  }

  function sourceLabel(item) {
    if (item.source === "project") return project(item.sourceId).name;
    if (item.source === "workshop") return workshop(item.sourceId).name;
    return item.source;
  }

  function pointsLabel(n) {
    return n === 1 ? t("points.one") : t("points.many", { n });
  }

  function offerPoints(ids) {
    return ids.length * 4;
  }

  function pointsStillOpen(personId, competencyId) {
    const level = levelOf(personId, competencyId);
    if (level == null) return 4;
    return Math.max(0, 4 - level);
  }

  function offerPhrase(ids) {
    const n = offerPoints(ids);
    if (n === 0) return t("points.zero");
    return t("points.upTo", { n: pointsLabel(n) });
  }

  function skillsPointPhrase(ids) {
    if (!ids.length) return t("points.noneMove");
    const names = namedList(ids);
    if (ids.length === 1) return t("points.oneSkill", { names });
    return t("points.eachSkill", { names });
  }

  function stagePointsSentence(level) {
    if (level == null) return t("points.noneYet");
    return t("points.stageLine", { stage: levelLabel(level), points: pointsLabel(level) });
  }

  function evidencePoints(item) {
    return item.scores.reduce((sum, score) => sum + score.level, 0);
  }

  function workshopStatusLabel(status) {
    if (status === "done") return t("status.done");
    if (status === "enrolled") return t("status.inProgress");
    return t("status.notStarted");
  }

  function projectStatusLabel(personRecord, projectId) {
    if (personRecord.projectIds.includes(projectId)) return t("status.yourProject");
    if (personRecord.recommendedProjectId === projectId) return t("status.seatWaiting");
    return t("status.notYourSeat");
  }

  function projectAvailability(personRecord, projectId) {
    if (personRecord.projectIds.includes(projectId)) {
      return state.role === "student" ? t("status.onProjectYou") : t("status.onProjectThem", { name: firstName(personRecord) });
    }
    if (personRecord.recommendedProjectId === projectId) return t("status.seatIsWaiting");
    return t("status.openToRead");
  }

  function actionStatus(personRecord, source, parent) {
    if (source === "workshop") return `${parent.name} · ${workshopStatusLabel(personRecord.workshops[parent.id])}`;
    return `${parent.name} · ${projectStatusLabel(personRecord, parent.id)}`;
  }

  function actionCurrent(personRecord, source, parent) {
    if (source === "workshop") {
      const status = personRecord.workshops[parent.id];
      return status === "enrolled" || status === "upcoming";
    }
    return personRecord.projectIds.includes(parent.id) || personRecord.recommendedProjectId === parent.id;
  }

  function overlapNote(item) {
    const sum = item.activities.reduce((total, activity) => total + offerPoints(activity.competencyIds), 0);
    const cap = offerPoints(item.elicits);
    if (sum <= cap) return "";
    return t("overlap.note", { cap: pointsLabel(cap), sum: pointsLabel(sum) });
  }

  function activityKind(kind) {
    return t("activity." + kind) === "activity." + kind ? kind : t("activity." + kind);
  }

  function activityList(activities) {
    return `<ul class="point-mini">${activities.map((activity) => `<li>
      <span>${esc(activityKind(activity.kind))} · ${esc(activity.name)}</span>
      <b>${esc(offerPhrase(activity.competencyIds))}</b>
      <small>${esc(skillsPointPhrase(activity.competencyIds))}</small>
    </li>`).join("")}</ul>`;
  }

  function pointsBoard(personRecord) {
    const rows = []
      .concat(A.workshops.map((item) => ({ parent: item, source: "workshop" })))
      .concat(A.projects.map((item) => ({ parent: item, source: "project" })))
      .flatMap(({ parent, source }) => parent.activities.map((activity) => ({ activity, parent, source })))
      .map(({ activity, parent, source }) => {
        const href = source === "workshop" ? `#workshops/${parent.id}` : `#projects/${parent.id}`;
        const n = offerPoints(activity.competencyIds);
        const points = n === 0
          ? `<strong>0</strong> <span>${esc(t("points.word"))}</span>`
          : `<strong>${n}</strong> <span>${esc(t("points.atMost"))}</span>`;
        return `<tr class="${actionCurrent(personRecord, source, parent) ? "is-yours" : ""}">
          <th scope="row">${esc(activity.name)}</th>
          <td>${esc(activity.kind)}</td>
          <td class="pts">${points}</td>
          <td>${esc(skillsPointPhrase(activity.competencyIds))}</td>
          <td><a href="${href}">${esc(actionStatus(personRecord, source, parent))}</a></td>
        </tr>`;
      }).join("");
    return `<section class="point-board" aria-labelledby="points-title">
      <h3 class="section-title" id="points-title">Points for each action</h3>
      <p>Every workshop, test, and piece of project work lists the points it can place. A recorded mark is worth 1 point at emerging, 2 at developing, 3 at proficient, and 4 at advanced. You receive the points a mentor records. The skill line keeps the furthest of those points.</p>
      <div class="table-wrap">
        <table class="points-table">
          <caption>What ${esc(firstName(personRecord))} can earn</caption>
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col">Kind</th>
              <th scope="col">Points</th>
              <th scope="col">Where the points land</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
  }

  function recommendation(personRecord) {
    const name = firstName(personRecord);
    const flag = attention(personRecord);
    const last = lastEvidenceItem(personRecord.id);
    if (flag.id === "stale" && last) {
      return `${name} has no evidence since ${formatDate(last.date)} (${daysSince(last.date)} days). ${mediaSentence(personRecord)} The last scored work was "${last.title}". Meet, and set the next observation in that medium. Writing can still be scored. It can be short, and it can come after the work.`;
    }
    if (flag.id === "intake") {
      return `${name} is in intake. Let ${workshop("sampler").name} finish before a project seat. An empty chart means the work has not been scored yet.`;
    }
    if (flag.id === "workshops") {
      const enrolled = Object.entries(personRecord.workshops)
        .filter(([, value]) => value === "enrolled")
        .map(([id]) => workshop(id).name);
      const seat = personRecord.recommendedProjectId
        ? ` A scaffolded place on ${project(personRecord.recommendedProjectId).name} is the recommendation. ${personRecord.scaffold}`
        : "";
      return `${name} still has workshop time${enrolled.length ? ` (${enrolled.join(", ")})` : ""}.${seat}`;
    }
    if (!floorMet(personRecord)) {
      const open = A.floorIds
        .filter((id) => (levelOf(personRecord.id, id) ?? 0) < A.gate)
        .map((id) => `${competency(id).name} is ${levelLabel(levelOf(personRecord.id, id)).toLowerCase()}`);
      return `Along the shared subjects, ${open.join("; ")}. The next project can move ${open.length === 1 ? "that skill" : "those skills"}, and the same work can move others.`;
    }
    const soft = A.competencies.filter((item) => {
      const level = levelOf(personRecord.id, item.id);
      return !A.floorIds.includes(item.id) && level != null && level < A.gate;
    });
    const softText = soft.length ? ` Still moving: ${soft.map((item) => item.name).join(", ")}.` : "";
    if (flag.id === "endorsed") return `A mentor has noted that the shared subjects are far enough along.${softText}`;
    if (flag.id === "withheld") return `A mentor has written that readiness waits.${softText} A later note can replace that sentence.`;
    return `Algebra, writing, mechanics, and ethics have each reached proficient.${softText} Further work still adds marks. A mentor may note that these four are far enough along.`;
  }

  function namedList(ids) {
    const names = ids.map((id) => competency(id).name);
    if (names.length < 2) return names.join("");
    const conj = t("and");
    if (state.lang === "fr") return `${names.slice(0, -1).join(", ")} ${conj} ${names[names.length - 1]}`;
    return `${names.slice(0, -1).join(", ")}, ${conj} ${names[names.length - 1]}`;
  }

  function floorCopy(personRecord) {
    const levels = A.floorIds.map((id) => levelOf(personRecord.id, id));
    const bits = A.floorIds.map((id) => `${competency(id).name} is ${levelLabel(levelOf(personRecord.id, id)).toLowerCase()}`);
    let lead;
    if (levels.every((level) => level == null)) {
      lead = `${personRecord.name} has no scored evidence. An empty arc means that skill has not been touched yet.`;
    } else {
      lead = `Each exercise, test, and project adds a mark on every skill it touches. One piece of work can move several skills in the same sitting. The arc fills to the furthest stage those marks have reached. ${bits.join(". ")}.`;
    }
    return { lead };
  }

  function situation(personRecord) {
    const names = personRecord.projectIds.map((id) => project(id).name);
    if (names.length) return `${firstName(personRecord)} is on ${names.join(" and ")}.`;
    if (personRecord.recommendedProjectId) {
      return `${firstName(personRecord)} has no project seat yet. A scaffolded place on ${project(personRecord.recommendedProjectId).name} is waiting on the workshops.`;
    }
    return `${firstName(personRecord)} has no project seat yet.`;
  }

  function authority(personRecord) {
    const mentor = person(personRecord.mentorId);
    const director = person("ortega");
    if (state.role === "student") {
      return `This is the same record ${mentor.name} and ${director.name} see. A challenge asks for a reread. It leaves the score as it is until someone scores the work again.`;
    }
    if (canDecide(personRecord)) {
      const who = state.role === "director"
        ? `${director.name} can act on any student.`
        : `${mentor.name} is the mentor of record.`;
      return `${who} ${personRecord.name} sees the same levels and every note.`;
    }
    return `${mentor.name} is the mentor of record for ${personRecord.name}. This panel is readable. Decisions belong to that mentor or the director.`;
  }

  function meter(level, fieldId) {
    const n = level == null ? 0 : level;
    const bars = [1, 2, 3, 4].map((step) => `<i class="${step <= n ? "on" : ""}"></i>`).join("");
    return `<span class="meter field-${fieldId}" data-level="${n}" title="${esc(levelLabel(level))}">${bars}</span>`;
  }

  function pip(level, fieldId, title) {
    const n = level == null ? 0 : level;
    return `<i class="pip field-${fieldId}" data-level="${n}" title="${esc(title)}"></i>`;
  }

  function flagHTML(personRecord) {
    const flag = attention(personRecord);
    return `<span class="flag flag-${flag.id}">${esc(flag.label)}</span>`;
  }

  function persist() {
    const payload = {
      role: state.role,
      mentorId: state.mentorId,
      studentId: state.studentId,
      competencyId: state.competencyId,
      focus: state.focus,
      layer: state.layer,
      field: state.field,
      skill: state.skill,
      medium: state.medium,
      logs: state.logs,
      challenges: state.challenges,
      endorsements: state.endorsements,
      mediaOverrides: state.mediaOverrides,
      drafts: state.drafts,
      reports: state.reports,
      contributions: state.contributions,
      materialUses: state.materialUses,
      materialRatings: state.materialRatings,
      planKind: state.planKind,
      registrations: state.registrations,
      withdrawals: state.withdrawals,
      planned: state.planned,
      moods: state.moods,
      assistant: state.assistant,
      lang: state.lang,
    };
    try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch (err) { /* private mode */ }
  }

  function load() {
    state = blank();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const keys = Object.keys(blank());
      for (const key of keys) {
        if (key === "route" || key === "param") continue;
        if (saved[key] !== undefined) state[key] = saved[key];
      }
    } catch (err) {
      state = blank();
    }
    if (!student(state.studentId)) state.studentId = "amina";
    if (!person(state.mentorId)) state.mentorId = "ibarra";
    if (!["student", "mentor", "director"].includes(state.role)) state.role = "student";
    if (state.lang !== "fr") state.lang = "en";
    try {
      const qlang = new URLSearchParams(location.search).get("lang");
      if (qlang === "fr" || qlang === "en") state.lang = qlang;
    } catch (err) { /* keep saved lang */ }
    if (!competency(state.competencyId)) state.competencyId = "PE";
    if (state.skill !== "all" && !competency(state.skill)) state.skill = "all";
    if (!focusOk(state.focus)) state.focus = { type: "competency", id: "PE" };
    if (!A.layers.some((item) => item.id === state.layer) && state.layer !== "") state.layer = "caf";
    if (!Array.isArray(state.logs)) state.logs = [];
    if (!Array.isArray(state.challenges)) state.challenges = [];
    if (!state.endorsements || typeof state.endorsements !== "object") state.endorsements = {};
    if (!state.mediaOverrides || typeof state.mediaOverrides !== "object") state.mediaOverrides = {};
    if (!state.drafts || typeof state.drafts !== "object") state.drafts = {};
    if (!state.reports || typeof state.reports !== "object") state.reports = {};
    if (!Array.isArray(state.contributions)) state.contributions = [];
    const seenIds = new Set();
    state.contributions = state.contributions.map(cleanContribution).filter((item) => {
      if (!item || seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
    state.materialUses = cleanUseMap(state.materialUses);
    state.materialRatings = cleanRatingMap(state.materialRatings);
    if (!["all", "workshop", "project", "lecture"].includes(state.planKind)) state.planKind = "all";
    if (!state.registrations || typeof state.registrations !== "object" || Array.isArray(state.registrations)) state.registrations = {};
    if (!state.withdrawals || typeof state.withdrawals !== "object" || Array.isArray(state.withdrawals)) state.withdrawals = {};
    state.planned = cleanPlanned(state.planned);
    state.registrations = cleanRegistrationMap(state.registrations);
    state.withdrawals = cleanWithdrawalMap(state.withdrawals);
    normalizeAssistantState();
  }

  function normalizeAssistantState() {
    if (!state.moods || typeof state.moods !== "object" || Array.isArray(state.moods)) state.moods = {};
    if (!state.assistant || typeof state.assistant !== "object" || Array.isArray(state.assistant)) state.assistant = {};
  }

  function cleanContributor(value) {
    if (!value || typeof value !== "object") return null;
    if (value.kind === "student" && student(value.id)) return { kind: "student", id: value.id };
    if (value.kind === "mentor" && person(value.id)) return { kind: "mentor", id: value.id };
    if (value.kind === "director" && person(value.id)) return { kind: "director", id: value.id };
    if (value.kind === "external") {
      const name = String(value.name || "").trim().slice(0, 80);
      if (!name) return null;
      const place = String(value.place || "").trim().slice(0, 80);
      return place ? { kind: "external", name, place } : { kind: "external", name };
    }
    return null;
  }

  function cleanContribution(item) {
    if (!item || typeof item !== "object") return null;
    const id = typeof item.id === "string" ? item.id : "";
    if (!/^mat-[a-z0-9-]+$/.test(id)) return null;
    if (A.materials.some((row) => row.id === id)) return null;
    const title = String(item.title || "").trim().slice(0, 140);
    const summary = String(item.summary || "").trim().slice(0, 600);
    if (!title || !summary) return null;
    if (!A.media.some((row) => row.id === item.medium)) return null;
    const fields = [];
    const sourceFields = Array.isArray(item.fields) ? item.fields : [];
    for (const fieldId of sourceFields) {
      if (field(fieldId) && !fields.includes(fieldId)) fields.push(fieldId);
    }
    if (!fields.length) return null;
    const competencies = [];
    const sourceClaims = Array.isArray(item.competencies) ? item.competencies : [];
    for (const claimId of sourceClaims) {
      if (competency(claimId) && !competencies.includes(claimId)) competencies.push(claimId);
    }
    const minutes = Math.round(Number(item.minutes));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) return null;
    const contributor = cleanContributor(item.contributor);
    if (!contributor) return null;
    const brought = typeof item.brought === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.brought) ? item.brought : A.today;
    return { id, title, summary, medium: item.medium, minutes, fields, competencies, contributor, brought };
  }

  function cleanPlanned(value) {
    if (!Array.isArray(value)) return [];
    const taken = new Set(A.sessions.map((item) => item.id));
    const out = [];
    for (const item of value) {
      const cleaned = cleanPlannedItem(item, taken);
      if (!cleaned) continue;
      taken.add(cleaned.id);
      out.push(cleaned);
    }
    return out;
  }

  function cleanPlannedItem(item, taken) {
    if (!item || typeof item !== "object") return null;
    const id = typeof item.id === "string" ? item.id : "";
    if (!/^sit-[a-z0-9-]+$/.test(id) || taken.has(id)) return null;
    if (!["workshop", "project", "lecture"].includes(item.kind)) return null;
    const date = typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : "";
    const start = normalizeTime(item.start);
    const end = normalizeTime(item.end);
    if (!date || !start || !end || timeValue(end) <= timeValue(start)) return null;
    const place = String(item.place || "").trim().slice(0, 80);
    if (!place || !person(item.hostId)) return null;
    const capacity = Number(item.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 40) return null;
    const note = String(item.note || "").trim().slice(0, 240);
    let ref = "";
    let title = "";
    let summary = "";
    let fieldId = "";
    if (item.kind === "workshop") {
      if (!workshop(item.ref)) return null;
      ref = item.ref;
    } else if (item.kind === "project") {
      if (!project(item.ref)) return null;
      ref = item.ref;
    } else {
      title = String(item.title || "").trim().slice(0, 140);
      summary = String(item.summary || "").trim().slice(0, 400);
      if (!title || !summary || !field(item.field)) return null;
      fieldId = item.field;
    }
    return {
      id,
      kind: item.kind,
      ref,
      title,
      summary,
      field: fieldId,
      date,
      start,
      end,
      place,
      hostId: item.hostId,
      capacity,
      note,
    };
  }

  function seedRoster(id) {
    const item = byId(A.sessions, id);
    return item && Array.isArray(item.roster) ? item.roster : [];
  }

  function cleanStudentList(list) {
    const ids = [];
    if (!Array.isArray(list)) return ids;
    for (const id of list) {
      if (typeof id === "string" && student(id) && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  function sessionAllowed(id) {
    if (A.sessions.some((item) => item.id === id)) return true;
    return state.planned.some((item) => item.id === id);
  }

  function cleanRegistrationMap(value) {
    const out = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [id, list] of Object.entries(value)) {
      if (!sessionAllowed(id)) continue;
      const seed = seedRoster(id);
      const ids = cleanStudentList(list).filter((studentId) => !seed.includes(studentId));
      if (ids.length) out[id] = ids;
    }
    return out;
  }

  function cleanWithdrawalMap(value) {
    const out = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [id, list] of Object.entries(value)) {
      if (!byId(A.sessions, id)) continue;
      const seed = seedRoster(id);
      const ids = cleanStudentList(list).filter((studentId) => seed.includes(studentId));
      if (ids.length) out[id] = ids;
    }
    return out;
  }

  function knownMaterialId(id) {
    if (A.materials.some((item) => item.id === id)) return true;
    return state.contributions.some((item) => item.id === id);
  }

  function cleanUseMap(value) {
    const out = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [id, list] of Object.entries(value)) {
      if (!knownMaterialId(id) || !Array.isArray(list)) continue;
      const ids = [];
      for (const studentId of list) {
        if (typeof studentId === "string" && student(studentId) && !ids.includes(studentId)) ids.push(studentId);
      }
      if (ids.length) out[id] = ids;
    }
    return out;
  }

  function cleanRatingMap(value) {
    const out = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [id, list] of Object.entries(value)) {
      if (!knownMaterialId(id) || !Array.isArray(list)) continue;
      const byStudent = new Map();
      for (const row of list) {
        if (!row || !student(row.studentId)) continue;
        const score = Number(row.score);
        if (!Number.isInteger(score) || score < 1 || score > 4) continue;
        byStudent.set(row.studentId, score);
      }
      if (byStudent.size) out[id] = Array.from(byStudent, ([studentId, score]) => ({ studentId, score }));
    }
    return out;
  }

  function readRoute() {
    const raw = (location.hash || "#dashboard").replace(/^#/, "");
    const cut = raw.indexOf("/");
    const route = cut === -1 ? raw : raw.slice(0, cut);
    let param = cut === -1 ? "" : raw.slice(cut + 1);
    try { param = decodeURIComponent(param); } catch (err) { /* keep the raw piece */ }
    param = param.slice(0, 80);
    if (!ROUTES.includes(route)) return { route: "dashboard", param: "" };
    return { route, param };
  }

  function rememberField(route) {
    if (route.route === "fields" && field(route.param)) {
      state.field = route.param;
      state.skill = "all";
    }
    if (route.route === "fields" && partById(route.param)) {
      const part = partById(route.param);
      const claim = competency(part.skillId);
      state.field = claim.field;
      state.skill = claim.id;
      state.competencyId = claim.id;
      skillGraphId = part.id;
    } else if (route.route === "fields" && competency(route.param)) {
      const claim = competency(route.param);
      state.field = claim.field;
      state.skill = claim.id;
      state.competencyId = claim.id;
    }
  }

  function applyRoute(next) {
    state.route = next.route;
    state.param = next.param;
    rememberField(next);
    if (next.route === "library" && materialById(next.param)) {
      state.field = "all";
      state.medium = "all";
    }
  }

  function health() {
    const savedLang = state.lang;
    state.lang = "en";
    const problems = [];
    const expect = (ok, message) => { if (!ok) problems.push(message); };
    const lv = (studentId, id) => levelOf(studentId, id);
    expect(lv("amina", "PE") === 2, "Amina ethics");
    expect(lv("amina", "PM") === 4, "Amina mechanics");
    expect(lv("amina", "MA") === 3, "Amina algebra");
    expect(lv("amina", "EH") === 2, "Amina rhetoric");
    expect(Math.abs(meanFloor(student("amina")) - 3) < 1e-9, "Amina mean");
    expect(compensatoryMet(student("amina")), "Amina compensatory");
    expect(lv("noor", "PE") === 1, "Noor ethics");
    expect(lv("noor", "MS") === 4, "Noor statistics");
    expect(lv("noor", "MC") === 4, "Noor calculus");
    expect(lv("noor", "EW") === 4, "Noor writing");
    expect(lv("noor", "EH") === 1, "Noor rhetoric");
    expect(Math.abs(meanFloor(student("noor")) - 3) < 1e-9, "Noor mean");
    expect(!floorMet(student("noor")), "Noor conjunctive");
    expect(compensatoryMet(student("noor")), "Noor compensatory");
    expect(floorMet(student("soren")), "Soren floor");
    expect(floorMet(student("idris")), "Idris floor");
    expect(!floorMet(student("amina")), "Amina floor");
    expect(lv("soren", "PX") === 2, "Soren experiment");
    expect(lv("soren", "EH") === 4, "Soren rhetoric");
    expect(lv("idris", "MS") === 4, "Idris statistics");
    expect(lv("idris", "PX") === 2, "Idris experiment");
    expect(lv("leo", "PE") == null, "Leo ethics empty");
    expect(lv("leo", "MA") === 1, "Leo algebra");
    expect(lv("rafi", "MA") == null, "Rafi empty");
    expect(lv("jun", "EW") === 1, "Jun writing");
    expect(lv("jun", "MC") == null, "Jun calculus empty");
    expect(lv("jun", "PO") === 2, "Jun optics");
    expect(lv("jun", "MG") === 2, "Jun geometry");
    const algebraTrail = historyOf("amina", "MA");
    expect(algebraTrail.length >= 2, "Amina algebra trail");
    expect(algebraTrail.some((row) => row.evidence.source === "workshop"), "Amina algebra workshop");
    expect(algebraTrail.some((row) => row.evidence.source === "project"), "Amina algebra project");
    const load = byId(A.evidence, "ev-amina-load");
    expect(!!load && load.scores.length >= 3, "one project moves several skills");
    expect(lastEvidenceItem("jun").date === "2026-09-22", "Jun date");
    expect(daysSince("2026-09-22") === 40, "stale span");
    for (const item of A.evidence) {
      expect(!!student(item.studentId), "evidence student " + item.id);
      expect(!!person(item.assessorId), "assessor " + item.id);
      if (item.source === "project") expect(!!project(item.sourceId), "project source " + item.id);
      if (item.source === "workshop") expect(!!workshop(item.sourceId), "workshop source " + item.id);
      for (const score of item.scores) {
        expect(!!competency(score.competencyId), "score " + score.competencyId);
        expect(score.level >= 1 && score.level <= 4, "level range " + item.id);
      }
    }
    for (const [left, right] of A.edges) {
      expect(!!competency(left) && !!competency(right), "edge " + left + "-" + right);
    }
    const partIds = new Set();
    const partOwner = new Map();
    for (const claim of A.competencies) {
      expect(Array.isArray(claim.parts) && claim.parts.length >= 2, "parts " + claim.id);
      claim.parts.forEach((part, index) => {
        expect(!!part.id && !!part.name && !!part.about && !partIds.has(part.id) && !competency(part.id), "part " + part.id);
        partIds.add(part.id);
        partOwner.set(part.id, { claim, index });
        expect(Array.isArray(part.needs || []), "part needs " + part.id);
        for (const id of part.needs || []) expect(id !== part.id, "part self " + part.id);
      });
    }
    for (const claim of A.competencies) {
      claim.parts.forEach((part, index) => {
        for (const id of part.needs || []) {
          const owner = partOwner.get(id);
          expect(!!owner, "part need missing " + part.id + " " + id);
          if (owner && owner.claim.id === claim.id) expect(owner.index < index, "part order " + part.id);
        }
      });
    }
    const walkPart = (id, stack) => {
      if (stack.includes(id)) {
        expect(false, "part cycle " + stack.concat(id).join(">"));
        return;
      }
      const part = allParts().find((item) => item.id === id);
      for (const prior of (part && part.needs) || []) walkPart(prior, stack.concat(id));
    };
    for (const part of allParts()) walkPart(part.id, []);
    const deriv = allParts().find((part) => part.id === "MC-deriv");
    const integ = allParts().find((part) => part.id === "MC-int");
    const rate = allParts().find((part) => part.id === "PM-rate");
    const ray = allParts().find((part) => part.id === "PO-ray");
    expect(!!deriv && (deriv.needs || []).includes("MC-basic") && !(deriv.needs || []).includes("MA-eq"), "derivatives rest on basic calculus");
    expect(!!integ && (integ.needs || []).join(",") === "MC-deriv", "integrals rest on derivatives");
    expect(!!rate && (rate.needs || []).includes("MC-deriv"), "the rate rests on derivatives");
    expect(!!ray && (ray.needs || []).includes("MG-fig"), "a ray rests on a figure");
    for (const item of A.projects) {
      for (const id of item.elicits) expect(!!competency(id), "elicit " + id);
      for (const feature of item.features) {
        for (const id of feature.competencyIds) expect(!!competency(id), "feature " + id);
      }
    }
    const activityIds = [];
    const kinds = new Set(["Workshop", "Test", "Project"]);
    for (const item of A.workshops.concat(A.projects)) {
      expect(Array.isArray(item.activities) && item.activities.length > 0, "activities " + item.id);
      const union = [];
      for (const activity of item.activities) {
        activityIds.push(activity.id);
        expect(kinds.has(activity.kind), "activity kind " + activity.id);
        for (const id of activity.competencyIds) {
          expect(item.elicits.includes(id), "activity skill " + activity.id + " " + id);
          if (!union.includes(id)) union.push(id);
        }
      }
      expect(union.length === item.elicits.length && item.elicits.every((id) => union.includes(id)), "activity union " + item.id);
    }
    expect(new Set(activityIds).size === activityIds.length, "unique activity ids");
    expect(offerPoints(workshop("sampler").elicits) === 0, "sampler points");
    expect(offerPoints(workshop("diagnostic").elicits) === 24, "diagnostic points");
    for (const item of A.workshops) {
      const plate = workshopPlate(item);
      expect(plate.includes(`id="plate-${item.id}"`) && plate.includes("<svg"), "workshop plate " + item.id);
    }
    expect(workshopPlate(workshop("diagnostic")).includes("Who is affected") && workshopPlate(workshop("diagnostic")).includes("Flood hours"), "diagnostic plate stations");
    expect(workshopPlate(workshop("sampler")).includes("No mark") && workshopPlate(workshop("sampler")).includes("Tide table"), "sampler plate empty");
    expect(workshopPlate(workshop("media")).includes("Reconstruction is the mark") && workshopPlate(workshop("media")).includes("Spring"), "medium plate");
    expect(workshopPlate(workshop("argument")).includes("Revision") && workshopPlate(workshop("argument")).includes("Safer road"), "argument plate");
    expect(offerPoints(project("coastal").elicits) === 44, "coastal points");
    expect(evidencePoints(byId(A.evidence, "ev-amina-diag")) === 9, "amina diagnostic points");
    for (const personRecord of A.students) {
      expect(!!person(personRecord.mentorId), "mentor " + personRecord.id);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(personRecord.born) && personRecord.born < personRecord.started, "born " + personRecord.id);
      const years = ageExact(personRecord);
      expect(years >= 12 && years <= 19, "age range " + personRecord.id);
      for (const id of personRecord.projectIds) expect(!!project(id), "seat " + id);
    }
    expect(ageExact(student("rafi")) < ageExact(student("soren")), "rafi younger than soren");
    expect(ageChartHTML(["amina"]).includes("age-chart") && ageChartHTML(["amina"]).includes("Amina"), "age chart");
    const caseload = caseloadSnapshot(A.students);
    expect(caseload.students.length === A.students.length && caseload.toCoach.length >= 1, "caseload snapshot");
    expect(caseload.toCoach.some((row) => row.name === "Rafi" || row.name === "Jun" || row.name === "Leo"), "caseload toCoach");
    const ids = A.evidence.map((item) => item.id);
    expect(new Set(ids).size === ids.length, "unique evidence ids");
    expect(!!A.materialActivity, "material activity present");
    const spanCount = A.materials.filter((item) => Array.isArray(item.fields) && item.fields.length > 1).length;
    expect(spanCount >= 3, "materials span fields");
    expect(A.materials.some((item) => item.contributor && item.contributor.kind === "student"), "student material");
    expect(A.materials.some((item) => item.contributor && item.contributor.kind === "mentor"), "professor material");
    expect(A.materials.some((item) => item.contributor && item.contributor.kind === "external" && item.contributor.name), "external material");
    for (const item of A.materials) {
      expect(A.media.some((row) => row.id === item.medium), "material medium " + item.id);
      expect(item.minutes > 0, "material minutes " + item.id);
      const declared = Array.isArray(item.fields) && item.fields.length ? item.fields : (item.field ? [item.field] : []);
      expect(declared.length > 0, "material fields " + item.id);
      for (const id of declared) expect(!!field(id), "material field " + item.id + " " + id);
      expect(Array.isArray(item.competencies), "material claims " + item.id);
      for (const id of item.competencies || []) expect(!!competency(id), "material claim " + item.id + " " + id);
      const owner = item.contributor && item.contributor.kind === "student" ? item.contributor.id : "";
      if (owner) expect(!!student(owner), "contributor " + item.id);
      if (item.contributor && (item.contributor.kind === "mentor" || item.contributor.kind === "director")) {
        expect(!!person(item.contributor.id), "contributor " + item.id);
      }
      for (const studentId of item.uses || []) {
        expect(!!student(studentId), "material use " + item.id);
        expect(studentId !== owner, "self use " + item.id);
      }
      for (const rating of item.ratings || []) {
        expect(!!student(rating.studentId), "material rating " + item.id);
        expect(rating.score >= 1 && rating.score <= 4, "material rating range " + item.id);
        expect((item.uses || []).includes(rating.studentId), "rater used " + item.id);
        expect(rating.studentId !== owner, "self rate " + item.id);
      }
    }
    for (const [id, row] of Object.entries(A.materialActivity)) {
      const item = byId(A.materials, id);
      expect(!!item && !item.contributor, "activity is house " + id);
      for (const studentId of row.uses) expect(!!student(studentId), "activity use " + id);
      for (const rating of row.ratings) {
        expect(!!student(rating.studentId) && row.uses.includes(rating.studentId), "activity rater " + id);
        expect(rating.score >= 1 && rating.score <= 4, "activity score " + id);
      }
    }
    expect(Array.isArray(A.sessions) && A.sessions.length > 0, "sessions");
    const sessionIds = [];
    const sessionKinds = new Set(["workshop", "project", "lecture"]);
    for (const item of A.sessions) {
      sessionIds.push(item.id);
      expect(sessionKinds.has(item.kind), "session kind " + item.id);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(item.date), "session date " + item.id);
      expect(normalizeTime(item.start) === item.start && normalizeTime(item.end) === item.end, "session clock " + item.id);
      expect(timeValue(item.end) > timeValue(item.start), "session span " + item.id);
      expect(typeof item.place === "string" && item.place.trim().length > 0, "session place " + item.id);
      expect(!!person(item.hostId), "session host " + item.id);
      expect(Number.isInteger(item.capacity) && item.capacity >= 1, "session capacity " + item.id);
      expect(Array.isArray(item.roster), "session roster " + item.id);
      expect(typeof item.note === "string", "session note " + item.id);
      const seen = new Set();
      for (const studentId of item.roster) {
        expect(!!student(studentId) && !seen.has(studentId), "session student " + item.id + " " + studentId);
        seen.add(studentId);
        expect(student(studentId).started <= item.date, "session before start " + item.id + " " + studentId);
      }
      expect(item.roster.length <= item.capacity, "session over capacity " + item.id);
      if (item.kind === "workshop") expect(!!workshop(item.ref), "session workshop " + item.id);
      if (item.kind === "project") expect(!!project(item.ref), "session project " + item.id);
      if (item.kind === "lecture") {
        expect(item.ref === "", "lecture ref " + item.id);
        expect(!!field(item.field), "lecture field " + item.id);
        expect(typeof item.title === "string" && item.title.trim().length > 0, "lecture title " + item.id);
        expect(typeof item.summary === "string" && item.summary.trim().length > 0, "lecture summary " + item.id);
      }
    }
    expect(new Set(sessionIds).size === sessionIds.length, "unique session ids");
    expect(A.sessions.some((item) => item.date < A.today), "held sitting");
    expect(A.sessions.some((item) => item.kind === "workshop" && item.date >= A.today), "future workshop");
    expect(A.sessions.some((item) => item.kind === "project" && item.date >= A.today), "future project");
    expect(A.sessions.some((item) => item.kind === "lecture" && item.date >= A.today), "future lecture");
    expect(A.sessions.some((item) => item.kind === "workshop" && item.date >= A.today && item.roster.length < item.capacity), "open workshop place");
    for (const personRecord of A.students) {
      for (const [workshopId, status] of Object.entries(personRecord.workshops)) {
        if (status !== "enrolled") continue;
        const seated = A.sessions.some((item) => item.kind === "workshop" && item.ref === workshopId && item.date >= A.today && item.roster.includes(personRecord.id));
        expect(seated, "enrolled sitting " + personRecord.id + " " + workshopId);
      }
      for (const projectId of personRecord.projectIds) {
        const seated = A.sessions.some((item) => item.kind === "project" && item.ref === projectId && item.date >= A.today && item.roster.includes(personRecord.id));
        expect(seated, "project sitting " + personRecord.id + " " + projectId);
      }
    }
    for (let i = 0; i < A.sessions.length; i += 1) {
      for (let j = i + 1; j < A.sessions.length; j += 1) {
        const left = A.sessions[i];
        const right = A.sessions[j];
        if (left.date !== right.date) continue;
        if (left.start >= right.end || right.start >= left.end) continue;
        expect(left.hostId !== right.hostId, "host clash " + left.id + " " + right.id);
        for (const studentId of left.roster) {
          expect(!right.roster.includes(studentId), "student clash " + left.id + " " + right.id + " " + studentId);
        }
      }
    }
    expect(typeof globalThis.ATELIER_I18N.t === "function", "i18n t");
    expect(globalThis.ATELIER_I18N.t("fr", "nav.workshops") === "Ateliers", "fr workshops nav");
    expect(!!(globalThis.ATELIER_I18N.content && ATELIER_I18N.content.fr && ATELIER_I18N.content.fr.workshops.sampler.name), "fr sampler overlay");
    state.lang = savedLang;
    return problems;
  }

  function litCompetencies() {
    const focus = state.focus || { type: "competency", id: "PE" };
    if (focus.type === "competency") return new Set([focus.id]);
    if (focus.type === "evidence") {
      const item = byId(A.evidence, focus.id);
      return new Set(item ? item.scores.map((score) => score.competencyId) : []);
    }
    if (focus.type === "feature") {
      const coastal = project("coastal");
      const feature = coastal.features.find((item) => item.id === focus.id);
      return new Set(feature ? feature.competencyIds : []);
    }
    return new Set();
  }

  function focusSentence() {
    const coastalEvidence = A.evidence.filter((item) => item.sourceId === "coastal");
    const focus = state.focus;
    if (focus.type === "competency") {
      const claim = competency(focus.id);
      if (!claim) return "";
      const hits = coastalEvidence.filter((item) => item.scores.some((score) => score.competencyId === claim.id));
      if (!project("coastal").elicits.includes(claim.id)) {
        return `${claim.name} sits on the map. Coastal Crossing is not built to elicit it.`;
      }
      if (!hits.length) {
        return `${claim.name} is a claim this project can support. No observation of it is on file for Coastal Crossing yet.`;
      }
      const bits = hits.map((item) => {
        const score = item.scores.find((entry) => entry.competencyId === claim.id);
        return `${student(item.studentId).name}, “${item.title}”, ${levelLabel(score.level).toLowerCase()} (${formatDate(item.date)})`;
      });
      return `${claim.name}. ${bits.join(". ")}.`;
    }
    if (focus.type === "evidence") {
      const item = byId(A.evidence, focus.id);
      if (!item) return "";
      const bits = item.scores.map((score) => `${competency(score.competencyId).name} ${levelLabel(score.level).toLowerCase()}`);
      return `${student(item.studentId).name}, “${item.title}”. This observation scores ${bits.join("; ")}.`;
    }
    if (focus.type === "feature") {
      const feature = project("coastal").features.find((item) => item.id === focus.id);
      if (!feature) return "";
      const names = feature.competencyIds.map((id) => competency(id).name);
      return `${feature.label}. ${feature.text} It is built to elicit ${names.join(", ")}, ${offerPhrase(feature.competencyIds).toLowerCase()}.`;
    }
    return "";
  }

  function stageArcs(level) {
    const radius = 15.5;
    const gap = 0.28;
    const sweep = (Math.PI * 2) / 4;
    let paths = "";
    for (let stage = 1; stage <= 4; stage += 1) {
      const start = -Math.PI / 2 + (stage - 1) * sweep + gap / 2;
      const end = start + sweep - gap;
      const x1 = (Math.cos(start) * radius).toFixed(2);
      const y1 = (Math.sin(start) * radius).toFixed(2);
      const x2 = (Math.cos(end) * radius).toFixed(2);
      const y2 = (Math.sin(end) * radius).toFixed(2);
      const on = level != null && stage <= level;
      paths += `<path class="stage${on ? " is-on" : ""}" d="M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}"></path>`;
    }
    return paths;
  }

  function contribDots(history) {
    const buckets = [[], [], [], []];
    for (const item of history) buckets[item.level - 1].push(item);
    const radius = 25;
    const sweep = (Math.PI * 2) / 4;
    let dots = "";
    for (let stage = 1; stage <= 4; stage += 1) {
      const marks = buckets[stage - 1];
      const mid = -Math.PI / 2 + (stage - 0.5) * sweep;
      marks.forEach((item, index) => {
        const offset = (index - (marks.length - 1) / 2) * 0.16;
        const angle = mid + offset;
        const cx = (Math.cos(angle) * radius).toFixed(2);
        const cy = (Math.sin(angle) * radius).toFixed(2);
        const label = `${sourceLabel(item.evidence)} · ${item.evidence.title} · ${levelLabel(item.level)}`;
        dots += `<circle class="contrib" cx="${cx}" cy="${cy}" r="2.3"><title>${esc(label)}</title></circle>`;
      });
    }
    return dots;
  }

  function renderNetwork(personRecord) {
    const selected = state.competencyId;
    const selectedClaim = competency(selected);
    const neighborIds = new Set(neighbors(selected));
    const hot = selectedClaim ? `var(--c-${selectedClaim.field})` : "var(--ink)";
    const edges = A.edges.map(([left, right]) => {
      const a = competency(left);
      const b = competency(right);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const cx = mx + -dy * 0.12;
      const cy = my + dx * 0.12;
      const isHot = left === selected || right === selected;
      return `<path class="edge ${isHot ? "is-hot" : "is-quiet"}" style="--hot:${hot}" d="M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}"></path>`;
    }).join("");
    const headers = A.fields.map((item) => {
      const x = A.competencies.find((claim) => claim.field === item.id).x;
      const progress = fieldProgress(personRecord.id, item.id);
      const width = 86;
      const fill = progress == null ? 0 : Math.max(0, Math.min(width, (progress / 4) * width));
      const started = A.competencies.filter((claim) => claim.field === item.id && levelOf(personRecord.id, claim.id) != null).length;
      const total = A.competencies.filter((claim) => claim.field === item.id).length;
      const title = progress == null
        ? `${item.name}: no skill in this field has evidence yet`
        : `${item.name}: ${started} of ${total} skills have evidence`;
      return `<g class="field-bar field-${item.id}">
        <text class="col-label" x="${x}" y="26" text-anchor="middle">${esc(item.short)}</text>
        <rect class="rail" x="${x - width / 2}" y="36" width="${width}" height="6" rx="3"></rect>
        ${fill > 0 ? `<rect class="fill" x="${x - width / 2}" y="36" width="${fill.toFixed(1)}" height="6" rx="3"><title>${esc(title)}</title></rect>` : ""}
      </g>`;
    }).join("");
    const nodes = A.competencies.map((claim) => {
      const level = levelOf(personRecord.id, claim.id);
      const history = historyOf(personRecord.id, claim.id);
      const quiet = claim.id !== selected && !neighborIds.has(claim.id);
      const classes = [
        "node",
        "field-" + claim.field,
        claim.id === selected ? "is-selected" : "",
        quiet ? "is-quiet" : "",
        level == null ? "is-unobserved" : "",
      ].filter(Boolean).join(" ");
      const markCount = history.length === 1 ? "1 mark" : `${history.length} marks`;
      const aria = level == null
        ? `${claim.name}, no evidence yet`
        : `${claim.name}, ${levelLabel(level)}, ${markCount}`;
      return `<g class="${classes}" tabindex="0" role="button" aria-pressed="${claim.id === selected}" aria-label="${esc(aria)}" data-action="select-competency" data-id="${claim.id}" transform="translate(${claim.x} ${claim.y})">
        <circle class="hit" r="36" fill="transparent"></circle>
        <circle r="8" fill="var(--paper-2)"></circle>
        <circle r="8" fill="var(--c-${claim.field})" fill-opacity="${level == null ? 0 : 0.35}"></circle>
        ${stageArcs(level)}
        ${contribDots(history)}
        <circle class="ring" r="20" fill="none" stroke="var(--c-${claim.field})" stroke-width="${claim.id === selected ? 1.8 : 0}"></circle>
        <text class="label" y="42" text-anchor="middle">${esc(claim.short)}</text>
      </g>`;
    }).join("");
    return `<figure class="network">
      <svg viewBox="0 0 900 560" role="img" aria-labelledby="net-title">
        <title id="net-title">Skill lines for ${esc(personRecord.name)}. Each arc is a stage. Each dot is a piece of work.</title>
        ${edges}
        ${headers}
        ${nodes}
      </svg>
      <figcaption class="legend">
        ${A.fields.map((item) => `<span class="field-${item.id}"><i></i>${esc(field(item.id).short)}</span>`).join("")}
        <span>Four arcs are the stages: emerging, developing, proficient, advanced. A stage is worth its number in points, from 1 to 4. The fill stops at the furthest stage reached. Each dot is an exercise, a test, or a project, and one piece of work can dot several skills. A dashed arc has no evidence yet. The bar under a field follows the skills in that field that already have evidence. Lines join subjects to read together.</span>
      </figcaption>
    </figure>`;
  }

  function seals(personRecord) {
    return `<ol class="seals">${A.floorIds.map((id) => {
      const claim = competency(id);
      const level = levelOf(personRecord.id, id);
      const marks = historyOf(personRecord.id, id).length;
      const count = marks === 0 ? "No marks" : marks === 1 ? "1 mark" : `${marks} marks`;
      return `<li><button type="button" class="seal field-${claim.field} ${state.competencyId === id ? "is-selected" : ""}" data-action="select-competency" data-id="${id}">
        <span>${esc(claim.name)}</span>
        ${meter(level, claim.field)}
        <span class="lv">${esc(levelLabel(level))} · ${count}</span>
      </button></li>`;
    }).join("")}</ol>`;
  }

  function trail(personRecord, claim) {
    const rows = historyOf(personRecord.id, claim.id);
    if (!rows.length) {
      return `<p>No mark on this skill yet. An empty line is waiting for an exercise, a test, or a project.</p>`;
    }
    const items = rows.map((row) => {
      const others = alsoMoved(row.evidence, claim.id).map((id) => competency(id).name);
      const together = others.length
        ? `<p class="meta">Also moved ${esc(others.join(", "))}.</p>`
        : "";
      return `<li class="field-${claim.field}">
        <p class="stage-name">${esc(levelLabel(row.level))}</p>
        <p><button type="button" class="text-btn" data-action="jump" data-id="${row.evidence.id}">${esc(row.evidence.title)}</button></p>
        <p class="meta">${esc(formatDate(row.date))} · ${esc(sourceLabel(row.evidence))}</p>
        ${together}
      </li>`;
    }).join("");
    return `<ol class="trail">${items}</ol>`;
  }

  function evidenceCard(item) {
    const scores = item.scores.map((score) => {
      const claim = competency(score.competencyId);
      const selected = state.competencyId === score.competencyId ? "is-selected" : "";
      return `<li><button type="button" class="${selected}" data-action="select-competency" data-id="${score.competencyId}">${esc(claim.name)} · ${esc(levelLabel(score.level))} · ${esc(pointsLabel(score.level))}</button></li>`;
    }).join("");
    const challenges = state.challenges.filter((entry) => entry.evidenceId === item.id);
    const challengeHTML = challenges.map((entry) => {
      const response = entry.status === "addressed"
        ? `<p class="meta">Response from ${esc(entry.responder)} · ${esc(formatWhen(entry.respondedAt))}</p><p>${esc(entry.response)}</p>`
        : "";
      return `<div class="challenge">
        <p class="tag">${entry.status === "open" ? "Challenge open" : "Challenge addressed"}</p>
        <p>${esc(entry.text)}</p>
        ${response}
      </div>`;
    }).join("");
    return `<article class="evidence" id="${item.id}">
      <p class="eyebrow">${esc(sourceLabel(item))}</p>
      <h3>${esc(item.title)}</h3>
      <p class="point-offer"><b>${esc(pointsLabel(evidencePoints(item)))}</b> <span>on this work</span></p>
      <p class="meta">${esc(formatDate(item.date))} · scored by ${esc(person(item.assessorId).name)}</p>
      <p>${esc(item.summary)}</p>
      <ul class="scores">${scores}</ul>
      <p class="rubric"><span>Rubric reading</span>${esc(item.rubric)}</p>
      ${challengeHTML}
    </article>`;
  }

  function noteCard(item) {
    const where = item.workshopId ? workshop(item.workshopId).name : "Mentor note";
    return `<article class="note">
      <p class="tag">${esc(where)} · not a score</p>
      <p class="meta">${esc(formatDate(item.date))} · ${esc(person(item.authorId).name)}</p>
      <p>${esc(item.text)}</p>
    </article>`;
  }

  function logList(personRecord) {
    const rows = state.logs.filter((item) => item.studentId === personRecord.id).slice().reverse();
    if (!rows.length) return `<p class="muted">No mentor actions on the panel yet.</p>`;
    const labels = {
      note: "Note",
      conference: "Conference",
      scaffold: "Scaffold",
      medium: "Medium",
      withhold: "Advancement withheld",
      endorse: "Advancement endorsed",
    };
    return `<ul class="log">${rows.map((item) => `<li>
      <p class="meta">${esc(labels[item.kind] || item.kind)} · ${esc(item.actor)} · ${esc(formatWhen(item.at))}</p>
      <p>${esc(item.text)}</p>
    </li>`).join("")}</ul>`;
  }

  function actionForms(personRecord) {
    if (state.role === "student") {
      const options = evidenceFor(personRecord.id)
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map((item) => `<option value="${item.id}">${esc(formatDate(item.date))} — ${esc(item.title)}</option>`)
        .join("");
      if (!options) return `<p class="muted">When a score exists, it can be challenged from here.</p>`;
      return `<form class="stack-form" data-form="challenge">
        <p class="eyebrow">Challenge a score</p>
        <label>Evidence
          <select name="evidenceId" required>${options}</select>
        </label>
        <label>What should be reread, and why?
          <textarea name="text" required placeholder="Name the claim and the part of the work the score missed."></textarea>
        </label>
        <button type="submit" class="primary">File the challenge</button>
      </form>`;
    }
    if (!canDecide(personRecord)) return "";
    const open = openChallenges(personRecord.id).map((entry) => {
      const item = byId(A.evidence, entry.evidenceId);
      return `<form class="stack-form challenge" data-form="response">
        <input type="hidden" name="id" value="${esc(entry.id)}">
        <p class="tag">Open challenge · ${esc(item ? item.title : "evidence")}</p>
        <p>${esc(entry.text)}</p>
        <label>Response, visible to ${esc(firstName(personRecord))}
          <textarea name="response" required></textarea>
        </label>
        <button type="submit">Address the challenge</button>
      </form>`;
    }).join("");
    const met = floorMet(personRecord);
    const already = state.endorsements[personRecord.id] && state.endorsements[personRecord.id].decision === "endorse";
    const mediaOptions = A.media.map((item) => `<option value="${item.id}">${esc(item.label)}</option>`).join("");
    return `${open}
      <form class="stack-form" data-form="log">
        <p class="eyebrow">Act on the panel</p>
        <label>Action
          <select name="kind">
            <option value="note">Note</option>
            <option value="conference">Request a conference</option>
            <option value="scaffold">Assign a scaffold</option>
            <option value="medium">Set the recommended medium</option>
            <option value="withhold">Withhold advancement</option>
          </select>
        </label>
        <label>Medium, used only for that action
          <select name="medium">${mediaOptions}</select>
        </label>
        <label>What goes on the record
          <textarea name="text" required></textarea>
        </label>
        <div class="action-row">
          <button type="submit" class="primary">Add to the panel</button>
          <button type="button" data-action="endorse" ${met && !already ? "" : "disabled"}>Endorse advancement</button>
        </div>
        <p class="muted">${met ? "Algebra, writing, mechanics, and ethics have each reached proficient. Noting readiness is a sentence you write. The lines do not write it." : "Noting readiness waits until algebra, writing, mechanics, and ethics have each reached proficient. The lines stay visible while those skills are still moving."}</p>
      </form>`;
  }

  function renderPanel() {
    const personRecord = current();
    const claim = competency(state.competencyId) || competency("PE");
    const level = levelOf(personRecord.id, claim.id);
    const latest = latestOf(personRecord.id, claim.id);
    const copy = floorCopy(personRecord);
    const decision = state.endorsements[personRecord.id];
    const decisionLine = decision
      ? `<p class="meta">${decision.decision === "endorse" ? "Endorsed" : "Withheld"} by ${esc(decision.actor)} on ${esc(formatWhen(decision.at))}.</p>`
      : "";
    const latestHTML = latest
      ? `<p>Furthest stage on the line: ${esc(levelLabel(level))}. Most recent mark: <button type="button" class="text-btn" data-action="jump" data-id="${latest.evidence.id}">${esc(latest.evidence.title)}</button> · ${esc(formatDate(latest.evidence.date))} · ${esc(levelLabel(latest.score.level))}.</p><p class="muted">${esc(latest.evidence.rubric)}</p>`
      : `<p>No mark on this skill yet. An empty arc is not a low stage.</p>`;
    const related = neighbors(claim.id).map((id) => {
      const other = competency(id);
      return `<button type="button" class="text-btn" data-action="select-competency" data-id="${id}">${esc(other.name)}</button>`;
    }).join(", ");
    const evidence = evidenceFor(personRecord.id).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const notes = notesFor(personRecord.id).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const projects = personRecord.projectIds.map((id) => `<a href="#projects/${id}">${esc(project(id).name)}</a>`).join(", ");
    return `<article class="page" data-page="panel" data-student="${personRecord.id}">
      <header class="page-head">
        <p class="eyebrow">Monitoring panel · ${esc(person(personRecord.mentorId).name)}</p>
        <h2>${esc(personRecord.name)}</h2>
        <p class="lede">${esc(situation(personRecord))} ${esc(mediaSentence(personRecord))}</p>
      </header>
      <div class="panel-top">
        ${flagHTML(personRecord)}
        <p class="meta">On the record since ${esc(formatDate(personRecord.started))}${projects ? ` · ${projects}` : ""}</p>
      </div>
      <p>${esc(authority(personRecord))}</p>
      ${pointsBoard(personRecord)}
      <div class="panel-grid">
        ${renderNetwork(personRecord)}
        <aside class="inspector">
          <p class="eyebrow">Skill lines</p>
          <h3>${esc(evidence.length ? "How far the skills have come" : "No evidence yet")}</h3>
          <p>${esc(copy.lead)}</p>
          ${seals(personRecord)}
          ${decisionLine}
          <div>
            <p class="eyebrow">Selected subject</p>
            <h3 class="field-${claim.field}">${esc(claim.name)}</h3>
            <p class="level-line">${meter(level, claim.field)} <span>${esc(levelLabel(level))}</span></p>
            <p class="meta">${esc(stagePointsSentence(level))}</p>
            <p>${esc(claim.claim)}</p>
            <p class="eyebrow">What counts as evidence</p>
            <ul class="rules">${claim.rules.map((rule) => `<li>${esc(rule)}</li>`).join("")}</ul>
            <p class="eyebrow">Marks on this line, in order</p>
            ${trail(personRecord, claim)}
            ${latestHTML}
            <p class="eyebrow">Read together with</p>
            <p>${related || "This claim stands on its own in the map."}</p>
          </div>
          <div class="actions no-print">
            <p>${esc(recommendation(personRecord))}</p>
            ${actionForms(personRecord)}
            <p><a href="#activities" data-action="open-activities" data-id="${claim.id}">Activities and materials for ${esc(claim.name)}</a></p>
            <p><a href="#report">Open the report</a></p>
          </div>
        </aside>
      </div>
      <h3 class="section-title">Evidence</h3>
      <p class="muted">Newest first. Each piece of work stays on every skill it moved. The arc shows the furthest stage.</p>
      <div class="tape">${evidence.length ? evidence.map(evidenceCard).join("") : `<p class="empty">No scored evidence. Workshop notes below, when they exist, do not change a level.</p>`}</div>
      <h3 class="section-title">Notes that do not move a score</h3>
      <div class="tape">${notes.length ? notes.map(noteCard).join("") : `<p class="muted">No unscored notes.</p>`}</div>
      <h3 class="section-title">Actions on the record</h3>
      ${logList(personRecord)}
    </article>`;
  }

  function ecdBoard() {
    const coastal = project("coastal");
    const lit = litCompetencies();
    const focus = state.focus;
    const claimGroups = A.fields.map((item) => {
      const claims = A.competencies.filter((claim) => claim.field === item.id && coastal.elicits.includes(claim.id));
      if (!claims.length) return "";
      const chips = claims.map((claim) => {
        const on = lit.has(claim.id);
        return `<button type="button" class="chip compact ${on ? "is-lit" : "is-dim"}" data-action="focus" data-type="competency" data-id="${claim.id}">
          <b>${esc(claim.name)}</b>
        </button>`;
      }).join("");
      return `<p class="group-label field-${item.id}">${esc(item.short)}</p><div class="chip-cloud">${chips}</div>`;
    }).join("");
    const evidence = A.evidence
      .filter((item) => item.sourceId === "coastal")
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const evidenceChips = evidence.map((item) => {
      const on = focus.type === "evidence" ? focus.id === item.id : item.scores.some((score) => lit.has(score.competencyId));
      let detail = `${item.scores.length} claims`;
      if (focus.type === "competency") {
        const score = item.scores.find((entry) => entry.competencyId === focus.id);
        if (score) detail = levelLabel(score.level);
      }
      return `<button type="button" class="chip ${on ? "is-lit" : "is-dim"}" data-action="focus" data-type="evidence" data-id="${item.id}">
        <b>${esc(item.title)}</b>
        <small>${esc(student(item.studentId).name)} · ${esc(detail)}</small>
      </button>`;
    }).join("");
    const featureChips = coastal.features.map((feature) => {
      const on = focus.type === "feature" ? focus.id === feature.id : feature.competencyIds.some((id) => lit.has(id));
      return `<button type="button" class="chip ${on ? "is-lit" : "is-dim"}" data-action="focus" data-type="feature" data-id="${feature.id}">
        <b>${esc(feature.label)}</b>
        <small>${esc(feature.text)}</small>
      </button>`;
    }).join("");
    return `<section class="ecd" aria-label="Evidence-centered design for Coastal Crossing">
      <div class="ecd-col col-claim">
        <p class="eyebrow">01 · Competency model</p>
        <h3>What we claim</h3>
        <p>The claims this project is allowed to support. A claim outside the list can still be true of a student. This task was not built to show it.</p>
        ${claimGroups}
      </div>
      <div class="gutter" aria-hidden="true"><span>design</span><b>→</b><span>read back</span><b>←</b></div>
      <div class="ecd-col col-evidence">
        <p class="eyebrow">02 · Evidence model</p>
        <h3>What we accept</h3>
        <p>Work already scored on Coastal Crossing. One piece of work can mark several skills. Each mark stays on those lines.</p>
        <div class="chip-list">${evidenceChips}</div>
      </div>
      <div class="gutter" aria-hidden="true"><span>design</span><b>→</b><span>read back</span><b>←</b></div>
      <div class="ecd-col col-task">
        <p class="eyebrow">03 · Task model</p>
        <h3>Where it happens</h3>
        <p>${esc(coastal.summary)} ${esc(coastal.varied)}</p>
        <div class="chip-list">${featureChips}</div>
      </div>
    </section>
    <p class="live" id="ecd-live" aria-live="polite">${esc(focusSentence())}</p>`;
  }

  function renderModel() {
    const layers = A.layers.map((layer) => {
      const loc = extraOf("layers", layer.id);
      const name = loc && loc.name ? loc.name : layer.name;
      const text = loc && loc.text ? loc.text : layer.text;
      const open = state.layer === layer.id;
      return `<section class="layer ${open ? "is-open" : ""}">
        <h3><button type="button" data-action="layer" data-id="${layer.id}" aria-expanded="${open}"><span>${esc(layer.n)}</span>${esc(name)}</button></h3>
        ${open ? `<p>${esc(text)}</p>` : ""}
      </section>`;
    }).join("");
    const decisions = A.decisions.map((item, index) => {
      const loc = extraOf("decisions", String(index));
      const title = loc && loc.title ? loc.title : item.title;
      const text = loc && loc.text ? loc.text : item.text;
      return `<article class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`;
    }).join("");
    return `<article class="page" data-page="model">
      <header class="page-head">
        <p class="eyebrow">${esc(t("title.model"))}</p>
        <h2>${esc(t("model.h2"))}</h2>
        <p class="lede">${esc(t("model.lede"))}</p>
      </header>
      <p class="eyebrow">${esc(t("model.coastal"))}</p>
      ${ecdBoard()}
      <div class="rule">
        <p class="eyebrow">${esc(t("model.update"))}</p>
        <p>${esc(t("model.updateText"))}</p>
      </div>
      <h3 class="section-title">${esc(t("model.decisions"))}</h3>
      <div class="grid-2">${decisions}</div>
      <h3 class="section-title">${esc(t("model.layers"))}</h3>
      <div class="layers">${layers}</div>
      <h3 class="section-title">${esc(t("model.openDash"))}</h3>
      <p class="muted">${esc(t("model.openMuted"))}</p>
      <div class="doors">
        <button type="button" class="primary" data-action="enter" data-role="student" data-student="amina" data-competency="PE" data-route="dashboard">${esc(t("model.openAmina"))}</button>
        <button type="button" data-action="enter" data-role="mentor" data-mentor="ibarra" data-student="jun" data-route="dashboard">${esc(t("model.openIbarra"))}</button>
        <button type="button" data-action="enter" data-role="director" data-route="dashboard">${esc(t("model.openDirector"))}</button>
        <button type="button" data-action="enter" data-role="student" data-student="noor" data-competency="PE" data-route="dashboard">${esc(t("model.openNoor"))}</button>
      </div>
    </article>`;
  }

  function renderMap() {
    const personRecord = current();
    const groups = A.fields.map((rawField) => {
      const item = field(rawField.id);
      const cards = A.competencies.filter((claim) => claim.field === item.id).map((rawClaim) => {
        const claim = competency(rawClaim.id);
        const level = levelOf(personRecord.id, claim.id);
        const elicited = []
          .concat(A.projects.filter((row) => row.elicits.includes(claim.id)).map((row) => project(row.id).name))
          .concat(A.workshops.filter((row) => row.elicits.includes(claim.id)).map((row) => workshop(row.id).name));
        const practice = allMaterials().filter((row) => (row.competencies || []).includes(claim.id)).map((row) => localize("materials", row).title);
        const related = neighbors(claim.id).map((id) => competency(id).short).join(", ");
        return `<article class="card map-card field-${item.id} ${state.competencyId === claim.id ? "is-selected" : ""}">
          <p class="eyebrow">${esc(item.name)}</p>
          <h3><button type="button" class="text-btn" data-action="select-competency" data-id="${claim.id}">${esc(claim.name)}</button></h3>
          <p class="level-line">${meter(level, item.id)} <span>${esc(levelLabel(level))} for ${esc(firstName(personRecord))}</span></p>
          <p class="meta">${esc(stagePointsSentence(level))}</p>
          <p>${esc(claim.claim)}</p>
          <p class="eyebrow">${esc(t("map.rules"))}</p>
          <ul class="rules">${claim.rules.map((rule) => `<li>${esc(rule)}</li>`).join("")}</ul>
          <p class="meta">${esc(t("map.elicitedBy", { list: elicited.length ? elicited.join(", ") : t("map.elicitedNone") }))}</p>
          <p class="meta">Practice, with no credit: ${practice.length ? esc(practice.join(", ")) : "none on the shelf"}.</p>
          <p class="meta">Read with ${esc(related)}.</p>
        </article>`;
      }).join("");
      return `<section>
        <h3>${esc(item.name)}</h3>
        <p class="muted">${esc(item.blurb)}</p>
        <div class="map-cards">${cards}</div>
      </section>`;
    }).join("");
    return `<article class="page" data-page="map">
      <header class="page-head">
        <p class="eyebrow">Competency model</p>
        <h2>${esc(t("map.h2"))}</h2>
        <p class="lede">Thirteen subjects across mathematics, English, physics, and philosophy. The arc on each subject is how far that skill has come, and each dot is work that moved it. The bar under a field follows the skills in that field that already have evidence. Switch the student in the header to read someone else onto the same map.</p>
      </header>
      ${renderNetwork(personRecord)}
      <div class="map-groups">${groups}</div>
    </article>`;
  }

  function peopleOn(projectId) {
    return {
      on: A.students.filter((item) => item.projectIds.includes(projectId)),
      invited: A.students.filter((item) => item.recommendedProjectId === projectId),
    };
  }

  function projectCard(item) {
    const seats = peopleOn(item.id);
    const fields = [];
    for (const id of item.elicits) {
      const fieldId = competency(id).field;
      if (!fields.includes(fieldId)) fields.push(fieldId);
    }
    const pips = fields.map((id) => `<span class="pill field-${id}">${esc(field(id).short)}</span>`).join("");
    const names = seats.on.map((personRecord) => personRecord.name).join(", ") || "Open seat";
    const viewer = current();
    const next = nextSitting("project", item.id);
    const when = next ? `${formatDate(next.date)}, ${next.start}–${next.end}, ${next.place}. ${placesOpen(next)}` : "None on the plan";
    return `<article class="card">
      <p class="eyebrow">${esc(item.place)}</p>
      <h3><a href="#projects/${item.id}">${esc(item.name)}</a></h3>
      <p>${esc(item.summary)}</p>
      <p class="point-offer"><b>${esc(offerPhrase(item.elicits))}</b> <span>across ${item.elicits.length} skills</span></p>
      <p class="meta">${esc(projectAvailability(viewer, item.id))}</p>
      <p class="tags">${pips}</p>
      <p class="meta">On it: ${esc(names)}</p>
      <p class="meta">Next sitting: ${esc(when)}. <a href="#plan">See the days</a></p>
    </article>`;
  }

  function renderProjectDetail(item) {
    if (!item) {
      return `<article class="page" data-page="projects"><header class="page-head"><p class="eyebrow">${esc(t("nav.projects"))}</p><h2>${esc(t("projects.missing"))}</h2></header><p><a href="#projects">${esc(t("projects.back"))}</a></p></article>`;
    }
    const seats = peopleOn(item.id);
    const evidence = A.evidence.filter((row) => row.sourceId === item.id).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const features = item.features.map((feature) => `<div class="card"><h3>${esc(feature.label)}</h3><p>${esc(feature.text)}</p><p class="meta">${esc(offerPhrase(feature.competencyIds))}. ${esc(feature.competencyIds.map((id) => competency(id).name).join(", "))}</p></div>`).join("");
    const claims = item.elicits.map((id) => `<button type="button" class="text-btn" data-action="select-competency" data-id="${id}">${esc(competency(id).name)}</button>`).join(", ");
    const on = seats.on.map((personRecord) => `<a href="#panel" data-action="open-student" data-id="${personRecord.id}">${esc(personRecord.name)}</a>`).join(", ") || "None yet";
    const invited = seats.invited.map((personRecord) => `${esc(personRecord.name)} — ${esc(personRecord.scaffold)}`).join(" ");
    return `<article class="page" data-page="projects" data-project="${item.id}">
      <header class="page-head">
        <p class="eyebrow">Task model · <a href="#projects">All projects</a></p>
        <h2>${esc(item.name)}</h2>
        <p class="lede">${esc(item.brief)}</p>
      </header>
      <p class="meta">${esc(item.place)}</p>
      <p class="point-offer"><b>${esc(offerPhrase(item.elicits))}</b> <span>across ${item.elicits.length} skills</span></p>
      ${overlapNote(item) ? `<p class="meta">${esc(overlapNote(item))}</p>` : ""}
      ${offerSkillCloud(item, current(), "project")}
      <h3 class="section-title">Points for each part</h3>
      ${activityList(item.activities)}
      <p><strong>On it.</strong> ${on}</p>
      ${invited ? `<p><strong>Scaffolded seat, not yet taken.</strong> ${invited}</p>` : ""}
      <h3 class="section-title">Sittings</h3>
      <p class="muted">A place at a sitting is attendance. It does not put you on the project. Register from a student account.</p>
      ${planNoticeHTML()}
      ${sittingSection("project", item.id)}
      <h3 class="section-title">The task, in parts</h3>
      <div class="grid-2">${features}</div>
      <p class="rule">${esc(item.varied)}</p>
      <h3 class="section-title">Claims this task can elicit</h3>
      <p>${claims}. The rules for each claim live on <a href="#map">the map</a>.</p>
      <h3 class="section-title">Evidence already on file</h3>
      <div class="tape">${evidence.length ? evidence.map(evidenceCard).join("") : `<p class="empty">No scored work on this project yet.</p>`}</div>
    </article>`;
  }

  function renderProjects() {
    if (state.param) return renderProjectDetail(project(state.param));
    return `<article class="page" data-page="projects">
      <header class="page-head">
        <p class="eyebrow">${esc(t("projects.taskModels"))}</p>
        <h2>${esc(t("projects.h2"))}</h2>
        <p class="lede">${esc(t("projects.lede"))}</p>
      </header>
      <div class="grid-2">${A.projects.map((row) => projectCard(project(row.id))).join("")}</div>
    </article>`;
  }

  function kindLabel(kind) {
    if (kind === "workshop") return t("kind.workshop");
    if (kind === "project") return t("kind.project");
    return t("kind.lecture");
  }

  function allSessions() {
    return A.sessions.concat(Array.isArray(state.planned) ? state.planned : []).map((item) => localize("sessions", item));
  }

  function sessionById(id) {
    return allSessions().find((item) => item.id === id) || null;
  }

  function sessionParent(item) {
    if (!item) return null;
    if (item.kind === "workshop") return workshop(item.ref);
    if (item.kind === "project") return project(item.ref);
    return null;
  }

  function sessionTitle(item) {
    if (!item) return "Sitting";
    if (item.kind === "lecture") return item.title || "Lecture";
    const parent = sessionParent(item);
    return parent ? parent.name : (item.title || "Sitting");
  }

  function sessionHref(item) {
    if (item.kind === "workshop") return "#workshops/" + item.ref;
    if (item.kind === "project") return "#projects/" + item.ref;
    return "#plan";
  }

  function sessionBlurb(item) {
    if (item.kind === "lecture") return item.summary || "";
    if (item.note) return item.note;
    const parent = sessionParent(item);
    return parent ? parent.summary : "";
  }

  function sittingOpen(item) {
    return item.date >= A.today;
  }

  function compareSittings(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return sessionTitle(a).localeCompare(sessionTitle(b));
  }

  function sittingsOf(kind, ref) {
    return allSessions().filter((item) => item.kind === kind && item.ref === ref).sort(compareSittings);
  }

  function nextSitting(kind, ref) {
    return sittingsOf(kind, ref).find((item) => sittingOpen(item)) || null;
  }

  function rosterOf(item) {
    const removed = new Set((state.withdrawals && state.withdrawals[item.id]) || []);
    const extra = (state.registrations && state.registrations[item.id]) || [];
    const seed = Array.isArray(item.roster) ? item.roster : [];
    const ids = [];
    for (const id of seed.concat(extra)) {
      if (!student(id) || removed.has(id) || ids.includes(id)) continue;
      ids.push(id);
    }
    return ids;
  }

  function sittingClash(studentId, item) {
    return allSessions().find((other) => {
      if (other.id === item.id || other.date !== item.date) return false;
      if (item.start >= other.end || other.start >= item.end) return false;
      return rosterOf(other).includes(studentId);
    }) || null;
  }

  function placeCount(item) {
    const count = rosterOf(item).length;
    const word = item.capacity === 1 ? t("place.one") : t("place.many");
    return t("place.of", { count, capacity: item.capacity, word });
  }

  function rosterNames(item) {
    const names = rosterOf(item).map((id) => student(id).name).sort((a, b) => a.localeCompare(b, state.lang === "fr" ? "fr" : "en"));
    if (!names.length) return t("place.noneRegistered");
    return t("place.registered", { names: joinNames(names) });
  }

  function registerFor(sessionId) {
    const item = sessionById(sessionId);
    if (!item || state.role !== "student" || !sittingOpen(item)) return "closed";
    const me = current().id;
    if (rosterOf(item).includes(me)) return "already";
    if (rosterOf(item).length >= item.capacity) return "full";
    if (sittingClash(me, item)) return "clash";
    const dropped = ((state.withdrawals && state.withdrawals[item.id]) || []).filter((id) => id !== me);
    if (dropped.length) state.withdrawals[item.id] = dropped;
    else delete state.withdrawals[item.id];
    const seed = Array.isArray(item.roster) ? item.roster : [];
    if (!seed.includes(me)) {
      const added = (state.registrations[item.id] || []).slice();
      if (!added.includes(me)) added.push(me);
      state.registrations[item.id] = added;
    }
    return "ok";
  }

  function withdrawFrom(sessionId) {
    const item = sessionById(sessionId);
    if (!item || state.role !== "student" || !sittingOpen(item)) return false;
    const me = current().id;
    if (!rosterOf(item).includes(me)) return false;
    const added = (state.registrations[item.id] || []).filter((id) => id !== me);
    if (added.length) state.registrations[item.id] = added;
    else delete state.registrations[item.id];
    const seed = Array.isArray(item.roster) ? item.roster : [];
    if (seed.includes(me)) {
      const dropped = (state.withdrawals[item.id] || []).slice();
      if (!dropped.includes(me)) dropped.push(me);
      state.withdrawals[item.id] = dropped;
    }
    return true;
  }

  function planNoticeHTML() {
    if (!planNotice) return "";
    return `<p class="live" id="plan-notice">${esc(planNotice)}</p>`;
  }

  function whenBlock(item) {
    const [, month, day] = item.date.split("-");
    const year = item.date.slice(0, 4);
    return `<div class="when" aria-hidden="true">
      <b>${Number(day)}</b>
      <span>${esc(monthNames("short")[Number(month) - 1] || "")} ${esc(year)}</span>
      <small>${esc(weekdayName(item.date))}</small>
    </div>`;
  }

  function registerButtons(item) {
    const open = sittingOpen(item);
    const mine = rosterOf(item).includes(current().id);
    const full = rosterOf(item).length >= item.capacity;
    const label = sessionTitle(item);
    const when = formatDate(item.date);
    if (!open) return `<p class="muted">${esc(t("register.heldClosed"))}</p>`;
    if (state.role !== "student") return `<p class="muted">${esc(t("register.studentOnly"))}</p>`;
    if (mine) {
      return `<div class="action-row">
        <button type="button" data-action="withdraw" data-id="${esc(item.id)}" aria-label="${esc(t("withdrawFrom", { title: label, when }))}">${esc(t("withdraw"))}</button>
      </div>`;
    }
    if (full) return `<div class="action-row"><button type="button" disabled>${esc(t("full"))}</button></div>`;
    return `<div class="action-row">
      <button type="button" class="primary" data-action="register" data-id="${esc(item.id)}" aria-label="${esc(t("registerFor", { title: label, when }))}">${esc(t("register"))}</button>
    </div>`;
  }

  function sittingCard(item, domId) {
    const parent = sessionParent(item);
    const title = sessionTitle(item);
    const href = sessionHref(item);
    const heading = item.kind === "lecture" ? esc(title) : `<a href="${esc(href)}">${esc(title)}</a>`;
    const mine = rosterOf(item).includes(current().id);
    const host = person(item.hostId);
    const fieldName = item.kind === "lecture" && field(item.field) ? field(item.field).name : "";
    let eyebrow = kindLabel(item.kind);
    if (item.kind === "lecture" && fieldName) eyebrow += " · " + fieldName;
    if (item.kind === "workshop" && parent) eyebrow += " · " + parent.kind;
    if (item.kind === "project" && parent) eyebrow += " · " + parent.place;
    if (!sittingOpen(item)) eyebrow += " · " + t("held");
    const points = item.kind === "lecture" || !parent
      ? `<p class="point-offer"><b>${esc(t("points.zero"))}</b> <span>${item.kind === "lecture" ? esc(t("lecture.notAMark")) : ""}</span></p>`
      : `<p class="point-offer"><b>${esc(offerPhrase(parent.elicits))}</b></p>`;
    const yours = mine
      ? (state.role === "student" ? t("place.youHave") : t("place.theyHave", { name: firstName(current()) }))
      : "";
    const line = `${placeCount(item)} taken. ${rosterNames(item)}${yours ? " " + yours : ""}`;
    const described = `${title}. ${formatDate(item.date)}, ${item.start} to ${item.end}. ${item.place}.`;
    return `<article class="card sitting${mine ? " is-yours" : ""}" id="${esc(domId || item.id)}" data-kind="${esc(item.kind)}" aria-label="${esc(described)}">
      ${whenBlock(item)}
      <div>
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h3>${heading}</h3>
        <p class="meta">${esc(weekdayName(item.date))} ${esc(formatDate(item.date))} · ${esc(item.start)}–${esc(item.end)} · ${esc(item.place)} · ${esc(host ? host.name : "")}</p>
        ${points}
        <p>${esc(sessionBlurb(item))}</p>
        <p class="meta">${esc(line)}</p>
        ${registerButtons(item)}
      </div>
    </article>`;
  }

  function sittingCompact(item) {
    const mine = rosterOf(item).includes(current().id);
    const open = sittingOpen(item);
    const title = sessionTitle(item);
    const when = formatDate(item.date);
    const host = person(item.hostId);
    let button = "";
    if (state.role === "student" && open && mine) {
      button = `<button type="button" data-action="withdraw" data-id="${esc(item.id)}" aria-label="${esc(t("withdrawFrom", { title, when }))}">${esc(t("withdraw"))}</button>`;
    } else if (state.role === "student" && open && rosterOf(item).length < item.capacity) {
      button = `<button type="button" class="primary" data-action="register" data-id="${esc(item.id)}" aria-label="${esc(t("registerFor", { title, when }))}">${esc(t("register"))}</button>`;
    } else if (open && !mine && rosterOf(item).length >= item.capacity) {
      button = `<span class="meta">${esc(t("full"))}</span>`;
    }
    let status = t("openDot");
    if (!open) status = t("heldDot");
    else if (mine) status = state.role === "student" ? t("place.youHave") : t("place.theyHave", { name: firstName(current()) });
    return `<li id="${esc(item.id)}">
      <span><a href="#plan">${esc(when)}</a> · ${esc(item.start)}–${esc(item.end)} · ${esc(item.place)}</span>
      <b>${esc(placeCount(item))}</b>
      <small>${esc(status)} ${esc(host ? host.name : "")}</small>
      ${button}
    </li>`;
  }

  function sittingSection(kind, ref) {
    const rows = sittingsOf(kind, ref);
    if (!rows.length) return `<p class="muted">${esc(t("register.noSitting"))}</p>`;
    return `<ul class="point-mini">${rows.map(sittingCompact).join("")}</ul>`;
  }

  function agendaPoints(item) {
    if (item.kind === "lecture") return t("points.zero");
    const parent = sessionParent(item);
    if (!parent || !Array.isArray(parent.elicits)) return "0 points";
    return offerPhrase(parent.elicits);
  }

  function planGlance(personRecord) {
    const rows = allSessions()
      .filter((item) => sittingOpen(item) && rosterOf(item).includes(personRecord.id))
      .sort(compareSittings);
    if (!rows.length) {
      const sentence = state.role === "student"
        ? t("plan.emptyGlanceYou")
        : t("plan.emptyGlanceThem", { name: firstName(personRecord) });
      return `<p class="empty">${esc(sentence)}</p>`;
    }
    const days = [];
    for (const row of rows) {
      const last = days[days.length - 1];
      if (last && last.date === row.date) last.rows.push(row);
      else days.push({ date: row.date, rows: [row] });
    }
    const daysHTML = days.map((day) => {
      const slots = day.rows.map((row) => {
        const host = person(row.hostId);
        const named = row.kind === "lecture" ? field(row.field) : null;
        const tone = named ? ` field-${named.id}` : "";
        const kind = named ? `${kindLabel(row.kind)} · ${named.name}` : kindLabel(row.kind);
        const where = host ? `${row.place} · ${host.name}` : row.place;
        return `<li class="agenda-slot${tone}">
          <p class="agenda-time"><b>${esc(row.start)}</b><span>to ${esc(row.end)}</span></p>
          <div class="agenda-body">
            <p class="eyebrow">${esc(kind)}</p>
            <h4><a href="${esc(sessionHref(row))}">${esc(sessionTitle(row))}</a></h4>
            <p class="meta">${esc(where)}</p>
            <p class="agenda-points">${esc(agendaPoints(row))}</p>
          </div>
        </li>`;
      }).join("");
      const today = day.date === A.today ? " is-today" : "";
      return `<li class="agenda-day${today}">
        <p class="vh">${esc(weekdayName(day.date))} ${esc(formatDate(day.date))}</p>
        ${whenBlock(day.rows[0])}
        <ol class="agenda-slots">${slots}</ol>
      </li>`;
    }).join("");
    return `<ol class="agenda">${daysHTML}</ol>`;
  }

  function nextSittingLine(personRecord) {
    const next = allSessions()
      .filter((item) => sittingOpen(item) && rosterOf(item).includes(personRecord.id))
      .sort(compareSittings)[0];
    if (!next) return "No coming sitting.";
    return `Next sitting: ${sessionTitle(next)}, ${formatDate(next.date)}.`;
  }

  function syncPlanForm(form) {
    const pick = form.querySelector('[name="sittingKind"]');
    if (!pick) return;
    for (const block of form.querySelectorAll("[data-plan-block]")) {
      const on = block.dataset.planBlock === pick.value;
      block.hidden = !on;
      for (const field of block.querySelectorAll("input, select, textarea")) field.disabled = !on;
    }
  }

  function planForm() {
    if (state.role === "student") {
      return `<p class="muted">A mentor or the director plans a sitting. You register for one that is already on the books.</p>`;
    }
    const workshopOptions = A.workshops.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
    const projectOptions = A.projects.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
    const fieldOptions = A.fields.map((item) => `<option value="${esc(item.id)}">${esc(field(item.id).name)}</option>`).join("");
    const hostBlock = state.role === "director"
      ? `<label>Host
          <select name="hostId" required>${A.people.map((item) => `<option value="${esc(item.id)}"${item.id === "ortega" ? " selected" : ""}>${esc(item.name)}</option>`).join("")}</select>
        </label>`
      : `<p class="meta">Host: ${esc(person(state.mentorId).name)}</p>`;
    return `<section class="card bring">
      <p class="eyebrow">Add to the plan</p>
      <h3>Plan a sitting</h3>
      <p>File this as ${esc(state.role === "director" ? person("ortega").name : person(state.mentorId).name)}. Students register from their own accounts. A sitting does not add a mark.</p>
      <form class="stack-form" data-form="plan">
        <label>Kind
          <select name="sittingKind" required>
            <option value="workshop" selected>Workshop sitting</option>
            <option value="project">Project sitting</option>
            <option value="lecture">Lecture</option>
          </select>
        </label>
        <div data-plan-block="workshop">
          <label>Workshop
            <select name="workshopId" required>${workshopOptions}</select>
          </label>
        </div>
        <div data-plan-block="project" hidden>
          <label>Project
            <select name="projectId" required disabled>${projectOptions}</select>
          </label>
        </div>
        <div data-plan-block="lecture" hidden>
          <label>Title
            <input name="title" required disabled maxlength="140">
          </label>
          <label>Summary
            <textarea name="summary" required disabled maxlength="400" placeholder="What the lecture is for. It places no mark."></textarea>
          </label>
          <label>Field
            <select name="lectureField" required disabled>${fieldOptions}</select>
          </label>
        </div>
        ${hostBlock}
        <label>Day
          <input name="date" type="date" required min="${esc(A.today)}" value="${esc(A.today)}">
        </label>
        <label>Start
          <input name="start" type="time" required value="13:00">
        </label>
        <label>End
          <input name="end" type="time" required value="16:00">
        </label>
        <label>Room
          <input name="place" required maxlength="80" placeholder="Studio hall">
        </label>
        <label>Places
          <input name="capacity" type="number" min="1" max="40" value="12" required>
        </label>
        <label>Note
          <textarea name="note" maxlength="240" placeholder="Optional. What this sitting is for."></textarea>
        </label>
        <p class="form-error" data-error role="alert"></p>
        <button type="submit" class="primary">Put it on the plan</button>
      </form>
    </section>`;
  }

  function planCardList(rows) {
    if (!rows.length) {
      return state.role === "student"
        ? `<p class="empty">You have no place at a coming sitting. Register from the list below.</p>`
        : `<p class="empty">${esc(firstName(current()))} has no place at a coming sitting.</p>`;
    }
    return `<div class="plan-list">${rows.map((item) => sittingCard(item)).join("")}</div>`;
  }

  function monthGroups(rows, prefix) {
    if (!rows.length) return `<p class="empty">Nothing in this part of the plan.</p>`;
    let html = "";
    let month = "";
    for (const item of rows) {
      const key = item.date.slice(0, 7);
      if (key !== month) {
        month = key;
        html += `<h3 class="month-label">${esc(formatMonth(item.date))}</h3>`;
      }
      html += sittingCard(item, prefix + item.id);
    }
    return `<div class="plan-list">${html}</div>`;
  }

  function renderPlan() {
    const personRecord = current();
    const rows = allSessions()
      .filter((item) => state.planKind === "all" || item.kind === state.planKind)
      .sort(compareSittings);
    const coming = rows.filter((item) => sittingOpen(item));
    const held = rows.filter((item) => !sittingOpen(item)).slice().sort((a, b) => compareSittings(b, a));
    const mine = coming.filter((item) => rosterOf(item).includes(personRecord.id));
    const options = [
      ["all", "All sittings"],
      ["workshop", "Workshops"],
      ["project", "Projects"],
      ["lecture", "Lectures"],
    ].map(([id, label]) => `<option value="${id}"${state.planKind === id ? " selected" : ""}>${label}</option>`).join("");
    const account = state.role === "student"
      ? `Registering as ${personRecord.name}.`
      : `Showing places for ${personRecord.name}. A student registers from their own account.`;
    const yoursTitle = state.role === "student" ? "Your places" : `Places for ${firstName(personRecord)}`;
    return `<article class="page" data-page="plan" data-student="${esc(personRecord.id)}">
      <header class="page-head">
        <p class="eyebrow">Plan · cohort clock ${esc(formatDate(A.today))}</p>
        <h2>When the work meets.</h2>
        <p class="lede">Workshops, projects, and lectures are planned as sittings. Each one has a day, a time, a room, and a host. A student registers from their own account. A place at the sitting is not a mark, and it is not a project seat. A lecture is worth 0 points.</p>
        <p class="meta">${esc(account)}</p>
      </header>
      ${planNoticeHTML()}
      <div class="filters">
        <label>Show
          <select name="planKind" data-action="filter">${options}</select>
        </label>
      </div>
      <div class="stat-row">
        <div class="stat"><b>${coming.length}</b><span>coming up</span></div>
        <div class="stat"><b>${mine.length}</b><span>${mine.length === 1 ? "place held" : "places held"}</span></div>
        <div class="stat"><b>${held.length}</b><span>already held</span></div>
      </div>
      ${planForm()}
      <h3 class="section-title">${esc(yoursTitle)}</h3>
      ${planCardList(mine)}
      <h3 class="section-title">Coming up</h3>
      ${monthGroups(coming, "upcoming-")}
      <h3 class="section-title">Already held</h3>
      ${monthGroups(held, "held-")}
    </article>`;
  }

  function focusSitting(id) {
    const node = document.getElementById(id)
      || document.getElementById("upcoming-" + id)
      || document.getElementById("held-" + id);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function explainRegistration(sessionId, mode) {
    const item = sessionById(sessionId);
    if (!item) return;
    const title = sessionTitle(item);
    const when = formatDate(item.date);
    if (mode === "register") {
      const result = registerFor(sessionId);
      if (result === "ok") planNotice = `You have a place at ${title} on ${when}.`;
      else if (result === "full") planNotice = `${title} on ${when} is full.`;
      else if (result === "closed") planNotice = `Registration for ${title} is closed.`;
      else if (result === "clash") {
        const clash = sittingClash(current().id, item);
        planNotice = clash
          ? `You already have a place at ${sessionTitle(clash)} then (${clash.start}–${clash.end}).`
          : "You already have a place at that time.";
      } else planNotice = `You already have a place at ${title}.`;
      persist();
      render();
      if (result === "ok") focusSitting(sessionId);
      else {
        const note = document.getElementById("plan-notice");
        if (note) note.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }
    if (!withdrawFrom(sessionId)) return;
    planNotice = `You withdrew from ${title} on ${when}.`;
    persist();
    render();
    focusSitting(sessionId);
  }

  function plateSvg(id, viewBox, title, body) {
    return `<svg viewBox="${viewBox}" role="img" aria-labelledby="plate-${id}">
      <title id="plate-${id}">${esc(title)}</title>
      ${body}
    </svg>`;
  }

  function stationDisc(x, y, tone, dashed, icon, n, name, detail) {
    const ring = dashed ? ' stroke-dasharray="2.6 2.8"' : "";
    return `<g class="${tone}" transform="translate(${x} ${y})">
      <circle class="disc" r="22"${ring}/>
      ${icon}
      <text class="soft" x="34" y="-6" font-size="11" letter-spacing="1.1">${n}</text>
      <text class="serif" x="34" y="12" font-size="15">${esc(name)}</text>
      <text class="soft" x="34" y="28" font-size="11">${esc(detail)}</text>
    </g>`;
  }

  function plateText(id, key, fallback) {
    const extra = extraOf("plates", id);
    if (extra && extra[key]) return extra[key];
    return fallback;
  }

  function workshopPlate(item) {
    if (!item) return "";
    const iconPage = `<g class="icon">
      <rect x="-7" y="-11" width="14" height="20" rx="1.6" fill="var(--paper-2)" stroke="currentColor" stroke-width="1.4"/>
      <path d="M-4 -5 H4 M-4 0 H4 M-4 5 H1"/>
    </g>`;
    const iconAxes = `<g class="icon">
      <path d="M-10 8 H10"/>
      <path d="M-8 10 V-8"/>
      <path d="M-8 8 L7 -6"/>
    </g>`;
    const iconTalk = `<g class="icon">
      <circle cx="0" cy="-6" r="2.1" fill="currentColor" stroke="none"/>
      <circle cx="-5.2" cy="4" r="2.1" fill="currentColor" stroke="none"/>
      <circle cx="5.2" cy="4" r="2.1" fill="currentColor" stroke="none"/>
    </g>`;
    const iconSlope = `<g class="icon">
      <path d="M-11 8 H10"/>
      <path d="M-10 8 L8 -4"/>
      <circle cx="-4" cy="0.2" r="2.8" fill="var(--paper-2)" stroke="currentColor" stroke-width="1.35"/>
    </g>`;
    const iconClip = `<g class="icon">
      <rect x="-10" y="-7" width="15" height="14" rx="1.6" fill="var(--paper-2)" stroke="currentColor" stroke-width="1.4"/>
      <path class="solid" d="M7 -4 L12 0 L7 4 Z"/>
    </g>`;
    const iconWave = `<g class="icon">
      <path d="M-11 1 C-8 -7 -4 -7 -1 1 S5 9 11 1"/>
    </g>`;
    const iconBench = `<g class="icon">
      <path d="M-10 -8 H8"/>
      <circle cx="-1" cy="-8" r="1.3" fill="currentColor" stroke="none"/>
      <path d="M-1 -6.6 L6 4"/>
      <circle cx="6" cy="6" r="2.8" fill="var(--paper-2)" stroke="currentColor" stroke-width="1.35"/>
      <path d="M-11 10 H11"/>
    </g>`;
    const iconClaim = `<g class="icon">
      <path d="M-9 -2 H8"/>
      <path d="M-9 4 H3"/>
    </g>`;
    const iconRevision = `<g class="icon">
      <path class="hair" d="M-8 -3 H7"/>
      <path class="strike" d="M-9 -6 L8 0"/>
      <path d="M-8 5 H8"/>
    </g>`;
    const iconQuestion = `<text class="serif tone-fill" text-anchor="middle" dominant-baseline="central" font-size="20">?</text>`;
    const caption = (text, y) => `<text class="soft" text-anchor="middle" x="220" y="${y}" font-size="12">${esc(text)}</text>`;
    if (item.id === "sampler") {
      return `<figure class="workshop-plate">${plateSvg("sampler", "0 0 440 186", plateText("sampler", "title", "Four rooms on the Arne. Tide table, street note, flume, and who still gets wet. Nothing here is scored."), `
        ${stationDisc(46, 40, "math", true, iconAxes, "01", plateText("sampler", "s1", "Tide table"), t("plate.noMark"))}
        ${stationDisc(250, 40, "english", true, iconPage, "02", plateText("sampler", "s2", "Street note"), t("plate.noMark"))}
        ${stationDisc(46, 112, "physics", true, iconSlope, "03", plateText("sampler", "s3", "The flume"), t("plate.noMark"))}
        ${stationDisc(250, 112, "philosophy", true, iconTalk, "04", plateText("sampler", "s4", "Who gets wet"), t("plate.noMark"))}
        ${caption(plateText("sampler", "caption", "Nothing here is scored."), 172)}
      `)}</figure>`;
    }
    if (item.id === "diagnostic") {
      const iconEstimation = `<g class="icon">
        <path d="M-11 2 H11"/>
        <path d="M0 -10 V12"/>
        <path d="M-4 -6 H4"/>
        <path d="M-4 10 H4"/>
        <circle cx="0" cy="2" r="1.8" fill="currentColor" stroke="none"/>
      </g>`;
      const iconMechanics = `<g class="icon">
        <path d="M-9 -12 H5"/>
        <circle cx="-2" cy="-12" r="1.45" fill="currentColor" stroke="none"/>
        <path d="M-2 -10.6 L8 5"/>
        <circle cx="8" cy="7.4" r="3.6" fill="var(--paper-2)" stroke="currentColor" stroke-width="1.45"/>
      </g>`;
      const iconPeople = `<g class="icon">
        <circle cx="-6.5" cy="-8" r="2.3" fill="var(--paper-2)" stroke="currentColor" stroke-width="1.3"/>
        <path d="M-6.5 -5.6 V3"/>
        <path d="M-10 8 L-6.5 3 L-3 8"/>
        <circle cx="6.5" cy="-8" r="2.3" fill="var(--paper-2)" stroke="currentColor" stroke-width="1.3"/>
        <path d="M6.5 -5.6 V3"/>
        <path d="M3 8 L6.5 3 L10 8"/>
      </g>`;
      return `<figure class="workshop-plate">${plateSvg("diagnostic", "0 0 440 186", plateText("diagnostic", "title", "Tuesday’s tide. Four stations: flood hours, a pendulum, a paragraph for that street, and who is affected. A station you skip stays blank."), `
        ${stationDisc(46, 40, "math", true, iconEstimation, "01", plateText("diagnostic", "s1", "Flood hours"), plateText("diagnostic", "d1", "Algebra · Statistics"))}
        ${stationDisc(250, 40, "physics", true, iconMechanics, "02", plateText("diagnostic", "s2", "Pendulum"), plateText("diagnostic", "d2", "Mechanics · Experiment"))}
        ${stationDisc(46, 112, "english", true, iconPage, "03", plateText("diagnostic", "s3", "That street"), plateText("diagnostic", "d3", "Writing"))}
        ${stationDisc(250, 112, "philosophy", true, iconPeople, "04", plateText("diagnostic", "s4", "Who is affected"), plateText("diagnostic", "d4", "Ethics"))}
        ${caption(plateText("diagnostic", "caption", "A station you skip stays blank."), 172)}
      `)}</figure>`;
    }
    if (item.id === "media") {
      return `<figure class="workshop-plate">${plateSvg("media", "0 0 440 186", plateText("media", "title", "The weight that comes to rest. Notes, a slow-motion clip, the sandbox, and the spring on the bench. Reconstruction is the mark, the next day."), `
        ${stationDisc(46, 40, "physics", false, iconPage, "01", plateText("media", "s1", "Notes"), plateText("media", "d1", "The page"))}
        ${stationDisc(250, 40, "physics", false, iconClip, "02", plateText("media", "s2", "Clip"), plateText("media", "d2", "Slow motion"))}
        ${stationDisc(46, 112, "physics", false, iconWave, "03", plateText("media", "s3", "Sandbox"), plateText("media", "d3", "The model"))}
        ${stationDisc(250, 112, "physics", false, iconBench, "04", plateText("media", "s4", "Spring"), plateText("media", "d4", "The bench"))}
        ${caption(plateText("media", "caption", "Reconstruction is the mark, the next day."), 172)}
      `)}</figure>`;
    }
    if (item.id === "argument") {
      const stamp = (x, tone, n, name, detail, icon) => `<g class="${tone}" transform="translate(${x} 62)">
        <text class="soft" text-anchor="middle" y="-36" font-size="11" letter-spacing="1.1">${n}</text>
        <circle class="disc" r="22"/>
        ${icon}
        <text class="serif" text-anchor="middle" y="44" font-size="15">${esc(name)}</text>
        <text class="soft" text-anchor="middle" y="62" font-size="11">${esc(detail)}</text>
      </g>`;
      return `<figure class="workshop-plate">${plateSvg("argument", "0 0 440 186", plateText("argument", "title", "Who still walks. The safer-road claim, one question from a peer, and a revision."), `
        ${stamp(74, "philosophy", "01", plateText("argument", "s1", "Safer road"), plateText("argument", "d1", "Your claim"), iconClaim)}
        ${stamp(220, "philosophy", "02", plateText("argument", "s2", "Who walks"), plateText("argument", "d2", "A peer"), iconQuestion)}
        ${stamp(366, "english", "03", plateText("argument", "s3", "Revision"), plateText("argument", "d3", "The new page"), iconRevision)}
        ${caption(plateText("argument", "caption", "The revision answers the question."), 172)}
      `)}</figure>`;
    }
    return "";
  }

  function renderWorkshops() {
    const cards = A.workshops.map((row) => {
      const item = workshop(row.id);
      const enrolled = A.students.filter((personRecord) => personRecord.workshops[item.id] === "enrolled");
      const done = A.students.filter((personRecord) => personRecord.workshops[item.id] === "done");
      const now = enrolled.length ? enrolled.map((personRecord) => personRecord.name).join(", ") : t("workshops.noOne");
      const claims = item.elicits.length
        ? t("workshops.canMark", { names: item.elicits.map((id) => competency(id).name).join(", ") })
        : t("workshops.noMark");
      const viewer = current();
      const place = workshopStatusLabel(viewer.workshops[item.id]).toLowerCase();
      return `<article class="card workshop-card" id="workshop-${item.id}">
        ${workshopPlate(item)}
        <div class="workshop-copy">
        <p class="eyebrow">${esc(item.kind)}${item.scored ? " · " + t("scored") : " · " + t("unscored")}</p>
        <h3>${esc(item.name)}</h3>
        <p class="point-offer"><b>${esc(offerPhrase(item.elicits))}</b></p>
        ${offerSkillCloud(item, viewer, "workshop")}
        <p class="meta">${esc(t("workshops.forPerson", { name: firstName(viewer), place }))}</p>
        <p>${esc(item.detail)}</p>
        ${activityList(item.activities)}
        <p class="meta">${esc(claims)}</p>
        <p class="meta">${esc(t("workshops.inItNow", { now, done: done.length }))}</p>
        <p class="eyebrow">${esc(t("sittings"))}</p>
        ${sittingSection("workshop", item.id)}
        </div>
      </article>`;
    }).join("");
    const intake = A.students.filter((personRecord) => workshopPhase(personRecord) !== "done");
    const lines = intake.map((personRecord) => {
      const steps = A.workshops.map((item) => {
        const status = personRecord.workshops[item.id];
        const word = status === "done" ? t("workshops.wordDone") : status === "enrolled" ? t("workshops.wordProgress") : t("workshops.wordTodo");
        return `${item.name} (${word})`;
      }).join("; ");
      return `<li><a href="#panel" data-action="open-student" data-id="${personRecord.id}">${esc(personRecord.name)}</a> — ${esc(steps)}</li>`;
    }).join("");
    return `<article class="page" data-page="workshops">
      <header class="page-head">
        <p class="eyebrow">${esc(t("nav.workshops"))}</p>
        <h2>${esc(t("workshops.h2"))}</h2>
        <p class="lede">${esc(t("workshops.lede"))}</p>
      </header>
      ${planNoticeHTML()}
      <div class="grid-2">${cards}</div>
      ${state.role === "student" ? "" : `<h3 class="section-title">${esc(t("workshops.stillIn"))}</h3>
      ${lines ? `<ul>${lines}</ul>` : `<p>${esc(t("workshops.allDone"))}</p>`}`}
    </article>`;
  }

  /* Shelf order is how many other students used the piece, then the mean quality score.
     The contributor's own use and score never count. One use per student.
     The same rule covers every kind of material. */
  function materialFields(item) {
    const ids = [];
    const declared = Array.isArray(item.fields) && item.fields.length ? item.fields : (item.field ? [item.field] : []);
    for (const id of declared) {
      if (field(id) && !ids.includes(id)) ids.push(id);
    }
    for (const claimId of item.competencies || []) {
      const claim = competency(claimId);
      if (claim && !ids.includes(claim.field)) ids.push(claim.field);
    }
    return ids;
  }

  function allMaterials() {
    return A.materials.map((item) => localize("materials", item)).concat(state.contributions || []);
  }

  function materialById(id) {
    const item = allMaterials().find((row) => row.id === id) || null;
    return localize("materials", item);
  }

  function contributorStudentId(item) {
    if (item.contributor && item.contributor.kind === "student") return item.contributor.id;
    return "";
  }

  function contributorBucket(item) {
    const kind = item.contributor && item.contributor.kind;
    if (kind === "student") return "student";
    if (kind === "mentor" || kind === "director") return "professor";
    if (kind === "external") return "outside";
    return "atelier";
  }

  function seedActivity(item) {
    const extra = (A.materialActivity && A.materialActivity[item.id]) || {};
    return {
      uses: []
        .concat(Array.isArray(item.uses) ? item.uses : [])
        .concat(Array.isArray(extra.uses) ? extra.uses : []),
      ratings: []
        .concat(Array.isArray(item.ratings) ? item.ratings : [])
        .concat(Array.isArray(extra.ratings) ? extra.ratings : []),
    };
  }

  function ratingsOf(item) {
    const owner = contributorStudentId(item);
    const seed = seedActivity(item).ratings;
    const extra = (state.materialRatings && state.materialRatings[item.id]) || [];
    const byStudent = new Map();
    for (const row of seed.concat(extra)) {
      if (!row || !student(row.studentId) || row.studentId === owner) continue;
      const score = Number(row.score);
      if (!Number.isInteger(score) || score < 1 || score > 4) continue;
      byStudent.set(row.studentId, score);
    }
    return Array.from(byStudent, ([studentId, score]) => ({ studentId, score }));
  }

  function usesOf(item) {
    const owner = contributorStudentId(item);
    const seed = seedActivity(item).uses;
    const extra = (state.materialUses && state.materialUses[item.id]) || [];
    const ids = seed.concat(extra, ratingsOf(item).map((row) => row.studentId));
    const seen = new Set();
    const found = [];
    for (const id of ids) {
      if (!student(id) || id === owner || seen.has(id)) continue;
      seen.add(id);
      found.push(id);
    }
    return found;
  }

  function meanScore(item) {
    const ratings = ratingsOf(item);
    if (!ratings.length) return -1;
    return ratings.reduce((sum, row) => sum + row.score, 0) / ratings.length;
  }

  function joinNames(names) {
    if (names.length <= 1) return names.join("");
    const conj = t("and");
    if (state.lang === "fr") {
      if (names.length === 2) return `${names[0]} ${conj} ${names[1]}`;
      return `${names.slice(0, -1).join(", ")} ${conj} ${names[names.length - 1]}`;
    }
    if (names.length === 2) return `${names[0]} ${conj} ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, ${conj} ${names[names.length - 1]}`;
  }

  function broughtBy(item) {
    const contributor = item.contributor;
    if (!contributor || contributor.kind === "atelier") return "Atelier shelf";
    if (contributor.kind === "student") {
      const personRecord = student(contributor.id);
      return personRecord ? `Brought by ${personRecord.name}, a student` : "Brought by a student";
    }
    if (contributor.kind === "mentor" || contributor.kind === "director") {
      const record = person(contributor.id);
      return record ? `Brought by ${record.name}, a professor` : "Brought by a professor";
    }
    if (contributor.kind === "external") {
      const place = contributor.place ? ` (${contributor.place})` : "";
      return `Brought by ${contributor.name}, from outside the atelier${place}`;
    }
    return "Atelier shelf";
  }

  function qualityWord(n) {
    return ["", "Set aside", "Thin", "Sound", "Keep"][n] || String(n);
  }

  function qualitySentence(item) {
    const users = usesOf(item)
      .map((id) => student(id))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!users.length) return "No other student has used this yet.";
    const names = joinNames(users.map((personRecord) => firstName(personRecord)));
    const used = users.length === 1
      ? `Used by 1 other student (${names}).`
      : `Used by ${users.length} other students (${names}).`;
    const ratings = ratingsOf(item);
    if (!ratings.length) return `${used} No quality score yet.`;
    const mean = ratings.reduce((sum, row) => sum + row.score, 0) / ratings.length;
    const scoreWord = ratings.length === 1 ? "score" : "scores";
    let sentence = `${used} Quality ${formatMean(mean)} from ${ratings.length} ${scoreWord}.`;
    if (ratings.length >= 2) {
      if (mean >= 3) sentence += " The scores say to keep it.";
      else if (mean < 2) sentence += " The scores say to set it aside.";
      else sentence += " The scores are divided.";
    }
    return sentence;
  }

  function censusSentence(items) {
    const buckets = { atelier: 0, student: 0, professor: 0, outside: 0 };
    let used = 0;
    for (const item of items) {
      buckets[contributorBucket(item)] += 1;
      if (usesOf(item).length) used += 1;
    }
    const waiting = items.length - used;
    const piece = items.length === 1 ? "piece sits" : "pieces sit";
    const usedSentence = used === 1
      ? "1 has been used by another student."
      : `${used} have been used by another student.`;
    const waitSentence = waiting === 1 ? "1 is still waiting." : `${waiting} are still waiting.`;
    return `${items.length} ${piece} on the shelf. ${usedSentence} ${waitSentence} ${buckets.atelier} came with the atelier, ${buckets.student} from students, ${buckets.professor} from professors, and ${buckets.outside} from outside. Counts cover the whole shelf.`;
  }

  function compareShelf(a, b) {
    const usesA = usesOf(a).length;
    const usesB = usesOf(b).length;
    if (usesB !== usesA) return usesB - usesA;
    const meanA = meanScore(a);
    const meanB = meanScore(b);
    if (meanB !== meanA) return meanB - meanA;
    return a.title.localeCompare(b.title);
  }

  function compareWaiting(a, b) {
    const da = a.brought || "";
    const db = b.brought || "";
    if (da !== db) return da < db ? 1 : -1;
    return a.title.localeCompare(b.title);
  }

  function recordUse(materialId, studentId) {
    const currentUses = state.materialUses && Array.isArray(state.materialUses[materialId])
      ? state.materialUses[materialId].slice()
      : [];
    if (!currentUses.includes(studentId)) currentUses.push(studentId);
    state.materialUses[materialId] = currentUses;
  }

  function recordRating(materialId, studentId, score) {
    const currentRatings = state.materialRatings && Array.isArray(state.materialRatings[materialId])
      ? state.materialRatings[materialId].filter((row) => row.studentId !== studentId)
      : [];
    currentRatings.push({ studentId, score });
    state.materialRatings[materialId] = currentRatings;
    recordUse(materialId, studentId);
  }

  function materialActions(item) {
    if (state.role !== "student") {
      return `<p class="muted">Students use this and score its quality. A professor does not set that score.</p>`;
    }
    if (contributorStudentId(item) === current().id) {
      return `<p class="muted">You brought this. Other students use it and score its quality. You do not score your own piece.</p>`;
    }
    const used = usesOf(item).includes(current().id);
    const mine = ratingsOf(item).find((row) => row.studentId === current().id);
    const buttons = [1, 2, 3, 4].map((n) => {
      const pressed = mine && mine.score === n;
      return `<button type="button" data-action="rate-material" data-id="${esc(item.id)}" data-score="${n}" aria-pressed="${pressed ? "true" : "false"}">${n} ${esc(qualityWord(n))}</button>`;
    }).join("");
    return `<div class="action-row">
        <button type="button" data-action="use-material" data-id="${esc(item.id)}" ${used ? "disabled" : ""}>${used ? "You used this" : "I used this"}</button>
      </div>
      <p class="eyebrow">Your quality score</p>
      <div class="quality" role="group" aria-label="Quality score for ${esc(item.title)}">${buttons}</div>
      <p class="muted">A quality score records that you used it. You can change your score. It does not add a mark.</p>`;
  }

  function materialCard(item) {
    const fields = materialFields(item);
    const ratings = ratingsOf(item);
    const uses = usesOf(item);
    const mean = ratings.length ? ratings.reduce((sum, row) => sum + row.score, 0) / ratings.length : null;
    const fieldTags = fields.map((id) => `<li class="field-${id}">${esc(field(id).short)}</li>`).join("");
    const claimTags = (item.competencies || []).map((id) => {
      const claim = competency(id);
      if (!claim) return "";
      return `<li class="field-${claim.field}">${esc(claim.short)}</li>`;
    }).join("");
    const when = item.brought ? ` · ${formatDate(item.brought)}` : "";
    const claimBlock = claimTags ? `<ul class="tags">${claimTags}</ul>` : "";
    return `<article class="card material" id="${esc(item.id)}" data-uses="${uses.length}" data-marks="${ratings.length}" data-mean="${mean == null ? "" : esc(formatMean(mean))}" data-fields="${esc(fields.join(" "))}">
      <p class="eyebrow">${esc(mediaLabel(item.medium))} · ${item.minutes} min</p>
      <h3>${esc(item.title)}</h3>
      <p class="meta">${esc(broughtBy(item) + when)}</p>
      <ul class="tags">${fieldTags}</ul>
      <p>${esc(item.summary)}</p>
      ${claimBlock}
      <p class="point-offer"><b>0 points</b> <span>practice</span></p>
      <p class="quality-line">${esc(qualitySentence(item))}</p>
      ${materialActions(item)}
    </article>`;
  }

  function bringAs() {
    if (state.role === "student") return `${current().name}, a student`;
    if (state.role === "mentor") return `${person(state.mentorId).name}, a professor`;
    return `${person("ortega").name}, a professor`;
  }

  function bringForm() {
    const kindOptions = [`<option value="">Choose a kind</option>`]
      .concat(A.media.map((item) => `<option value="${item.id}">${esc(item.label)}</option>`))
      .join("");
    const fieldChecks = A.fields.map((item) =>
      `<label class="choice field-${item.id}"><input type="checkbox" name="bringField" value="${item.id}"> ${esc(item.name)}</label>`
    ).join("");
    const claimGroups = A.fields.map((item) => {
      const boxes = A.competencies.filter((claim) => claim.field === item.id).map((claim) =>
        `<label class="choice"><input type="checkbox" name="bringClaim" value="${claim.id}"> ${esc(claim.short)}</label>`
      ).join("");
      return `<p class="group-label field-${item.id}">${esc(item.short)}</p><div class="checks">${boxes}</div>`;
    }).join("");
    const noticed = libraryNotice ? materialById(libraryNotice) : null;
    const notice = noticed
      ? `<p class="live" id="library-notice">${esc(noticed.title)} is on the shelf.</p>`
      : "";
    return `${notice}<section class="card bring">
      <p class="eyebrow">Add to the shelf</p>
      <h3>Bring material</h3>
      <p>File this as ${esc(bringAs())}. Every student can use it. It is worth 0 points and does not add a mark.</p>
      <form class="stack-form" data-form="bring">
        <label>Title
          <input name="title" required maxlength="140">
        </label>
        <label>Summary
          <textarea name="summary" required maxlength="600" placeholder="What another student can do with this."></textarea>
        </label>
        <label>Kind
          <select name="bringMedium" required>${kindOptions}</select>
        </label>
        <label>Minutes
          <input name="minutes" type="number" min="1" max="240" value="20" required>
        </label>
        <fieldset>
          <legend>Fields it serves</legend>
          <div class="checks">${fieldChecks}</div>
          <p class="muted">Choose one or several. A subject you tick adds its field.</p>
        </fieldset>
        <details class="claims">
          <summary>Subjects it practices</summary>
          ${claimGroups}
        </details>
        <label class="check"><input type="checkbox" name="external"> Someone outside the atelier brought this</label>
        <div id="external-fields" hidden>
          <p class="muted">The card names this person. Students still set the quality score.</p>
          <label>Their name
            <input name="externalName" maxlength="80">
          </label>
          <label>Where they come from
            <input name="place" maxlength="80">
          </label>
        </div>
        <p class="form-error" data-error role="alert"></p>
        <button type="submit" class="primary">Put it on the shelf</button>
        <p class="muted">Students score a piece after they use it. The person who brought it does not score it. A professor does not set the quality score.</p>
      </form>
    </section>`;
  }

  function shelfBlock(title, lede, rows, empty) {
    const cards = rows.map(materialCard).join("");
    const body = cards || `<p class="empty">${esc(empty)}</p>`;
    return `<section class="shelf-block">
      <h3 class="section-title">${esc(title)}</h3>
      <p class="muted">${esc(lede)}</p>
      <div class="shelf">${body}</div>
    </section>`;
  }

  function materialMatches(item) {
    const mediumOk = state.medium === "all" || item.medium === state.medium;
    if (!mediumOk) return false;
    if (state.field === "all") return true;
    if (materialFields(item).includes(state.field)) return true;
    return (item.competencies || []).some((id) => competency(id) && competency(id).field === state.field);
  }

  function activityEvidence(personRecord, source, sourceId, skillId) {
    return A.evidence.filter((item) => {
      if (item.studentId !== personRecord.id || item.source !== source || item.sourceId !== sourceId) return false;
      if (skillId && !item.scores.some((score) => score.competencyId === skillId)) return false;
      return true;
    }).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function shownSkills(skillIds, skillId) {
    return skillIds.filter((id) => {
      if (skillId) return id === skillId;
      if (state.field !== "all") return competency(id).field === state.field;
      return true;
    });
  }

  function activityTouches(skillIds, skillId, fieldId) {
    if (skillId) return skillIds.includes(skillId);
    if (fieldId && fieldId !== "all") return skillIds.some((id) => competency(id).field === fieldId);
    return true;
  }

  function activityBoard(personRecord) {
    const skillId = state.skill !== "all" && competency(state.skill) ? state.skill : "";
    const fieldId = state.field;
    const rows = [];
    for (const raw of A.workshops) {
      const item = workshop(raw.id);
      if (!activityTouches(item.elicits, skillId, fieldId)) continue;
      const seat = personRecord.workshops[item.id];
      const phase = seat === "done" ? "closed" : seat === "enrolled" ? "soon" : "todo";
      const scored = activityEvidence(personRecord, "workshop", item.id, skillId);
      let detail;
      if (phase === "closed" && scored.length) {
        detail = scored.map((entry) => `${entry.title} · ${formatDate(entry.date)}`).join("; ");
      } else if (phase === "closed") {
        detail = item.scored ? "Closed. No score was recorded for this filter." : "Closed. This workshop carries no score.";
      } else if (phase === "soon") {
        detail = "In progress now.";
      } else {
        detail = "Still to do.";
      }
      rows.push({
        phase,
        kind: t("kind.workshop"),
        name: item.name,
        href: `#workshops/${item.id}`,
        summary: item.summary,
        skills: shownSkills(item.elicits, skillId),
        points: offerPhrase(item.elicits),
        activities: item.activities,
        note: overlapNote(item),
        detail,
      });
    }
    for (const raw of A.projects) {
      const item = project(raw.id);
      if (!activityTouches(item.elicits, skillId, fieldId)) continue;
      const seated = personRecord.projectIds.includes(item.id);
      const recommended = personRecord.recommendedProjectId === item.id;
      const scored = activityEvidence(personRecord, "project", item.id, skillId);
      let phase = "todo";
      let detail = "Still to do.";
      if (scored.length) {
        phase = "closed";
        detail = scored.map((entry) => `${entry.title} · ${formatDate(entry.date)}`).join("; ");
      } else if (recommended) {
        phase = "soon";
        detail = "Recommended next seat.";
      } else if (seated) {
        phase = "soon";
        detail = "Seat taken. No scored work on this skill yet.";
      }
      rows.push({
        phase,
        kind: t("kind.project"),
        name: item.name,
        href: `#projects/${item.id}`,
        summary: item.summary,
        skills: shownSkills(item.elicits, skillId),
        points: offerPhrase(item.elicits),
        activities: item.activities,
        note: overlapNote(item),
        detail,
      });
    }
    return rows;
  }

  function renderActivities() {
    const personRecord = current();
    const skillId = state.skill !== "all" && competency(state.skill) ? state.skill : "";
    const rows = activityBoard(personRecord);
    const phases = [
      ["closed", "Closed"],
      ["soon", "Soon"],
      ["todo", "Still to do"],
    ];
    const columns = phases.map(([phase, label]) => {
      const items = rows.filter((row) => row.phase === phase);
      const cards = items.map((row) => {
        const tags = row.skills.map((id) => {
          const claim = competency(id);
          return `<li class="field-${claim.field}">${esc(claim.short)}</li>`;
        }).join("");
        return `<article class="card">
          <p class="eyebrow">${esc(row.kind)}</p>
          <h3><a href="${esc(row.href)}">${esc(row.name)}</a></h3>
          <p class="point-offer"><b>${esc(row.points)}</b></p>
          <p>${esc(row.summary)}</p>
          ${activityList(row.activities)}
          ${row.note ? `<p class="meta">${esc(row.note)}</p>` : ""}
          ${tags ? `<ul class="tags">${tags}</ul>` : ""}
          <p class="meta">${esc(row.detail)}</p>
        </article>`;
      }).join("");
      return `<section class="activity-col">
        <h3>${esc(label)} <span class="meta">${items.length}</span></h3>
        ${cards || `<p class="empty">Nothing ${label.toLowerCase()} for this filter.</p>`}
      </section>`;
    }).join("");
    const fieldOptions = [`<option value="all"${state.field === "all" ? " selected" : ""}>${esc(t("activities.allFields"))}</option>`]
      .concat(A.fields.map((item) => `<option value="${item.id}"${state.field === item.id ? " selected" : ""}>${esc(field(item.id).name)}</option>`))
      .join("");
    const skillPool = state.field === "all"
      ? A.competencies
      : A.competencies.filter((item) => item.field === state.field);
    const skillOptions = [`<option value="all"${state.skill === "all" ? " selected" : ""}>All skills</option>`]
      .concat(skillPool.map((item) => `<option value="${item.id}"${state.skill === item.id ? " selected" : ""}>${esc(item.name)}</option>`))
      .join("");
    const materials = allMaterials().filter((item) => {
      const claims = item.competencies || [];
      if (skillId) return claims.includes(skillId);
      if (state.field === "all") return true;
      if (materialFields(item).includes(state.field)) return true;
      return claims.some((id) => competency(id) && competency(id).field === state.field);
    });
    const shelf = materials.map((item) => {
      const claims = (item.competencies || []).map((id) => {
        const claim = competency(id);
        if (!claim) return "";
        return `<li class="field-${claim.field}">${esc(claim.short)}</li>`;
      }).join("");
      const fieldNames = materialFields(item).map((id) => field(id).short).join(" · ");
      return `<article class="card">
        <p class="eyebrow">${esc(fieldNames)} · ${esc(mediaLabel(item.medium))} · ${item.minutes} min</p>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.summary)}</p>
        <ul class="tags">${claims}</ul>
        <p class="point-offer"><b>0 points</b> <span>practice</span></p>
        <p class="meta">${esc(qualitySentence(item))} Using it does not add a mark.</p>
      </article>`;
    }).join("");
    const focusName = skillId ? competency(skillId).name : state.field === "all" ? "every skill" : field(state.field).name;
    const closed = rows.filter((row) => row.phase === "closed").length;
    const soon = rows.filter((row) => row.phase === "soon").length;
    const todo = rows.filter((row) => row.phase === "todo").length;
    return `<article class="page" data-page="activities" data-student="${personRecord.id}">
      <header class="page-head">
        <p class="eyebrow">${esc(t("title.activities"))} · ${esc(personRecord.name)}</p>
        <h2>${esc(t("activities.h2"))}</h2>
        <p class="lede">${t("activities.lede", { focus: esc(focusName), plan: `<a href="#plan">${esc(t("activities.plan"))}</a>` })}</p>
      </header>
      <div class="filters">
        <label>Field
          <select name="field" data-action="filter">${fieldOptions}</select>
        </label>
        <label>Skill
          <select name="skill" data-action="filter">${skillOptions}</select>
        </label>
      </div>
      <div class="stat-row">
        <div class="stat"><b>${closed}</b><span>closed</span></div>
        <div class="stat"><b>${soon}</b><span>soon</span></div>
        <div class="stat"><b>${todo}</b><span>still to do</span></div>
        <div class="stat"><b>${materials.length}</b><span>open materials</span></div>
      </div>
      <div class="activity-board">${columns}</div>
      <h3 class="section-title">Materials for these skills</h3>
      <div class="shelf">${shelf || `<p class="empty">No material on the shelf for this filter.</p>`}</div>
    </article>`;
  }

  function renderLibrary() {
    const fieldOptions = [`<option value="all"${state.field === "all" ? " selected" : ""}>${esc(t("activities.allFields"))}</option>`]
      .concat(A.fields.map((item) => `<option value="${item.id}"${state.field === item.id ? " selected" : ""}>${esc(field(item.id).name)}</option>`))
      .join("");
    const mediumOptions = [`<option value="all"${state.medium === "all" ? " selected" : ""}>All kinds</option>`]
      .concat(A.media.map((item) => `<option value="${item.id}"${state.medium === item.id ? " selected" : ""}>${esc(item.label)}</option>`))
      .join("");
    const rows = allMaterials().filter(materialMatches);
    const judged = rows.filter((item) => usesOf(item).length).sort(compareShelf);
    const waiting = rows.filter((item) => !usesOf(item).length).sort(compareWaiting);
    return `<article class="page" data-page="library">
      <header class="page-head">
        <p class="eyebrow">Open shelf</p>
        <h2>A shelf anyone can add to.</h2>
        <p class="lede">A student, a professor, or someone outside the atelier can put a piece here, for one field or for several at once. Every student can use it. Quality is how many other students used it, and the quality scores those students gave. The same rule covers text, video, simulation, experiment, and discussion. Each piece is worth 0 points. Use does not add a mark.</p>
        <p class="meta" id="shelf-census">${esc(censusSentence(allMaterials()))}</p>
      </header>
      <div class="filters">
        <label>Field
          <select name="field" data-action="filter">${fieldOptions}</select>
        </label>
        <label>Kind
          <select name="medium" data-action="filter">${mediumOptions}</select>
        </label>
      </div>
      ${bringForm()}
      ${shelfBlock(
        "Judged from use",
        "Ordered by how many other students used the piece, then by the mean quality score. Once two students have scored it, a mean of 3 or higher reads as keep, below 2 as set aside, and in between as divided.",
        judged,
        "Nothing in this part of the shelf matches both filters."
      )}
      ${shelfBlock(
        "Waiting on another student",
        "No other student has used these yet. Who brought them does not move them up.",
        waiting,
        "Nothing in this part of the shelf matches both filters."
      )}
    </article>`;
  }

  function renderCohort() {
    if (state.role === "student") {
      return `<article class="page" data-page="cohort">
        <header class="page-head">
          <p class="eyebrow">Cohort</p>
          <h2>The overview belongs to mentors and the director.</h2>
          <p class="lede">A student sees their own panel, in full. The cohort table is the director’s instrument and a mentor’s caseload. Switch role in the header to open it.</p>
        </header>
        <div class="doors">
          <button type="button" class="primary" data-action="enter" data-role="director" data-route="cohort">Continue as director</button>
          <a href="#dashboard">Back to the dashboard</a>
        </div>
      </article>`;
    }
    const rank = { challenge: 0, stale: 1, intake: 2, workshops: 3, open: 4, withheld: 5, ready: 6, endorsed: 7 };
    const rows = A.students.slice().sort((a, b) => {
      const diff = rank[attention(a).id] - rank[attention(b).id];
      if (diff) return diff;
      return a.name.localeCompare(b.name);
    });
    const moving = A.students.filter((item) => evidenceFor(item.id).length).length;
    const stale = A.students.filter((item) => attention(item).id === "stale");
    const body = rows.map((personRecord) => {
      const pips = A.floorIds.map((id) => pip(levelOf(personRecord.id, id), competency(id).field, `${competency(id).name}: ${levelLabel(levelOf(personRecord.id, id))}`)).join("");
      const last = lastEvidenceItem(personRecord.id);
      const lastText = last ? formatDate(last.date) : "None";
      const marks = evidenceFor(personRecord.id).length;
      return `<tr data-action="open-student" data-id="${personRecord.id}" data-student="${personRecord.id}">
        <td><button type="button" class="name-btn" data-action="open-student" data-id="${personRecord.id}">${esc(personRecord.name)}</button><br><span class="meta">${esc(person(personRecord.mentorId).name.replace(/^Dr\. |^Prof\. /, ""))}</span></td>
        <td>${esc(agePhrase(personRecord))}</td>
        <td><span class="pips">${pips}</span></td>
        <td>${marks}</td>
        <td>${esc(lastText)}</td>
        <td>${flagHTML(personRecord)}</td>
      </tr>`;
    }).join("");
    const loads = ["ibarra", "adeyemi", "vogel"].map((id) => {
      const mentees = A.students.filter((item) => item.mentorId === id);
      const bits = mentees.map((item) => `${item.name} (${attention(item).label})`).join("; ");
      return `<article class="card"><h3>${esc(person(id).name)}</h3><p class="meta">${esc(person(id).domain)} · ${mentees.length} students</p><p>${esc(bits)}</p></article>`;
    }).join("");
    return `<article class="page" data-page="cohort">
      <header class="page-head">
        <p class="eyebrow">Director’s overview · ${esc(person("ortega").name)}</p>
        <h2>The cohort, one row at a time.</h2>
        <p class="lede">The four marks are algebra, writing, mechanics, and ethics, drawn as far as each skill has come. A dashed mark has no evidence yet. The map shows every skill, the links between fields, and the dots each project added. Mentoring load is the constraint that used to be class size.</p>
      </header>
      ${ageChartHTML(A.students.map((item) => item.id))}
      <div class="stat-row">
        <div class="stat"><b>${A.students.length}</b><span>students</span></div>
        <div class="stat"><b>${moving}</b><span>with marks on a skill line</span></div>
        <div class="stat"><b>${stale.length}</b><span>no recent evidence</span></div>
      </div>
      <div class="table-wrap">
        <table>
          <caption>Skill lines and attention</caption>
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Age</th>
              <th scope="col">Shared subjects</th>
              <th scope="col">Pieces of work</th>
              <th scope="col">Latest evidence</th>
              <th scope="col">Attention</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <h3 class="section-title">Caseload</h3>
      <div class="grid-3">${loads}</div>
      ${assistantDock()}
    </article>`;
  }

  function generateDraft(personRecord) {
    const mentor = person(personRecord.mentorId);
    const evidence = evidenceFor(personRecord.id).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const floorLines = A.floorIds.map((id) => {
      const level = levelOf(personRecord.id, id);
      const trailRows = historyOf(personRecord.id, id);
      const via = trailRows.length
        ? " " + trailRows.map((row) => `${levelLabel(row.level)} in ${row.evidence.title} (${sourceLabel(row.evidence)}, ${formatDate(row.date)})`).join("; ") + "."
        : "";
      return `${competency(id).name} — ${levelLabel(level)}.${via}`;
    });
    const evidenceLines = evidence.map((item) => `${formatDate(item.date)} — ${item.title} (${sourceLabel(item)}). ${item.rubric}`);
    const noteLines = notesFor(personRecord.id).map((item) => `${formatDate(item.date)} — ${item.text}`);
    const blocks = [
      `Continuum report\n${personRecord.name}`,
      `Mentor of record: ${mentor.name}. Director: ${person("ortega").name}.\nCohort clock: ${formatDate(A.today)}. Each scored exercise, test, or project adds a mark on every skill it touches. The line shows the furthest stage reached. ${namedList(A.floorIds)} are the skills everyone carries forward.`,
      `${situation(personRecord)} ${mediaSentence(personRecord)}`,
      `Required subjects\n${floorLines.join("\n")}`,
      floorCopy(personRecord).lead,
      `Evidence cited\n${evidenceLines.length ? evidenceLines.join("\n") : "No scored evidence."}`,
      noteLines.length ? `Notes that are not scores\n${noteLines.join("\n")}` : "",
      `Reading\n${recommendation(personRecord)}`,
      `This report is a reading of the record. It is not a certificate. Once it is filed, ${personRecord.name} can read these words on their own panel.`,
    ].filter(Boolean);
    return blocks.join("\n\n");
  }

  function draftText(personRecord) {
    const draft = state.drafts[personRecord.id];
    if (typeof draft === "string" && draft.trim()) return draft;
    const filed = state.reports[personRecord.id];
    if (typeof filed === "string" && filed.trim()) return filed;
    return generateDraft(personRecord);
  }

  function renderReport() {
    const personRecord = current();
    const filed = state.reports[personRecord.id];
    if (state.role === "student" || !canDecide(personRecord)) {
      const body = filed
        ? `<div class="report-body">${esc(filed)}</div>`
        : `<p class="empty">No report is filed for ${esc(personRecord.name)}. A filed report appears here in the words the mentor saved. The panel itself is already visible.</p>`;
      const note = state.role !== "student" && !canDecide(personRecord)
        ? `<p class="muted">${esc(person(personRecord.mentorId).name)} writes this report. You can read a filed copy.</p>`
        : `<p class="muted">You see a report after it is filed. The monitoring panel is available the whole time.</p>`;
      return `<article class="page report-layout" data-page="report" data-student="${personRecord.id}">
        <header class="page-head">
          <p class="eyebrow">Report · <a href="#panel">Back to the panel</a></p>
          <h2>${esc(personRecord.name)}</h2>
        </header>
        ${note}
        ${body}
        ${filed ? `<p class="no-print"><button type="button" data-action="print">Print</button></p>` : ""}
      </article>`;
    }
    const text = draftText(personRecord);
    const status = filed
      ? "Filed. The student can read this."
      : "Draft in this browser. File it when the wording should be visible to the student.";
    return `<article class="page report-layout" data-page="report" data-student="${personRecord.id}">
      <header class="page-head">
        <p class="eyebrow">Report · <a href="#panel">Back to the panel</a></p>
        <h2>${esc(personRecord.name)}</h2>
        <p class="lede">${esc(status)}</p>
      </header>
      <form class="stack-form no-print" data-form="report" id="report-form">
        <label>Report text
          <textarea name="body" id="report-body">${esc(text)}</textarea>
        </label>
        <div class="action-row">
          <button type="submit" class="primary">File the report</button>
          <button type="button" data-action="print">Print</button>
          <span class="meta" id="report-status">Edits stay in this browser as you type.</span>
        </div>
      </form>
      <div class="report-body print-only">${esc(text)}</div>
    </article>`;
  }

  function linePoints(personRecord) {
    return A.competencies.reduce((sum, claim) => sum + (levelOf(personRecord.id, claim.id) || 0), 0);
  }

  function floorPoints(personRecord) {
    return A.floorIds.reduce((sum, id) => sum + (levelOf(personRecord.id, id) || 0), 0);
  }

  function ageExact(personRecord, onIso) {
    const born = personRecord && personRecord.born;
    if (!born || !/^\d{4}-\d{2}-\d{2}$/.test(born)) return 0;
    const [by, bm, bd] = born.split("-").map(Number);
    const [y, m, d] = (onIso || A.today).split("-").map(Number);
    const months = (y - by) * 12 + (m - bm) + (d - bd) / 30.4375;
    return Math.max(0, months / 12);
  }

  function ageWhole(personRecord) {
    return Math.floor(ageExact(personRecord) + 1e-9);
  }

  function agePhrase(personRecord) {
    return t("age.years", { n: ageWhole(personRecord) });
  }

  function mentorTone(mentorId) {
    if (mentorId === "ibarra") return "physics";
    if (mentorId === "vogel") return "mathematics";
    return "philosophy";
  }

  function ageChartRows() {
    return A.students.map((personRecord) => ({
      id: personRecord.id,
      name: personRecord.name,
      short: firstName(personRecord),
      mentorId: personRecord.mentorId,
      age: ageExact(personRecord),
      years: ageWhole(personRecord),
      points: linePoints(personRecord),
      floor: floorPoints(personRecord),
    }));
  }

  function ageChartHTML(caseloadIds) {
    const mine = new Set(caseloadIds && caseloadIds.length ? caseloadIds : A.students.map((item) => item.id));
    const allMine = mine.size === A.students.length;
    const rows = ageChartRows().slice().sort((a, b) => a.age - b.age || a.name.localeCompare(b.name));
    const width = 680;
    const height = 268;
    const padL = 46;
    const padR = 72;
    const padT = 22;
    const padB = 40;
    const ageMin = 13;
    const ageMax = 18.5;
    const yMax = 16;
    const xAt = (age) => padL + ((age - ageMin) / (ageMax - ageMin)) * (width - padL - padR);
    const yAt = (points) => padT + (1 - points / yMax) * (height - padT - padB);
    const ticksX = [13, 14, 15, 16, 17, 18];
    const ticksY = [];
    for (let n = 0; n <= yMax; n += 4) ticksY.push(n);
    const gridX = ticksX.map((age) => {
      const x = xAt(age).toFixed(1);
      return `<line class="chart-grid" x1="${x}" y1="${padT}" x2="${x}" y2="${height - padB}"></line>
        <text class="age-tick" x="${x}" y="${height - padB + 16}" text-anchor="middle">${age}</text>`;
    }).join("");
    const gridY = ticksY.map((points) => {
      const y = yAt(points).toFixed(1);
      const guide = points === 12;
      return `<line class="${guide ? "age-guide" : "chart-grid"}" x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}"></line>
        <text class="age-tick" x="${padL - 8}" y="${Number(y) + 4}" text-anchor="end">${points}</text>`;
    }).join("");
    const guideY = yAt(12);
    const dots = rows.map((row, index) => {
      const x = xAt(row.age);
      const y = yAt(row.floor);
      const on = mine.has(row.id);
      let lift = index % 2 === 0 ? -15 : 20;
      if (Math.abs((y + lift) - yAt(12)) < 11) lift = lift < 0 ? 20 : -16;
      const label = t("age.open", { name: row.name });
      return `<g class="age-dot field-${mentorTone(row.mentorId)}${on ? " is-mine" : " is-ghost"}" data-action="open-student" data-id="${esc(row.id)}" tabindex="0" role="button" aria-label="${esc(label)}">
        <circle class="hit" data-action="open-student" data-id="${esc(row.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16"></circle>
        <circle class="mark" data-action="open-student" data-id="${esc(row.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${on ? 7 : 5.2}"></circle>
        <text class="age-name" x="${x.toFixed(1)}" y="${(y + lift).toFixed(1)}" text-anchor="middle">${esc(row.short)}</text>
      </g>`;
    }).join("");
    const list = rows.map((row) => {
      const personRecord = student(row.id);
      const pips = A.floorIds.map((id) => pip(levelOf(row.id, id), competency(id).field, `${competency(id).name}: ${levelLabel(levelOf(row.id, id))}`)).join("");
      const on = mine.has(row.id);
      return `<li class="${on ? "is-mine" : "is-ghost"}">
        <button type="button" data-action="open-student" data-id="${esc(row.id)}">
          <b>${esc(row.short)}</b>
          <span class="meta">${esc(agePhrase(personRecord))}</span>
          <span class="pips" aria-label="${esc(t("age.shared"))}">${pips}</span>
          <span class="age-pts"><strong>${row.points}</strong> <span>${esc(t("age.allPoints"))}</span></span>
        </button>
      </li>`;
    }).join("");
    const lede = allMine ? t("age.ledeDirector") : t("age.ledeMentor");
    const legend = allMine
      ? `<p class="legend">${["ibarra", "adeyemi", "vogel"].map((id) => `<span class="field-${mentorTone(id)}"><i></i>${esc(person(id).name.replace(/^Dr\. |^Prof\. /, ""))}</span>`).join("")}</p>`
      : `<p class="legend"><span class="age-key-mine"><i></i>${esc(t("age.legendCaseload"))}</span><span class="age-key-ghost"><i></i>${esc(t("age.legendCohort"))}</span></p>`;
    const high = rows.slice().sort((a, b) => b.floor - a.floor || b.points - a.points || a.age - b.age)[0];
    const young = rows[0];
    const reading = t("age.reading", {
      name: high.short,
      age: agePhrase(student(high.id)),
      points: pointsLabel(high.points),
      floor: high.floor,
      mentor: person(high.mentorId).name,
    });
    return `<section class="age-chart" aria-labelledby="age-chart-title">
      <h3 id="age-chart-title">${esc(t("age.chartTitle"))}</h3>
      <p class="muted">${esc(lede)}</p>
      ${legend}
      <div class="chart-scroll">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t("age.chartTitle"))}">
          ${gridX}
          ${gridY}
          <text class="age-guide-label" x="${padL + 6}" y="${guideY - 7}" text-anchor="start">${esc(t("age.sharedGuide"))}</text>
          <text class="age-axis" x="${(padL + width - padR) / 2}" y="${height - 6}" text-anchor="middle">${esc(t("age.younger"))} → ${esc(t("age.older"))}</text>
          <text class="age-axis" transform="translate(14 ${(padT + height - padB) / 2}) rotate(-90)" text-anchor="middle">${esc(t("age.pointsAxis"))}</text>
          ${dots}
        </svg>
      </div>
      <p class="cloud-read">${esc(reading)} ${esc(t("age.listCaption"))}: ${esc(young.short)} (${esc(agePhrase(student(young.id)))}).</p>
      <ol class="age-strip">${list}</ol>
    </section>`;
  }

  function fieldBundle(fieldId) {
    const skills = A.competencies.filter((claim) => claim.field === fieldId).map((claim) => competency(claim.id));
    const materials = allMaterials().filter((item) => materialFields(item).includes(fieldId));
    const workshops = A.workshops.filter((item) => item.elicits.some((id) => competency(id) && competency(id).field === fieldId)).map((item) => workshop(item.id));
    const projects = A.projects.filter((item) => item.elicits.some((id) => competency(id) && competency(id).field === fieldId)).map((item) => project(item.id));
    return { skills, materials, workshops, projects };
  }

  function placesOpen(item) {
    const left = item.capacity - rosterOf(item).length;
    if (left <= 0) return t("full");
    if (left === 1) return t("place.openOne");
    return t("place.openMany", { n: left });
  }

  function openSittings(kind) {
    return allSessions().filter((item) => item.kind === kind && sittingOpen(item)).sort(compareSittings);
  }

  const CLOUD_W = 880;
  const CLOUD_H = 560;
  const CLOUD_SPOTS = {
    MA: [160, 160],
    MC: [280, 230],
    MG: [150, 320],
    MS: [270, 410],
    ER: [420, 130],
    EW: [560, 170],
    EH: [450, 278],
    PM: [710, 150],
    PX: [691, 310],
    PO: [816, 250],
    PL: [417, 403],
    PK: [584, 365],
    PE: [517, 472],
  };

  function cloudDiameter(level) {
    if (level == null) return 44;
    return [0, 56, 68, 80, 92][level];
  }

  function cloudStrength(level) {
    if (level == null) return "0%";
    return ["0%", "42%", "64%", "84%", "100%"][level];
  }

  function cloudLabel(claim, fieldItem, level) {
    const stage = level == null ? "no evidence yet" : levelLabel(level);
    return claim.name + ", " + fieldItem.name + ", " + stage;
  }

  function syncCloudStudent(personId) {
    if (cloudStudentId === personId) return;
    cloudStudentId = personId;
    cloudZoom = 1;
    cloudFocus = "";
  }

  function skillCloud(personRecord) {
    syncCloudStudent(personRecord.id);
    const title = state.role === "student" ? "Your skills" : `${firstName(personRecord)}’s skills`;
    const legend = `<p class="legend">${A.fields.map((item) => `<span class="field-${item.id}"><i></i>${esc(field(item.id).short)}</span>`).join("")}<span class="cloud-empty-key"><i></i>${esc(t("level.unobserved"))}</span></p>`;
    const tools = `<div class="cloud-tools">
      <button type="button" data-action="cloud-zoom" data-dir="out"${cloudZoom === 1 ? " disabled" : ""}>Zoom out</button>
      <button type="button" data-action="cloud-zoom" data-dir="in"${cloudZoom === 2 ? " disabled" : ""}>Zoom in</button>
    </div>`;
    const farSkills = A.competencies.map((claim) => {
      const item = field(claim.field);
      const level = levelOf(personRecord.id, claim.id);
      const spot = CLOUD_SPOTS[claim.id];
      const x = (spot[0] / CLOUD_W * 100).toFixed(2);
      const y = (spot[1] / CLOUD_H * 100).toFixed(2);
      return `<button type="button" class="cloud-skill field-${item.id}" data-action="cloud-focus" data-id="${esc(claim.id)}" data-level="${level == null ? 0 : level}" style="--x:${x}%;--y:${y}%;--d:${cloudDiameter(level)};--strength:${cloudStrength(level)}" aria-label="${esc(cloudLabel(claim, item, level))}">
        <span class="cloud-orb" aria-hidden="true"></span>
        <span class="cloud-name">${esc(claim.short)}</span>
      </button>`;
    }).join("");
    const halos = A.fields.map((item) => {
      const group = A.competencies.filter((claim) => claim.field === item.id);
      const cx = group.reduce((sum, claim) => sum + CLOUD_SPOTS[claim.id][0], 0) / group.length;
      const cy = group.reduce((sum, claim) => sum + CLOUD_SPOTS[claim.id][1], 0) / group.length;
      let reach = 0;
      for (const claim of group) {
        const level = levelOf(personRecord.id, claim.id);
        const dist = Math.hypot(CLOUD_SPOTS[claim.id][0] - cx, CLOUD_SPOTS[claim.id][1] - cy) + cloudDiameter(level) / 2;
        if (dist > reach) reach = dist;
      }
      const d = (reach * 2.15 / CLOUD_W * 100).toFixed(2);
      return `<span class="cloud-halo field-${item.id}" style="--x:${(cx / CLOUD_W * 100).toFixed(2)}%;--y:${(cy / CLOUD_H * 100).toFixed(2)}%;--d:${d}%" aria-hidden="true"></span>`;
    }).join("");
    const near = A.fields.map((item) => {
      const cards = A.competencies.filter((claim) => claim.field === item.id).map((claim) => {
        const level = levelOf(personRecord.id, claim.id);
        const open = cloudFocus === claim.id;
        const detail = open
          ? `<p>${esc(claim.claim)}</p><p class="meta">${esc(stagePointsSentence(level))}</p><p><a href="#fields/${esc(claim.id)}">Open ${esc(claim.name)}</a></p>`
          : "";
        return `<article class="cloud-card${open ? " is-open" : ""}" id="cloud-${esc(claim.id)}">
          <button type="button" class="cloud-pick field-${item.id}" data-action="cloud-focus" data-id="${esc(claim.id)}" data-level="${level == null ? 0 : level}" aria-pressed="${open}" style="--level:${level == null ? 0 : level};--strength:${cloudStrength(level)}" aria-label="${esc(cloudLabel(claim, item, level))}">
            <span class="cloud-orb" aria-hidden="true"></span>
            <span class="cloud-copy"><strong>${esc(claim.name)}</strong><span class="cloud-level">${esc(levelLabel(level))}</span></span>
          </button>
          ${detail}
        </article>`;
      }).join("");
      return `<section class="cloud-field field-${item.id}"><h4>${esc(item.name)}</h4><div class="cloud-cards">${cards}</div></section>`;
    }).join("");
    const view = cloudZoom === 1
      ? `<div class="cloud-stage" role="group" aria-label="Skill cloud">${halos}${farSkills}</div>`
      : `<div class="cloud-near">${near}</div>`;
    return `<section class="skill-cloud" data-zoom="${cloudZoom}" aria-labelledby="cloud-title">
      <div class="cloud-head">
        <h3 class="section-title" id="cloud-title">${esc(title)}</h3>
        ${tools}
      </div>
      <p class="muted">Each color is a field. A deeper color is a further stage. An open ring means there is no evidence yet, and that is not a low score. Zoom in to read the stage and what the skill is asking for.</p>
      ${view}
      ${legend}
    </section>`;
  }

  function offerDiameter(points) {
    return [34, 50, 66, 80, 92][points];
  }

  function offerStrength(points) {
    if (points <= 0) return "0%";
    return ["0%", "48%", "66%", "84%", "100%"][points];
  }

  function stillOpenSentence(personRecord, claim, noun) {
    const level = levelOf(personRecord.id, claim.id);
    const points = pointsStillOpen(personRecord.id, claim.id);
    const line = state.role === "student" ? "your line" : `${firstName(personRecord)}’s line`;
    if (points === 0) {
      return `${claim.name} is already advanced, 4 points on ${line}. The work can still be scored, and the line does not rise.`;
    }
    if (level == null) {
      return `${claim.name} has no evidence yet. That is not a low score. This ${noun} can place up to 4 points on ${line}.`;
    }
    const rise = points === 1 ? "1 point" : `${points} points`;
    return `${claim.name} is ${levelLabel(level).toLowerCase()}, ${pointsLabel(level)} on ${line}. This ${noun} can raise it by up to ${rise}.`;
  }

  function offerSkillCloud(workItem, personRecord, noun) {
    const ids = workItem.elicits.filter((id) => competency(id));
    if (!ids.length) return "";
    const total = ids.reduce((sum, id) => sum + pointsStillOpen(personRecord.id, id), 0);
    const who = state.role === "student" ? "your lines" : `${firstName(personRecord)}’s lines`;
    const ceiling = total === 0
      ? `Nothing further can rise on ${who}. Each of these lines is already advanced.`
      : total === 1
        ? `Up to 1 point can still rise on ${who}.`
        : `Up to ${total} points can still rise on ${who}.`;
    const focusId = offerCloudFocus.parentId === workItem.id && ids.includes(offerCloudFocus.skillId)
      ? offerCloudFocus.skillId
      : "";
    const focusClaim = focusId ? competency(focusId) : null;
    const shown = new Set(ids);
    const skills = ids.map((id) => {
      const claim = competency(id);
      const item = field(claim.field);
      const points = pointsStillOpen(personRecord.id, id);
      const spot = CLOUD_SPOTS[id];
      const x = (spot[0] / CLOUD_W * 100).toFixed(2);
      const y = (spot[1] / CLOUD_H * 100).toFixed(2);
      const classes = ["cloud-skill", "field-" + item.id, points === 0 ? "is-spent" : "", points >= 3 ? "is-strong" : ""].filter(Boolean).join(" ");
      const room = points === 0 ? "no points left on the line" : points === 1 ? "up to 1 point still available" : `up to ${points} points still available`;
      return `<button type="button" class="${classes}" data-action="offer-cloud" data-parent="${esc(workItem.id)}" data-id="${esc(id)}" data-points="${points}" aria-pressed="${id === focusId}" style="--x:${x}%;--y:${y}%;--d:${offerDiameter(points)};--strength:${offerStrength(points)}" aria-label="${esc(claim.name + ", " + item.name + ", " + room)}">
        <span class="cloud-orb" aria-hidden="true"><span class="cloud-points">${points}</span></span>
        <span class="cloud-name">${esc(claim.short)}</span>
      </button>`;
    }).join("");
    const halos = A.fields.map((item) => {
      const group = A.competencies.filter((claim) => claim.field === item.id && shown.has(claim.id));
      if (!group.length) return "";
      const cx = group.reduce((sum, claim) => sum + CLOUD_SPOTS[claim.id][0], 0) / group.length;
      const cy = group.reduce((sum, claim) => sum + CLOUD_SPOTS[claim.id][1], 0) / group.length;
      let reach = 0;
      for (const claim of group) {
        const dist = Math.hypot(CLOUD_SPOTS[claim.id][0] - cx, CLOUD_SPOTS[claim.id][1] - cy) + offerDiameter(pointsStillOpen(personRecord.id, claim.id)) / 2;
        if (dist > reach) reach = dist;
      }
      const d = (reach * 2.15 / CLOUD_W * 100).toFixed(2);
      return `<span class="cloud-halo field-${item.id}" style="--x:${(cx / CLOUD_W * 100).toFixed(2)}%;--y:${(cy / CLOUD_H * 100).toFixed(2)}%;--d:${d}%" aria-hidden="true"></span>`;
    }).join("");
    const reading = focusClaim
      ? `<div class="cloud-read" id="offer-cloud-read-${esc(workItem.id)}"><p>${esc(stillOpenSentence(personRecord, focusClaim, noun))}</p><p><a href="#fields/${esc(focusClaim.id)}">Open ${esc(focusClaim.name)}</a></p></div>`
      : `<p class="cloud-read" id="offer-cloud-read-${esc(workItem.id)}">Choose a skill to see how many points the work can still add.</p>`;
    const legend = `<p class="legend">${A.fields.filter((item) => A.competencies.some((claim) => claim.field === item.id && shown.has(claim.id))).map((item) => `<span class="field-${item.id}"><i></i>${esc(item.short)}</span>`).join("")}<span class="cloud-spent-key"><i></i>No points left on this line</span></p>`;
    return `<section class="skill-cloud offer-skill-cloud" data-offer-cloud="${esc(workItem.id)}" aria-labelledby="offer-cloud-title-${esc(workItem.id)}">
      <h3 class="section-title" id="offer-cloud-title-${esc(workItem.id)}">Skills this ${esc(noun)} can mark</h3>
      <p class="muted">A larger, deeper mark means more points the work can still add on that line, up to 4. ${esc(ceiling)} The line keeps the furthest stage, so a skill already at advanced stays small.</p>
      <div class="cloud-stage" role="group" aria-label="Skills this ${esc(noun)} can still mark">${halos}${skills}</div>
      ${reading}
      ${legend}
    </section>`;
  }

  function sparkSVG(series) {
    if (!series.steps.length) return "";
    const width = 160;
    const height = 42;
    const pad = 3;
    const domain = chartDomain(series.steps);
    const yAt = (points) => pad + (1 - points / series.ceiling) * (height - pad * 2);
    const y0 = yAt(0);
    const xs = placeXs(series.steps, domain, pad, width - pad, 18);
    const pts = stepPoints(series.steps.map((step) => step.total), xs, yAt, pad, width - pad);
    const last = series.steps[series.steps.length - 1];
    const dot = `${xs[xs.length - 1].toFixed(1)},${yAt(last.total).toFixed(1)}`;
    return `<svg class="spark" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
      <path class="spark-area" d="${pathFrom(pts, { y0 })}"></path>
      <path class="spark-line" d="${pathFrom(pts)}"></path>
      <circle cx="${dot.split(",")[0]}" cy="${dot.split(",")[1]}" r="2.4"></circle>
    </svg>`;
  }

  function joinBits(bits) {
    if (bits.length <= 1) return bits.join("");
    if (bits.length === 2) return `${bits[0]} and ${bits[1]}`;
    return `${bits.slice(0, -1).join(", ")}, and ${bits[bits.length - 1]}`;
  }

  function partLabel(part, homeSkillId) {
    if (part.skillId === homeSkillId) return part.name;
    return `${part.name} in ${competency(part.skillId).name}`;
  }

  function partFocusId(fieldId) {
    const skills = A.competencies.filter((claim) => claim.field === fieldId);
    const shown = new Set();
    for (const skill of skills) {
      for (const part of skill.parts) {
        shown.add(part.id);
        for (const id of part.needs || []) shown.add(id);
      }
    }
    if (shown.has(skillGraphId)) return skillGraphId;
    const claim = competency(state.competencyId);
    if (claim && claim.field === fieldId && claim.parts[0]) return claim.parts[0].id;
    return skills[0].parts[0].id;
  }

  function partReading(personRecord, part) {
    const skill = competency(part.skillId);
    const level = levelOf(personRecord.id, skill.id);
    const stage = level == null
      ? `${skill.name} has no evidence yet.`
      : `${skill.name} is ${levelLabel(level).toLowerCase()} (${pointsLabel(level)}).`;
    const prior = (part.needs || []).map(partById).filter(Boolean);
    const later = allParts().filter((item) => (item.needs || []).includes(part.id));
    const bits = [];
    if (prior.length) bits.push(`It rests on ${joinBits(prior.map((item) => partLabel(item, part.skillId)))}.`);
    else bits.push(`It is where ${skill.name} starts.`);
    if (later.length) bits.push(`${joinBits(later.map((item) => partLabel(item, part.skillId)))} ${later.length === 1 ? "rests" : "rest"} on it.`);
    return `${part.name} is a part of ${skill.name}. ${part.about} ${bits.join(" ")} ${stage} The mark stays on ${skill.name}. These parts are not separate scores.`;
  }

  function skillGraph(personRecord, fieldItem) {
    const skills = A.competencies.filter((claim) => claim.field === fieldItem.id);
    const focusId = partFocusId(fieldItem.id);
    const focus = partById(focusId);
    const rows = skills.map((skill) => {
      const level = levelOf(personRecord.id, skill.id);
      const stage = level == null ? "No evidence yet" : `${levelLabel(level)} · ${level}`;
      const steps = skill.parts.map((raw) => {
        const part = partById(raw.id);
        const outside = (part.needs || [])
          .map(partById)
          .filter((item) => item && item.skillId !== skill.id);
        const prior = (part.needs || []).map(partById).filter(Boolean);
        const note = prior.length
          ? `Rests on ${joinBits(prior.map((item) => partLabel(item, skill.id)))}`
          : "Starts this skill";
        const outs = outside.map((item) => {
          const on = item.id === focusId;
          const area = field(item.fieldId);
          return `<button type="button" class="part-card is-outside field-${item.fieldId}${on ? " is-selected" : ""}" id="part-${esc(item.id)}" data-action="skill-graph" data-id="${esc(item.id)}" aria-pressed="${on}">
            <b>${esc(item.name)}</b>
            <span>${esc(competency(item.skillId).name)} · ${esc(area.short)}</span>
          </button>`;
        }).join("");
        const on = part.id === focusId;
        return `<li class="part-step">
          ${outs ? `<div class="part-outs">${outs}</div>` : ""}
          <button type="button" class="part-card field-${skill.field}${on ? " is-selected" : ""}" id="part-${esc(part.id)}" data-action="skill-graph" data-id="${esc(part.id)}" aria-pressed="${on}">
            <b>${esc(part.name)}</b>
            <span>${esc(note)}</span>
          </button>
        </li>`;
      }).join("");
      return `<div class="part-row field-${skill.field}">
        <h4>${esc(skill.name)} <span>${esc(stage)}</span></h4>
        <ol class="part-chain" aria-label="${esc("Parts of " + skill.name + ", in order")}">${steps}</ol>
      </div>`;
    }).join("");
    const whose = state.role === "student"
      ? "The stage beside each skill is yours."
      : `The stage beside each skill is ${firstName(personRecord)}’s.`;
    const lede = `Inside a skill, the parts come in order. You meet basic calculus before derivatives, and derivatives before integrals. A dashed card is a part from another field. ${whose} The mark stays on the skill. The parts are not separate scores.`;
    const linkSkill = competency(focus.skillId);
    const link = focus.fieldId === fieldItem.id
      ? `<a href="#fields/${esc(linkSkill.id)}">Open ${esc(linkSkill.name)}</a>`
      : `<a href="#fields/${esc(focus.id)}">Open ${esc(focus.name)} in ${esc(linkSkill.name)}</a>`;
    return `<section class="skill-graph field-${fieldItem.id}" id="skill-graph" aria-labelledby="skill-graph-title">
      <h3 id="skill-graph-title">The order inside each skill</h3>
      <p class="muted">${esc(lede)}</p>
      ${rows}
      <div class="cloud-read" id="skill-graph-read">
        <p>${esc(partReading(personRecord, focus))}</p>
        <p>${link}</p>
      </div>
    </section>`;
  }

  function fieldMarkReading(fieldItem, series, step) {
    const moved = step.moved.map((id) => {
      const claim = competency(id);
      return `${claim.name} to ${levelLabel(step.levels[id]).toLowerCase()} (${pointsLabel(step.levels[id])})`;
    });
    const rise = moved.length
      ? `It raised ${moved.join(", ")}.`
      : "It did not raise a skill in this field.";
    const standing = series.skills.map((claim) => {
      const level = step.levels[claim.id];
      if (!level) return `${claim.name} still has no evidence`;
      return `${claim.name} ${pointsLabel(level)}`;
    }).join(", ");
    return `${formatDate(step.date)}, ${step.title}. ${fieldItem.name} stands at ${pointsLabel(step.total)}. ${rise} After this work: ${standing}.`;
  }

  function fieldChart(personRecord, fieldItem) {
    const series = fieldSeries(personRecord.id, fieldItem.id);
    if (!series.steps.length) {
      return `<section class="field-chart field-${fieldItem.id}" aria-labelledby="field-chart-title">
        <h3 id="field-chart-title">Points over time</h3>
        <p class="empty">No scored work in ${esc(fieldItem.name)} yet. That is not 0 points. The line starts when a work product is scored.</p>
      </section>`;
    }
    const last = series.steps[series.steps.length - 1];
    const chosen = series.steps.find((step) => step.id === fieldMarkId) || last;
    const whose = state.role === "student"
      ? "These steps are your scored work in this field."
      : `These steps are ${firstName(personRecord)}’s scored work in this field.`;
    const width = 640;
    const height = 200;
    const padL = 12;
    const padR = 16;
    const padT = 14;
    const padB = 12;
    const domain = chartDomain(series.steps);
    const yAt = (points) => padT + (1 - points / series.ceiling) * (height - padT - padB);
    const y0 = yAt(0);
    const xs = placeXs(series.steps, domain, padL, width - padR, 56);
    const pts = stepPoints(series.steps.map((step) => step.total), xs, yAt, padL, width - padR);
    const bands = [];
    for (let points = 0; points <= series.ceiling; points += 4) bands.push(points);
    const grid = bands.map((points) => {
      const y = yAt(points).toFixed(1);
      return `<line class="chart-grid" x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}"></line>`;
    }).join("");
    const dots = series.steps.map((step, index) => {
      const on = step.id === chosen.id;
      const label = `${formatDate(step.date)}, ${step.title}, ${pointsLabel(step.total)} in ${fieldItem.name}`;
      const x = xs[index].toFixed(1);
      const y = yAt(step.total).toFixed(1);
      return `<g class="field-dot" data-action="field-mark" data-id="${esc(step.id)}" tabindex="0" role="button" aria-pressed="${on}" aria-label="${esc(label)}">
        <circle class="hit" cx="${x}" cy="${y}" r="16"></circle>
        <circle class="mark" cx="${x}" cy="${y}" r="${on ? 6.5 : 5}"></circle>
      </g>`;
    }).join("");
    const rows = series.steps.map((step) => {
      const on = step.id === chosen.id;
      return `<li>
        <button type="button" data-action="field-mark" data-id="${esc(step.id)}" aria-pressed="${on}">
          <b>${step.total}<span class="vh"> points</span></b>
          <span><strong>${esc(step.title)}</strong> · ${esc(formatDate(step.date))}</span>
        </button>
      </li>`;
    }).join("");
    const rule = `The line adds the furthest stage on each skill in ${fieldItem.name}. A stage is 1 to 4 points. A skill with no evidence adds nothing, and a later mark does not stack on a stage already reached. ${series.ceiling} is every skill at advanced. The line holds to ${formatDate(A.today)}.`;
    return `<section class="field-chart field-${fieldItem.id}" aria-labelledby="field-chart-title">
      <h3 id="field-chart-title">Points over time</h3>
      <p class="chart-total"><b>${last.total}</b> <span>of ${series.ceiling} points in ${esc(fieldItem.name)}</span></p>
      <p class="muted">${esc(whose)} ${esc(rule)}</p>
      <div class="chart-scroll">
        <svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(fieldItem.name + " points over time")}">
          ${grid}
          <path class="chart-area" d="${pathFrom(pts, { y0 })}"></path>
          <path class="chart-line" d="${pathFrom(pts)}"></path>
          ${dots}
        </svg>
      </div>
      <p class="chart-when"><span>${esc(formatDate(series.steps[0].date))}</span><span>${esc(formatDate(A.today))}</span></p>
      <ol class="field-steps">${rows}</ol>
      <p class="cloud-read" id="field-mark-read">${esc(fieldMarkReading(fieldItem, series, chosen))}</p>
    </section>`;
  }

  function learnCard(item, personRecord) {
    const bundle = fieldBundle(item.id);
    const skills = bundle.skills.map((claim) => claim.short).join(", ");
    const series = fieldSeries(personRecord.id, item.id);
    const last = series.steps.length ? series.steps[series.steps.length - 1].total : null;
    const points = last == null ? "No scored work yet" : pointsLabel(last);
    return `<a class="card field-card field-${item.id}" href="#fields/${item.id}">
      <p class="eyebrow">Field</p>
      <h3>${esc(item.name)}</h3>
      <p>${esc(item.blurb)}</p>
      <p class="meta">${esc(skills)}</p>
      <p class="meta">${esc(points)}</p>
      ${sparkSVG(series)}
    </a>`;
  }

  function offerCard(item) {
    const parent = sessionParent(item);
    const title = sessionTitle(item);
    const href = item.kind === "workshop" ? `#workshops/${item.ref}` : `#projects/${item.ref}`;
    const summary = parent && parent.summary ? parent.summary : sessionBlurb(item);
    const mine = rosterOf(item).includes(current().id);
    const yours = mine
      ? (state.role === "student" ? "You have a place." : `${firstName(current())} has a place.`)
      : placesOpen(item);
    return `<article class="offer" id="${esc(item.id)}">
      <div>
        <h3><a href="${esc(href)}">${esc(title)}</a></h3>
        <p>${esc(summary)}</p>
      </div>
      <p class="meta">${esc(formatDate(item.date))} · ${esc(item.start)}–${esc(item.end)} · ${esc(item.place)}<br>${esc(yours)}</p>
      ${registerButtons(item)}
    </article>`;
  }

  function assistantUsesCaseload() {
    return state.role === "mentor" || state.role === "director";
  }

  function assistantAllowed() {
    if (state.role === "student") return state.route === "dashboard";
    if (assistantUsesCaseload()) return state.route === "dashboard" || state.route === "cohort";
    return false;
  }

  function assistantScope() {
    if (state.role === "mentor") return "caseload:" + state.mentorId;
    if (state.role === "director") return "caseload:director";
    return current().id;
  }

  function caseloadPeople() {
    if (state.role === "mentor") return A.students.filter((item) => item.mentorId === state.mentorId);
    if (state.role === "director") return A.students.slice();
    return [];
  }

  function coachingWhy(personRecord) {
    const name = firstName(personRecord);
    const flag = attention(personRecord);
    if (flag.id === "challenge") return t("coach.why.challenge", { name });
    if (flag.id === "stale") {
      const last = lastEvidenceItem(personRecord.id);
      return t("coach.why.stale", { name, date: last ? formatDate(last.date) : "", days: last ? daysSince(last.date) : "" });
    }
    if (flag.id === "intake") return t("coach.why.intake", { name });
    if (flag.id === "workshops") {
      const list = Object.entries(personRecord.workshops || {})
        .filter(([, status]) => status !== "done")
        .map(([id]) => workshop(id) && workshop(id).name)
        .filter(Boolean)
        .join(", ");
      return t("coach.why.workshops", { name, list });
    }
    const short = A.floorIds
      .filter((id) => (levelOf(personRecord.id, id) ?? 0) < A.gate)
      .map((id) => `${competency(id).name} ${levelLabel(levelOf(personRecord.id, id)).toLowerCase()}`);
    if (short.length) return t("coach.why.floor", { name, list: short.join("; ") });
    return t("coach.why.steady", { name, flag: flag.label.toLowerCase() });
  }

  function caseloadSnapshot(people) {
    const rows = (people || caseloadPeople()).slice().sort((a, b) => {
      const diff = (COACH_RANK[attention(a).id] ?? 8) - (COACH_RANK[attention(b).id] ?? 8);
      if (diff) return diff;
      return (floorPoints(a) - floorPoints(b)) || a.name.localeCompare(b.name);
    });
    const students = rows.map((personRecord) => {
      const last = lastEvidenceItem(personRecord.id);
      const flag = attention(personRecord);
      const recommended = personRecord.recommendedProjectId && project(personRecord.recommendedProjectId);
      return {
        name: firstName(personRecord),
        ageYears: Math.round(ageExact(personRecord) * 10) / 10,
        attention: flag.label,
        attentionId: flag.id,
        sharedPoints: floorPoints(personRecord),
        totalPoints: linePoints(personRecord),
        lastEvidence: last ? `${last.title} · ${formatDate(last.date)}` : "",
        daysSinceEvidence: last ? daysSince(last.date) : null,
        workshopsOpen: Object.entries(personRecord.workshops || {})
          .filter(([, status]) => status !== "done")
          .map(([id]) => workshop(id) && workshop(id).name)
          .filter(Boolean),
        projects: (personRecord.projectIds || []).map((id) => project(id) && project(id).name).filter(Boolean),
        recommendedProject: recommended ? recommended.name : "",
        scaffold: personRecord.scaffold || "",
        sharedShort: A.floorIds
          .filter((id) => (levelOf(personRecord.id, id) ?? 0) < A.gate)
          .map((id) => `${competency(id).name} ${levelLabel(levelOf(personRecord.id, id)).toLowerCase()}`),
        nextSitting: nextSittingLine(personRecord),
        why: coachingWhy(personRecord),
      };
    });
    return {
      lang: state.lang === "fr" ? "fr" : "en",
      today: A.today,
      role: state.role === "director" ? "director" : "mentor",
      viewer: state.role === "director" ? person("ortega").name : person(state.mentorId).name,
      students,
      toCoach: students
        .filter((row) => row.attentionId !== "ready" && row.attentionId !== "endorsed")
        .map((row) => ({ name: row.name, why: row.why, attentionId: row.attentionId })),
    };
  }

  function assistantMood(studentId) {
    const saved = state.moods && state.moods[studentId];
    return ASSISTANT_MOODS.some((item) => item.id === saved) ? saved : "steady";
  }

  function assistantThread(scope) {
    const rows = state.assistant && state.assistant[scope];
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => row && (row.role === "user" || row.role === "assistant" || row.role === "note") && typeof row.text === "string");
  }

  function skillProgress(personRecord, claim) {
    const level = levelOf(personRecord.id, claim.id);
    return {
      id: claim.id,
      name: claim.name,
      field: field(claim.field).name,
      stage: level == null ? "no evidence yet" : levelLabel(level),
      room: pointsStillOpen(personRecord.id, claim.id),
      level: level == null ? -1 : level,
      floor: A.floorIds.includes(claim.id),
    };
  }

  function skillWhy(row) {
    if (row.floor && row.level < A.gate) return t("why.floorShort");
    if (row.level < 0) return t("why.noEvidence");
    if (row.level < A.gate) return t("why.startedShort");
    return t("why.roomLeft");
  }

  function sittingForSkill(personRecord, skillId) {
    const rows = allSessions()
      .filter((item) => sittingOpen(item) && item.kind !== "lecture")
      .sort(compareSittings);
    const elicits = (item) => {
      const parent = sessionParent(item);
      return !!(parent && Array.isArray(parent.elicits) && parent.elicits.includes(skillId));
    };
    const mine = rows.find((item) => elicits(item) && rosterOf(item).includes(personRecord.id));
    const openSeat = rows.find((item) => elicits(item) && !rosterOf(item).includes(personRecord.id) && rosterOf(item).length < item.capacity);
    const pick = mine || openSeat;
    return pick ? `${sessionTitle(pick)} on ${formatDate(pick.date)}` : "";
  }

  function skillsToLearn(personRecord) {
    const rows = A.competencies.map((claim) => skillProgress(personRecord, claim));
    const byLevel = (a, b) => a.level - b.level || a.name.localeCompare(b.name);
    const chosen = [];
    const floorOpen = rows
      .filter((row) => row.floor && row.level < A.gate)
      .sort((a, b) => a.level - b.level || A.floorIds.indexOf(a.id) - A.floorIds.indexOf(b.id));
    chosen.push(...floorOpen);
    const started = rows.filter((row) => !row.floor && row.level >= 0 && row.level < A.gate).sort(byLevel);
    for (const row of started) {
      if (chosen.length >= 6) break;
      chosen.push(row);
    }
    if (!chosen.length) {
      const stretch = rows.filter((row) => row.level >= A.gate && row.room > 0).sort(byLevel);
      chosen.push(...stretch.slice(0, 3));
    }
    if (!chosen.length) {
      chosen.push(...rows.filter((row) => row.level < 0).sort(byLevel).slice(0, 4));
    }
    return chosen.slice(0, 6).map((row) => {
      const item = {
        name: row.name,
        field: row.field,
        stage: row.stage,
        room: row.room,
        why: skillWhy(row),
      };
      const where = sittingForSkill(personRecord, row.id);
      if (where) item.where = where;
      return item;
    });
  }

  function assistantSnapshot(personRecord) {
    const agenda = allSessions()
      .filter((item) => sittingOpen(item) && rosterOf(item).includes(personRecord.id))
      .sort(compareSittings)
      .slice(0, 8)
      .map((item) => ({
        date: item.date,
        weekday: weekdayName(item.date),
        start: item.start,
        end: item.end,
        kind: item.kind,
        title: sessionTitle(item),
        place: item.place,
        points: agendaPoints(item),
      }));
    const open = allSessions()
      .filter((item) => sittingOpen(item) && item.kind !== "lecture" && !rosterOf(item).includes(personRecord.id))
      .sort(compareSittings)
      .slice(0, 8)
      .map((item) => {
        const parent = sessionParent(item);
        return {
          date: item.date,
          weekday: weekdayName(item.date),
          start: item.start,
          end: item.end,
          kind: item.kind,
          title: sessionTitle(item),
          place: item.place,
          points: agendaPoints(item),
          places: placesOpen(item),
          skills: parent && parent.elicits ? parent.elicits.map((id) => competency(id).name) : [],
        };
      });
    const skills = A.competencies.map((claim) => {
      const level = levelOf(personRecord.id, claim.id);
      const parts = (claim.parts || []).map((part) => ({
        name: part.name,
        restsOn: (part.needs || []).map((id) => {
          const prior = partById(id);
          if (!prior) return "";
          if (prior.skillId === claim.id) return prior.name;
          return prior.name + " in " + competency(prior.skillId).name;
        }).filter(Boolean),
      }));
      const row = {
        name: claim.name,
        field: field(claim.field).name,
        stage: level == null ? "no evidence yet" : levelLabel(level),
        room: pointsStillOpen(personRecord.id, claim.id),
        parts,
      };
      if (level != null) row.points = level;
      return row;
    });
    const tasks = [];
    const works = A.projects.concat(A.workshops).slice().sort((a, b) => taskRank(a, personRecord) - taskRank(b, personRecord));
    for (const work of works) {
      for (const activity of work.activities || []) {
        const openRoom = (activity.competencyIds || []).filter((id) => competency(id) && pointsStillOpen(personRecord.id, id) > 0);
        if (!openRoom.length) continue;
        tasks.push({
          name: activity.name,
          kind: activity.kind,
          where: work.name,
          skills: openRoom.map((id) => competency(id).name),
        });
      }
    }
    const recommended = personRecord.recommendedProjectId && project(personRecord.recommendedProjectId);
    return {
      lang: state.lang === "fr" ? "fr" : "en",
      name: firstName(personRecord),
      today: A.today,
      projects: (personRecord.projectIds || []).map((id) => project(id) && project(id).name).filter(Boolean),
      recommendedProject: recommended ? recommended.name : "",
      agenda,
      open,
      skills,
      toLearn: skillsToLearn(personRecord),
      tasks: tasks.slice(0, 12),
    };
  }

  function taskRank(work, personRecord) {
    if ((personRecord.projectIds || []).includes(work.id)) return 0;
    const sitting = allSessions().find((item) => item.ref === work.id && sittingOpen(item));
    if (sitting && rosterOf(sitting).includes(personRecord.id)) return 1;
    if (sitting) return 2;
    return 3;
  }

  function rememberAssistantDraft() {
    const draftBox = document.getElementById("assistant-q");
    if (draftBox) assistantDraft = draftBox.value;
  }

  function pushAssistant(scope, row) {
    const next = assistantThread(scope).concat([row]).slice(-12);
    state.assistant[scope] = next;
  }

  function askAssistant(text) {
    if (!assistantAllowed() || assistantBusy) return;
    const question = String(text || "").trim().slice(0, 600);
    if (!question) {
      assistantNotice = t(assistantUsesCaseload() ? "coach.empty" : "assistant.empty");
      const status = document.getElementById("assistant-status");
      if (status) status.textContent = assistantNotice;
      const input = document.getElementById("assistant-q");
      if (input) input.focus();
      return;
    }
    const scope = assistantScope();
    const caseload = assistantUsesCaseload();
    normalizeAssistantState();
    pushAssistant(scope, { role: "user", text: question });
    assistantDraft = "";
    const draftBox = document.getElementById("assistant-q");
    if (draftBox) draftBox.value = "";
    assistantNotice = "";
    assistantBusy = true;
    assistantBusyFor = scope;
    const token = ++assistantToken;
    const payload = {
      kind: caseload ? "caseload" : "student",
      messages: assistantThread(scope)
        .filter((row) => row.role === "user" || row.role === "assistant")
        .slice(-8)
        .map((row) => ({ role: row.role, content: row.text })),
      snapshot: caseload ? caseloadSnapshot() : assistantSnapshot(current()),
    };
    if (!caseload) payload.mood = assistantMood(current().id);
    persist();
    render();
    const log = document.getElementById("assistant-log");
    if (log) log.scrollTop = log.scrollHeight;
    fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (response) => {
      let data = {};
      try { data = await response.json(); } catch (err) { data = {}; }
      if (!response.ok) {
        const fallback = response.status === 404
          ? "The assistant runs with the atelier server. From the project folder, run node server.js and open the address it prints."
          : "The assistant could not answer just now.";
        throw new Error(data.error || fallback);
      }
      if (!data.reply) throw new Error("The assistant sent an empty reply.");
      return String(data.reply);
    }).then((reply) => {
      if (token !== assistantToken) return;
      pushAssistant(scope, { role: "assistant", text: reply.slice(0, 2000) });
    }).catch((err) => {
      if (token !== assistantToken) return;
      const message = err && err.message === "Failed to fetch"
        ? "The assistant runs with the atelier server. From the project folder, run node server.js and open the address it prints."
        : (err && err.message) || "The assistant could not answer just now.";
      pushAssistant(scope, { role: "note", text: message });
    }).finally(() => {
      if (token !== assistantToken) return;
      assistantBusy = false;
      assistantBusyFor = "";
      persist();
      render();
      if (!assistantOpen) return;
      const log = document.getElementById("assistant-log");
      if (log) log.scrollTop = log.scrollHeight;
      const input = document.getElementById("assistant-q");
      if (input) input.focus({ preventScroll: true });
    });
  }

  function clearAssistant() {
    if (!assistantAllowed()) return;
    const scope = assistantScope();
    normalizeAssistantState();
    state.assistant[scope] = [];
    assistantDraft = "";
    const draftBox = document.getElementById("assistant-q");
    if (draftBox) draftBox.value = "";
    assistantNotice = t(assistantUsesCaseload() ? "coach.cleared" : "assistant.cleared");
    if (assistantBusyFor === scope) {
      assistantBusy = false;
      assistantBusyFor = "";
      assistantToken += 1;
    }
    persist();
    render();
    if (!assistantOpen) return;
    const input = document.getElementById("assistant-q");
    if (input) input.focus({ preventScroll: true });
  }

  function assistantHeadSVG() {
    return `<svg viewBox="0 0 88 88" aria-hidden="true" focusable="false">
      <ellipse cx="16" cy="50" rx="6.5" ry="8" fill="#f3d2c6" stroke="#1c1917" stroke-width="1.5"/>
      <path d="M26 28 C20 32 15 40 17 52 C20 68 32 78 48 78 C68 78 80 64 78 48 C76 30 64 20 48 20 C39 20 32 23 26 28Z" fill="#fffaf4" stroke="#1c1917" stroke-width="1.6" stroke-linejoin="round"/>
      <ellipse cx="76" cy="46" rx="5" ry="7" fill="#f6ddd2" stroke="#1c1917" stroke-width="1.4"/>
      <path d="M22 32 C26 14 50 10 64 20 C70 24 68 32 58 31 C44 28 32 34 22 32Z" fill="#2c4578"/>
      <circle cx="63" cy="16" r="3.4" fill="#a3482a"/>
      <path d="M30 24 C27 13 37 12 35 23" fill="none" stroke="#1c1917" stroke-width="1.6" stroke-linecap="round"/>
      <ellipse cx="32" cy="58" rx="5.2" ry="3" fill="#e7b09a"/>
      <ellipse cx="64" cy="55" rx="5" ry="2.8" fill="#e7b09a"/>
      <path d="M24 42 H35" stroke="#1c1917" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M50 34 Q58 29 67 35" fill="none" stroke="#1c1917" stroke-width="1.7" stroke-linecap="round"/>
      <circle cx="30" cy="48" r="2.5" fill="#1c1917"/>
      <g class="assistant-eye">
        <circle cx="58" cy="45" r="6.4" fill="#1c1917"/>
        <circle cx="60.2" cy="42.8" r="1.8" fill="#fffaf4"/>
      </g>
      <circle cx="58" cy="45" r="8.4" fill="none" stroke="#7a3e4a" stroke-width="1.35"/>
      <path d="M66 49 Q73 53 71 57" fill="none" stroke="#7a3e4a" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M30 60 Q46 73 64 59" fill="none" stroke="#1c1917" stroke-width="1.7" stroke-linecap="round"/>
      <rect x="44" y="62" width="4" height="4.4" rx="0.7" fill="#fffaf4" stroke="#1c1917" stroke-width="1"/>
    </svg>`;
  }

  function assistantPanel() {
    const caseload = assistantUsesCaseload();
    const scope = assistantScope();
    const waiting = assistantBusy && assistantBusyFor === scope;
    const prompts = (caseload ? CASELOAD_PROMPTS : ASSISTANT_PROMPTS).map((item) => {
      const label = t((caseload ? "coach.prompt." : "prompt.") + item.id);
      return `<button type="button" data-action="assistant-ask" data-id="${item.id}"${waiting ? " disabled" : ""}>${esc(label)}</button>`;
    }).join("");
    let moods = "";
    if (!caseload) {
      const mood = assistantMood(current().id);
      moods = `<p class="eyebrow" id="mood-label">${esc(t("assistant.mood"))}</p>
        <div class="moods" role="group" aria-labelledby="mood-label">${ASSISTANT_MOODS.map((item) =>
          `<button type="button" data-action="assistant-mood" data-id="${item.id}" aria-pressed="${item.id === mood}">${esc(t("mood." + item.id))}</button>`
        ).join("")}</div>`;
    }
    const rows = assistantThread(scope);
    let log = "";
    if (!rows.length && !waiting) {
      log = `<p class="empty">${esc(t(caseload ? "coach.empty" : "assistant.logEmpty"))}</p>`;
    } else {
      log = rows.map((row) => {
        const kind = row.role === "user" ? "you" : row.role === "note" ? "note" : "atelier";
        const label = row.role === "user" ? t("assistant.you") : t("assistant.atelier");
        return `<p class="assistant-turn" data-who="${kind}"><b>${esc(label)}</b>${esc(row.text)}</p>`;
      }).join("");
      if (waiting) log += `<p class="assistant-wait">${esc(t(caseload ? "coach.looking" : "assistant.wait"))}</p>`;
    }
    const status = waiting ? "" : assistantNotice;
    const title = t(caseload ? "coach.title" : "assistant.title");
    return `<section class="assistant" id="assistant" role="dialog" aria-labelledby="assistant-title" tabindex="-1"${assistantOpen ? "" : " hidden"}>
      <div class="assistant-top">
        <div>
          <p class="eyebrow">${esc(title)}</p>
          <h3 id="assistant-title">${esc(title)}</h3>
        </div>
        <button type="button" class="assistant-close" data-action="assistant-close">${esc(t("assistant.close"))}</button>
      </div>
      <div class="assistant-scroll">
        <p>${esc(t(caseload ? "coach.intro" : "assistant.intro"))}</p>
        ${moods}
        <div class="assistant-prompts">${prompts}</div>
        <p class="muted">${esc(t(caseload ? "coach.hint" : "assistant.hint"))}</p>
        <div class="assistant-log" id="assistant-log" aria-live="polite">${log}</div>
      </div>
      <form class="stack-form" data-form="assistant">
        <label for="assistant-q">${esc(t(caseload ? "coach.ask" : "assistant.ask"))}</label>
        <textarea id="assistant-q" name="q" maxlength="600">${esc(assistantDraft)}</textarea>
        <div class="action-row">
          <button type="submit" class="primary"${waiting ? " disabled" : ""}>${waiting ? esc(t("assistant.looking")) : esc(t("assistant.send"))}</button>
          <button type="button" class="quiet" data-action="assistant-clear">${esc(t("assistant.clear"))}</button>
        </div>
      </form>
      <p id="assistant-status" class="muted" role="status">${esc(status)}</p>
    </section>`;
  }

  function assistantDock() {
    const openLabel = assistantOpen ? t("assistant.close") : t("assistant.open");
    return `<div class="assistant-dock">
      ${assistantPanel()}
      <button type="button" class="assistant-head" data-action="assistant-toggle" aria-expanded="${assistantOpen ? "true" : "false"}" aria-controls="assistant" aria-haspopup="dialog" aria-label="${openLabel}">
        ${assistantOpen ? "" : `<span class="assistant-psst" aria-hidden="true">${esc(t("assistant.psst"))}</span>`}
        ${assistantHeadSVG()}
      </button>
    </div>`;
  }

  function studentDashInner(personRecord, options = {}) {
    const workshops = openSittings("workshop").map(offerCard).join("");
    const projects = openSittings("project").map(offerCard).join("");
    const recordLabel = state.role === "student" ? t("dash.yourRecord") : t("dash.theirRecord", { name: firstName(personRecord) });
    const planTitle = state.role === "student" ? t("dash.yourAgenda") : t("dash.theirAgenda", { name: firstName(personRecord) });
    const planLede = state.role === "student"
      ? t("dash.planLedeYou")
      : t("dash.planLedeThem", { name: firstName(personRecord) });
    return `<header class="page-head">
        <p class="eyebrow">${state.role === "student" ? esc(t("dash.startHere")) : esc(personRecord.name)}</p>
        <h2>${esc(t("dash.h2"))}</h2>
        <p class="lede">${esc(t("dash.lede"))}</p>
      </header>
      ${planNoticeHTML()}
      ${options.assistant ? assistantDock() : ""}
      ${skillCloud(personRecord)}
      <section class="ask" aria-labelledby="learn-title">
        <h3 class="section-title" id="learn-title">${esc(t("dash.learnTitle"))}</h3>
        <p class="muted">${esc(t("dash.learnMuted"))}</p>
        <div class="learn-grid">${A.fields.map((item) => learnCard(field(item.id), personRecord)).join("")}</div>
      </section>
      <section class="ask" aria-labelledby="workshops-title">
        <h3 class="section-title" id="workshops-title">${esc(t("dash.workshopsTitle"))}</h3>
        <p class="muted">${esc(t("dash.workshopsMuted"))} <a href="#workshops">${esc(t("dash.allWorkshops"))}</a></p>
        <div class="offer-list">${workshops || `<p class="empty">${esc(t("dash.noWorkshop", { date: formatDate(A.today) }))}</p>`}</div>
      </section>
      <section class="ask" aria-labelledby="projects-title">
        <h3 class="section-title" id="projects-title">${esc(t("dash.projectsTitle"))}</h3>
        <p class="muted">${esc(t("dash.projectsMuted"))} <a href="#projects">${esc(t("dash.allProjects"))}</a></p>
        <div class="offer-list">${projects || `<p class="empty">${esc(t("dash.noProject", { date: formatDate(A.today) }))}</p>`}</div>
      </section>
      <section class="ask" aria-labelledby="plan-title">
        <h3 class="section-title" id="plan-title">${esc(planTitle)}</h3>
        <p class="muted">${esc(planLede)}</p>
        ${planGlance(personRecord)}
        <p><a href="#plan">${esc(t("dash.seeEvery"))}</a>. ${esc(t("dash.lectureZero"))}</p>
        <p class="muted">${esc(t("dash.recordHasMarks", { record: recordLabel })).replace(recordLabel, `<a href="#panel">${esc(recordLabel)}</a>`)} <a href="#model">${esc(t("dash.howCredit"))}</a>.</p>
      </section>`;
  }

  function menteeCard(personRecord) {
    const points = linePoints(personRecord);
    const last = lastEvidenceItem(personRecord.id);
    const pointsText = points ? `${pointsLabel(points)} on the skill lines.` : "No points on the skill lines yet.";
    const lastText = last ? ` Latest work ${formatDate(last.date)}.` : "";
    return `<article class="card">
      ${flagHTML(personRecord)}
      <h3>${esc(personRecord.name)}</h3>
      <p class="meta">${esc(agePhrase(personRecord))} · ${esc(t("age.shared"))} ${floorPoints(personRecord)} / 16</p>
      <p>${esc(situation(personRecord))}</p>
      <p class="meta">${esc(pointsText + lastText)}</p>
      <p class="meta">${esc(nextSittingLine(personRecord))}</p>
      <p>${esc(recommendation(personRecord))}</p>
      <p><a href="#panel" data-action="open-student" data-id="${personRecord.id}">Open the record</a></p>
    </article>`;
  }

  function mentorDashInner(mentorId, options = {}) {
    const mentor = person(mentorId);
    const mentees = A.students.filter((item) => item.mentorId === mentorId);
    const cards = mentees.map(menteeCard).join("");
    const chart = options.chart === false ? "" : ageChartHTML(mentees.map((item) => item.id));
    return `<section class="dash-block" data-mentor="${esc(mentorId)}">
      <header class="page-head">
        <p class="eyebrow">Mentor dashboard · ${esc(mentor.domain)}</p>
        <h2>${esc(mentor.name)}</h2>
        <p class="lede">${mentees.length === 1 ? "1 student." : `${mentees.length} students.`} Search finds a workshop, a project, or something a student can learn. The questions along the top are the same ones a student starts from.</p>
      </header>
      ${chart}
      <div class="grid-2">${cards || `<p class="empty">No students on this dashboard.</p>`}</div>
    </section>`;
  }

  function renderDashboard() {
    if (state.role === "student") {
      const personRecord = current();
      return `<article class="page" data-page="dashboard" data-student="${personRecord.id}">${studentDashInner(personRecord, { assistant: true })}</article>`;
    }
    if (state.role === "mentor") {
      return `<article class="page" data-page="dashboard">${mentorDashInner(state.mentorId)}${assistantDock()}</article>`;
    }
    const mentors = ["ibarra", "adeyemi", "vogel"].map((id) => mentorDashInner(id, { chart: false })).join("");
    return `<article class="page" data-page="dashboard">
      <header class="page-head">
        <p class="eyebrow">Director · ${esc(person("ortega").name)}</p>
        <h2>The student dashboard and the mentor dashboards.</h2>
        <p class="lede">This unit opens two dashboards. One belongs to the student. One belongs to the mentor. ${esc(person("ortega").name)} reads both. The student’s page starts from what they can learn, which workshops have a place, and which projects are meeting.</p>
      </header>
      ${ageChartHTML(A.students.map((item) => item.id))}
      ${studentDashInner(current())}
      <h3 class="section-title">Mentor dashboards</h3>
      ${mentors}
      <p><a href="#cohort">Open the cohort table</a></p>
      ${assistantDock()}
    </article>`;
  }

  function activeFieldId() {
    if (field(state.param)) return state.param;
    if (state.route === "fields" && partById(state.param)) return partById(state.param).fieldId;
    if (state.route === "fields" && competency(state.param)) return competency(state.param).field;
    if (state.field !== "all" && field(state.field)) return state.field;
    const claim = competency(state.competencyId);
    return claim ? claim.field : A.fields[0].id;
  }

  function renderFields() {
    const personRecord = current();
    const fieldId = activeFieldId();
    const item = field(fieldId);
    const bundle = fieldBundle(fieldId);
    const tabs = A.fields.map((row) => `<a class="field-${row.id}" href="#fields/${row.id}"${row.id === fieldId ? ' aria-current="page"' : ""}>${esc(field(row.id).name)}</a>`).join("");
    const skills = bundle.skills.map((claim) => {
      const level = levelOf(personRecord.id, claim.id);
      return `<article class="card field-${item.id}" id="skill-${claim.id}">
        <h3><button type="button" class="text-btn" data-action="select-competency" data-id="${claim.id}">${esc(claim.name)}</button></h3>
        <p class="level-line">${meter(level, item.id)} <span>${esc(levelLabel(level))}</span></p>
        <p class="meta">${esc(stagePointsSentence(level))}</p>
        <p>${esc(claim.claim)}</p>
      </article>`;
    }).join("");
    const materials = bundle.materials.map((row) => `<li>
      <span>${esc(mediaLabel(row.medium))} · ${esc(row.title)}</span>
      <b>0 points</b>
    </li>`).join("");
    const workshops = bundle.workshops.map((row) => `<li>
      <span><a href="#workshops">${esc(row.name)}</a> · ${esc(row.kind)}</span>
      <b>${esc(offerPhrase(row.elicits))}</b>
    </li>`).join("");
    const projects = bundle.projects.map((row) => `<li>
      <span><a href="#projects/${row.id}">${esc(row.name)}</a></span>
      <b>${esc(offerPhrase(row.elicits))}</b>
    </li>`).join("");
    const lectures = allSessions()
      .filter((row) => row.kind === "lecture" && row.field === item.id)
      .sort(compareSittings)
      .map((row) => `<li>
        <span><a href="#plan">${esc(row.title)}</a> · ${esc(formatDate(row.date))}${sittingOpen(row) ? "" : " · held"}</span>
        <b>0 points</b>
      </li>`).join("");
    return `<article class="page" data-page="fields" data-field="${item.id}" data-student="${personRecord.id}">
      <header class="page-head">
        <p class="eyebrow">Fields · ${esc(personRecord.name)}</p>
        <h2>${esc(item.name)}</h2>
        <p class="lede">${esc(item.blurb)} ${esc(t("fields.levelsAre", { name: firstName(personRecord) }))}</p>
      </header>
      <nav class="field-tabs" aria-label="Fields">${tabs}</nav>
      ${skillGraph(personRecord, item)}
      ${fieldChart(personRecord, item)}
      <p><a href="#map">Open the map of every subject</a></p>
      <h3 class="section-title">${esc(t("fields.skills"))}</h3>
      <div class="grid-2">${skills}</div>
      <h3 class="section-title">${esc(t("fields.materials"))}</h3>
      ${materials ? `<ul class="point-mini">${materials}</ul>` : `<p class="muted">${esc(t("fields.noMaterial"))}</p>`}
      <p><a href="#library" data-action="open-field" data-id="${item.id}" data-route="library">${esc(t("fields.openShelf", { name: item.name }))}</a></p>
      <h3 class="section-title">${esc(t("fields.workshops"))}</h3>
      ${workshops ? `<ul class="point-mini">${workshops}</ul>` : `<p class="muted">${esc(t("fields.noWorkshop"))}</p>`}
      <h3 class="section-title">${esc(t("fields.projects"))}</h3>
      ${projects ? `<ul class="point-mini">${projects}</ul>` : `<p class="muted">${esc(t("fields.noProject"))}</p>`}
      <h3 class="section-title">${esc(t("fields.lectures"))}</h3>
      ${lectures ? `<ul class="point-mini">${lectures}</ul>` : `<p class="muted">${esc(t("fields.noLecture"))}</p>`}
      <p><a href="#plan">${esc(t("fields.openPlan"))}</a>. ${esc(t("dash.lectureZero"))}</p>
    </article>`;
  }

  function page() {
    if (state.route === "dashboard") return renderDashboard();
    if (state.route === "fields") return renderFields();
    if (state.route === "model") return renderModel();
    if (state.route === "panel") return renderPanel();
    if (state.route === "map") return renderMap();
    if (state.route === "projects") return renderProjects();
    if (state.route === "workshops") return renderWorkshops();
    if (state.route === "plan") return renderPlan();
    if (state.route === "activities") return renderActivities();
    if (state.route === "library") return renderLibrary();
    if (state.route === "cohort") return renderCohort();
    if (state.route === "report") return renderReport();
    if (state.route === "search") return renderSearch();
    return renderDashboard();
  }

  function pageTitle() {
    const fieldName = field(activeFieldId());
    const titles = {
      dashboard: state.role === "mentor" ? t("title.mentor") : state.role === "director" ? t("title.dashboards") : t("title.home"),
      search: state.param.trim() ? t("title.searchFor", { q: state.param.trim().slice(0, 40) }) : t("title.search"),
      fields: fieldName ? fieldName.name : t("title.fields"),
      model: t("title.model"),
      panel: current().name,
      map: t("title.map"),
      projects: state.param && project(state.param) ? project(state.param).name : t("title.projects"),
      workshops: t("title.workshops"),
      plan: t("title.plan"),
      activities: t("title.activities"),
      library: t("title.library"),
      cohort: t("title.cohort"),
      report: t("title.report"),
    };
    return titles[state.route] || "Continuum";
  }

  function primaryMark() {
    if (state.route === "report" || state.route === "panel") return "record";
    if (state.route === "plan") return "plan";
    if (state.route === "workshops") return "workshops";
    if (state.route === "projects") return "projects";
    if (["fields", "library", "activities", "map"].includes(state.route)) return "learn";
    return "";
  }

  function navLink(href, label, on) {
    return `<a href="${href}"${on ? ' aria-current="page"' : ""}>${label}</a>`;
  }

  function normSearch(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9'+]+/g, " ")
      .trim();
  }

  function clipText(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= 140) return text;
    return text.slice(0, 137).trim() + "…";
  }

  function sittingWords(kind, ref) {
    return sittingsOf(kind, ref).map((item) => {
      const host = person(item.hostId);
      return [item.date, formatDate(item.date), item.place, item.start, item.end, host ? host.name : ""].join(" ");
    }).join(" ");
  }

  function searchCatalog() {
    const rows = [];
    for (const raw of A.fields) {
      const item = field(raw.id);
      rows.push({
        kind: t("search.kind.Field"),
        title: item.name,
        detail: clipText(item.blurb),
        href: "#fields/" + item.id,
        text: [item.name, item.blurb, raw.name, "field", "learn", "domaine"].join(" "),
      });
    }
    for (const raw of A.competencies) {
      const item = competency(raw.id);
      const area = field(item.field);
      rows.push({
        kind: t("search.kind.Skill"),
        title: item.name,
        detail: clipText(`${area.name}. ${item.claim}`),
        href: "#fields/" + item.id,
        text: [item.name, item.short, item.claim, area.name, raw.name, "skill", "learn", "competence"].join(" "),
      });
      for (const part of item.parts || []) {
        rows.push({
          kind: t("search.kind.Skill"),
          title: part.name,
          detail: clipText(`${item.name}. ${part.about}`),
          href: "#fields/" + part.id,
          text: [part.name, part.about, item.name, item.short, area.name, "part", "skill", "learn"].join(" "),
        });
      }
    }
    for (const raw of A.workshops) {
      const item = workshop(raw.id);
      const activities = (item.activities || []).map((row) => row.name).join(" ");
      rows.push({
        kind: t("search.kind.Workshop"),
        title: item.name,
        detail: clipText(item.summary),
        href: "#workshops/" + item.id,
        text: ["workshop", "atelier", item.name, item.summary, item.detail, item.kind, activities, sittingWords("workshop", item.id), raw.name].join(" "),
      });
    }
    for (const raw of A.projects) {
      const item = project(raw.id);
      const activities = (item.activities || []).map((row) => row.name).join(" ");
      rows.push({
        kind: t("search.kind.Project"),
        title: item.name,
        detail: clipText(item.summary),
        href: "#projects/" + item.id,
        text: ["project", "projet", item.name, item.summary, item.brief, item.place, activities, sittingWords("project", item.id), raw.name].join(" "),
      });
    }
    for (const item of allSessions()) {
      if (item.kind !== "lecture") continue;
      const area = field(item.field);
      rows.push({
        kind: "Lecture",
        title: item.title,
        detail: clipText(`${formatDate(item.date)}${sittingOpen(item) ? "" : ", already held"}. ${item.summary || ""}`),
        href: "#plan/" + item.id,
        text: ["lecture", item.title, item.summary, area ? area.name : "", formatDate(item.date), item.place].join(" "),
      });
    }
    for (const item of allMaterials()) {
      const areas = materialFields(item).map((id) => field(id).name).join(" ");
      rows.push({
        kind: "Material",
        title: item.title,
        detail: clipText(item.summary),
        href: "#library/" + item.id,
        text: ["material", item.title, item.summary, areas, mediaLabel(item.medium)].join(" "),
      });
    }
    return rows;
  }

  function searchHits(query) {
    const words = normSearch(query).split(" ").filter(Boolean);
    if (words.length < 1) return [];
    const kindOrder = { Workshop: 0, Project: 1, Field: 2, Skill: 3, Lecture: 4, Material: 5 };
    const scored = [];
    for (const item of searchCatalog()) {
      const title = normSearch(item.title);
      const text = normSearch(item.text);
      if (!words.every((word) => text.includes(word))) continue;
      const joined = words.join(" ");
      let rank = 3;
      if (title.startsWith(joined)) rank = 0;
      else if (title.includes(joined)) rank = 1;
      else if (words.every((word) => title.includes(word))) rank = 2;
      scored.push({ item, rank });
    }
    scored.sort((a, b) => a.rank - b.rank || kindOrder[a.item.kind] - kindOrder[b.item.kind] || a.item.title.localeCompare(b.item.title));
    return scored.map((row) => row.item);
  }

  function searchGroups(hits) {
    const groups = [
      ["Workshop", "Workshops"],
      ["Project", "Projects"],
      ["Field", "Fields"],
      ["Skill", "Skills"],
      ["Lecture", "Lectures"],
      ["Material", "Materials"],
    ];
    return groups.map(([kind, label]) => ({
      label,
      rows: hits.filter((item) => item.kind === kind),
    })).filter((group) => group.rows.length);
  }

  function renderSearch() {
    const query = state.param.trim();
    const ready = normSearch(query).split(" ").filter(Boolean).length >= 1 && query.trim().length >= 2;
    const hits = ready ? searchHits(query) : [];
    const body = !query
      ? `<p>Type a workshop, a project, a skill, or a material.</p>`
      : !ready
        ? `<p>Type at least two letters.</p>`
        : !hits.length
          ? `<p class="empty">Nothing matches “${esc(query)}”.</p>`
          : searchGroups(hits).map((group) => `<section>
              <h3 class="section-title">${esc(group.label)}</h3>
              <ul class="search-hits">${group.rows.map((item) => `<li><a href="${esc(item.href)}"><strong>${esc(item.title)}</strong><span>${esc(item.detail)}</span></a></li>`).join("")}</ul>
            </section>`).join("");
    return `<article class="page" data-page="search">
      <header class="page-head">
        <p class="eyebrow">Search</p>
        <h2>${query ? `Matches for “${esc(query)}”` : "Search the atelier."}</h2>
        <p class="lede">Results open the workshop, the project, the field, the material, or the sitting.</p>
      </header>
      ${body}
    </article>`;
  }

  function hideSearchList() {
    searchActive = -1;
    const input = document.getElementById("find-q");
    const list = document.getElementById("find-list");
    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
    if (list) {
      list.hidden = true;
      list.innerHTML = "";
    }
  }

  function closeSearch() {
    const input = document.getElementById("find-q");
    if (input) input.value = "";
    hideSearchList();
  }

  function paintSearchList() {
    const input = document.getElementById("find-q");
    const list = document.getElementById("find-list");
    if (!input || !list) return;
    const query = input.value.trim();
    if (query.length < 2) {
      hideSearchList();
      return;
    }
    const hits = searchHits(query);
    if (!hits.length) {
      searchActive = -1;
      list.hidden = false;
      list.innerHTML = `<p class="find-empty">Nothing matches.</p>`;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      return;
    }
    const shown = hits.slice(0, 8);
    const extra = hits.length > shown.length;
    const count = shown.length + (extra ? 1 : 0);
    if (searchActive >= count) searchActive = count - 1;
    const options = shown.map((item, index) => {
      const selected = index === searchActive;
      return `<a role="option" id="find-opt-${index}" href="${esc(item.href)}" aria-selected="${selected ? "true" : "false"}"><span class="find-kind">${esc(item.kind)}</span><strong>${esc(item.title)}</strong><span class="find-detail">${esc(item.detail)}</span></a>`;
    });
    if (extra) {
      const index = shown.length;
      const selected = index === searchActive;
      options.push(`<a role="option" id="find-opt-${index}" href="#search/${esc(encodeURIComponent(query))}" aria-selected="${selected ? "true" : "false"}"><span class="find-kind">Search</span><strong>See all ${hits.length} matches</strong></a>`);
    }
    list.hidden = false;
    list.innerHTML = options.join("");
    input.setAttribute("aria-expanded", "true");
    if (searchActive >= 0) {
      input.setAttribute("aria-activedescendant", "find-opt-" + searchActive);
      const node = document.getElementById("find-opt-" + searchActive);
      if (node) node.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }

  function onSearchKey(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.id !== "find-q") return;
    if (event.key === "Escape") {
      hideSearchList();
      return;
    }
    const query = input.value.trim();
    const total = query.length < 2 ? 0 : (() => {
      const n = searchHits(query).length;
      if (!n) return 0;
      return Math.min(8, n) + (n > 8 ? 1 : 0);
    })();
    if (event.key === "ArrowDown" && total) {
      event.preventDefault();
      searchActive = Math.min(total - 1, searchActive + 1);
      paintSearchList();
      return;
    }
    if (event.key === "ArrowUp" && total) {
      event.preventDefault();
      searchActive = Math.max(-1, searchActive - 1);
      paintSearchList();
      return;
    }
    if (event.key === "Enter" && searchActive >= 0) {
      const node = document.getElementById("find-opt-" + searchActive);
      if (node) {
        event.preventDefault();
        node.click();
      }
    }
  }

  function bindSearch() {
    const form = document.getElementById("find");
    const input = document.getElementById("find-q");
    const list = document.getElementById("find-list");
    if (!form || !input || !list || form.dataset.bound === "true") return;
    form.dataset.bound = "true";
    input.addEventListener("input", () => {
      searchActive = -1;
      paintSearchList();
    });
    input.addEventListener("keydown", onSearchKey);
    list.addEventListener("mousedown", (event) => event.preventDefault());
  }

  function whoHTML() {
    const roles = [
      ["student", t("role.student")],
      ["mentor", t("role.mentor")],
      ["director", t("role.director")],
    ];
    const langSeg = `<div class="seg lang-seg" role="group" aria-label="${esc(t("role.language"))}">
      <button type="button" data-action="set-lang" data-lang="en" lang="en" aria-pressed="${state.lang !== "fr"}">EN</button>
      <button type="button" data-action="set-lang" data-lang="fr" lang="fr" aria-pressed="${state.lang === "fr"}">FR</button>
    </div>`;
    const seg = `<div class="seg" role="group" aria-label="${esc(t("role.account"))}">${roles.map(([id, label]) =>
      `<button type="button" data-action="set-role" data-role="${id}" aria-pressed="${state.role === id}">${esc(label)}</button>`
    ).join("")}</div>`;
    let extra = "";
    if (state.role === "mentor") {
      const options = ["ibarra", "adeyemi", "vogel"].map((id) =>
        `<option value="${id}" ${state.mentorId === id ? "selected" : ""}>${esc(person(id).name)}</option>`
      ).join("");
      extra += `<label>${esc(t("who.actingAs"))}<select name="mentorId">${options}</select></label>`;
    }
    if (state.role === "director") {
      extra += `<p class="who-name">${esc(person("ortega").name)}</p>`;
    }
    const students = A.students.map((item) =>
      `<option value="${item.id}" ${state.studentId === item.id ? "selected" : ""}>${esc(item.name)}</option>`
    ).join("");
    const studentLabel = state.role === "student" ? t("who.viewingAs") : t("who.student");
    extra += `<label>${esc(studentLabel)}<select name="studentId">${students}</select></label>`;
    return langSeg + seg + extra;
  }

  function applyLang() {
    const lang = state.lang === "fr" ? "fr" : "en";
    document.documentElement.lang = lang;
    const skip = document.querySelector(".skip");
    if (skip) skip.textContent = t("skip");
    const tag = document.querySelector(".brand em");
    if (tag) tag.textContent = t("brand.tag");
    const findLabel = document.querySelector("#find label");
    if (findLabel) findLabel.textContent = t("search.label");
    const findInput = document.getElementById("find-q");
    if (findInput) findInput.placeholder = t("search.placeholder");
    const foot = document.getElementById("foot-copy");
    if (foot) foot.textContent = t("footer.copy");
    const reset = document.querySelector("[data-action='reset']");
    if (reset) reset.textContent = t("footer.reset");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("meta.description"));
  }

  function renderChrome() {
    applyLang();
    const mark = primaryMark();
    const nav = document.getElementById("nav");
    if (nav) {
      const primary = [
        ["#fields", t("nav.learn"), mark === "learn"],
        ["#workshops", t("nav.workshops"), mark === "workshops"],
        ["#projects", t("nav.projects"), mark === "projects"],
      ];
      let side = "";
      if (state.role !== "student") side += navLink("#plan", t("nav.plan"), mark === "plan");
      const recordLabel = state.role === "student" ? t("nav.record") : t("nav.recordShort");
      side += navLink("#panel", recordLabel, mark === "record");
      nav.innerHTML = primary.map(([href, label, on]) => navLink(href, label, on)).join("")
        + `<span class="nav-side">${side}</span>`;
    }
    const who = document.getElementById("who");
    if (who) who.innerHTML = whoHTML();
    document.title = `${pageTitle()} · Continuum`;
  }

  function healthHTML(problems) {
    const status = problems.length ? "fail" : "ok";
    const banner = problems.length
      ? `<div class="banner" role="alert">${esc(t("health.fail", { problems: problems.join("; ") }))}</div>`
      : "";
    return `${banner}<p id="health" class="vh" data-health="${status}">${esc(problems.join("; ") || "ok")}</p>`;
  }

  function fitAssistant() {
    const mast = document.querySelector(".mast");
    const height = mast ? Math.ceil(mast.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--mast-h", height + "px");
  }

  function render(options = {}) {
    rememberAssistantDraft();
    const y = window.scrollY;
    const active = document.activeElement;
    const restore = active && active.dataset && active.dataset.action && active.dataset.id
      ? {
          action: active.dataset.action,
          id: active.dataset.id,
          type: active.dataset.type || "",
          score: active.dataset.score || "",
        }
      : null;
    renderChrome();
    document.body.classList.toggle("has-assistant", assistantAllowed());
    const root = document.getElementById("app");
    root.innerHTML = healthHTML(health()) + page();
    fitAssistant();
    if (options.scroll === "top") {
      window.scrollTo(0, 0);
      jumpToRoute();
    } else window.scrollTo(0, y);
    if (restore && options.scroll !== "top") {
      const bits = [`[data-action="${restore.action}"]`, `[data-id="${CSS.escape(restore.id)}"]`];
      if (restore.type) bits.push(`[data-type="${CSS.escape(restore.type)}"]`);
      if (restore.score) bits.push(`[data-score="${CSS.escape(restore.score)}"]`);
      const next = document.querySelector(bits.join(""));
      if (next && next !== document.activeElement) next.focus({ preventScroll: true });
    }
  }

  function jumpToRoute() {
    let id = "";
    if (state.route === "workshops" && workshop(state.param)) id = "workshop-" + state.param;
    else if (state.route === "library" && materialById(state.param)) id = state.param;
    else if (state.route === "plan" && sessionById(state.param)) id = state.param;
    else if (state.route === "fields" && partById(state.param)) id = "part-" + state.param;
    else if (state.route === "fields" && competency(state.param)) id = "skill-" + state.param;
    if (!id) return;
    const node = document.getElementById(id)
      || document.getElementById("upcoming-" + id)
      || document.getElementById("held-" + id);
    if (node) node.scrollIntoView({ block: "start" });
  }

  function go(route) {
    const next = "#" + route;
    if (location.hash === next) render();
    else location.hash = next;
  }

  function setStudent(id) {
    if (!student(id)) return;
    state.studentId = id;
    state.competencyId = defaultCompetency(student(id));
    fieldMarkId = "";
    skillGraphId = "";
    planNotice = "";
    persist();
    render();
  }

  function onClick(event) {
    const find = document.getElementById("find");
    if (find && !find.contains(event.target)) hideSearchList();
    const target = event.target instanceof Element ? event.target : null;
    const insideDock = target ? target.closest(".assistant-dock") : null;
    const node = target ? target.closest("[data-action]") : null;
    if (assistantOpen && !insideDock) {
      assistantOpen = false;
      render();
      if (!node) return;
    }
    if (!node) return;
    const action = node.dataset.action;
    if (action === "assistant-toggle" || action === "assistant-close") {
      if (!assistantAllowed()) return;
      assistantOpen = action === "assistant-toggle" ? !assistantOpen : false;
      render();
      const focusNode = assistantOpen ? document.getElementById("assistant") : document.querySelector(".assistant-head");
      if (focusNode) focusNode.focus({ preventScroll: true });
      return;
    }
    if (action === "cloud-zoom") {
      if (node.dataset.dir === "in") {
        cloudZoom = 2;
        if (!competency(cloudFocus)) cloudFocus = state.competencyId;
      } else {
        cloudZoom = 1;
        cloudFocus = "";
      }
      render();
      return;
    }
    if (action === "offer-cloud") {
      const claim = competency(node.dataset.id);
      if (!claim) return;
      offerCloudFocus = { parentId: node.dataset.parent || "", skillId: claim.id };
      state.competencyId = claim.id;
      persist();
      render();
      const reading = document.getElementById("offer-cloud-read-" + offerCloudFocus.parentId);
      if (reading) reading.scrollIntoView({ block: "nearest" });
      return;
    }
    if (action === "cloud-focus") {
      const claim = competency(node.dataset.id);
      if (!claim) return;
      cloudFocus = claim.id;
      cloudZoom = 2;
      state.competencyId = claim.id;
      persist();
      render();
      const card = document.getElementById("cloud-" + claim.id);
      if (card) card.scrollIntoView({ block: "nearest" });
      return;
    }
    if (action === "field-mark") {
      fieldMarkId = node.dataset.id || "";
      render();
      const reading = document.getElementById("field-mark-read");
      if (reading) reading.scrollIntoView({ block: "nearest" });
      return;
    }
    if (action === "assistant-mood") {
      if (state.role !== "student") return;
      const mood = node.dataset.id;
      if (!ASSISTANT_MOODS.some((item) => item.id === mood)) return;
      normalizeAssistantState();
      state.moods[current().id] = mood;
      persist();
      render();
      return;
    }
    if (action === "assistant-ask") {
      const caseload = assistantUsesCaseload();
      const prompt = (caseload ? CASELOAD_PROMPTS : ASSISTANT_PROMPTS).find((item) => item.id === node.dataset.id);
      if (!prompt) return;
      askAssistant(t((caseload ? "coach.prompt." : "prompt.") + prompt.id));
      return;
    }
    if (action === "assistant-clear") {
      clearAssistant();
      return;
    }
    if (action === "skill-graph") {
      const part = partById(node.dataset.id);
      if (!part) return;
      skillGraphId = part.id;
      state.competencyId = part.skillId;
      persist();
      render();
      const reading = document.getElementById("skill-graph-read");
      if (reading) reading.scrollIntoView({ block: "nearest" });
      return;
    }
    if (action === "select-competency") {
      state.competencyId = node.dataset.id;
      persist();
      render();
      return;
    }
    if (action === "focus") {
      state.focus = { type: node.dataset.type, id: node.dataset.id };
      persist();
      render();
      return;
    }
    if (action === "layer") {
      state.layer = state.layer === node.dataset.id ? "" : node.dataset.id;
      persist();
      render();
      return;
    }
    if (action === "set-lang") {
      const lang = node.dataset.lang === "fr" ? "fr" : "en";
      if (state.lang === lang) return;
      state.lang = lang;
      persist();
      render({ scroll: "top" });
      return;
    }
    if (action === "set-role") {
      state.role = node.dataset.role;
      persist();
      go("dashboard");
      return;
    }
    if (action === "open-field") {
      event.preventDefault();
      if (field(node.dataset.id)) {
        state.field = node.dataset.id;
        state.skill = "all";
      }
      persist();
      go(node.dataset.route || "library");
      return;
    }
    if (action === "enter") {
      if (node.dataset.role) state.role = node.dataset.role;
      if (node.dataset.mentor) state.mentorId = node.dataset.mentor;
      if (node.dataset.student) state.studentId = node.dataset.student;
      if (node.dataset.competency) state.competencyId = node.dataset.competency;
      persist();
      go(node.dataset.route);
      return;
    }
    if (action === "open-student") {
      event.preventDefault();
      state.studentId = node.dataset.id;
      state.competencyId = defaultCompetency(student(state.studentId));
      persist();
      go("panel");
      return;
    }
    if (action === "open-activities") {
      event.preventDefault();
      const claim = competency(node.dataset.id);
      if (claim) {
        state.skill = claim.id;
        state.field = claim.field;
        state.competencyId = claim.id;
      } else {
        state.skill = "all";
        state.field = "all";
      }
      persist();
      go("activities");
      return;
    }
    if (action === "endorse") {
      const personRecord = current();
      if (!canDecide(personRecord) || !floorMet(personRecord)) return;
      const at = new Date().toISOString();
      state.endorsements[personRecord.id] = { decision: "endorse", at, actor: actorName(), text: "" };
      state.logs.push({
        id: "log-" + Date.now(),
        studentId: personRecord.id,
        kind: "endorse",
        text: "Readiness noted. Algebra, writing, mechanics, and ethics have each reached proficient, and a person has said so.",
        at,
        actor: actorName(),
      });
      persist();
      render();
      return;
    }
    if (action === "jump") {
      const target = document.getElementById(node.dataset.id);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (action === "print") {
      window.print();
      return;
    }
    if (action === "use-material") {
      if (state.role !== "student") return;
      const item = materialById(node.dataset.id);
      if (!item || contributorStudentId(item) === current().id) return;
      recordUse(item.id, current().id);
      persist();
      render();
      const card = document.getElementById(item.id);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (action === "rate-material") {
      if (state.role !== "student") return;
      const item = materialById(node.dataset.id);
      const score = Number(node.dataset.score);
      if (!item || contributorStudentId(item) === current().id) return;
      if (!Number.isInteger(score) || score < 1 || score > 4) return;
      recordRating(item.id, current().id, score);
      persist();
      render();
      const card = document.getElementById(item.id);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (action === "register") {
      explainRegistration(node.dataset.id, "register");
      return;
    }
    if (action === "withdraw") {
      explainRegistration(node.dataset.id, "withdraw");
      return;
    }
    if (action === "reset") {
      const ok = window.confirm("Clear challenges, mentor notes, reports, materials, registrations, and the assistant conversation saved in this browser? The sample shelf and the sample plan stay.");
      if (!ok) return;
      try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
      const route = state.route;
      const param = state.param;
      state = blank();
      state.route = route;
      state.param = param;
      libraryNotice = "";
      planNotice = "";
      assistantDraft = "";
      assistantNotice = "";
      assistantBusy = false;
      assistantBusyFor = "";
      assistantToken += 1;
      assistantOpen = false;
      render();
    }
  }

  function onChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.name === "external") {
      const box = document.getElementById("external-fields");
      if (box) box.hidden = !target.checked;
      return;
    }
    if (target.name === "sittingKind" && target.form) {
      syncPlanForm(target.form);
      return;
    }
    if (target.name === "planKind") {
      if (!["all", "workshop", "project", "lecture"].includes(target.value)) return;
      state.planKind = target.value;
      persist();
      render();
      return;
    }
    if (target.name === "studentId") setStudent(target.value);
    if (target.name === "mentorId") {
      state.mentorId = target.value;
      persist();
      render();
    }
    if (target.name === "field" || target.name === "medium" || target.name === "skill") {
      state[target.name] = target.value;
      if (target.name === "skill" && target.value !== "all") {
        const claim = competency(target.value);
        if (claim) state.field = claim.field;
      }
      if (target.name === "field" && state.skill !== "all") {
        const claim = competency(state.skill);
        if (!claim || (target.value !== "all" && claim.field !== target.value)) state.skill = "all";
      }
      persist();
      render();
    }
  }

  function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.form) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.dataset.form === "assistant") {
      askAssistant(String(data.get("q") || ""));
      return;
    }
    if (form.dataset.form === "find") {
      const query = String(data.get("q") || "").trim().slice(0, 80);
      const input = document.getElementById("find-q");
      if (!query) {
        if (input) input.focus();
        return;
      }
      const next = "#search/" + encodeURIComponent(query);
      if (location.hash === next) {
        closeSearch();
        if (input) input.value = query;
        render({ scroll: "top" });
      } else location.hash = next;
      return;
    }
    const personRecord = current();
    if (form.dataset.form === "challenge") {
      if (state.role !== "student") return;
      const text = String(data.get("text") || "").trim();
      const evidenceId = String(data.get("evidenceId") || "");
      const item = byId(A.evidence, evidenceId);
      if (!text || !item || item.studentId !== personRecord.id) return;
      state.challenges.push({
        id: "ch-" + Date.now(),
        evidenceId,
        studentId: personRecord.id,
        text,
        at: new Date().toISOString(),
        status: "open",
        response: "",
        responder: "",
      });
      persist();
      render();
      return;
    }
    if (form.dataset.form === "response") {
      if (!canDecide(personRecord)) return;
      const entry = state.challenges.find((item) => item.id === data.get("id"));
      const text = String(data.get("response") || "").trim();
      if (!entry || entry.studentId !== personRecord.id || !text) return;
      entry.response = text;
      entry.status = "addressed";
      entry.responder = actorName();
      entry.respondedAt = new Date().toISOString();
      persist();
      render();
      return;
    }
    if (form.dataset.form === "log") {
      if (!canDecide(personRecord)) return;
      const text = String(data.get("text") || "").trim();
      const kind = String(data.get("kind") || "note");
      if (!text) return;
      const at = new Date().toISOString();
      if (kind === "medium") {
        const medium = String(data.get("medium") || "");
        if (A.media.some((item) => item.id === medium)) state.mediaOverrides[personRecord.id] = [medium];
      }
      if (kind === "withhold") {
        state.endorsements[personRecord.id] = { decision: "withhold", at, actor: actorName(), text };
      }
      state.logs.push({ id: "log-" + Date.now(), studentId: personRecord.id, kind, text, at, actor: actorName() });
      persist();
      render();
      return;
    }
    if (form.dataset.form === "bring") {
      const title = String(data.get("title") || "").trim();
      const summary = String(data.get("summary") || "").trim();
      const medium = String(data.get("bringMedium") || "");
      const minutes = Number(data.get("minutes"));
      const error = form.querySelector("[data-error]");
      const fail = (message) => { if (error) error.textContent = message; };
      const fields = [];
      for (const fieldId of data.getAll("bringField")) {
        const id = String(fieldId);
        if (field(id) && !fields.includes(id)) fields.push(id);
      }
      const competencies = [];
      for (const claimId of data.getAll("bringClaim")) {
        const claim = competency(String(claimId));
        if (!claim || competencies.includes(claim.id)) continue;
        competencies.push(claim.id);
        if (!fields.includes(claim.field)) fields.push(claim.field);
      }
      if (!title || !summary) return fail("Give the piece a title and a summary.");
      if (!A.media.some((item) => item.id === medium)) return fail("Choose what kind of material it is.");
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) return fail("Minutes should be between 1 and 240.");
      if (!fields.length) return fail("Choose at least one field, or a subject.");
      const external = data.get("external") === "on";
      const externalName = String(data.get("externalName") || "").trim().slice(0, 80);
      const place = String(data.get("place") || "").trim().slice(0, 80);
      let contributor;
      if (external) {
        if (!externalName) return fail("Name the person outside the atelier.");
        contributor = place
          ? { kind: "external", name: externalName, place }
          : { kind: "external", name: externalName };
      } else if (state.role === "student") {
        contributor = { kind: "student", id: current().id };
      } else if (state.role === "mentor") {
        contributor = { kind: "mentor", id: state.mentorId };
      } else {
        contributor = { kind: "director", id: "ortega" };
      }
      materialSerial += 1;
      const item = {
        id: "mat-local-" + Date.now() + "-" + materialSerial,
        title: title.slice(0, 140),
        summary: summary.slice(0, 600),
        medium,
        minutes: Math.round(minutes),
        fields,
        competencies,
        contributor,
        brought: A.today,
      };
      state.contributions.push(item);
      libraryNotice = item.id;
      persist();
      render();
      const card = document.getElementById(item.id);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (form.dataset.form === "plan") {
      if (state.role === "student") return;
      const kind = String(data.get("sittingKind") || "");
      const error = form.querySelector("[data-error]");
      const fail = (message) => { if (error) error.textContent = message; };
      const date = String(data.get("date") || "");
      const start = normalizeTime(data.get("start"));
      const end = normalizeTime(data.get("end"));
      const place = String(data.get("place") || "").trim().slice(0, 80);
      const note = String(data.get("note") || "").trim().slice(0, 240);
      const capacityText = String(data.get("capacity") || "");
      if (!["workshop", "project", "lecture"].includes(kind)) return fail("Choose what kind of sitting this is.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < A.today) return fail(`Choose a day on or after ${formatDate(A.today)}.`);
      if (!start || !end || timeValue(end) <= timeValue(start)) return fail("The end needs to be after the start.");
      if (!place) return fail("Name the room.");
      if (!/^\d+$/.test(capacityText)) return fail("Capacity should be a whole number from 1 to 40.");
      const capacity = Number(capacityText);
      if (capacity < 1 || capacity > 40) return fail("Capacity should be a whole number from 1 to 40.");
      const hostId = state.role === "mentor" ? state.mentorId : String(data.get("hostId") || "");
      if (!person(hostId)) return fail("Choose a host.");
      let ref = "";
      let title = "";
      let summary = "";
      let fieldId = "";
      if (kind === "workshop") {
        ref = String(data.get("workshopId") || "");
        if (!workshop(ref)) return fail("Choose a workshop.");
      } else if (kind === "project") {
        ref = String(data.get("projectId") || "");
        if (!project(ref)) return fail("Choose a project.");
      } else {
        title = String(data.get("title") || "").trim().slice(0, 140);
        summary = String(data.get("summary") || "").trim().slice(0, 400);
        fieldId = String(data.get("lectureField") || "");
        if (!title || !summary) return fail("Give the lecture a title and a summary.");
        if (!field(fieldId)) return fail("Choose the field the lecture serves.");
      }
      const clash = allSessions().find((item) => item.date === date && item.hostId === hostId && start < item.end && item.start < end);
      if (clash) return fail(`${person(hostId).name} already has a sitting then (${sessionTitle(clash)}, ${clash.start}–${clash.end}).`);
      sittingSerial += 1;
      const item = {
        id: "sit-local-" + Date.now() + "-" + sittingSerial,
        kind,
        ref,
        title,
        summary,
        field: fieldId,
        date,
        start,
        end,
        place,
        hostId,
        capacity,
        note,
      };
      state.planned.push(item);
      if (state.planKind !== "all" && state.planKind !== kind) state.planKind = kind;
      planNotice = `${sessionTitle(item)} is on the plan for ${formatDate(date)}.`;
      persist();
      render();
      focusSitting(item.id);
      return;
    }
    if (form.dataset.form === "report") {
      if (!canDecide(personRecord)) return;
      const text = String(data.get("body") || "").trim();
      if (!text) return;
      state.reports[personRecord.id] = text;
      state.drafts[personRecord.id] = text;
      persist();
      render();
    }
  }

  function onInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement) || target.id !== "report-body") return;
    state.drafts[current().id] = target.value;
    persist();
    const status = document.getElementById("report-status");
    if (status) status.textContent = "Draft saved in this browser.";
  }

  function onKeydown(event) {
    if (event.key === "Escape" && assistantOpen) {
      const list = document.getElementById("find-list");
      if (!list || list.hidden) {
        assistantOpen = false;
        render();
        const head = document.querySelector(".assistant-head");
        if (head) head.focus();
        return;
      }
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const node = event.target.closest(".network .node, .field-chart .field-dot, .age-chart .age-dot");
    if (!node) return;
    event.preventDefault();
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function init() {
    const root = document.getElementById("app");
    if (!A) {
      root.innerHTML = "<p>The atelier data did not load.</p>";
      return;
    }
    load();
    bindSearch();
    if (!location.hash) history.replaceState(null, "", "#dashboard");
    applyRoute(readRoute());
    render({ scroll: "top" });
    window.addEventListener("hashchange", () => {
      const next = readRoute();
      applyRoute(next);
      libraryNotice = "";
      planNotice = "";
      closeSearch();
      if (next.route === "search") {
        const input = document.getElementById("find-q");
        if (input) input.value = next.param;
      }
      render({ scroll: "top" });
    });
    document.body.addEventListener("click", onClick);
    document.body.addEventListener("change", onChange);
    document.body.addEventListener("submit", onSubmit);
    document.body.addEventListener("input", onInput);
    document.body.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", fitAssistant);
  }

  init();
})();
