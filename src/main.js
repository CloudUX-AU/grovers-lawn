// Edge-adjacent steps, so every tile is reachable. Up/down and left/right are true opposites.
const DIRS = {
  up: { x: -1, y: 0 },
  down: { x: 1, y: 0 },
  left: { x: 0, y: 1 },
  right: { x: 0, y: -1 },
};

const KEY_DIR = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const els = {
  overlay: document.getElementById("overlay"),
  card: document.getElementById("card"),
  round: document.getElementById("round-label"),
  timer: document.getElementById("timer"),
  pips: document.getElementById("pips"),
  catcher: document.getElementById("catcher-fill"),
  catcherLabel: document.getElementById("catcher-label"),
  left: document.getElementById("left"),
  score: document.getElementById("score"),
  status: document.getElementById("status"),
  hint: document.getElementById("hint"),
  stage: document.getElementById("stage"),
};

const held = [];
const edges = new Set();
let queuedDir = null;

function actor(x, y) {
  return {
    x,
    y,
    fromX: x,
    fromY: y,
    hop: 1,
    hopDur: 0.14,
    dir: "down",
    flip: false,
  };
}

function makeGame(round, score, mowers) {
  const world = createWorld(round, difficulty);
  return {
    mode: "title",
    round,
    mowers,
    score,
    world,
    player: actor(START.x, START.y),
    mower: actor(START.x, START.y),
    riding: true,
    carryingPoo: false,
    catcher: 0,
    capacity: world.params.capacity,
    timeLeft: world.params.time,
    soaked: false,
    wet: false,
    stall: 0,
    cuttingT: 0,
    fullNotice: 0,
    heldClear: false,
    clearTimeLeft: 0,
    roundPoo: 0,
    lastBonus: null,
    script: [],
    truckT: 0,
    truckX: -1.4,
    dumpT: 0,
    boomT: 0,
    boomAge: 0,
    shake: 0,
    winT: 0,
    time: 0,
    mood: 1,
    particles: [],
    floaters: [],
  };
}

let difficulty = "normal";
let game = makeGame(1, 0, 3);
let nextBark = 2.4;

function setDifficulty(id) {
  if (!DIFFICULTY[id] || id === difficulty) return;
  difficulty = id;
  if (game.mode === "title" || game.mode === "over") {
    resetRound(game.mode === "title" ? 1 : game.round, game.mode === "title" ? 0 : game.score, game.mode === "title" ? 3 : game.mowers, game.mode);
    return;
  }
  applyDifficulty(game.world, id);
}

function resetRound(round, score, mowers, mode) {
  const scoreKeep = score;
  const mowerKeep = mowers;
  queuedDir = null;
  game = makeGame(round, scoreKeep, mowerKeep);
  game.mode = mode;
  if (mode === "intro") {
    game.script = INTRO.map((s) => ({ ...s }));
    game.player.hopDur = 0.16;
    game.mower.hopDur = 0.16;
  }
}

function screenOf(body) {
  const v = visualOf(body);
  const elev = body === game.mower && !game.riding ? 1 : 1;
  return project(v.x, v.y, elev);
}

function floater(text, body, color) {
  const p = screenOf(body);
  game.floaters.push({ text, x: p.x, y: p.y - 36, life: 1.1, color });
}

function burst(body, colors) {
  const p = screenOf(body);
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 50 + Math.random() * 160;
    const color = colors[i % colors.length];
    game.particles.push({
      x: p.x,
      y: p.y - 10,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 40,
      life: 0.55 + Math.random() * 0.4,
      max: 0.9,
      color,
      g: 320,
    });
  }
}

function beginHop(body, nx, ny, dir) {
  const screenDx = nx - body.x - (ny - body.y);
  body.flip = screenDx < 0;
  body.fromX = body.x;
  body.fromY = body.y;
  body.x = nx;
  body.y = ny;
  body.hop = 0;
  body.dir = dir;
}

function syncRider() {
  if (!game.riding) return;
  const m = game.mower;
  const p = game.player;
  p.x = m.x;
  p.y = m.y;
  p.fromX = m.fromX;
  p.fromY = m.fromY;
  p.hop = m.hop;
  p.dir = m.dir;
  p.flip = m.flip;
}

function standingTile(body) {
  if (body.hop >= 0.55) return { x: body.x, y: body.y };
  return { x: body.fromX, y: body.fromY };
}

function arrive() {
  const m = game.mower;
  scootDogs(game.world, m.x, m.y);
  if (hasPoo(game.world, m.x, m.y)) {
    const poo = pooAt(game.world, m.x, m.y);
    if (poo) poo.smeared = true;
    game.stall = 0.72;
    floater("Poo!", m, "#6a3418");
    soundGrrr();
    return;
  }
  if (game.catcher >= game.capacity) {
    const tile = game.world.tiles[m.y][m.x];
    if (tile && tile.type === "grass" && tile.growth !== "short") {
      if (game.fullNotice <= 0) {
        floater("Full", m, "#9a3030");
        game.fullNotice = 0.8;
      }
    }
    return;
  }
  if (cutTile(game.world, m.x, m.y)) {
    game.catcher += 1;
    game.cuttingT = 0.16;
    burst(m, ["#8ed15c", "#d6e86a", "#f4efe4"]);
  }
}

function tryMove(dir) {
  if (game.mode !== "play" || game.stall > 0) return;
  const body = game.riding ? game.mower : game.player;
  if (body.hop < 1) return;
  const d = DIRS[dir];
  const nx = body.x + d.x;
  const ny = body.y + d.y;
  if (!isWalkable(game.world, nx, ny)) return;
  beginHop(body, nx, ny, dir);
  if (game.riding) syncRider();
  else scootDogs(game.world, game.player.x, game.player.y);
}

function interact() {
  if (game.mode !== "play") return;
  const bin = game.world.greenbin;
  const dogbin = game.world.dogbin;
  if (game.riding) {
    if (game.mower.hop < 1) return;
    if (game.catcher > 0 && nearPoint(game.mower.x, game.mower.y, bin.x, bin.y)) {
      game.catcher = 0;
      floater("Emptied", game.mower, "#1f6b38");
    }
    return;
  }
  if (game.player.hop < 1) return;
  if (game.carryingPoo && nearPoint(game.player.x, game.player.y, dogbin.x, dogbin.y)) {
    game.carryingPoo = false;
    game.roundPoo += 1;
    game.score += 100;
    floater("+100", game.player, "#1f6b38");
    soundPoo();
    return;
  }
  if (!game.carryingPoo && hasPoo(game.world, game.player.x, game.player.y)) {
    removePoo(game.world, game.player.x, game.player.y);
    game.carryingPoo = true;
    floater("Got it", game.player, "#6a3418");
    soundPoo();
  }
}

function toggleRide() {
  if (game.mode !== "play" || game.stall > 0) return;
  if (game.riding) {
    if (game.mower.hop < 1) return;
    game.riding = false;
    const p = game.player;
    p.x = game.mower.x;
    p.y = game.mower.y;
    p.fromX = p.x;
    p.fromY = p.y;
    p.hop = 1;
    p.flip = game.mower.flip;
    return;
  }
  if (game.player.hop < 1 || game.mower.hop < 1) return;
  if (game.player.x === game.mower.x && game.player.y === game.mower.y) {
    game.riding = true;
    syncRider();
  }
}

function finishClear() {
  const timeBonus = Math.round(game.timeLeft * 10);
  const dry = game.soaked ? 0 : 500;
  game.score += timeBonus + dry;
  game.lastBonus = { timeBonus, dry, poo: game.roundPoo * 100 };
  game.mode = "dump";
  game.dumpT = 1.15;
}

function resolveTruck() {
  if (isClear(game.world)) {
    finishClear();
    return;
  }
  game.mowers -= 1;
  game.mode = "boom";
  game.boomT = 1.7;
  game.boomAge = 0;
  game.shake = 1;
  burst(game.mower, ["#f2d23a", "#e25b2a", "#f7f4ea", "#9a3030"]);
}

function updateIntro(dt) {
  const m = game.mower;
  if (m.hop < 1) {
    m.hop = Math.min(1, m.hop + dt / m.hopDur);
    syncRider();
    if (m.hop >= 1) arrive();
    return;
  }
  if (!game.script.length) {
    game.mode = "play";
    game.player.hopDur = 0.13;
    game.mower.hopDur = 0.13;
    return;
  }
  const next = game.script.shift();
  beginHop(m, next.x, next.y, "down");
  syncRider();
}

function updatePlay(dt) {
  const body = game.riding ? game.mower : game.player;
  if (body.hop < 1 && game.stall <= 0) {
    body.hop = Math.min(1, body.hop + dt / body.hopDur);
    if (game.riding) syncRider();
    if (body.hop >= 1) {
      if (game.riding) arrive();
      else scootDogs(game.world, game.player.x, game.player.y);
    }
  } else if (game.stall <= 0 && (queuedDir || held.length)) {
    tryMove(queuedDir || held[held.length - 1]);
    queuedDir = null;
  }

  updateWorld(game.world, dt, [
    { x: game.player.x, y: game.player.y },
    { x: game.mower.x, y: game.mower.y },
  ]);

  if (isClear(game.world) && !game.carryingPoo) {
    game.clearTimeLeft = game.timeLeft;
    game.heldClear = true;
    finishClear();
    return;
  }

  game.timeLeft = Math.max(0, game.timeLeft - dt);
  const approach = 5;
  if (game.timeLeft < approach) {
    const p = 1 - game.timeLeft / approach;
    game.truckT = 1;
    game.truckX = -1.4 + (game.world.greenbin.x + 1.4) * p;
  }
  if (game.timeLeft <= 0) resolveTruck();
}

function update(dt) {
  game.time += dt;
  game.stall = Math.max(0, game.stall - dt);
  game.cuttingT = Math.max(0, game.cuttingT - dt);
  game.fullNotice = Math.max(0, game.fullNotice - dt);
  game.shake = Math.max(0, game.shake - dt * 1.4);

  if (game.mode === "intro") updateIntro(dt);
  else if (game.mode === "play") updatePlay(dt);
  else if (game.mode === "dump") {
    game.dumpT -= dt;
    game.world.clock += dt;
    if (game.dumpT <= 0) game.mode = "win";
  } else if (game.mode === "boom") {
    game.boomT -= dt;
    game.boomAge += dt;
    if (game.boomT <= 0) {
      if (game.mowers <= 0) game.mode = "over";
      else resetRound(game.round, game.score, game.mowers, "intro");
    }
  } else if (game.mode === "title" || game.mode === "intro" || game.mode === "win" || game.mode === "over") {
    game.world.clock += dt;
    for (const dog of game.world.dogs) dog.anim += dt;
  }

  const wasWet = game.wet;
  const foot = standingTile(game.riding ? game.mower : game.player);
  game.wet = game.mode === "play" && sprayHits(game.world, foot.x, foot.y);
  if (game.wet && !wasWet) soundGrrr();
  if (game.wet) game.soaked = true;

  if (game.mode === "play" || game.mode === "intro") {
    nextBark -= dt;
    if (nextBark <= 0 && game.world.dogs.length) {
      soundBark();
      nextBark = 2.2 + Math.random() * 2.5;
    }
  }

  const spraying = game.world.sprinklers.some((sprinkler) => {
    if (!sprinklerOn(game.world.clock, sprinkler.i, game.world.params.sprinkleFor)) return false;
    return Math.max(Math.abs(sprinkler.x - foot.x), Math.abs(sprinkler.y - foot.y)) <= 2;
  });
  const engineOn = (game.mode === "play" || game.mode === "intro") && game.riding && game.mode !== "boom";
  const rumble = !engineOn ? 0 : game.stall > 0 ? 0.06 : game.cuttingT > 0 || game.mower.hop < 1 ? 0.26 : 0.14;
  soundScene(spraying && game.mode !== "over", rumble);

  let mood = 1;
  if (game.wet) mood = 2;
  const nearPoo = game.world.poos.some((p) => Math.abs(p.x - foot.x) + Math.abs(p.y - foot.y) <= 1);
  if (nearPoo) mood = Math.max(mood, 2);
  if (game.stall > 0 || game.mode === "boom") mood = 3;
  game.mood = mood;

  for (const part of game.particles) {
    part.life -= dt;
    part.vy += part.g * dt;
    part.x += part.vx * dt;
    part.y += part.vy * dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
  for (const f of game.floaters) {
    f.life -= dt;
    f.y -= 18 * dt;
  }
  game.floaters = game.floaters.filter((f) => f.life > 0);

  if (edges.has("act")) interact();
  if (edges.has("ride")) toggleRide();
  edges.clear();
}

function fmt(t) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function renderHud() {
  els.round.textContent = `Round ${game.round}`;
  document.querySelectorAll("[data-diff]").forEach((button) => {
    button.classList.toggle("on", button.dataset.diff === difficulty);
  });
  els.timer.textContent = fmt(game.timeLeft);
  els.timer.classList.toggle("warn", game.timeLeft <= 10 && game.mode === "play");
  els.left.textContent = String(tilesLeft(game.world));
  els.left.classList.toggle("warn", tilesLeft(game.world) > 0 && game.timeLeft <= 12 && game.mode === "play");
  els.score.textContent = String(game.score);
  const pct = Math.round((game.catcher / game.capacity) * 100);
  els.catcher.style.width = `${pct}%`;
  els.catcherLabel.textContent = `${game.catcher}/${game.capacity}`;
  els.pips.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const pip = document.createElement("i");
    pip.className = i < game.mowers ? "pip" : "pip off";
    els.pips.appendChild(pip);
  }
  const wet = game.soaked;
  els.status.textContent = game.carryingPoo ? "Carrying poo" : wet ? "Wet" : "Dry";
  els.status.className = game.carryingPoo ? "" : wet ? "wet" : "dry";

  if (game.mode === "play") {
    const pooLeft = game.world.poos.length;
    if (game.stall > 0) els.hint.textContent = "The mower is sitting in it. Hop off and shovel that poo to the dog bin.";
    else if (game.catcher >= game.capacity) els.hint.textContent = "Catcher is full. Drive onto the green bin by the road and press E.";
    else if (!game.riding && game.carryingPoo) els.hint.textContent = "Carry it to the dog bin at the side of the lawn and press E.";
    else if (pooLeft && tilesLeft(game.world) === pooLeft) els.hint.textContent = "Grass is cut. Hop off and shovel every poo off the lawn. The round waits until the grass is clean.";
    else if (!game.riding) els.hint.textContent = "On foot with the shovel. Stand on a poo and press E. Space gets back on the mower when you are standing on it.";
    else els.hint.textContent = "Mow every tile before the weeds return. Arrows move. Space hops off. E empties the catcher.";
  }
}

function card(html) {
  els.card.dataset.kind = "";
  els.card.innerHTML = html;
  els.overlay.classList.remove("hidden");
}

function renderOverlay() {
  if (game.mode === "title") {
    els.overlay.classList.add("splash");
    els.overlay.classList.remove("hidden");
    if (els.card.dataset.kind !== "splash") {
      els.card.dataset.kind = "splash";
      els.card.innerHTML = `
        <img src="assets/splash.jpg" alt="Grover's Lawn" />
        <p class="go">Press any key</p>
      `;
    }
    return;
  }
  els.overlay.classList.remove("splash");
  if (game.mode === "win") {
    const b = game.lastBonus || { timeBonus: 0, dry: 0, poo: 0 };
    const next = roundParams(game.round + 1, difficulty);
    const now = roundParams(game.round, difficulty);
    const sooner = Math.max(0, now.time - next.time);
    card(`
      <h2>Round ${game.round} clear</h2>
      <p>The truck has the clippings. Score ${game.score}.</p>
      <p>Time left +${b.timeBonus}. ${b.dry ? "Stayed dry, +500." : "No dry bonus. The sprinklers got him."} Poo binned +${b.poo}.</p>
      <p>Round ${game.round + 1} is a little harder. The truck comes ${sooner ? `${sooner} seconds sooner` : "just as soon"}, weeds sprout a little earlier, and the dogs are a bit less patient. Same mowers, fresh grass.</p>
      <p class="go">Press any key when you're ready</p>
    `);
    return;
  }
  if (game.mode === "over") {
    card(`
      <h2>Game over</h2>
      <p>Three mowers, all of them in pieces. Score ${game.score}.</p>
      <p class="go">Press any key</p>
    `);
    return;
  }
  if (game.mode === "boom") {
    card(`
      <h2>The mower blew up</h2>
      <p>${game.mowers > 0 ? `${game.mowers} left in the garage.` : "That was the last one."}</p>
    `);
    return;
  }
  els.overlay.classList.add("hidden");
}

function frame(now) {
  if (!frame.last) frame.last = now;
  const dt = Math.min(0.05, (now - frame.last) / 1000);
  frame.last = now;
  update(dt);
  draw(ctx, game);
  renderHud();
  renderOverlay();
  requestAnimationFrame(frame);
}

function startFromCard() {
  if (game.mode === "title") resetRound(1, 0, 3, "intro");
  else if (game.mode === "over") resetRound(1, 0, 3, "intro");
  else if (game.mode === "win") resetRound(game.round + 1, game.score, game.mowers, "intro");
}

function onKeyDown(e) {
  soundStart();
  if (e.repeat) return;
  const dir = KEY_DIR[e.code];
  if (dir || e.code === "Space" || e.code === "KeyE" || e.code.startsWith("Digit")) e.preventDefault();
  if (e.code === "Digit1") {
    setDifficulty("easy");
    return;
  }
  if (e.code === "Digit2") {
    setDifficulty("normal");
    return;
  }
  if (e.code === "Digit3") {
    setDifficulty("hard");
    return;
  }
  if (game.mode === "title" || game.mode === "win" || game.mode === "over") {
    startFromCard();
    return;
  }
  if (dir) {
    if (!held.includes(dir)) held.push(dir);
    queuedDir = dir;
  }
  if (e.code === "Space") edges.add("ride");
  if (e.code === "KeyE") edges.add("act");
}

function onKeyUp(e) {
  const dir = KEY_DIR[e.code];
  if (!dir) return;
  const i = held.indexOf(dir);
  if (i >= 0) held.splice(i, 1);
}

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
document.getElementById("diff").addEventListener("click", (event) => {
  const button = event.target.closest("[data-diff]");
  if (!button) return;
  setDifficulty(button.dataset.diff);
  els.stage.focus();
});
els.stage.addEventListener("click", () => {
  soundStart();
  els.stage.focus();
  if (game.mode === "title" || game.mode === "win" || game.mode === "over") startFromCard();
});

requestAnimationFrame(frame);
