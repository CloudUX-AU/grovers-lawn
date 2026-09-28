// Yard layout and round simulation for Grover's Lawn.

const COLS = 12;
const ROWS = 9;

// Far edge is the house. Near edge is the road, opposite it.
const RAW = [
  "..HHHHHH....",
  "..HHGGHH....",
  "..hDDhfhh...",
  ".hggggggh...",
  ".hgggggsh...",
  ".hgggsggh...",
  ".hggsgggP...",
  "..hhdhhh....",
  ".rrrBrrrr...",
];

const START = { x: 4, y: 1 };
const INTRO = [
  { x: 4, y: 2 },
  { x: 4, y: 3 },
];

const WALKABLE = new Set(["garage", "drive", "grass", "path", "road", "greenbin", "dogbin"]);

const DIFFICULTY = {
  easy: { label: "Easy", poo: 2.8, sprinkle: 0.65, time: 1.22 },
  normal: { label: "Normal", poo: 1, sprinkle: 2.15, time: 1 },
  hard: { label: "Hard", poo: 0.62, sprinkle: 3.3, time: 0.88 },
};

function roundParams(round, difficulty = "normal") {
  const i = Math.max(0, round - 1);
  const tune = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const sproutAt = Math.max(26, 42 - i);
  return {
    time: Math.round(Math.max(64, 90 - i * 3) * tune.time),
    sproutAt,
    tallAt: Math.max(sproutAt + 18, 78 - i * 1.5),
    capacity: 16,
    pooEvery: Math.max(9, 16 - i * 0.6) * tune.poo,
    sprinkleFor: tune.sprinkle,
    difficulty,
  };
}

function kindOf(ch) {
  switch (ch) {
    case "H":
      return "house";
    case "G":
      return "garage";
    case "h":
      return "hedge";
    case "D":
      return "drive";
    case "f":
      return "flower";
    case "g":
    case "s":
      return "grass";
    case "P":
      return "dogbin";
    case "d":
      return "path";
    case "r":
      return "road";
    case "B":
      return "greenbin";
    default:
      return "water";
  }
}

function createWorld(round, difficulty = "normal") {
  const tiles = [];
  const sprinklers = [];
  let greenbin = null;
  let dogbin = null;
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      const ch = RAW[y][x];
      const type = kindOf(ch);
      const tile = {
        type,
        growth: type === "grass" ? "long" : null,
        grow: 0,
      };
      if (ch === "s") sprinklers.push({ x, y, i: sprinklers.length });
      if (type === "greenbin") greenbin = { x, y };
      if (type === "dogbin") dogbin = { x, y };
      row.push(tile);
    }
    tiles.push(row);
  }
  const params = roundParams(round, difficulty);
  return {
    round,
    params,
    tiles,
    sprinklers,
    greenbin,
    dogbin,
    poos: [],
    clock: 0,
    dogs: [
      makeDog(2, 4, "pal", params.pooEvery * 0.45),
      makeDog(6, 3, "stray", params.pooEvery * 0.22),
    ],
  };
}

function applyDifficulty(world, difficulty) {
  const prev = world.params.pooEvery || 1;
  const next = roundParams(world.round, difficulty);
  const scale = next.pooEvery / prev;
  world.params.pooEvery = next.pooEvery;
  world.params.sprinkleFor = next.sprinkleFor;
  world.params.difficulty = difficulty;
  for (const dog of world.dogs) {
    if (dog.pooIn > 0) dog.pooIn *= scale;
  }
}

function makeDog(x, y, kind, pooIn) {
  return {
    kind,
    x,
    y,
    fromX: x,
    fromY: y,
    hop: 1,
    hopDur: 0.22,
    flip: false,
    mode: "wander",
    timer: 0.4 + Math.random() * 0.5,
    pooIn,
    anim: Math.random() * 10,
  };
}

function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return world.tiles[y][x];
}

function isWalkable(world, x, y) {
  const tile = tileAt(world, x, y);
  return !!tile && WALKABLE.has(tile.type);
}

function isGrass(world, x, y) {
  const tile = tileAt(world, x, y);
  return !!tile && tile.type === "grass";
}

function tilesLeft(world) {
  let n = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = world.tiles[y][x];
      if (tile.type === "grass" && (tile.growth === "long" || tile.growth === "tall")) n++;
    }
  }
  return n + world.poos.length;
}

function isClear(world) {
  return tilesLeft(world) === 0;
}

function hasPoo(world, x, y) {
  return world.poos.some((p) => p.x === x && p.y === y);
}

function pooAt(world, x, y) {
  return world.poos.find((p) => p.x === x && p.y === y) || null;
}

function removePoo(world, x, y) {
  const i = world.poos.findIndex((p) => p.x === x && p.y === y);
  if (i >= 0) world.poos.splice(i, 1);
}

function cutTile(world, x, y) {
  const tile = tileAt(world, x, y);
  if (!tile || tile.type !== "grass") return false;
  if (tile.growth === "short") return false;
  if (hasPoo(world, x, y)) return false;
  tile.growth = "short";
  tile.grow = 0;
  return true;
}

function nearPoint(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by) <= 1;
}

function sprinklerOn(clock, index, onFor = 2.15) {
  const period = 5.6;
  const phase = index * 1.85;
  return ((clock + phase) % period) < onFor;
}

function sprayHits(world, x, y) {
  for (const s of world.sprinklers) {
    if (!sprinklerOn(world.clock, s.i, world.params.sprinkleFor)) continue;
    if (Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) <= 1) return true;
  }
  return false;
}

function grassNeighbors(world, x, y, blocked) {
  const out = [];
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of steps) {
    const nx = x + dx;
    const ny = y + dy;
    if (!isGrass(world, nx, ny)) continue;
    if (blocked && blocked.some((b) => b.x === nx && b.y === ny)) continue;
    out.push({ x: nx, y: ny });
  }
  return out;
}

function beginDogHop(dog, nx, ny) {
  const screenDx = nx - dog.x - (ny - dog.y);
  dog.flip = screenDx < 0;
  dog.fromX = dog.x;
  dog.fromY = dog.y;
  dog.x = nx;
  dog.y = ny;
  dog.hop = 0;
}

function retargetDog(world, dog, avoid) {
  const options = grassNeighbors(world, dog.x, dog.y, avoid);
  if (!options.length) return;
  const next = options[Math.floor(Math.random() * options.length)];
  dog.mode = "wander";
  dog.timer = 0.25;
  beginDogHop(dog, next.x, next.y);
}

function scootDogs(world, x, y) {
  const avoid = [{ x, y }];
  for (const dog of world.dogs) {
    if (dog.x === x && dog.y === y) retargetDog(world, dog, avoid);
  }
}

function dropPoo(world, dog) {
  if (world.poos.length >= 4) return;
  if (!isGrass(world, dog.x, dog.y)) return;
  if (hasPoo(world, dog.x, dog.y)) return;
  world.poos.push({ x: dog.x, y: dog.y, born: world.clock, smeared: false });
}

function updateWorld(world, dt, actors) {
  world.clock += dt;
  const { sproutAt, tallAt } = world.params;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = world.tiles[y][x];
      if (tile.type !== "grass") continue;
      if (tile.growth === "long" || tile.growth === "tall") continue;
      tile.grow += dt;
      if (tile.growth === "short" && tile.grow >= sproutAt) tile.growth = "sprout";
      if (tile.growth === "sprout" && tile.grow >= tallAt) tile.growth = "tall";
    }
  }

  const occupied = actors || [];
  for (const dog of world.dogs) {
    dog.anim += dt;
    if (dog.hop < 1) {
      dog.hop = Math.min(1, dog.hop + dt / dog.hopDur);
      continue;
    }
    const stoodOn = occupied.some((a) => a.x === dog.x && a.y === dog.y);
    if (stoodOn) {
      retargetDog(world, dog, occupied);
      continue;
    }
    dog.timer -= dt;
    if (dog.mode === "squat") {
      if (dog.timer <= 0) {
        dropPoo(world, dog);
        dog.mode = "wander";
        dog.timer = 0.35;
        dog.pooIn = world.params.pooEvery * (0.75 + Math.random() * 0.5);
      }
      continue;
    }
    if (dog.mode === "spin" || dog.mode === "sniff") {
      if (dog.timer <= 0) {
        dog.mode = "wander";
        dog.timer = 0.2;
      }
      continue;
    }
    dog.pooIn -= dt;
    if (dog.pooIn <= 0 && world.poos.length < 4 && isGrass(world, dog.x, dog.y) && !hasPoo(world, dog.x, dog.y)) {
      dog.mode = "squat";
      dog.timer = 0.58;
      continue;
    }
    if (dog.timer <= 0) {
      const roll = Math.random();
      if (roll < 0.14) {
        dog.mode = "spin";
        dog.timer = 0.55;
      } else if (roll < 0.28) {
        dog.mode = "sniff";
        dog.timer = 0.42;
      } else if (roll < 0.92) {
        const options = grassNeighbors(world, dog.x, dog.y, occupied);
        if (options.length) {
          const next = options[Math.floor(Math.random() * options.length)];
          beginDogHop(dog, next.x, next.y);
        }
        dog.timer = 0.28 + Math.random() * 0.45;
      } else {
        dog.timer = 0.3;
      }
    }
  }
}
