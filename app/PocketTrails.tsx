"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MONSTERS, type Monster } from "./monster-data";

type Spawn = { key: number; monster: Monster; x: number; y: number };
type Save = { caught: Record<string, number>; balls: number; greatBalls?: number; ultraBalls?: number; xp: number; steps: number; starter?: string };
type BallKind = "basic" | "great" | "ultra";

const initialSave: Save = { caught: {}, balls: 30, greatBalls: 10, ultraBalls: 3, xp: 0, steps: 0 };
const BALLS = {
  basic: { name: "몬스터볼", key: "balls" as const, bonus: 1 },
  great: { name: "슈퍼볼", key: "greatBalls" as const, bonus: 1.35 },
  ultra: { name: "하이퍼볼", key: "ultraBalls" as const, bonus: 1.25 },
};
const spawnPoints = [
  [17, 24], [72, 18], [84, 42], [31, 67], [67, 74], [12, 82],
] as const;
const stopPoints = [
  [13, 44], [78, 25], [42, 19], [88, 68], [24, 76], [57, 57], [72, 86],
] as const;

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
  const pool = MONSTERS.flatMap((monster) =>
    Array.from({ length: Math.max(1, 7 - monster.rarity) }, () => monster),
  );
  return pool[Math.floor(Math.random() * pool.length)];
}

function createSpawns(seed = Date.now()): Spawn[] {
  return spawnPoints.map(([x, y], index) => ({
    key: seed + index,
    monster: chooseMonster(),
    x,
    y,
  }));
}

export function PocketTrails() {
  const [save, setSave] = useState<Save>(initialSave);
  const [spawns, setSpawns] = useState<Spawn[]>([]);
  const [position, setPosition] = useState({ x: 49, y: 53 });
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<Spawn | null>(null);
  const [tab, setTab] = useState<"map" | "dex" | "bag">("map");
  const [message, setMessage] = useState("");
  const [throwing, setThrowing] = useState(false);
  const [selectedBall, setSelectedBall] = useState<BallKind>("basic");
  const [encounterThrows, setEncounterThrows] = useState(0);
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

  useEffect(() => {
    const stored = localStorage.getItem("pocket-trails-save");
    if (stored) {
      try { setSave({ ...initialSave, ...JSON.parse(stored) }); } catch { /* 새 저장으로 시작 */ }
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
      if (selected || tab !== "map") return;
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

  useEffect(() => () => {
    if (gpsWatchId.current !== null) navigator.geolocation.clearWatch(gpsWatchId.current);
    window.removeEventListener("deviceorientation", handleOrientation);
    window.removeEventListener("devicemotion", handleMotion);
  }, []);

  const level = Math.floor(save.xp / 100) + 1;
  const caughtTotal = Object.values(save.caught).reduce((a, b) => a + b, 0);
  const discovered = Object.keys(save.caught).length;

  const nearby = useMemo(() => spawns.map((spawn) => ({
    ...spawn,
    distance: Math.round(Math.hypot(spawn.x - position.x, spawn.y - position.y) * 2.2),
  })).sort((a, b) => a.distance - b.distance), [spawns, position]);

  function move(dx: number, dy: number) {
    moveAcrossMap(dx, dy);
    setSave((s) => ({ ...s, steps: s.steps + 1 }));
  }

  function moveAcrossMap(dx: number, dy: number) {
    setPosition((p) => ({
      ...(() => {
        let x = p.x + dx, y = p.y + dy, mapX = 0, mapY = 0;
        if (x > 94) { x = 7; mapX = 1; }
        if (x < 6) { x = 93; mapX = -1; }
        if (y > 91) { y = 9; mapY = 1; }
        if (y < 8) { y = 90; mapY = -1; }
        if (mapX || mapY) {
          setMapOffset((offset) => ({ x: offset.x + mapX, y: offset.y + mapY }));
          setSpawns(createSpawns());
          setMessage("새로운 구역에 도착했어요!");
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
    setEncounterThrows(0);
    setSelected(spawn);
  }

  function throwBall() {
    const ball = BALLS[selectedBall];
    if (!selected || (save[ball.key] || 0) < 1 || throwing) return;
    setThrowing(true);
    setSave((s) => ({ ...s, [ball.key]: Math.max(0, (s[ball.key] || 0) - 1) }));
    const target = selected;
    const nextThrow = encounterThrows + 1;
    setEncounterThrows(nextThrow);
    setTimeout(() => {
      const baseRate = target.monster.catchRate ?? Math.max(.25, .86 - target.monster.rarity * .09);
      const minimumMet = nextThrow >= (target.monster.minThrows || 1);
      const caught = minimumMet && Math.random() < Math.min(.96, baseRate * ball.bonus);
      if (caught) {
        setSave((s) => ({
          ...s,
          xp: s.xp + 20 + target.monster.rarity * 5,
          caught: { ...s.caught, [target.monster.id]: (s.caught[target.monster.id] || 0) + 1 },
        }));
        setSpawns((items) => items.filter((item) => item.key !== target.key));
        setMessage(`${target.monster.name} 포획 성공!`);
        setSelected(null);
      } else {
        const remaining = Math.max(0, (target.monster.minThrows || 1) - nextThrow);
        setMessage(remaining > 0
          ? `${target.monster.name}은(는) 아직 꿈쩍도 하지 않아요 · 최소 ${remaining}회 더!`
          : `${target.monster.name}이(가) 볼에서 빠져나왔어요!`);
      }
      setThrowing(false);
      setTimeout(() => setMessage(""), 2100);
    }, 900);
  }

  function refill() {
    if (save.balls >= 30 && (save.greatBalls || 0) >= 10 && (save.ultraBalls || 0) >= 3) return;
    setSave((s) => ({ ...s, balls: 30, greatBalls: 10, ultraBalls: 3 }));
    setMessage("모든 볼을 충전했어요!");
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
            <div className="map" aria-label="탐험 지도">
              <div className="map-shade" style={{ backgroundPosition: `${mapOffset.x * 95}px ${mapOffset.y * 75}px` }} />
              <div className="park park-a">느티 공원</div>
              <div className="park park-b">새봄 쉼터</div>
              <div className="water" />
              <div className="road road-a" /><div className="road road-b" /><div className="road road-c" />
              {stopPoints.map(([x, y], index) => (
                <button key={`${mapOffset.x}-${mapOffset.y}-${index}`} className="stop" style={{ left: `${x}%`, top: `${y}%` }} onClick={refill} aria-label="포켓스탑">◈</button>
              ))}
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
                  return <article key={monster.id} className={count ? "found" : "locked"}>
                    <div style={{ background: `${monster.color}22`, color: monster.color }}>{count ? <MonsterSprite monster={monster} /> : "?"}</div>
                    <span>NO.{String(MONSTERS.indexOf(monster) + 1).padStart(3, "0")}</span>
                    <b>{count ? monster.name : "미발견"}</b>
                    <small>{count ? <><TypeBadges type={monster.type} /><em>{count}마리</em></> : "???"}</small>
                    {count > 0 && <p>{monster.description}</p>}
                  </article>;
                })}
              </div>
            </div>
          )}

          {tab === "bag" && (
            <div className="content-panel bag-panel">
              <div className="panel-heading"><span>EXPLORER KIT</span><h1>내 가방</h1><p>모험 기록은 이 기기에 자동 저장돼요.</p></div>
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
                <button onClick={refill}>충전소 이용하기</button>
              </section>
              <button className="reset" onClick={() => { setSave(initialSave); setSpawns(createSpawns()); }}>저장 기록 초기화</button>
            </div>
          )}
        </section>

        <nav className="bottom-nav">
          <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}><i>⌖</i><span>지도</span></button>
          <button className={tab === "dex" ? "active" : ""} onClick={() => setTab("dex")}><i>▦</i><span>도감</span></button>
          <button className={tab === "bag" ? "active" : ""} onClick={() => setTab("bag")}><i>◉</i><span>가방</span></button>
        </nav>

        {selected && (
          <div className="encounter" style={{ "--accent": selected.monster.color } as React.CSSProperties}>
            <button className="close-encounter" onClick={() => setSelected(null)}>×</button>
            <div className="encounter-sky"><i /><i /><i /></div>
            <div className="encounter-monster"><div><MonsterSprite monster={selected.monster} /></div><span /></div>
            <section>
              {selected.monster.legendary && <div className="legendary-badge">★ LEGENDARY</div>}
              <TypeBadges type={selected.monster.type} />
              <h1>{selected.monster.name}</h1>
              <p>{selected.monster.description}</p>
              <div className="catch-rate"><span>포획 난이도</span><i>{Array.from({length: 5}, (_, i) => <b key={i} className={i < selected.monster.rarity ? "on" : ""} />)}</i></div>
              {selected.monster.minThrows && <div className="throw-rule">투척 {encounterThrows}회 · 최소 {selected.monster.minThrows}회 필요</div>}
              <div className="ball-picker">
                {(Object.keys(BALLS) as BallKind[]).map((kind) => {
                  const ball = BALLS[kind];
                  return <button key={kind} className={selectedBall === kind ? "active" : ""} onClick={() => setSelectedBall(kind)}>
                    <span className={`ball-icon ${kind}`} /><b>{ball.name}</b><small>{save[ball.key] || 0}개</small>
                  </button>;
                })}
              </div>
            </section>
            <button className={`throw ${throwing ? "throwing" : ""}`} onClick={throwBall} disabled={!(save[BALLS[selectedBall].key] || 0)}>
              <span className={`ball-icon ${selectedBall}`} /><b>{throwing ? "포획 중..." : `${BALLS[selectedBall].name} 던지기`}</b><small>{save[BALLS[selectedBall].key] || 0}개 남음</small>
            </button>
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
