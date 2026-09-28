// Isometric drawing. The ride-on is a transparent PNG; the rest is painted.

const VIEW_W = 1100;
const VIEW_H = 720;
const TILE_W = 92;
const TILE_H = 46;
const HW = TILE_W / 2;
const HH = TILE_H / 2;
const LIFT = 28;
const ORIGIN_X = 508;
const ORIGIN_Y = 118;

const PX = 3;

function loadSprite(file) {
  const img = new Image();
  img.src = `assets/${file}`;
  return img;
}

const riderSprite = loadSprite("mower-rider.png");
const grimaceSprite = loadSprite("mower-rider-grimace.png");
const emptySprite = loadSprite("mower-empty.png");
const walkSprite = loadSprite("grover-walk.png");
const walkGrimaceSprite = loadSprite("grover-walk-grimace.png");

function hash(x, y) {
  return ((x * 374761393 + y * 668265263) >>> 0) % 1000;
}

function elevOf(type) {
  if (!type || type === "water") return 0;
  if (type === "road" || type === "greenbin") return 0.42;
  return 1;
}

function project(x, y, elev = 0) {
  return {
    x: ORIGIN_X + (x - y) * HW,
    y: ORIGIN_Y + (x + y) * HH - elev * LIFT,
  };
}

function ease(t) {
  const c1 = 1.45;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function visualOf(body) {
  const t = body.hop >= 1 ? 1 : ease(Math.min(1, Math.max(0, body.hop)));
  return {
    x: body.fromX + (body.x - body.fromX) * t,
    y: body.fromY + (body.y - body.fromY) * t,
  };
}

function hopLift(body, time) {
  if (body.hop >= 1) return 0;
  return Math.sin(body.hop * Math.PI) * 16;
}

function traceDiamond(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + HW, y + HH);
  ctx.lineTo(x, y + TILE_H);
  ctx.lineTo(x - HW, y + HH);
  ctx.closePath();
}

function fillDiamond(ctx, x, y, color) {
  traceDiamond(ctx, x, y);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCliff(ctx, x, y, depth, side) {
  if (depth < 1) return;
  ctx.beginPath();
  if (side === "left") {
    ctx.moveTo(x - HW, y + HH);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x, y + TILE_H + depth);
    ctx.lineTo(x - HW, y + HH + depth);
  } else {
    ctx.moveTo(x + HW, y + HH);
    ctx.lineTo(x, y + TILE_H);
    ctx.lineTo(x, y + TILE_H + depth);
    ctx.lineTo(x + HW, y + HH + depth);
  }
  ctx.closePath();
  ctx.fillStyle = side === "left" ? "#5e3b28" : "#7a4e34";
  ctx.fill();
  ctx.strokeStyle = "#3e281c";
  ctx.lineWidth = 1;
  ctx.stroke();
  // Dirt speckles.
  ctx.fillStyle = "rgba(40, 24, 16, 0.35)";
  for (let i = 0; i < 4; i++) {
    const px = side === "left" ? x - HW * 0.55 + i * 7 : x + 8 + i * 7;
    const py = y + TILE_H * 0.72 + (i % 2) * 6;
    ctx.fillRect(px, py, 3, 2);
  }
}

function drawSky(ctx, time) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, "#b7e6df");
  g.addColorStop(1, "#7ec8c0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  const drift = (time * 18) % (VIEW_W + 200);
  ctx.beginPath();
  ctx.ellipse(drift - 80, 78, 90, 22, 0, 0, Math.PI * 2);
  ctx.ellipse(drift + 20, 70, 54, 16, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrassTop(ctx, sx, sy, x, y, growth, time) {
  const base =
    growth === "short" ? "#8ed15c" : growth === "sprout" ? "#7ec454" : growth === "tall" ? "#4e9234" : "#3f8a30";
  fillDiamond(ctx, sx, sy, base);
  ctx.save();
  traceDiamond(ctx, sx, sy);
  ctx.clip();
  if (growth === "short" || growth === "sprout") {
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    for (let i = -3; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(sx - HW, sy + HH + i * 6);
      ctx.lineTo(sx + HW, sy + HH + i * 6 - 8);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = growth === "tall" ? "#2f6a24" : "#2d6422";
    ctx.lineWidth = 2;
    const n = growth === "tall" ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const px = sx - 28 + ((hash(x, y) + i * 17) % 58);
      const py = sy + 10 + ((hash(x + 3, y + i) + i * 9) % 26);
      const sway = Math.sin(time * 3 + i + x) * 1.4;
      ctx.beginPath();
      ctx.moveTo(px, py + 10);
      ctx.lineTo(px + sway, py);
      ctx.stroke();
    }
  }
  if (growth === "sprout" || growth === "tall") {
    const weeds = growth === "tall" ? 4 : 2;
    for (let i = 0; i < weeds; i++) {
      const px = sx - 24 + ((hash(x + i, y) + i * 19) % 48);
      const py = sy + 14 + ((hash(y, x + i) + i * 11) % 18);
      const h = growth === "tall" ? 16 : 8;
      ctx.fillStyle = "#d6e86a";
      ctx.fillRect(px, py - h, 2, h);
      ctx.fillStyle = growth === "tall" && i % 2 === 0 ? "#f2d23a" : "#67a83a";
      ctx.beginPath();
      ctx.arc(px + 1, py - h, growth === "tall" ? 3.5 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(30, 60, 24, 0.45)";
  ctx.lineWidth = 1;
  traceDiamond(ctx, sx, sy);
  ctx.stroke();
}

function drawHedge(ctx, sx, sy, time, x, y) {
  const bob = Math.sin(time * 2.2 + x + y) * 1;
  ctx.fillStyle = "#245c30";
  ctx.beginPath();
  ctx.moveTo(sx, sy + 6 + bob);
  ctx.lineTo(sx + HW - 4, sy + HH + 2);
  ctx.lineTo(sx, sy + TILE_H - 4);
  ctx.lineTo(sx - HW + 4, sy + HH + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3d8a42";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 4 + bob, 24, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(sx - 16, sy + 14 + bob, 16, 10, 0.2, 0, Math.PI * 2);
  ctx.ellipse(sx + 16, sy + 14 + bob, 16, 10, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8fd36a";
  ctx.fillRect(sx - 8, sy - 2 + bob, 4, 3);
  ctx.fillRect(sx + 6, sy + 4 + bob, 3, 3);
}

function drawFlowers(ctx, sx, sy, time, x) {
  fillDiamond(ctx, sx, sy, "#6a4028");
  const colors = ["#e25b78", "#f2c14e", "#f7f4ea", "#d6456a"];
  for (let i = 0; i < 5; i++) {
    const px = sx - 22 + i * 10 + (i % 2) * 4;
    const py = sy + 16 + (i % 3) * 6 + Math.sin(time * 2.4 + i + x) * 1.5;
    ctx.fillStyle = "#2f7a38";
    ctx.fillRect(px, py, 2, 8);
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(px + 1, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6e27a";
    ctx.fillRect(px, py - 1, 2, 2);
  }
}

function drawRoad(ctx, sx, sy) {
  fillDiamond(ctx, sx, sy, "#5c636c");
  ctx.save();
  traceDiamond(ctx, sx, sy);
  ctx.clip();
  ctx.strokeStyle = "#d8c15a";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(sx - 10, sy + HH);
  ctx.lineTo(sx + 10, sy + HH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPath(ctx, sx, sy) {
  fillDiamond(ctx, sx, sy, "#c2b49a");
  ctx.fillStyle = "rgba(90, 70, 50, 0.35)";
  ctx.fillRect(sx - 8, sy + 18, 3, 2);
  ctx.fillRect(sx + 6, sy + 24, 4, 2);
  ctx.fillRect(sx - 2, sy + 28, 2, 2);
}

function drawDrive(ctx, sx, sy) {
  fillDiamond(ctx, sx, sy, "#d9d3c8");
  ctx.strokeStyle = "rgba(80,80,80,0.25)";
  ctx.strokeRect(sx - 14, sy + 18, 10, 2);
}

function drawHouse(ctx, time) {
  const back = project(2, 0, 1);
  const right = project(8, 0, 1);
  const front = project(8, 2, 1);
  const left = project(2, 2, 1);
  const wall = 62;
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  ctx.beginPath();
  ctx.moveTo(right.x, right.y);
  ctx.lineTo(front.x, front.y);
  ctx.lineTo(front.x, front.y - wall);
  ctx.lineTo(right.x, right.y - wall);
  ctx.closePath();
  ctx.fillStyle = "#d7c4a8";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(front.x, front.y);
  ctx.lineTo(front.x, front.y - wall);
  ctx.lineTo(left.x, left.y - wall);
  ctx.closePath();
  ctx.fillStyle = "#f6ecde";
  ctx.fill();

  const g0 = lerp(left, front, 2 / 6);
  const g1 = lerp(left, front, 4 / 6);
  const opening = wall - 14;
  ctx.beginPath();
  ctx.moveTo(g0.x, g0.y);
  ctx.lineTo(g1.x, g1.y);
  ctx.lineTo(g1.x, g1.y - opening);
  ctx.lineTo(g0.x, g0.y - opening);
  ctx.closePath();
  ctx.fillStyle = "#1a1412";
  ctx.fill();
  ctx.fillStyle = "#e7b089";
  ctx.beginPath();
  ctx.moveTo(g0.x, g0.y - opening);
  ctx.lineTo(g1.x, g1.y - opening);
  ctx.lineTo(g1.x, g1.y - opening - 8);
  ctx.lineTo(g0.x, g0.y - opening - 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#c48462";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(g0.x, g0.y - opening - i * 2);
    ctx.lineTo(g1.x, g1.y - opening - i * 2);
    ctx.stroke();
  }

  for (const t of [0.12, 0.78]) {
    const c = lerp(left, front, t);
    ctx.fillStyle = "#9fd4ea";
    ctx.fillRect(c.x - 7, c.y - wall + 18, 14, 16);
    ctx.strokeStyle = "#6e4638";
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x - 7, c.y - wall + 18, 14, 16);
    ctx.fillStyle = "#f6ecde";
    ctx.fillRect(c.x - 1, c.y - wall + 18, 2, 16);
  }

  ctx.beginPath();
  ctx.moveTo(back.x, back.y - wall - 16);
  ctx.lineTo(right.x + 6, right.y - wall - 8);
  ctx.lineTo(front.x, front.y - wall + 4);
  ctx.lineTo(left.x - 6, left.y - wall - 8);
  ctx.closePath();
  ctx.fillStyle = "#8d4638";
  ctx.fill();
  ctx.strokeStyle = "#6a3028";
  ctx.lineWidth = 2;
  ctx.stroke();

  const chimney = lerp(back, right, 0.72);
  ctx.fillStyle = "#6e4638";
  ctx.fillRect(chimney.x - 6, chimney.y - wall - 36, 12, 28);
  ctx.fillStyle = "rgba(90, 90, 90, 0.45)";
  const puff = (time * 16) % 18;
  ctx.beginPath();
  ctx.arc(chimney.x + 2, chimney.y - wall - 40 - puff, 4 + puff * 0.12, 0, Math.PI * 2);
  ctx.fill();
}


function drawBin(ctx, sx, sy, kind, time) {
  const color = kind === "greenbin" ? "#2f8a45" : "#8a4b32";
  const lid = kind === "greenbin" ? "#3eae58" : "#c46a48";
  ctx.fillStyle = "#3e281c";
  ctx.fillRect(sx - 14, sy + 28, 28, 6);
  ctx.fillStyle = color;
  ctx.fillRect(sx - 12, sy + 8, 24, 22);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(sx - 8, sy + 12, 4, 12);
  ctx.fillStyle = lid;
  const wobble = Math.sin(time * 4) * 0.4;
  ctx.save();
  ctx.translate(sx, sy + 8);
  ctx.rotate(-0.15 + wobble * 0.02);
  ctx.fillRect(-14, -6, 28, 7);
  ctx.restore();
  if (kind === "dogbin") {
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(sx - 3, sy + 16, 6, 6);
  }
}

function drawSprinklerHead(ctx, sx, sy, on, time, index) {
  ctx.fillStyle = "#8d97a1";
  ctx.fillRect(sx - 2, sy + 18, 4, 10);
  ctx.beginPath();
  ctx.arc(sx, sy + 16, 5, 0, Math.PI * 2);
  ctx.fillStyle = on ? "#d8dee6" : "#6d7680";
  ctx.fill();
  if (!on) return;
  ctx.save();
  ctx.translate(sx, sy + 14);
  ctx.strokeStyle = "rgba(186, 224, 245, 0.9)";
  ctx.lineWidth = 2;
  const spin = time * 2.2 + index;
  for (let a = 0; a < 6; a++) {
    const ang = spin + (a * Math.PI) / 3;
    ctx.beginPath();
    ctx.arc(0, 0, 16 + (a % 2) * 6, ang, ang + 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(210, 236, 255, 0.85)";
  for (let i = 0; i < 8; i++) {
    const ang = spin * 1.4 + i;
    const r = 10 + ((time * 30 + i * 9) % 22);
    ctx.fillRect(Math.cos(ang) * r, Math.sin(ang) * r * 0.55, 2, 2);
  }
  ctx.restore();
}

function drawPoo(ctx, sx, sy, poo, time) {
  const jiggle = Math.sin(time * 6 + poo.born) * 0.6;
  ctx.save();
  ctx.translate(sx, sy + 22 + jiggle);
  ctx.fillStyle = "#5a3418";
  ctx.beginPath();
  ctx.ellipse(0, 4, 8, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(-5, 2, 5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(5, 1, 4, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7a4a22";
  ctx.beginPath();
  ctx.ellipse(-2, 1, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (poo.smeared) {
    ctx.fillStyle = "rgba(90, 52, 24, 0.55)";
    ctx.fillRect(-12, 6, 8, 3);
  }
  ctx.fillStyle = "rgba(230, 240, 240, 0.75)";
  for (let i = 0; i < 3; i++) {
    const rise = ((time * 18 + i * 7 + poo.born) % 16);
    ctx.globalAlpha = 1 - rise / 16;
    ctx.beginPath();
    ctx.arc(-4 + i * 4, -rise, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function shadow(ctx, w) {
  ctx.fillStyle = "rgba(20, 30, 20, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 2, w, w * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDog(ctx, dog, time) {
  ctx.save();
  if (dog.flip) ctx.scale(-1, 1);
  const squat = dog.mode === "squat";
  const spin = dog.mode === "spin" ? Math.sin(time * 22) * 0.35 : 0;
  ctx.rotate(spin);
  const bounce = squat ? 0 : Math.abs(Math.sin(dog.anim * 10)) * 3;
  shadow(ctx, 12);
  ctx.translate(0, squat ? 2 : -bounce);
  const coat = dog.kind === "stray" ? "#9aa0a8" : "#d4924a";
  const dark = dog.kind === "stray" ? "#5e646c" : "#8a5524";
  const belly = dog.kind === "stray" ? "#c5c8ce" : "#f0d2a4";

  ctx.save();
  ctx.translate(-12, -11);
  ctx.rotate(Math.sin(dog.anim * 16) * 0.7 - 0.3);
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(5, 1, 6, 2.4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(10, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(0, -7, 12, squat ? 5.5 : 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(1, -5, 7, squat ? 3 : 4, 0, 0, Math.PI);
  ctx.fill();
  if (dog.kind === "stray") {
    ctx.fillStyle = "#6d6454";
    ctx.beginPath();
    ctx.ellipse(-3, -9, 3, 2, 0.4, 0, Math.PI * 2);
    ctx.ellipse(4, -6, 2.2, 1.6, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = dark;
  const step = squat ? 0 : Math.sin(dog.anim * 14);
  const legs = [
    [-8, 6 + step],
    [-2, 6 - step],
    [3, 6 + step],
    [7, 6 - step * 0.6],
  ];
  for (const [lx, len] of legs) {
    ctx.fillRect(lx, -4, 2.6, squat ? 4 : len);
    ctx.fillStyle = "#f2c2b0";
    ctx.fillRect(lx, (squat ? 0 : len - 4) - 1.2, 2.6, 1.3);
    ctx.fillStyle = dark;
  }

  const sniff = dog.mode === "sniff" ? 4 : 0;
  ctx.translate(11, -13 + sniff);
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(-3, -5 + Math.sin(time * 8), 2.2, 3.4, -0.4, 0, Math.PI * 2);
  ctx.ellipse(2, -4.5, 1.8, 2.6, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(3.5, 1.5, 3.2, 2.4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a2420";
  ctx.beginPath();
  ctx.arc(5.2, 1.2, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-1, -1, 1.5, 1.6, 0, 0, Math.PI * 2);
  ctx.ellipse(2.4, -1, 1.5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.arc(-0.6, -0.8, 0.65, 0, Math.PI * 2);
  ctx.arc(2.8, -0.8, 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e37a8a";
  const tongue = squat ? 2.2 : 3.6 + Math.sin(dog.anim * 12);
  ctx.beginPath();
  ctx.ellipse(1.2, 3.2, 1.5, tongue * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  if (dog.kind === "pal") {
    ctx.fillStyle = "#2f4f86";
    ctx.fillRect(-6, -1, 2.4, 2.2);
    ctx.fillStyle = "#d4a017";
    ctx.fillRect(-5.2, -0.2, 1.6, 1.4);
  }
  ctx.restore();
}

function drawTruck(ctx, sx, sy, time) {
  ctx.save();
  ctx.translate(sx, sy + 8);
  shadow(ctx, 28);
  ctx.fillStyle = "#2f6b3a";
  ctx.fillRect(-28, -28, 40, 22);
  ctx.fillStyle = "#3e8f4a";
  ctx.fillRect(-26, -32, 36, 6);
  ctx.fillStyle = "#d8dee4";
  ctx.fillRect(10, -26, 18, 18);
  ctx.fillStyle = "#9fd4ea";
  ctx.fillRect(14, -22, 10, 8);
  ctx.fillStyle = "#222";
  const spin = time * 10;
  for (const wx of [-16, 16]) {
    ctx.beginPath();
    ctx.arc(wx, -2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ccc";
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(spin) * 4, -2);
    ctx.lineTo(wx - Math.cos(spin) * 4, -2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoom(ctx, time) {
  const colors = ["#f2d23a", "#e25b2a", "#f7f4ea", "#9a3030"];
  for (let i = 0; i < 8; i++) {
    const a = time * 6 + i;
    const r = 8 + (time * 40 + i * 6) % 28;
    ctx.fillStyle = colors[i % colors.length];
    ctx.save();
    ctx.translate(Math.cos(a) * r, Math.sin(a) * r * 0.6 - 10);
    ctx.rotate(a);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
}

function draw(ctx, game) {
  const time = game.time;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  if (game.shake > 0) {
    const s = game.shake * 8;
    ctx.translate(Math.sin(time * 60) * s, Math.cos(time * 50) * s);
  }
  drawSky(ctx, time);

  const queue = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (tileAt(game.world, x, y).type === "water") continue;
      queue.push({ z: x + y, kind: "tile", x, y });
    }
  }
  queue.push({ z: 9.2, kind: "house" });
  for (const poo of game.world.poos) queue.push({ z: poo.x + poo.y + 0.15, kind: "poo", poo });
  for (const dog of game.world.dogs) {
    const v = visualOf(dog);
    queue.push({ z: v.x + v.y + 0.3, kind: "dog", dog, v });
  }
  const mv = visualOf(game.mower);
  const pv = visualOf(game.player);
  // Lawn tiles top out near z 20. Keep the mower above every one of them.
  if (game.mode !== "boom") {
    queue.push({ z: 80 + mv.x + mv.y, kind: "mower", v: mv });
  } else {
    queue.push({ z: 80 + mv.x + mv.y, kind: "boom", v: mv });
  }
  if (!game.riding) queue.push({ z: 90 + pv.x + pv.y, kind: "walker", v: pv });
  if (game.truckT > 0) {
    const tx = game.truckX;
    queue.push({ z: tx + game.world.greenbin.y + 0.2, kind: "truck", x: tx, y: game.world.greenbin.y });
  }

  queue.sort((a, b) => a.z - b.z);

  for (const item of queue) {
    if (item.kind === "tile") {
      const tile = tileAt(game.world, item.x, item.y);
      const elev = elevOf(tile.type);
      const p = project(item.x, item.y, elev);
      const right = tileAt(game.world, item.x + 1, item.y);
      const left = tileAt(game.world, item.x, item.y + 1);
      const eR = right ? elevOf(right.type) : 0;
      const eL = left ? elevOf(left.type) : 0;
      drawCliff(ctx, p.x, p.y, Math.max(0, elev - eL) * LIFT, "left");
      drawCliff(ctx, p.x, p.y, Math.max(0, elev - eR) * LIFT, "right");
      if (tile.type === "grass") drawGrassTop(ctx, p.x, p.y, item.x, item.y, tile.growth, time);
      else if (tile.type === "hedge") {
        fillDiamond(ctx, p.x, p.y, "#6a4028");
        drawHedge(ctx, p.x, p.y, time, item.x, item.y);
      } else if (tile.type === "flower") drawFlowers(ctx, p.x, p.y, time, item.x);
      else if (tile.type === "road") drawRoad(ctx, p.x, p.y);
      else if (tile.type === "path") drawPath(ctx, p.x, p.y);
      else if (tile.type === "drive" || tile.type === "garage") drawDrive(ctx, p.x, p.y);
      else if (tile.type === "house") fillDiamond(ctx, p.x, p.y, "#c2b49a");
      else if (tile.type === "greenbin" || tile.type === "dogbin") {
        if (tile.type === "greenbin") drawRoad(ctx, p.x, p.y);
        else drawPath(ctx, p.x, p.y);
        drawBin(ctx, p.x, p.y + HH - 18, tile.type, time + (game.dumpT > 0 ? (1.1 - game.dumpT) * 3 : 0));
      }
      const spr = game.world.sprinklers.find((s) => s.x === item.x && s.y === item.y);
      if (spr) {
        drawSprinklerHead(
          ctx,
          p.x,
          p.y + HH - 16,
          sprinklerOn(game.world.clock, spr.i, game.world.params.sprinkleFor),
          time,
          spr.i
        );
      }
    } else if (item.kind === "house") {
      drawHouse(ctx, time);
    } else if (item.kind === "poo") {
      const p = project(item.poo.x, item.poo.y, 1);
      drawPoo(ctx, p.x, p.y + HH - 8, item.poo, time);
    } else if (item.kind === "dog") {
      const p = project(item.v.x, item.v.y, 1);
      ctx.save();
      ctx.translate(p.x, p.y + HH - hopLift(item.dog, time));
      ctx.scale(PX * 0.72, PX * 0.72);
      drawDog(ctx, item.dog, time);
      ctx.restore();
      } else if (item.kind === "mower" || item.kind === "boom" || item.kind === "walker") {
      const body = item.kind === "walker" ? game.player : game.mower;
      const elev = elevOf(tileAt(game.world, Math.round(item.v.x), Math.round(item.v.y))?.type);
      const p = project(item.v.x, item.v.y, elev || 0);
      const beside =
        item.kind === "walker" &&
        game.player.hop >= 1 &&
        game.player.x === game.mower.x &&
        game.player.y === game.mower.y
          ? 108
          : 0;
      const amp = game.stall > 0 ? 2.4 : game.cuttingT > 0 ? 1.7 : game.riding ? 1 : 0.35;
      const jitterX = Math.sin(time * 62) * amp;
      const jitterY = Math.cos(time * 51) * amp * 0.55;
      ctx.save();
      ctx.translate(
        p.x + (item.kind === "walker" ? beside : jitterX),
        p.y + HH + (item.kind === "walker" ? -6 : jitterY) - hopLift(body, time)
      );
      if (item.kind === "boom") {
        ctx.scale(PX * 0.92, PX * 0.92);
        drawBoom(ctx, game.boomAge);
      } else if (item.kind === "mower") {
        const img = game.riding ? (game.wet || game.stall > 0 ? grimaceSprite : riderSprite) : emptySprite;
        if (img.complete && img.naturalWidth) {
          const w = 142;
          const h = w * (img.naturalHeight / img.naturalWidth);
          if (game.mower.flip) ctx.scale(-1, 1);
          ctx.drawImage(img, -w / 2, -h + 10, w, h);
        }
      } else {
        const img = game.wet || game.carryingPoo ? walkGrimaceSprite : walkSprite;
        if (img.complete && img.naturalWidth) {
          const h = 118;
          const w = h * (img.naturalWidth / img.naturalHeight);
          if (game.player.flip) ctx.scale(-1, 1);
          const bob = game.player.hop < 1 ? Math.abs(Math.sin(game.time * 14)) * 4 : 0;
          ctx.drawImage(img, -w / 2, -h - bob, w, h);
        }
      }
      ctx.restore();
    } else if (item.kind === "truck") {
      const p = project(item.x, item.y, 0.42);
      ctx.save();
      ctx.translate(0, 0);
      drawTruck(ctx, p.x, p.y + HH, time);
      ctx.restore();
    }
  }

  for (const part of game.particles) {
    ctx.globalAlpha = Math.max(0, part.life / part.max);
    ctx.fillStyle = part.color;
    ctx.fillRect(part.x, part.y, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.font = "700 16px Courier New, monospace";
  ctx.textAlign = "center";
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color || "#1c2a26";
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
