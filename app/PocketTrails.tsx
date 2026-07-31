"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MONSTERS, type Monster } from "./monster-data";
import { BattleArena } from "./BattleArena";
import { RaidBattle } from "./RaidBattle";

type Spawn = { key: number; monster: Monster; x: number; y: number };
type Save = {
  caught: Record<string, number>;
  candies: Record<string, number>;
  balls: number;
  greatBalls?: number;
  ultraBalls?: number;
  razzBerries: number;
  nanabBerries: number;
  pinapBerries: number;
  raidPasses: number;
  stopCooldowns?: Record<string, number>;
  chargeCooldownUntil?: number;
  xp: number;
  steps: number;
  starter?: string;
};
type BallKind = "basic" | "great" | "ultra";
type BerryKind = "razz" | "nanab" | "pinap";

const initialSave: Save = {
  caught: {},
  candies: {},
  balls: 30,
  greatBalls: 10,
  ultraBalls: 3,
  razzBerries: 10,
  nanabBerries: 7,
  pinapBerries: 5,
  raidPasses: 3,
  stopCooldowns: {},
  chargeCooldownUntil: 0,
  xp: 0,
  steps: 0,
};
const BALLS = {
  basic: { name: "몬스터볼", key: "balls" as const, bonus: 1 },
  great: { name: "슈퍼볼", key: "greatBalls" as const, bonus: 1.35 },
  ultra: { name: "하이퍼볼", key: "ultraBalls" as const, bonus: 1.25 },
};
const BERRIES = {
  razz: { name: "라즈열매", icon: "🍓", key: "razzBerries" as const, description: "다음 포획 확률 1.5배" },
  nanab: { name: "나나열매", icon: "🍌", key: "nanabBerries" as const, description: "포켓몬 움직임 감소" },
  pinap: { name: "파인열매", icon: "🍍", key: "pinapBerries" as const, description: "포획 사탕 2배" },
};
const RAID_BOSSES = MONSTERS.filter((monster) => monster.raidOnly);
const POKESTOP_COOLDOWN_MS = 30_000;
const CHARGE_STATION_COOLDOWN_MS = 30_000;
const WORLD_COLUMNS = 9;
const WORLD_ROWS = 13;
const WORLD_X_LIMIT = Math.floor(WORLD_COLUMNS / 2);
const WORLD_Y_LIMIT = Math.floor(WORLD_ROWS / 2);
const ENCOUNTER_SIZES: Record<string, number> = {
  leaflet: 150,
  emberoo: 150,
  bubbloo: 150,
  voltbit: 145,
  mothmoon: 130,
  rockhorn: 145,
  cloudle: 135,
  starling: 145,
  "monster-009": 170,
  "monster-010": 170,
  "monster-011": 170,
  "monster-012": 180,
  "monster-013": 175,
  "monster-014": 135,
  "monster-015": 145,
  "monster-016": 145,
  "monster-017": 185,
  "monster-018": 185,
  "monster-019": 205,
  "monster-020": 205,
  "monster-021": 140,
  "monster-022": 220,
  "monster-023": 215,
  "monster-024": 215,
  "monster-025": 215,
  "monster-026": 215,
  "monster-027": 220,
  "monster-028": 220,
  "monster-029": 220,
  "monster-030": 145,
};

function MonsterSprite({ monster }: { monster: Monster }) {
  const isImage = monster.sprite.startsWith("/") || monster.sprite.startsWith("http");
  const imageSrc = monster.sprite.startsWith("/")
    ? `${import.meta.env.BASE_URL || "/"}${monster.sprite.slice(1)}`
    : monster.sprite;
  return isImage
    ? <span className="monster-image-wrap">
        <span className="monster-image-fallback">?</span>
        <img className="monster-image" src={imageSrc} alt={monster.name} draggable={false}
          onError={(event) => { event.currentTarget.style.display = "none"; }} />
      </span>
    : <span aria-label={monster.name}>{monster.sprite}</span>;
}

const TYPE_COLORS: Record<string, string> = {
  "풀": "#56a94f", "독": "#9b5bc1", "불꽃": "#ed6b45", "물": "#4d9bdc",
  "전기": "#d9b82f", "벌레": "#8dac3d", "바위": "#9c8263", "비행": "#7eadd2",
  "에스퍼": "#d66fa9", "얼음": "#62bdc9", "고스트": "#7662a5", "드래곤": "#666bc4",
  "강철": "#7e929a", "땅": "#b88b55", "노말": "#8d9189", "페어리": "#d985ba",
};

function TypeBadges({ type }: { type: string }) {
  return <span className="type-badges">
    {type.split("/").map((item) => (
      <b key={item} style={{ "--type-color": TYPE_COLORS[item] || "#71877e" } as React.CSSProperties}>{item}</b>
    ))}
  </span>;
}

function chooseMonster(): Monster {
  const rarityWeight: Record<number, number> = { 1: 60, 2: 28, 3: 12, 4: 4, 5: 1 };
  const totalWeight = MONSTERS.reduce((sum, monster) =>
    sum + (monster.spawnWeight ?? rarityWeight[monster.rarity] ?? 1), 0);
  let roll = Math.random() * totalWeight;
  for (const monster of MONSTERS) {
    roll -= monster.spawnWeight ?? rarityWeight[monster.rarity] ?? 1;
    if (roll <= 0) return monster;
  }
  return MONSTERS[0];
}

function seededUnit(seed: number, salt: number) {
  const value = Math.sin(seed * .0001 + salt * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function playThrowSound() {
  try {
    const AudioContextClass = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(220, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(620, context.currentTime + .2);
    gain.gain.setValueAtTime(.075, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .23);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .24);
    oscillator.onended = () => { void context.close(); };
  } catch { /* 소리를 지원하지 않는 기기에서는 진동과 애니메이션만 사용 */ }
}

function playImpactSound() {
  try {
    const AudioContextClass = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(145, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(62, context.currentTime + .1);
    gain.gain.setValueAtTime(.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .13);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .14);
    oscillator.onended = () => { void context.close(); };
  } catch { /* 효과음 없이 계속 플레이 */ }
}

function createSpawns(seed = Date.now()): Spawn[] {
  return Array.from({ length: 7 }, (_, index) => ({
    key: seed + index,
    monster: chooseMonster(),
    x: 12 + seededUnit(seed, index * 2 + 1) * 76,
    y: 16 + seededUnit(seed, index * 2 + 2) * 68,
  }));
}

export function PocketTrails() {
  const [save, setSave] = useState<Save>(initialSave);
  const [spawns, setSpawns] = useState<Spawn[]>([]);
  const [position, setPosition] = useState({ x: 49, y: 53 });
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<Spawn | null>(null);
  const [tab, setTab] = useState<"map" | "dex" | "box" | "battle" | "bag">("map");
  const [message, setMessage] = useState("");
  const [throwing, setThrowing] = useState(false);
  const [selectedBall, setSelectedBall] = useState<BallKind>("basic");
  const [monsterX, setMonsterX] = useState(0);
  const [throwX, setThrowX] = useState(0);
  const [throwY, setThrowY] = useState(-270);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggingBall, setDraggingBall] = useState(false);
  const [impacting, setImpacting] = useState(false);
  const [timingLabel, setTimingLabel] = useState("몬스터볼을 위로 쓸어 올리세요!");
  const [ballMenuOpen, setBallMenuOpen] = useState(false);
  const [berryMenuOpen, setBerryMenuOpen] = useState(false);
  const [berryEffect, setBerryEffect] = useState<BerryKind | null>(null);
  const [raidOpen, setRaidOpen] = useState(false);
  const [activeRaidBoss, setActiveRaidBoss] = useState<Monster | null>(null);
  const [stopCooldowns, setStopCooldowns] = useState<Record<string, number>>({});
  const [chargeCooldownUntil, setChargeCooldownUntil] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  const [gps, setGps] = useState<"off" | "loading" | "on" | "error">("off");
  const [gpsInfo, setGpsInfo] = useState<{ accuracy: number; threshold: number; updated: string } | null>(null);
  const [motion, setMotion] = useState<"off" | "loading" | "on" | "error">("off");
  const gpsOrigin = useRef<{ lat: number; lng: number } | null>(null);
  const lastGps = useRef<{ lat: number; lng: number } | null>(null);
  const gpsWatchId = useRef<number | null>(null);
  const testDistance = useRef(0);
  const heading = useRef(0);
  const lastMotionStep = useRef(0);
  const previousForce = useRef(9.8);
  const throwStart = useRef<{ x: number; y: number } | null>(null);
  const encounterMonsterSize = selected ? ENCOUNTER_SIZES[selected.monster.id] || 170 : 170;
  const encounterAimSize = Math.round(Math.max(90, Math.min(150, encounterMonsterSize * .66)));

  useEffect(() => {
    const stored = localStorage.getItem("pocket-trails-save");
    if (stored) {
      try {
        const restored = { ...initialSave, ...JSON.parse(stored) } as Save;
        setSave(restored);
        setStopCooldowns(restored.stopCooldowns || {});
        setChargeCooldownUntil(restored.chargeCooldownUntil || 0);
      } catch { /* 새 저장으로 시작 */ }
    }
    setSpawns(createSpawns());
    setLoaded(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL || "/"}sw.js`).catch(() => {});
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("pocket-trails-save", JSON.stringify(save));
  }, [save, loaded]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (selected || raidOpen || tab !== "map") return;
      const delta: Record<string, [number, number]> = {
        ArrowUp: [0, -3], w: [0, -3], ArrowDown: [0, 3], s: [0, 3],
        ArrowLeft: [-3, 0], a: [-3, 0], ArrowRight: [3, 0], d: [3, 0],
      };
      if (delta[event.key]) {
        event.preventDefault();
        move(...delta[event.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const timer = window.setInterval(() => setCooldownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (gpsWatchId.current !== null) navigator.geolocation.clearWatch(gpsWatchId.current);
    window.removeEventListener("deviceorientation", handleOrientation);
    window.removeEventListener("devicemotion", handleMotion);
  }, []);

  useEffect(() => {
    if (!selected || throwing) return;
    let animationFrame = 0;
    const startedAt = performance.now();
    const speed = (1.05 + selected.monster.rarity * 0.08) * (berryEffect === "nanab" ? .45 : 1);
    let lastPaint = 0;
    const animate = (now: number) => {
      if (now - lastPaint > 30) {
        setMonsterX(Math.sin((now - startedAt) / 1000 * speed + Math.PI / 2) * 65);
        lastPaint = now;
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [selected, throwing, berryEffect]);

  const level = Math.floor(save.xp / 100) + 1;
  const caughtTotal = Object.values(save.caught).reduce((a, b) => a + b, 0);
  const discovered = Object.keys(save.caught).length;
  const worldSector = (mapOffset.y + WORLD_Y_LIMIT) * WORLD_COLUMNS + mapOffset.x + WORLD_X_LIMIT + 1;
  const raidBoss = RAID_BOSSES[worldSector % RAID_BOSSES.length] || MONSTERS[0];
  const ownedMonsters = MONSTERS.filter((monster) => (save.caught[monster.id] || 0) > 0);
  const terrain = useMemo(() => {
    const seed = (mapOffset.x + WORLD_X_LIMIT + 1) * 1009 + (mapOffset.y + WORLD_Y_LIMIT + 1) * 9176;
    const random = (salt: number) => seededUnit(seed, salt);
    const variant = Math.floor(random(1) * 5);
    const roadCount = 2 + Math.floor(random(2) * 3);
    const parkCount = 1 + Math.floor(random(3) * 3);
    const waterRoll = random(4);
    const waterKind = waterRoll < .28 ? "none" : waterRoll < .58 ? "river" : waterRoll < .82 ? "lake" : "coast";
    return {
      variant,
      roads: Array.from({ length: roadCount }, (_, index) => ({
        top: 12 + random(10 + index) * 76,
        angle: -65 + random(20 + index) * 130,
        height: 48 + random(30 + index) * 34,
        left: -28 + random(40 + index) * 12,
      })),
      parks: Array.from({ length: parkCount }, (_, index) => ({
        left: -8 + random(50 + index) * 82,
        top: 8 + random(60 + index) * 70,
        width: 90 + random(70 + index) * 105,
        height: 70 + random(80 + index) * 95,
        radius: 28 + random(90 + index) * 35,
        rotate: -18 + random(100 + index) * 36,
      })),
      waterKind,
      water: {
        left: waterKind === "coast" ? 62 + random(111) * 12 : 8 + random(112) * 68,
        top: waterKind === "lake" ? 18 + random(113) * 54 : -15,
        width: waterKind === "coast" ? 54 : waterKind === "lake" ? 105 + random(114) * 75 : 45 + random(115) * 48,
        height: waterKind === "lake" ? 90 + random(116) * 65 : 130,
        rotate: waterKind === "river" ? -24 + random(117) * 48 : 0,
      },
      features: Array.from({ length: 9 }, (_, index) => ({
        left: 5 + random(130 + index) * 90,
        top: 9 + random(150 + index) * 78,
        size: 8 + random(170 + index) * 19,
        rotate: random(190 + index) * 180,
      })),
      stops: Array.from({ length: 8 }, (_, index) => [
        10 + random(210 + index * 2) * 80,
        14 + random(211 + index * 2) * 72,
      ] as const),
    };
  }, [mapOffset.x, mapOffset.y]);

  const nearby = useMemo(() => spawns.map((spawn) => ({
    ...spawn,
    distance: Math.round(Math.hypot(spawn.x - position.x, spawn.y - position.y) * 2.2),
  })).sort((a, b) => a.distance - b.distance), [spawns, position]);

  function move(dx: number, dy: number) {
    moveAcrossMap(dx, dy);
    setSave((s) => ({ ...s, steps: s.steps + 1 }));
  }

  function moveAcrossMap(dx: number, dy: number) {
    if (raidOpen) return;
    setPosition((p) => ({
      ...(() => {
        let x = p.x + dx, y = p.y + dy, mapX = 0, mapY = 0;
        if (x > 94) { x = 7; mapX = 1; }
        if (x < 6) { x = 93; mapX = -1; }
        if (y > 91) { y = 9; mapY = 1; }
        if (y < 8) { y = 90; mapY = -1; }
        if (mapX || mapY) {
          const nextX = mapOffset.x + mapX;
          const nextY = mapOffset.y + mapY;
          if (Math.abs(nextX) > WORLD_X_LIMIT || Math.abs(nextY) > WORLD_Y_LIMIT) {
            if (mapX > 0) x = 94;
            if (mapX < 0) x = 6;
            if (mapY > 0) y = 91;
            if (mapY < 0) y = 8;
            setMessage("대한민국 탐험 지도의 끝에 도착했어요!");
            setTimeout(() => setMessage(""), 1500);
            return { x, y };
          }
          setMapOffset({ x: nextX, y: nextY });
          setSpawns(createSpawns(Date.now() + nextX * 1000 + nextY * 10000));
          const nextSector = (nextY + WORLD_Y_LIMIT) * WORLD_COLUMNS + nextX + WORLD_X_LIMIT + 1;
          setMessage(`새로운 구역 ${nextSector} / ${WORLD_COLUMNS * WORLD_ROWS}`);
          setTimeout(() => setMessage(""), 1300);
        }
        return { x, y };
      })(),
    }));
  }

  function openEncounter(spawn: Spawn) {
    const distance = Math.hypot(spawn.x - position.x, spawn.y - position.y);
    if (distance > 31) {
      setMessage("조금 더 가까이 걸어가 보세요!");
      setTimeout(() => setMessage(""), 1800);
      return;
    }
    setMonsterX(92);
    setTimingLabel("몬스터볼을 위로 쓸어 올리세요!");
    setBallMenuOpen(false);
    setBerryMenuOpen(false);
    setBerryEffect(null);
    setSelected(spawn);
  }

  function throwBall(swipe: { dx: number; upward: number }) {
    const ball = BALLS[selectedBall];
    if (!selected || (save[ball.key] || 0) < 1 || throwing) return;
    const rawTrajectoryX = Math.max(-115, Math.min(115, swipe.dx * 1.55));
    const aimAssist = selected.monster.raidOnly ? .14 : .32;
    const trajectoryX = rawTrajectoryX * (1 - aimAssist) + monsterX * aimAssist;
    const timingDistance = Math.abs(monsterX - trajectoryX) + Math.abs(swipe.upward - 125) * .12;
    const timing = timingDistance <= 22
      ? { label: "EXCELLENT!", multiplier: 1.8 }
      : timingDistance <= 50
        ? { label: "GREAT!", multiplier: 1.4 }
        : timingDistance <= 88
          ? { label: "NICE!", multiplier: 1.08 }
          : { label: "빗나감!", multiplier: 0 };
    const flightY = -Math.max(215, Math.min(340, 190 + swipe.upward * .65));
    setThrowX(trajectoryX);
    setThrowY(flightY);
    setTimingLabel(timing.label);
    setThrowing(true);
    setSave((current) => ({
      ...current,
      [ball.key]: Math.max(0, (current[ball.key] || 0) - 1),
    }));
    playThrowSound();
    navigator.vibrate?.(12);
    const target = selected;
    if (timing.multiplier > 0) {
      setTimeout(() => {
        setImpacting(true);
        playImpactSound();
        navigator.vibrate?.([22, 24, 35]);
        setTimeout(() => setImpacting(false), 280);
      }, 610);
    }
    setTimeout(() => {
      const baseRate = target.monster.catchRate ?? Math.max(.25, .86 - target.monster.rarity * .09);
      const berryBonus = berryEffect === "razz" ? 1.5 : 1;
      const standardChance = Math.min(.97, baseRate * ball.bonus * timing.multiplier * berryBonus * 1.22);
      const raidMinimum = timing.label === "EXCELLENT!" ? .6 : timing.label === "GREAT!" ? .45 : timing.label === "NICE!" ? .3 : 0;
      const raidChance = Math.min(.9, raidMinimum * ball.bonus * berryBonus);
      const catchChance = target.monster.raidOnly ? Math.max(standardChance, raidChance) : standardChance;
      const caught = timing.multiplier > 0 && Math.random() < catchChance;
      if (caught) {
        const family = target.monster.family || target.monster.id;
        const candyReward = berryEffect === "pinap" ? 6 : 3;
        setSave((s) => ({
          ...s,
          xp: s.xp + 20 + target.monster.rarity * 5,
          caught: { ...s.caught, [target.monster.id]: (s.caught[target.monster.id] || 0) + 1 },
          candies: { ...s.candies, [family]: (s.candies[family] || 0) + candyReward },
        }));
        setSpawns((items) => items.filter((item) => item.key !== target.key));
        setMessage(`${target.monster.name} 포획 성공!`);
        setSelected(null);
      } else {
        setMessage(timing.multiplier === 0
          ? "타이밍이 어긋나 볼이 빗나갔어요!"
          : `${timing.label} 하지만 ${target.monster.name}이(가) 빠져나왔어요!`);
      }
      setBerryEffect(null);
      setImpacting(false);
      setThrowing(false);
      setTimingLabel("몬스터볼을 위로 쓸어 올리세요!");
      setTimeout(() => setMessage(""), 2100);
    }, 900);
  }

  function beginBallSwipe(event: React.PointerEvent<HTMLButtonElement>) {
    if (throwing || !(save[BALLS[selectedBall].key] || 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    throwStart.current = { x: event.clientX, y: event.clientY };
    setDragOffset({ x: 0, y: 0 });
    setDraggingBall(true);
    setTimingLabel("목표를 향해 위로 곧게 던지세요!");
  }

  function moveBallSwipe(event: React.PointerEvent<HTMLButtonElement>) {
    if (!throwStart.current) return;
    event.preventDefault();
    const dx = event.clientX - throwStart.current.x;
    setDragOffset({
      x: Math.max(-85, Math.min(85, dx)),
      y: Math.max(-150, Math.min(8, event.clientY - throwStart.current.y)),
    });
  }

  function endBallSwipe(event: React.PointerEvent<HTMLButtonElement>) {
    if (!throwStart.current) return;
    const dx = event.clientX - throwStart.current.x;
    const upward = throwStart.current.y - event.clientY;
    throwStart.current = null;
    setDraggingBall(false);
    setDragOffset({ x: 0, y: 0 });
    if (upward < 30) {
      setTimingLabel("더 길게 위로 쓸어 올리세요!");
      return;
    }
    throwBall({ dx, upward });
  }

  function cancelBallSwipe() {
    throwStart.current = null;
    setDraggingBall(false);
    setDragOffset({ x: 0, y: 0 });
    setTimingLabel("몬스터볼을 위로 쓸어 올리세요!");
  }

  function useBerry(kind: BerryKind) {
    const berry = BERRIES[kind];
    if ((save[berry.key] || 0) < 1 || throwing) return;
    setSave((current) => ({ ...current, [berry.key]: Math.max(0, current[berry.key] - 1) }));
    setBerryEffect(kind);
    setBerryMenuOpen(false);
    setMessage(`${berry.name} 사용 · ${berry.description}`);
    setTimeout(() => setMessage(""), 1600);
  }

  function evolve(monster: Monster) {
    if (!monster.evolvesTo || !monster.evolutionCost || (save.caught[monster.id] || 0) < 1) return;
    const evolved = MONSTERS.find((candidate) => candidate.id === monster.evolvesTo);
    const family = monster.family || monster.id;
    if (!evolved || (save.candies[family] || 0) < monster.evolutionCost) return;
    setSave((current) => ({
      ...current,
      xp: current.xp + 50,
      candies: { ...current.candies, [family]: current.candies[family] - monster.evolutionCost! },
      caught: {
        ...current.caught,
        [monster.id]: Math.max(0, current.caught[monster.id] - 1),
        [evolved.id]: (current.caught[evolved.id] || 0) + 1,
      },
    }));
    setMessage(`${monster.name}이(가) ${evolved.name}(으)로 진화했어요!`);
    setTimeout(() => setMessage(""), 2300);
  }

  function startRaid() {
    if (save.raidPasses < 1) {
      setMessage("레이드패스가 없어요. 포켓스탑에서 충전하세요!");
      setTimeout(() => setMessage(""), 1900);
      return;
    }
    setSave((current) => ({ ...current, raidPasses: current.raidPasses - 1 }));
    setActiveRaidBoss(raidBoss);
    setRaidOpen(true);
  }

  function finishRaid(defeatedBoss: Monster) {
    setRaidOpen(false);
    setActiveRaidBoss(null);
    setMonsterX(92);
    setTimingLabel("레이드 보상 포획! 볼을 위로 던지세요.");
    setBerryEffect(null);
    setSelected({ key: Date.now(), monster: defeatedBoss, x: position.x, y: position.y });
    setMessage(`${defeatedBoss.name} 레이드 승리! 포획 기회 획득!`);
    setTimeout(() => setMessage(""), 2200);
  }

  function grantItems() {
    setSave((s) => ({
      ...s,
      balls: s.balls + 6,
      greatBalls: (s.greatBalls || 0) + 3,
      ultraBalls: (s.ultraBalls || 0) + 1,
      razzBerries: s.razzBerries + 3,
      nanabBerries: s.nanabBerries + 2,
      pinapBerries: s.pinapBerries + 2,
      raidPasses: s.raidPasses + 1,
    }));
  }

  function usePokestop(stopId: string) {
    const now = Date.now();
    const cooldownUntil = stopCooldowns[stopId] || 0;
    if (cooldownUntil > now) {
      setMessage(`포켓스탑 충전까지 ${Math.ceil((cooldownUntil - now) / 1000)}초`);
      setTimeout(() => setMessage(""), 1300);
      return;
    }
    grantItems();
    const nextCooldowns = { ...stopCooldowns, [stopId]: now + POKESTOP_COOLDOWN_MS };
    setStopCooldowns(nextCooldowns);
    setSave((current) => ({ ...current, stopCooldowns: nextCooldowns }));
    setCooldownNow(now);
    setMessage("포켓스탑에서 아이템을 받았어요! 30초 후 재충전");
    setTimeout(() => setMessage(""), 1800);
  }

  function useChargeStation() {
    const now = Date.now();
    if (chargeCooldownUntil > now) {
      setMessage(`충전소 재사용까지 ${Math.ceil((chargeCooldownUntil - now) / 1000)}초`);
      setTimeout(() => setMessage(""), 1300);
      return;
    }
    grantItems();
    const nextCooldown = now + CHARGE_STATION_COOLDOWN_MS;
    setChargeCooldownUntil(nextCooldown);
    setSave((current) => ({ ...current, chargeCooldownUntil: nextCooldown }));
    setCooldownNow(now);
    setMessage("충전 완료! 30초 후 다시 이용할 수 있어요.");
    setTimeout(() => setMessage(""), 1800);
  }

  function refreshWorld() {
    setSpawns(createSpawns());
    setMessage("새로운 기척이 느껴져요.");
    setTimeout(() => setMessage(""), 1800);
  }

  function simulateWalk() {
    testDistance.current += 0.5;
    moveAcrossMap(1.1, Math.sin(testDistance.current / 3) * 1.2);
    setSave((s) => ({ ...s, steps: s.steps + 1 }));
    setMessage(`테스트 이동 ${testDistance.current}m`);
    if (testDistance.current % 25 === 0) {
      setSpawns(createSpawns());
      setMessage("테스트 25m 완료 · 주변 몬스터 갱신!");
    }
    setTimeout(() => setMessage(""), 900);
  }

  function handleOrientation(event: DeviceOrientationEvent) {
    if (typeof event.alpha === "number") heading.current = event.alpha;
  }

  function handleMotion(event: DeviceMotionEvent) {
    const rotation = event.rotationRate;
    const rotationSpeed = rotation
      ? Math.hypot(rotation.alpha || 0, rotation.beta || 0, rotation.gamma || 0)
      : 0;
    if (rotationSpeed > 35) return;

    const linear = event.acceleration;
    let change = 0;
    if (linear && (linear.x !== null || linear.y !== null || linear.z !== null)) {
      change = Math.hypot(linear.x || 0, linear.y || 0, linear.z || 0);
    } else {
      const gravity = event.accelerationIncludingGravity;
      if (!gravity) return;
      const force = Math.hypot(gravity.x || 0, gravity.y || 0, gravity.z || 0);
      change = Math.abs(force - previousForce.current);
      previousForce.current = force;
    }
    const now = Date.now();
    if (change < 1.15 || now - lastMotionStep.current < 420) return;
    lastMotionStep.current = now;
    const radians = heading.current * Math.PI / 180;
    moveAcrossMap(Math.sin(radians) * 2.1, -Math.cos(radians) * 2.1);
    setSave((s) => ({ ...s, steps: s.steps + 1 }));
    testDistance.current += 1;
    if (testDistance.current % 25 === 0) {
      setSpawns(createSpawns());
      setMessage("25걸음 이동 · 주변 몬스터 갱신!");
      setTimeout(() => setMessage(""), 1400);
    }
  }

  async function startMotion() {
    setMotion("loading");
    try {
      const MotionEvent = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      const OrientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (MotionEvent.requestPermission && await MotionEvent.requestPermission() !== "granted") throw new Error();
      if (OrientationEvent.requestPermission && await OrientationEvent.requestPermission() !== "granted") throw new Error();
      window.addEventListener("deviceorientation", handleOrientation);
      window.addEventListener("devicemotion", handleMotion);
      setMotion("on");
      setMessage("동작 센서 연결 완료 · 휴대폰을 들고 움직여 보세요!");
      setTimeout(() => setMessage(""), 2200);
    } catch {
      setMotion("error");
      setMessage("동작 및 방향 접근 권한이 필요해요.");
      setTimeout(() => setMessage(""), 2200);
    }
  }

  function startGps() {
    if (!navigator.geolocation) {
      setGps("error");
      setMessage("이 브라우저는 GPS를 지원하지 않아요.");
      return;
    }
    setGps("loading");
    if (gpsWatchId.current !== null) return;
    gpsWatchId.current = navigator.geolocation.watchPosition(({ coords }) => {
      const current = { lat: coords.latitude, lng: coords.longitude };
      const movementThreshold = 0.5;
      setGpsInfo({
        accuracy: Math.round(coords.accuracy),
        threshold: Math.round(movementThreshold),
        updated: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      });
      if (!gpsOrigin.current) {
        gpsOrigin.current = current;
        setPosition({ x: 49, y: 53 });
        setMessage(`현재 위치를 찾았어요 · 오차 약 ${Math.round(coords.accuracy)}m`);
        setTimeout(() => setMessage(""), 2300);
      }
      if (lastGps.current) {
        const latMeters = (current.lat - lastGps.current.lat) * 111_000;
        const lngMeters = (current.lng - lastGps.current.lng) * 88_000;
        const walked = Math.hypot(latMeters, lngMeters);
        if (walked > movementThreshold) {
          setPosition((p) => ({
            x: Math.max(6, Math.min(94, p.x + lngMeters / 4)),
            y: Math.max(8, Math.min(90, p.y - latMeters / 4)),
          }));
          setSave((s) => ({ ...s, steps: s.steps + Math.max(1, Math.round(walked / movementThreshold)) }));
          if (walked > 25) setSpawns(createSpawns());
        }
      }
      lastGps.current = current;
      setGps("on");
    }, () => {
      if (gpsWatchId.current !== null) navigator.geolocation.clearWatch(gpsWatchId.current);
      gpsWatchId.current = null;
      setGps("error");
      setGpsInfo(null);
      setMessage("위치 권한을 허용하면 실제 걸음으로 탐험할 수 있어요.");
      setTimeout(() => setMessage(""), 2800);
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 });
  }

  function chooseStarter(monster: Monster) {
    setSave((s) => ({
      ...s,
      starter: monster.id,
      caught: { ...s.caught, [monster.id]: Math.max(1, s.caught[monster.id] || 0) },
      candies: { ...s.candies, [monster.family || monster.id]: Math.max(3, s.candies[monster.family || monster.id] || 0) },
    }));
    setMessage(`${monster.name}와(과) 모험을 시작합니다!`);
    setTimeout(() => setMessage(""), 2300);
  }

  return (
    <main className="pt-app">
      <div className="pt-phone">
        <header className="topbar">
          <div className="brand-mark">PT</div>
          <div><b>POCKET TRAILS</b><span>나만의 동네 탐험</span></div>
          <button className="weather" aria-label="날씨">☀︎ <small>맑음</small></button>
        </header>

        <section className={`game-view ${tab !== "map" ? "panel-view" : ""}`}>
          {tab === "map" && (
            <div className={`map biome-${terrain.variant}`} aria-label="이어지는 대형 탐험 지도">
              <div className="map-shade" style={{ backgroundPosition: `${mapOffset.x * 95}px ${mapOffset.y * 75}px`, transform: `rotate(${terrain.variant * 7 - 12}deg) scale(1.18)` }} />
              <div className={`terrain-features terrain-${terrain.variant}`}>
                {terrain.features.map((feature, index) => <i key={index} style={{ left: `${feature.left}%`, top: `${feature.top}%`, width: feature.size, height: feature.size, rotate: `${feature.rotate}deg` }} />)}
              </div>
              {terrain.parks.map((park, index) => <div key={`park-${index}`} className="park" style={{ left: `${park.left}%`, top: `${park.top}%`, width: park.width, height: park.height, borderRadius: `${park.radius}%`, transform: `rotate(${park.rotate}deg)` }} />)}
              {terrain.waterKind !== "none" && <div className={`water water-${terrain.waterKind}`} style={{
                left: `${terrain.water.left}%`,
                top: `${terrain.water.top}%`,
                width: terrain.waterKind === "coast" ? "54%" : terrain.water.width,
                height: terrain.waterKind === "lake" ? terrain.water.height : `${terrain.water.height}%`,
                transform: `rotate(${terrain.water.rotate}deg)`,
              }} />}
              {terrain.roads.map((road, index) => <div key={`road-${index}`} className="road" style={{ top: `${road.top}%`, left: `${road.left}%`, height: road.height, transform: `rotate(${road.angle}deg)` }} />)}
              <div className="world-sector"><b>{worldSector}</b><span>/ {WORLD_COLUMNS * WORLD_ROWS} 구역</span></div>
              {terrain.stops.map(([x, y], index) => {
                const stopId = `${mapOffset.x}-${mapOffset.y}-${index}`;
                const coolingDown = (stopCooldowns[stopId] || 0) > cooldownNow;
                return <button
                  key={stopId}
                  className={`stop ${coolingDown ? "cooldown" : ""}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onClick={() => usePokestop(stopId)}
                  aria-label={coolingDown ? "포켓스탑 충전 중" : "포켓스탑"}
                >◈</button>;
              })}
              <button className="raid-gym" style={{ left: `${terrain.stops[0][0]}%`, top: `${Math.min(82, terrain.stops[0][1] + 10)}%` }} onClick={startRaid} aria-label={`${raidBoss.name} 레이드 참가`}>
                <i>⚔</i><b>RAID</b><span>{raidBoss.name}</span>
              </button>
              {spawns.map((spawn) => (
                <button
                  key={spawn.key}
                  className="spawn"
                  style={{ left: `${spawn.x}%`, top: `${spawn.y}%`, "--monster": spawn.monster.color } as React.CSSProperties}
                  onClick={() => openEncounter(spawn)}
                  aria-label={`${spawn.monster.name} 만나기`}
                >
                  <span><MonsterSprite monster={spawn.monster} /></span>
                  <i />
                </button>
              ))}
              <div className="player" style={{ left: `${position.x}%`, top: `${position.y}%` }}>
                <i /><span>🧢</span>
              </div>
              <button className="refresh" onClick={refreshWorld} aria-label="몬스터 새로 찾기">↻</button>
              <button className={`gps-button ${motion}`} onClick={startMotion} aria-label="휴대폰 동작 센서 시작">
                <i>◌</i><span>{motion === "on" ? "동작 센서 연결됨" : motion === "loading" ? "센서 연결 중" : "동작 센서 시작"}</span>
              </button>
              <button className="test-walk" onClick={simulateWalk} aria-label="테스트로 50센티미터 이동">
                <i>＋50cm</i><span>테스트 걷기</span>
              </button>
              {motion !== "on" && (
                <div className="move-pad" aria-label="동작 센서 연결 전 이동 조작">
                  <button onClick={() => move(0, -3)}>▲</button>
                  <button onClick={() => move(-3, 0)}>◀</button>
                  <button onClick={() => move(3, 0)}>▶</button>
                  <button onClick={() => move(0, 3)}>▼</button>
                </div>
              )}
              <aside className="nearby">
                <div><b>주변 탐색</b><span>{spawns.length}마리</span></div>
                <div className="near-list">
                  {nearby.slice(0, 3).map((item) => (
                    <button key={item.key} onClick={() => openEncounter(item)}>
                      <em><MonsterSprite monster={item.monster} /></em><span>{item.monster.name}<small>{item.distance}m</small></span>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          )}

          {tab === "dex" && (
            <div className="content-panel">
              <div className="panel-heading"><span>FIELD NOTES</span><h1>탐험 도감</h1><p>{discovered} / {MONSTERS.length}종 발견</p></div>
              <div className="dex-grid">
                {MONSTERS.map((monster) => {
                  const count = save.caught[monster.id] || 0;
                  const family = monster.family || monster.id;
                  const candy = save.candies[family] || 0;
                  const evolved = monster.evolvesTo ? MONSTERS.find((candidate) => candidate.id === monster.evolvesTo) : null;
                  return <article key={monster.id} className={count ? "found" : "locked"}>
                    <div style={{ background: `${monster.color}22`, color: monster.color }}>{count ? <MonsterSprite monster={monster} /> : "?"}</div>
                    <span>NO.{String(MONSTERS.indexOf(monster) + 1).padStart(3, "0")}</span>
                    <b>{count ? monster.name : "미발견"}</b>
                    <small>{count ? <><TypeBadges type={monster.type} /><em>{count}마리</em></> : "???"}</small>
                    {count > 0 && <p>{monster.description}</p>}
                    {count > 0 && evolved && monster.evolutionCost && (
                      <section className="evolution-row">
                        <span>🍬 {candy} / {monster.evolutionCost}</span>
                        <button onClick={() => evolve(monster)} disabled={candy < monster.evolutionCost}>{evolved.name}(으)로 진화</button>
                      </section>
                    )}
                  </article>;
                })}
              </div>
            </div>
          )}

          {tab === "battle" && <BattleArena owned={ownedMonsters} />}

          {tab === "box" && (
            <div className="content-panel box-panel">
              <div className="panel-heading"><span>POKÉMON STORAGE</span><h1>포켓몬 박스</h1><p>{caughtTotal} / 300마리 보관 중</p></div>
              {ownedMonsters.length ? <div className="pokemon-box-grid">
                {ownedMonsters.map((monster) => {
                  const family = monster.family || monster.id;
                  const candy = save.candies[family] || 0;
                  const evolved = monster.evolvesTo ? MONSTERS.find((candidate) => candidate.id === monster.evolvesTo) : null;
                  return <article key={monster.id}>
                    <div className="box-sprite" style={{ background: `${monster.color}20` }}><MonsterSprite monster={monster} /></div>
                    <section><TypeBadges type={monster.type} /><b>{monster.name}</b><span>보유 {save.caught[monster.id]}마리 · 🍬 {candy}</span></section>
                    {evolved && monster.evolutionCost && <button onClick={() => evolve(monster)} disabled={candy < monster.evolutionCost}>{evolved.name} 진화</button>}
                  </article>;
                })}
              </div> : <div className="box-empty"><span>◌</span><b>박스가 비어 있어요</b><p>지도에서 포켓몬을 잡아 보세요.</p></div>}
            </div>
          )}

          {tab === "bag" && (
            <div className="content-panel bag-panel">
              <div className="panel-heading"><span>EXPLORER KIT · 용량 제한 없음</span><h1>내 가방</h1><p>아이템을 개수 제한 없이 계속 모을 수 있어요.</p></div>
              <section className="profile-card">
                <div className="avatar">🧢</div><div><span>탐험가</span><h2>LEVEL {level}</h2><p>다음 레벨까지 {100 - save.xp % 100} XP</p></div>
                <div className="xp-ring">{save.xp % 100}%</div>
              </section>
              <div className="stats">
                <article><span>포획</span><b>{caughtTotal}</b><small>마리</small></article>
                <article><span>발견</span><b>{discovered}</b><small>종</small></article>
                <article><span>걸음</span><b>{save.steps}</b><small>회</small></article>
              </div>
              <section className="inventory">
                <div><span className="ball-icon basic" /><p><b>몬스터볼</b><small>야생 몬스터를 포획하는 기본 볼</small></p><strong>{save.balls}</strong></div>
                <div><span className="ball-icon great" /><p><b>슈퍼볼</b><small>포획 확률 1.35배</small></p><strong>{save.greatBalls || 0}</strong></div>
                <div><span className="ball-icon ultra" /><p><b>하이퍼볼</b><small>포획 확률 1.25배</small></p><strong>{save.ultraBalls || 0}</strong></div>
                <div><span className="item-emoji">🍓</span><p><b>라즈열매</b><small>포획 확률을 높여요</small></p><strong>{save.razzBerries}</strong></div>
                <div><span className="item-emoji">🍌</span><p><b>나나열매</b><small>포켓몬 움직임을 늦춰요</small></p><strong>{save.nanabBerries}</strong></div>
                <div><span className="item-emoji">🍍</span><p><b>파인열매</b><small>받는 사탕이 2배가 돼요</small></p><strong>{save.pinapBerries}</strong></div>
                <div><span className="item-emoji">🎟️</span><p><b>레이드패스</b><small>전설 레이드 입장권</small></p><strong>{save.raidPasses}</strong></div>
                <button
                  className={chargeCooldownUntil > cooldownNow ? "cooldown" : ""}
                  onClick={useChargeStation}
                >
                  {chargeCooldownUntil > cooldownNow
                    ? `충전 중 · ${Math.ceil((chargeCooldownUntil - cooldownNow) / 1000)}초`
                    : "충전소 이용하기"}
                </button>
              </section>
              <button className="reset" onClick={() => {
                setSave(initialSave);
                setStopCooldowns({});
                setChargeCooldownUntil(0);
                setSpawns(createSpawns());
              }}>저장 기록 초기화</button>
            </div>
          )}
        </section>

        <nav className="bottom-nav">
          <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><i>⌖</i><span>지도</span></button>
          <button className={tab === "dex" ? "active" : ""} onClick={() => setTab("dex")}><i>▦</i><span>도감</span></button>
          <button className={tab === "box" ? "active" : ""} onClick={() => setTab("box")}><i>▣</i><span>박스</span></button>
          <button className={tab === "battle" ? "active" : ""} onClick={() => setTab("battle")}><i>⚔</i><span>배틀</span></button>
          <button className={tab === "bag" ? "active" : ""} onClick={() => setTab("bag")}><i>◉</i><span>가방</span></button>
        </nav>

        {raidOpen && activeRaidBoss && <RaidBattle
          boss={activeRaidBoss}
          onClose={() => { setRaidOpen(false); setActiveRaidBoss(null); }}
          onWin={() => finishRaid(activeRaidBoss)}
        />}

        {selected && (
          <div className={`encounter ${impacting ? "impacting" : ""}`} style={{ "--accent": selected.monster.color } as React.CSSProperties}>
            <button className="close-encounter" onClick={() => setSelected(null)} aria-label="포획 화면 닫기">×</button>
            <div className="encounter-sky"><i /><i /><i /></div>
            <div className="encounter-impact" aria-hidden="true" />
            <div className="encounter-hud">
              <div><span>◉</span><b>{selected.monster.name}</b></div>
              <strong>CP {Math.max(10, selected.monster.rarity * 110 + selected.key % 170)}</strong>
              <TypeBadges type={selected.monster.type} />
              {berryEffect && <em className="berry-active">{BERRIES[berryEffect].icon} {BERRIES[berryEffect].name}</em>}
            </div>
            <div className="encounter-monster">
              <div
                className={`encounter-target ${impacting ? "impacting" : ""}`}
                style={{
                  "--monster-x": `${monsterX}px`,
                  "--monster-size": `${encounterMonsterSize}px`,
                  "--aim-size": `${encounterAimSize}px`,
                } as React.CSSProperties}
              >
                <div className="aim-zone" aria-hidden="true"><i /><span /></div>
                <MonsterSprite monster={selected.monster} />
              </div>
              <span style={{ "--monster-x": `${monsterX}px` } as React.CSSProperties} />
            </div>
            <div className={`timing-callout ${throwing ? "show" : ""}`}>{timingLabel}</div>
            {ballMenuOpen && (
              <div className="encounter-ball-menu">
                <span>사용할 볼</span>
                {(Object.keys(BALLS) as BallKind[]).map((kind) => {
                  const ball = BALLS[kind];
                  return <button
                    key={kind}
                    className={selectedBall === kind ? "active" : ""}
                    onClick={() => { setSelectedBall(kind); setBallMenuOpen(false); }}
                    disabled={!(save[ball.key] || 0)}
                  >
                    <span className={`ball-icon ${kind}`} /><b>{ball.name}</b><small>{save[ball.key] || 0}개</small>
                  </button>;
                })}
              </div>
            )}
            {berryMenuOpen && (
              <div className="encounter-berry-menu">
                <span>사용할 열매</span>
                {(Object.keys(BERRIES) as BerryKind[]).map((kind) => {
                  const berry = BERRIES[kind];
                  return <button key={kind} onClick={() => useBerry(kind)} disabled={save[berry.key] < 1}>
                    <i>{berry.icon}</i><b>{berry.name}</b><small>{save[berry.key]}개</small><em>{berry.description}</em>
                  </button>;
                })}
              </div>
            )}
            <div className="swipe-guide"><i>↑</i><span>회전 없이 직선으로 던지기</span></div>
            <div className="catch-controls">
              <button className="encounter-item" onClick={() => { setBerryMenuOpen((open) => !open); setBallMenuOpen(false); }} aria-label="열매 선택">
                {berryEffect ? BERRIES[berryEffect].icon : "🍓"}
              </button>
              <button
                className={`throw ${throwing ? "throwing" : ""} ${draggingBall ? "dragging" : ""}`}
                style={{
                  "--throw-x": `${throwX}px`,
                  "--throw-y": `${throwY}px`,
                  "--drag-x": `${dragOffset.x}px`,
                  "--drag-y": `${dragOffset.y}px`,
                } as React.CSSProperties}
                onPointerDown={beginBallSwipe}
                onPointerMove={moveBallSwipe}
                onPointerUp={endBallSwipe}
                onPointerCancel={cancelBallSwipe}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    throwBall({ dx: 0, upward: 125 });
                  }
                }}
                disabled={!(save[BALLS[selectedBall].key] || 0) || throwing}
                aria-label={`${BALLS[selectedBall].name}을 위로 스와이프해서 던지기`}
              >
                <span className={`ball-icon ${selectedBall}`} />
                <small>{save[BALLS[selectedBall].key] || 0}</small>
              </button>
              <button className="encounter-item ball-bag" onClick={() => { setBallMenuOpen((open) => !open); setBerryMenuOpen(false); }} aria-label="볼 선택">
                <span className={`ball-icon ${selectedBall}`} />
              </button>
            </div>
          </div>
        )}
        {loaded && !save.starter && (
          <div className="starter-screen">
            <div className="starter-heading">
              <span>WELCOME, EXPLORER</span>
              <h1>첫 파트너를<br />선택하세요</h1>
              <p>함께 길을 걷고 새로운 몬스터를 발견할 친구예요.</p>
            </div>
            <div className="starter-list">
              {MONSTERS.slice(0, 3).map((monster, index) => (
                <button key={monster.id} onClick={() => chooseStarter(monster)} style={{ "--starter": monster.color } as React.CSSProperties}>
                  <small>NO.{String(index + 1).padStart(3, "0")}</small>
                  <div><MonsterSprite monster={monster} /></div>
                  <span>{monster.type} 타입</span>
                  <b>{monster.name}</b>
                  <p>{monster.description}</p>
                  <strong>이 친구로 시작하기 →</strong>
                </button>
              ))}
            </div>
          </div>
        )}
        {loaded && save.starter && motion !== "on" && (
          <div className="location-permission">
            <div className="location-radar"><i /><i /><span>⌖</span></div>
            <span>MOTION ADVENTURE</span>
            <h2>{motion === "loading" ? "동작 센서 연결 중..." : "휴대폰을 움직여 탐험하기"}</h2>
            <p>{motion === "error"
              ? "동작 및 방향 접근이 꺼져 있습니다. Safari 권한을 확인한 뒤 다시 눌러주세요."
              : "휴대폰을 들고 걷거나 가볍게 움직이면 향하고 있는 방향으로 캐릭터가 이동합니다."}</p>
            <button onClick={startMotion} disabled={motion === "loading"}>
              {motion === "loading" ? "센서 연결 중" : "동작 센서 허용하고 시작"}
            </button>
          </div>
        )}
        {message && <div className="toast">{message}</div>}
      </div>
    </main>
  );
}
