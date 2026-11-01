/* Continuum atelier.
   A skill line fills to the furthest stage any scored work has reached.
   Each exercise, test, or project adds a mark, and one piece of work can mark several skills.
   Unobserved is an empty arc. It is not a low stage.
   Edges on the map join subjects to read together. They do not move a stage. */
(function () {
  const A = globalThis.ATELIER;
  const KEY = "continuum-atelier-v1";

  const ROUTES = ["model", "panel", "map", "projects", "workshops", "activities", "library", "cohort", "report"];

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
      route: "model",
      param: "",
      logs: [],
      challenges: [],
      endorsements: {},
      mediaOverrides: {},
      drafts: {},
      reports: {},
    };
  }

  let state = blank();

  const byId = (list, id) => list.find((item) => item.id === id);
  const competency = (id) => byId(A.competencies, id);
  const student = (id) => byId(A.students, id);
  const person = (id) => byId(A.people, id);
  const project = (id) => byId(A.projects, id);
  const workshop = (id) => byId(A.workshops, id);
  const field = (id) => byId(A.fields, id);
  const current = () => student(state.studentId) || A.students[0];

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function formatDate(iso) {
    if (!iso) return "";
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${months[m - 1]} ${y}`;
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
    if (n == null) return "Unobserved";
    const row = A.levels.find((item) => item.n === n);
    return row ? row.label : String(n);
  }

  function mediaLabel(id) {
    const row = A.media.find((item) => item.id === id);
    return row ? row.label : id;
  }

  function evidenceFor(studentId) {
    return A.evidence.filter((item) => item.studentId === studentId);
  }

  function notesFor(studentId) {
    return A.notes.filter((item) => item.studentId === studentId);
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
    if (openChallenges(personRecord.id).length) return { id: "challenge", label: "Open challenge" };
    const last = lastEvidenceItem(personRecord.id);
    if (last && daysSince(last.date) > A.staleDays) return { id: "stale", label: "No recent evidence" };
    const phase = workshopPhase(personRecord);
    if (phase === "intake") return { id: "intake", label: "Intake, no evidence yet" };
    if (phase === "workshops") return { id: "workshops", label: "Workshops still open" };
    const decision = state.endorsements[personRecord.id];
    if (floorMet(personRecord) && decision && decision.decision === "withhold") {
      return { id: "withheld", label: "Advancement withheld" };
    }
    if (floorMet(personRecord) && decision && decision.decision === "endorse") {
      return { id: "endorsed", label: "Advancement endorsed" };
    }
    if (floorMet(personRecord)) return { id: "ready", label: "Shared subjects are proficient" };
    const gap = primaryOpenFloor(personRecord);
    if (!gap) return { id: "open", label: "Skills still moving" };
    return { id: "open", label: `${competency(gap.id).name} · ${levelLabel(levelOf(personRecord.id, gap.id)).toLowerCase()}` };
  }

  function mediaOf(personRecord) {
    return state.mediaOverrides[personRecord.id] || personRecord.media;
  }

  function mediaSentence(personRecord) {
    const list = mediaOf(personRecord);
    if (!list.length) return "No medium preference is on file yet.";
    if (list.length === 1) return `Prefers ${mediaLabel(list[0]).toLowerCase()}.`;
    return `Prefers ${mediaLabel(list[0]).toLowerCase()}, then ${mediaLabel(list[1]).toLowerCase()}.`;
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
    return n === 1 ? "1 point" : `${n} points`;
  }

  function offerPoints(ids) {
    return ids.length * 4;
  }

  function offerPhrase(ids) {
    const n = offerPoints(ids);
    if (n === 0) return "0 points";
    return `Up to ${pointsLabel(n)}`;
  }

  function skillsPointPhrase(ids) {
    if (!ids.length) return "No skill line moves.";
    const names = namedList(ids);
    if (ids.length === 1) return `${names}, 4 points.`;
    return `${names}, 4 points each.`;
  }

  function stagePointsSentence(level) {
    if (level == null) return "No points on this line yet. A mark is worth 1, 2, 3, or 4 points, matching the stage.";
    return `${levelLabel(level)} is ${pointsLabel(level)} on this line. A later mark can raise it as far as 4 points.`;
  }

  function evidencePoints(item) {
    return item.scores.reduce((sum, score) => sum + score.level, 0);
  }

  function workshopStatusLabel(status) {
    if (status === "done") return "Done";
    if (status === "enrolled") return "In progress";
    return "Not started";
  }

  function projectStatusLabel(personRecord, projectId) {
    if (personRecord.projectIds.includes(projectId)) return "Your project";
    if (personRecord.recommendedProjectId === projectId) return "Seat waiting";
    return "Not your seat";
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
    return `The parts share skills, so the ceiling is ${pointsLabel(cap)}, not ${pointsLabel(sum)}.`;
  }

  function activityList(activities) {
    return `<ul class="point-mini">${activities.map((activity) => `<li>
      <span>${esc(activity.kind)} · ${esc(activity.name)}</span>
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
        const href = source === "workshop" ? "#workshops" : `#projects/${parent.id}`;
        const n = offerPoints(activity.competencyIds);
        const points = n === 0
          ? `<strong>0</strong> <span>points</span>`
          : `<strong>${n}</strong> <span>points at most</span>`;
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
      return `${name} is in intake. Let the field sampler finish before a project seat. An empty chart means the work has not been scored yet.`;
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
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
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
  }

  function readRoute() {
    const raw = (location.hash || "#model").replace(/^#/, "");
    const [route, param] = raw.split("/");
    if (!ROUTES.includes(route)) return { route: "model", param: "" };
    return { route, param: param || "" };
  }

  function health() {
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
    expect(offerPoints(project("coastal").elicits) === 44, "coastal points");
    expect(evidencePoints(byId(A.evidence, "ev-amina-diag")) === 9, "amina diagnostic points");
    for (const personRecord of A.students) {
      expect(!!person(personRecord.mentorId), "mentor " + personRecord.id);
      for (const id of personRecord.projectIds) expect(!!project(id), "seat " + id);
    }
    const ids = A.evidence.map((item) => item.id);
    expect(new Set(ids).size === ids.length, "unique evidence ids");
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
        ${A.fields.map((item) => `<span class="field-${item.id}"><i></i>${esc(item.short)}</span>`).join("")}
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
      const open = state.layer === layer.id;
      return `<section class="layer ${open ? "is-open" : ""}">
        <h3><button type="button" data-action="layer" data-id="${layer.id}" aria-expanded="${open}"><span>${esc(layer.n)}</span>${esc(layer.name)}</button></h3>
        ${open ? `<p>${esc(layer.text)}</p>` : ""}
      </section>`;
    }).join("");
    const decisions = A.decisions.map((item) => `<article class="card"><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join("");
    return `<article class="page" data-page="model">
      <header class="page-head">
        <p class="eyebrow">The model</p>
        <h2>Claims, evidence, tasks.</h2>
        <p class="lede">Every credit in Continuum comes from a claim, an observation, and a task built to produce that observation. The same three parts structure a project, a workshop, and the monitoring panel.</p>
      </header>
      <p class="eyebrow">Coastal Crossing, read three ways</p>
      ${ecdBoard()}
      <div class="rule">
        <p class="eyebrow">Update rule</p>
        <p>Every scored exercise, test, or project adds a mark on each skill it touches. The arc fills to the furthest stage those marks have reached. A mark is worth 1, 2, 3, or 4 points, matching the stage, and an action shows the most it can place. An empty arc has no evidence yet. Lines between subjects mark skills to read together. A line between subjects does not move a stage.</p>
      </div>
      <h3 class="section-title">Decisions already in force</h3>
      <div class="grid-3">${decisions}</div>
      <h3 class="section-title">Five layers, from the field to the panel</h3>
      <div class="layers">${layers}</div>
      <h3 class="section-title">Open the atelier</h3>
      <p class="muted">The role switch inhabits the same record as a student, a mentor, or the director. Notes you add stay in this browser.</p>
      <div class="doors">
        <button type="button" class="primary" data-action="enter" data-role="student" data-student="amina" data-competency="PE" data-route="panel">Open Amina’s panel</button>
        <button type="button" data-action="enter" data-role="mentor" data-mentor="ibarra" data-student="jun" data-route="panel">See Jun as Jun’s mentor</button>
        <button type="button" data-action="enter" data-role="director" data-route="cohort">Open the cohort as director</button>
        <button type="button" data-action="enter" data-role="student" data-student="noor" data-competency="PE" data-route="panel">See how projects move Noor’s skills</button>
      </div>
    </article>`;
  }

  function renderMap() {
    const personRecord = current();
    const groups = A.fields.map((item) => {
      const cards = A.competencies.filter((claim) => claim.field === item.id).map((claim) => {
        const level = levelOf(personRecord.id, claim.id);
        const elicited = []
          .concat(A.projects.filter((row) => row.elicits.includes(claim.id)).map((row) => row.name))
          .concat(A.workshops.filter((row) => row.elicits.includes(claim.id)).map((row) => row.name));
        const practice = A.materials.filter((row) => row.competencies.includes(claim.id)).map((row) => row.title);
        const related = neighbors(claim.id).map((id) => competency(id).short).join(", ");
        return `<article class="card map-card field-${item.id} ${state.competencyId === claim.id ? "is-selected" : ""}">
          <p class="eyebrow">${esc(item.name)}</p>
          <h3><button type="button" class="text-btn" data-action="select-competency" data-id="${claim.id}">${esc(claim.name)}</button></h3>
          <p class="level-line">${meter(level, item.id)} <span>${esc(levelLabel(level))} for ${esc(firstName(personRecord))}</span></p>
          <p class="meta">${esc(stagePointsSentence(level))}</p>
          <p>${esc(claim.claim)}</p>
          <p class="eyebrow">Evidence rules</p>
          <ul class="rules">${claim.rules.map((rule) => `<li>${esc(rule)}</li>`).join("")}</ul>
          <p class="meta">Elicited by ${elicited.length ? esc(elicited.join(", ")) : "no current task"}.</p>
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
        <h2>The map of subjects.</h2>
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
    return `<article class="card">
      <p class="eyebrow">${esc(item.place)}</p>
      <h3><a href="#projects/${item.id}">${esc(item.name)}</a></h3>
      <p>${esc(item.summary)}</p>
      <p class="point-offer"><b>${esc(offerPhrase(item.elicits))}</b> <span>across ${item.elicits.length} skills</span></p>
      <p class="meta">${esc(firstName(viewer))}: ${esc(projectStatusLabel(viewer, item.id))}.</p>
      <p class="tags">${pips}</p>
      <p class="meta">On it: ${esc(names)}</p>
    </article>`;
  }

  function renderProjectDetail(item) {
    if (!item) {
      return `<article class="page" data-page="projects"><header class="page-head"><p class="eyebrow">Projects</p><h2>That project is not on the books.</h2></header><p><a href="#projects">Back to the projects</a></p></article>`;
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
      <h3 class="section-title">Points for each part</h3>
      ${activityList(item.activities)}
      <p><strong>On it.</strong> ${on}</p>
      ${invited ? `<p><strong>Scaffolded seat, not yet taken.</strong> ${invited}</p>` : ""}
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
        <p class="eyebrow">Task models</p>
        <h2>Projects across fields.</h2>
        <p class="lede">A project is a situation built to elicit particular claims. Finishing the weeks is not the credit. The work products are. Anyone can read a brief. A score requires the observation.</p>
      </header>
      <div class="grid-2">${A.projects.map(projectCard).join("")}</div>
    </article>`;
  }

  function renderWorkshops() {
    const cards = A.workshops.map((item) => {
      const enrolled = A.students.filter((personRecord) => personRecord.workshops[item.id] === "enrolled");
      const done = A.students.filter((personRecord) => personRecord.workshops[item.id] === "done");
      const now = enrolled.length ? enrolled.map((personRecord) => personRecord.name).join(", ") : "no one";
      const claims = item.elicits.length
        ? item.elicits.map((id) => competency(id).name).join(", ")
        : "No claims. Notes stay notes.";
      const viewer = current();
      return `<article class="card" id="workshop-${item.id}">
        <p class="eyebrow">${esc(item.kind)}${item.scored ? " · scored" : " · unscored"}</p>
        <h3>${esc(item.name)}</h3>
        <p class="point-offer"><b>${esc(offerPhrase(item.elicits))}</b></p>
        <p class="meta">${esc(firstName(viewer))}: ${esc(workshopStatusLabel(viewer.workshops[item.id]))}.</p>
        <p>${esc(item.detail)}</p>
        ${activityList(item.activities)}
        <p class="meta">Can elicit: ${esc(claims)}</p>
        <p class="meta">In it now: ${esc(now)}. Completed by ${done.length}.</p>
      </article>`;
    }).join("");
    const intake = A.students.filter((personRecord) => workshopPhase(personRecord) !== "done");
    const lines = intake.map((personRecord) => {
      const steps = A.workshops.map((item) => {
        const status = personRecord.workshops[item.id];
        const word = status === "done" ? "done" : status === "enrolled" ? "in progress" : "not started";
        return `${item.name} (${word})`;
      }).join("; ");
      return `<li><a href="#panel" data-action="open-student" data-id="${personRecord.id}">${esc(personRecord.name)}</a> — ${esc(steps)}</li>`;
    }).join("");
    return `<article class="page" data-page="workshops">
      <header class="page-head">
        <p class="eyebrow">Intake</p>
        <h2>Workshops before a seat.</h2>
        <p class="lede">New students begin in workshops. The sampler is exploratory and carries no score. The diagnostic stations put the first marks on the skill lines, and they show a mentor where the first project needs a scaffold. A workshop is waived when the evidence is already on the record.</p>
      </header>
      <div class="grid-2">${cards}</div>
      <h3 class="section-title">Who is still in the sequence</h3>
      ${lines ? `<ul>${lines}</ul>` : `<p>Everyone in the cohort has finished the workshop sequence.</p>`}
    </article>`;
  }

  function materialMatches(item) {
    const mediumOk = state.medium === "all" || item.medium === state.medium;
    if (!mediumOk) return false;
    if (state.field === "all") return true;
    if (item.field === state.field) return true;
    return item.competencies.some((id) => competency(id).field === state.field);
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
    for (const item of A.workshops) {
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
        kind: "Workshop",
        name: item.name,
        href: "#workshops",
        summary: item.summary,
        skills: shownSkills(item.elicits, skillId),
        points: offerPhrase(item.elicits),
        activities: item.activities,
        note: overlapNote(item),
        detail,
      });
    }
    for (const item of A.projects) {
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
        kind: "Project",
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
    const fieldOptions = [`<option value="all"${state.field === "all" ? " selected" : ""}>All fields</option>`]
      .concat(A.fields.map((item) => `<option value="${item.id}"${state.field === item.id ? " selected" : ""}>${esc(item.name)}</option>`))
      .join("");
    const skillPool = state.field === "all"
      ? A.competencies
      : A.competencies.filter((item) => item.field === state.field);
    const skillOptions = [`<option value="all"${state.skill === "all" ? " selected" : ""}>All skills</option>`]
      .concat(skillPool.map((item) => `<option value="${item.id}"${state.skill === item.id ? " selected" : ""}>${esc(item.name)}</option>`))
      .join("");
    const materials = A.materials.filter((item) => {
      if (skillId) return item.competencies.includes(skillId);
      if (state.field === "all") return true;
      if (item.field === state.field) return true;
      return item.competencies.some((id) => competency(id).field === state.field);
    });
    const shelf = materials.map((item) => {
      const claims = item.competencies.map((id) => {
        const claim = competency(id);
        return `<li class="field-${claim.field}">${esc(claim.short)}</li>`;
      }).join("");
      return `<article class="card">
        <p class="eyebrow">${esc(field(item.field).name)} · ${esc(mediaLabel(item.medium))} · ${item.minutes} min</p>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.summary)}</p>
        <ul class="tags">${claims}</ul>
        <p class="point-offer"><b>0 points</b> <span>practice</span></p>
        <p class="meta">Open material. Using it does not add a mark.</p>
      </article>`;
    }).join("");
    const focusName = skillId ? competency(skillId).name : state.field === "all" ? "every skill" : field(state.field).name;
    const closed = rows.filter((row) => row.phase === "closed").length;
    const soon = rows.filter((row) => row.phase === "soon").length;
    const todo = rows.filter((row) => row.phase === "todo").length;
    return `<article class="page" data-page="activities" data-student="${personRecord.id}">
      <header class="page-head">
        <p class="eyebrow">Activities · ${esc(personRecord.name)}</p>
        <h2>What is closed, soon, and still to do.</h2>
        <p class="lede">Workshops, tests, and project work that can move ${esc(focusName)}, each with the points it can place. A recorded mark is worth 1, 2, 3, or 4 points, matching the stage. A closed activity already has its work on the record. Soon is the seat in progress or the one recommended next. Materials underneath are worth 0 points.</p>
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
    const fieldOptions = [`<option value="all"${state.field === "all" ? " selected" : ""}>All fields</option>`]
      .concat(A.fields.map((item) => `<option value="${item.id}"${state.field === item.id ? " selected" : ""}>${esc(item.name)}</option>`))
      .join("");
    const mediumOptions = [`<option value="all"${state.medium === "all" ? " selected" : ""}>All media</option>`]
      .concat(A.media.map((item) => `<option value="${item.id}"${state.medium === item.id ? " selected" : ""}>${esc(item.label)}</option>`))
      .join("");
    const rows = A.materials.filter(materialMatches);
    const cards = rows.map((item) => {
      const claims = item.competencies.map((id) => {
        const claim = competency(id);
        return `<li class="field-${claim.field}">${esc(claim.short)}</li>`;
      }).join("");
      return `<article class="card">
        <p class="eyebrow">${esc(field(item.field).name)} · ${esc(mediaLabel(item.medium))} · ${item.minutes} min</p>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.summary)}</p>
        <ul class="tags">${claims}</ul>
        <p class="point-offer"><b>0 points</b> <span>practice</span></p>
        <p class="meta">Open shelf. Using this does not move a level.</p>
      </article>`;
    }).join("");
    const empty = `<p class="empty">Nothing matches both filters. Clear one. The shelf stays open either way, and none of it awards credit.</p>`;
    return `<article class="page" data-page="library">
      <header class="page-head">
        <p class="eyebrow">Open shelf</p>
        <h2>Materials for any student.</h2>
        <p class="lede">Lectures, texts, simulations, and bench cards sit on one shelf. A student uses the medium they can stay with. Access is open. Each item is worth 0 points. Credit is a scored observation, under a rubric, on the panel.</p>
      </header>
      <div class="filters">
        <label>Field
          <select name="field" data-action="filter">${fieldOptions}</select>
        </label>
        <label>Medium
          <select name="medium" data-action="filter">${mediumOptions}</select>
        </label>
      </div>
      <div class="shelf">${cards || empty}</div>
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
          <a href="#panel">Back to the panel</a>
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

  function page() {
    if (state.route === "model") return renderModel();
    if (state.route === "panel") return renderPanel();
    if (state.route === "map") return renderMap();
    if (state.route === "projects") return renderProjects();
    if (state.route === "workshops") return renderWorkshops();
    if (state.route === "activities") return renderActivities();
    if (state.route === "library") return renderLibrary();
    if (state.route === "cohort") return renderCohort();
    if (state.route === "report") return renderReport();
    return renderModel();
  }

  function pageTitle() {
    const titles = {
      model: "The model",
      panel: current().name,
      map: "Competency map",
      projects: state.param && project(state.param) ? project(state.param).name : "Projects",
      workshops: "Workshops",
      activities: "Activities",
      library: "Library",
      cohort: "Cohort",
      report: "Report",
    };
    return titles[state.route] || "Continuum";
  }

  function whoHTML() {
    const roles = [
      ["student", "Student"],
      ["mentor", "Mentor"],
      ["director", "Director"],
    ];
    const seg = `<div class="seg" role="group" aria-label="Role">${roles.map(([id, label]) =>
      `<button type="button" data-action="set-role" data-role="${id}" aria-pressed="${state.role === id}">${label}</button>`
    ).join("")}</div>`;
    let extra = "";
    if (state.role === "mentor") {
      const options = ["ibarra", "adeyemi", "vogel"].map((id) =>
        `<option value="${id}" ${state.mentorId === id ? "selected" : ""}>${esc(person(id).name)}</option>`
      ).join("");
      extra += `<label>Acting as<select name="mentorId">${options}</select></label>`;
    }
    if (state.role === "director") {
      extra += `<p class="who-name">${esc(person("ortega").name)}</p>`;
    }
    const students = A.students.map((item) =>
      `<option value="${item.id}" ${state.studentId === item.id ? "selected" : ""}>${esc(item.name)}</option>`
    ).join("");
    const studentLabel = state.role === "student" ? "Viewing as" : "Student";
    extra += `<label>${studentLabel}<select name="studentId">${students}</select></label>`;
    return seg + extra;
  }

  function renderChrome() {
    document.querySelectorAll("#nav a").forEach((link) => {
      const on = link.dataset.route === state.route;
      if (on) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
      if (link.dataset.route === "cohort") link.hidden = state.role === "student";
    });
    const who = document.getElementById("who");
    if (who) who.innerHTML = whoHTML();
    document.title = `${pageTitle()} · Continuum`;
  }

  function healthHTML(problems) {
    const status = problems.length ? "fail" : "ok";
    const banner = problems.length
      ? `<div class="banner" role="alert">The sample record failed a consistency check: ${esc(problems.join("; "))}.</div>`
      : "";
    return `${banner}<p id="health" class="vh" data-health="${status}">${esc(problems.join("; ") || "ok")}</p>`;
  }

  function render(options = {}) {
    const y = window.scrollY;
    const active = document.activeElement;
    const restore = active && active.dataset && active.dataset.action && active.dataset.id
      ? { action: active.dataset.action, id: active.dataset.id, type: active.dataset.type || "" }
      : null;
    renderChrome();
    const root = document.getElementById("app");
    root.innerHTML = healthHTML(health()) + page();
    if (options.scroll === "top") window.scrollTo(0, 0);
    else window.scrollTo(0, y);
    if (restore && options.scroll !== "top") {
      const selector = restore.type
        ? `[data-action="${restore.action}"][data-type="${restore.type}"][data-id="${CSS.escape(restore.id)}"]`
        : `[data-action="${restore.action}"][data-id="${CSS.escape(restore.id)}"]`;
      const next = document.querySelector(selector);
      if (next && next !== document.activeElement) next.focus({ preventScroll: true });
    }
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
    persist();
    render();
  }

  function onClick(event) {
    const node = event.target.closest("[data-action]");
    if (!node) return;
    const action = node.dataset.action;
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
    if (action === "set-role") {
      state.role = node.dataset.role;
      persist();
      if (state.role === "student" && state.route === "cohort") {
        go("panel");
        return;
      }
      render();
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
    if (action === "reset") {
      const ok = window.confirm("Clear challenges, mentor notes, and reports saved in this browser?");
      if (!ok) return;
      try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
      const route = state.route;
      const param = state.param;
      state = blank();
      state.route = route;
      state.param = param;
      render();
    }
  }

  function onChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
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
    if (event.key !== "Enter" && event.key !== " ") return;
    const node = event.target.closest(".network .node");
    if (!node) return;
    event.preventDefault();
    state.competencyId = node.dataset.id;
    persist();
    render();
  }

  function init() {
    const root = document.getElementById("app");
    if (!A) {
      root.innerHTML = "<p>The atelier data did not load.</p>";
      return;
    }
    load();
    if (!location.hash) history.replaceState(null, "", "#model");
    const route = readRoute();
    state.route = route.route;
    state.param = route.param;
    render({ scroll: "top" });
    window.addEventListener("hashchange", () => {
      const next = readRoute();
      state.route = next.route;
      state.param = next.param;
      render({ scroll: "top" });
    });
    document.body.addEventListener("click", onClick);
    document.body.addEventListener("change", onChange);
    document.body.addEventListener("submit", onSubmit);
    document.body.addEventListener("input", onInput);
    document.body.addEventListener("keydown", onKeydown);
  }

  init();
})();
