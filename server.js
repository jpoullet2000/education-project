/* Continuum atelier server.
   Serves the static pages and answers the student assistant.
   The key is XAI_API_KEY in the environment or in a git-ignored .env file.
   It never goes to the browser. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const MODEL = "grok-4.7";
const FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/data.js": ["data.js", "text/javascript; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
};

const MOODS = {
  steady: "Steady. Offer one coming sitting and one task. If they ask which skills to learn, name the first two in toLearn.",
  curious: "Curious. They can take a slightly longer stretch. If they ask which skills to learn, name up to three from toLearn, and what the next part of the first one rests on.",
  tired: "Tired. Keep it short. Name the first skill in toLearn and one small task. Do not add a second skill.",
  stuck: "Stuck. Give one very small next step on the first skill in toLearn, and say what finished looks like.",
  overwhelmed: "Overwhelmed. Name only the next sitting. If they asked which skills to learn, name only the first skill in toLearn and say the others can wait. Do not assign a task unless they asked for one.",
};

function loadEnv() {
  if (process.env.XAI_API_KEY) return;
  let text = "";
  try {
    text = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    return;
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*XAI_API_KEY\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    let value = match[1];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) process.env.XAI_API_KEY = value;
  }
}

function clip(value, max) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function take(value, max, map) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  for (const item of value) {
    if (rows.length >= max) break;
    const clean = map(item);
    if (clean) rows.push(clean);
  }
  return rows;
}

function cleanSitting(item) {
  if (!item || typeof item !== "object") return null;
  const title = clip(item.title, 120);
  if (!title) return null;
  return {
    date: clip(item.date, 20),
    weekday: clip(item.weekday, 20),
    start: clip(item.start, 8),
    end: clip(item.end, 8),
    kind: clip(item.kind, 20),
    title,
    place: clip(item.place, 80),
    points: clip(item.points, 40),
  };
}

function cleanOpen(item) {
  const sitting = cleanSitting(item);
  if (!sitting) return null;
  sitting.places = clip(item.places, 40);
  sitting.skills = take(item.skills, 8, (name) => clip(name, 40) || null);
  return sitting;
}

function cleanSkill(item) {
  if (!item || typeof item !== "object") return null;
  const name = clip(item.name, 40);
  if (!name) return null;
  const room = Number(item.room);
  return {
    name,
    field: clip(item.field, 40),
    stage: clip(item.stage, 40),
    points: Number.isInteger(item.points) ? item.points : null,
    room: Number.isInteger(room) ? Math.max(0, Math.min(4, room)) : null,
    parts: take(item.parts, 6, (part) => {
      if (!part || typeof part !== "object") return null;
      const partName = clip(part.name, 60);
      if (!partName) return null;
      return {
        name: partName,
        restsOn: take(part.restsOn, 3, (prior) => clip(prior, 80) || null),
      };
    }),
  };
}

function cleanProposal(item) {
  if (!item || typeof item !== "object") return null;
  const name = clip(item.name, 40);
  if (!name) return null;
  const room = Number(item.room);
  const row = {
    name,
    field: clip(item.field, 40),
    stage: clip(item.stage, 40),
    room: Number.isInteger(room) ? Math.max(0, Math.min(4, room)) : null,
    why: clip(item.why, 80),
  };
  const where = clip(item.where, 120);
  if (where) row.where = where;
  return row;
}

function cleanTask(item) {
  if (!item || typeof item !== "object") return null;
  const name = clip(item.name, 80);
  if (!name) return null;
  return {
    name,
    kind: clip(item.kind, 20),
    where: clip(item.where, 80),
    skills: take(item.skills, 6, (skill) => clip(skill, 40) || null),
  };
}

function cleanSnapshot(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    name: clip(src.name, 40),
    today: clip(src.today, 20),
    projects: take(src.projects, 6, (name) => clip(name, 80) || null),
    recommendedProject: clip(src.recommendedProject, 80),
    agenda: take(src.agenda, 8, cleanSitting),
    open: take(src.open, 8, cleanOpen),
    skills: take(src.skills, 16, cleanSkill),
    toLearn: take(src.toLearn, 6, cleanProposal),
    tasks: take(src.tasks, 12, cleanTask),
  };
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return [];
  const rows = [];
  for (const item of raw) {
    if (!item || (item.role !== "user" && item.role !== "assistant")) continue;
    const content = clip(item.content, 1200);
    if (!content) continue;
    rows.push({ role: item.role, content });
  }
  return rows.slice(-8);
}

function systemPrompt(mood, snapshot) {
  return [
    "You are the Continuum atelier assistant. You speak to one student about their own coming sittings, about a task that could move a skill, and about which skills to work on from their current stages.",
    `The student's name is ${snapshot.name || "the student"}. Today in the atelier is ${snapshot.today || "the date in the record"}. Use that date. Do not use any other calendar.`,
    "Use only the record below. If a sitting, task, or skill is not in the record, say it is not on this plan.",
    "A sitting holds a place. Registering does not add a mark and does not take a project seat. Lectures are 0 points. A workshop or a project can place up to 4 points on each skill it elicits, and only when the work is scored. The line keeps the furthest stage. No evidence yet is not 0 points. Room is how many points a later mark could still add, up to 4.",
    "Parts inside a skill are an order. Derivatives rest on basic calculus, and integrals rest on derivatives. A part is not its own score. Do not say a part is finished or missing.",
    `The student's mood right now is ${mood}. ${MOODS[mood]}`,
    "This mood replaces any mood from earlier in the conversation. Name the mood in the first sentence, and let it change what you ask them to do.",
    "When you suggest a task, use a task from the record, or practice on a part of a skill that still has room. Say which skill it would move. Do not invent a new assignment.",
    "toLearn is this student's progress, already put in order. Shared subjects short of proficient come first, then skills already started and still short of proficient, then room left before advanced. When they ask which skills to learn, or when you suggest what to work on, propose only skills from toLearn, in that order. Name the skill, its field, and its stage. Use the why. If where is set, that sitting can carry the skill. Naming it does not register them. If toLearn is empty, say the lines you can see are as far as a skill goes. A proposal is advice. It does not place a mark.",
    "Write plain sentences. No headings and no bullet lists. At most 90 words, or 120 when they ask which skills to learn and the mood is steady or curious. If the mood is tired, at most 45 words and only one skill. If the mood is overwhelmed, at most 40 words, name the next sitting, and do not assign a task unless the student asked for one.",
    "",
    "Record:",
    JSON.stringify(snapshot),
  ].join("\n");
}

function replyText(data) {
  if (data && typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const output = data && Array.isArray(data.output) ? data.output : [];
  const chunks = [];
  for (const item of output) {
    if (!item || item.type !== "message") continue;
    if (typeof item.content === "string") chunks.push(item.content);
    if (!Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && (part.type === "output_text" || part.type === "text") && part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function send(res, status, body, type) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": type || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 40000) {
        reject(Object.assign(new Error("That note is too long to send."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (err) {
        reject(Object.assign(new Error("The assistant needs a JSON body."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

async function askModel(mood, messages, snapshot) {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    const error = new Error("The assistant needs XAI_API_KEY on the server.");
    error.status = 503;
    throw error;
  }
  let response;
  try {
    response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: systemPrompt(mood, snapshot) },
          ...messages,
        ],
      }),
      signal: AbortSignal.timeout(55000),
    });
  } catch (err) {
    console.error("assistant upstream failed");
    const error = new Error("The assistant could not answer just now.");
    error.status = 502;
    throw error;
  }
  if (response.status === 401 || response.status === 403) {
    console.error("assistant upstream", response.status);
    const error = new Error("The atelier key was refused. Check XAI_API_KEY.");
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    console.error("assistant upstream", response.status);
    const error = new Error("The assistant could not answer just now.");
    error.status = 502;
    throw error;
  }
  const data = await response.json();
  const reply = replyText(data);
  if (!reply) {
    const error = new Error("The assistant sent an empty reply.");
    error.status = 502;
    throw error;
  }
  return reply.slice(0, 2000);
}

async function handleAssistant(req, res) {
  const body = await readBody(req);
  const mood = clip(body.mood, 20);
  if (!MOODS[mood]) {
    send(res, 400, { error: "Choose a mood before asking." });
    return;
  }
  const messages = cleanMessages(body.messages);
  if (!messages.some((item) => item.role === "user")) {
    send(res, 400, { error: "Write a question, or pick one of the three above." });
    return;
  }
  const reply = await askModel(mood, messages, cleanSnapshot(body.snapshot));
  send(res, 200, { reply });
}

function handleStatic(req, res) {
  const target = FILES[req.url.split("?")[0]];
  if (!target) {
    send(res, 404, "Not found.", "text/plain; charset=utf-8");
    return;
  }
  fs.readFile(path.join(ROOT, target[0]), (err, buf) => {
    if (err) {
      send(res, 404, "Not found.", "text/plain; charset=utf-8");
      return;
    }
    res.writeHead(200, {
      "Content-Type": target[1],
      "Cache-Control": "no-store",
      "Content-Length": buf.length,
    });
    res.end(buf);
  });
}

loadEnv();

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url.split("?")[0] === "/api/assistant") {
    handleAssistant(req, res).catch((err) => {
      if (res.headersSent) return;
      send(res, err.status || 500, { error: err.status ? err.message : "The assistant could not answer just now." });
    });
    return;
  }
  if (req.method === "GET") {
    handleStatic(req, res);
    return;
  }
  send(res, 405, { error: "That request is not available." });
});

const chosen = Number(process.env.PORT);
const port = Number.isInteger(chosen) && chosen >= 0 ? chosen : 4173;
server.requestTimeout = 70000;
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  console.log(`Continuum atelier at http://127.0.0.1:${address.port}`);
});
