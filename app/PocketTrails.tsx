"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MONSTERS, type Monster } from "./monster-data";

type Spawn = { key: number; monster: Monster; x: number; y: number };
type Save = { caught: Record<string, number>; balls: number; xp: number; steps: number };

const initialSave: Save = { caught: {}, balls: 30, xp: 0, steps: 0 };
const spawnPoints = [
  [17, 24], [72, 18], [84, 42], [31, 67], [67, 74], [12, 82],
] as const;

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
  const [selected, setSelected] = useState<Spawn | null>(null);
  const [tab, setTab] = useState<"map" | "dex" | "bag">("map");
  const [message, setMessage] = useState("");
  const [throwing, setThrowing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [gps, setGps] = useState<"off" | "loading" | "on" | "error">("off");
  const gpsOrigin = useRef<{ lat: number; lng: number } | null>(null);
  const lastGps = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("pocket-trails-save");
    if (stored) {
      try { setSave({ ...initialSave, ...JSON.parse(stored) }); } catch { /* 새 저장으로 시작 */ }
    }
    setSpawns(createSpawns());
    setLoaded(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
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

  const level = Math.floor(save.xp / 100) + 1;
  const caughtTotal = Object.values(save.caught).reduce((a, b) => a + b, 0);
  const discovered = Object.keys(save.caught).length;

  const nearby = useMemo(() => spawns.map((spawn) => ({
    ...spawn,
    distance: Math.round(Math.hypot(spawn.x - position.x, spawn.y - position.y) * 2.2),
  })).sort((a, b) => a.distance - b.distance), [spawns, position]);

  function move(dx: number, dy: number) {
    setPosition((p) => ({
      x: Math.max(6, Math.min(94, p.x + dx)),
      y: Math.max(8, Math.min(90, p.y + dy)),
    }));
    setSave((s) => ({ ...s, steps: s.steps + 1 }));
  }

  function openEncounter(spawn: Spawn) {
    const distance = Math.hypot(spawn.x - position.x, spawn.y - position.y);
    if (distance > 31) {
      setMessage("조금 더 가까이 걸어가 보세요!");
      setTimeout(() => setMessage(""), 1800);
      return;
    }
    setSelected(spawn);
  }

  function throwBall() {
    if (!selected || save.balls < 1 || throwing) return;
    setThrowing(true);
    setSave((s) => ({ ...s, balls: s.balls - 1 }));
    const target = selected;
    setTimeout(() => {
      const caught = Math.random() < Math.max(.38, .86 - target.monster.rarity * .09);
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
        setMessage(`${target.monster.name}이(가) 볼에서 빠져나왔어요!`);
      }
      setThrowing(false);
      setTimeout(() => setMessage(""), 2100);
    }, 900);
  }

  function refill() {
    if (save.balls >= 30) return;
    setSave((s) => ({ ...s, balls: 30 }));
    setMessage("탐험볼을 30개 채웠어요!");
    setTimeout(() => setMessage(""), 1800);
  }

  function refreshWorld() {
    setSpawns(createSpawns());
    setMessage("새로운 기척이 느껴져요.");
    setTimeout(() => setMessage(""), 1800);
  }

  function startGps() {
    if (!navigator.geolocation) {
      setGps("error");
      setMessage("이 브라우저는 GPS를 지원하지 않아요.");
      return;
    }
    setGps("loading");
    navigator.geolocation.watchPosition(({ coords }) => {
      const current = { lat: coords.latitude, lng: coords.longitude };
      if (!gpsOrigin.current) gpsOrigin.current = current;
      if (lastGps.current) {
        const latMeters = (current.lat - lastGps.current.lat) * 111_000;
        const lngMeters = (current.lng - lastGps.current.lng) * 88_000;
        const walked = Math.hypot(latMeters, lngMeters);
        if (walked > 3) {
          setPosition((p) => ({
            x: Math.max(6, Math.min(94, p.x + lngMeters / 4)),
            y: Math.max(8, Math.min(90, p.y - latMeters / 4)),
          }));
          setSave((s) => ({ ...s, steps: s.steps + Math.max(1, Math.round(walked / 3)) }));
          if (walked > 25) setSpawns(createSpawns());
        }
      }
      lastGps.current = current;
      setGps("on");
    }, () => {
      setGps("error");
      setMessage("위치 권한을 허용하면 실제 걸음으로 탐험할 수 있어요.");
      setTimeout(() => setMessage(""), 2800);
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 });
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
              <div className="map-shade" />
              <div className="park park-a">느티 공원</div>
              <div className="park park-b">새봄 쉼터</div>
              <div className="water" />
              <div className="road road-a" /><div className="road road-b" /><div className="road road-c" />
              <button className="stop stop-a" onClick={refill} aria-label="탐험볼 충전소">◈</button>
              <button className="stop stop-b" onClick={refill} aria-label="탐험볼 충전소">◈</button>
              {spawns.map((spawn) => (
                <button
                  key={spawn.key}
                  className="spawn"
                  style={{ left: `${spawn.x}%`, top: `${spawn.y}%`, "--monster": spawn.monster.color } as React.CSSProperties}
                  onClick={() => openEncounter(spawn)}
                  aria-label={`${spawn.monster.name} 만나기`}
                >
                  <span>{spawn.monster.sprite}</span>
                  <i />
                </button>
              ))}
              <div className="player" style={{ left: `${position.x}%`, top: `${position.y}%` }}>
                <i /><span>🧢</span>
              </div>
              <div className="map-title"><span>현재 위치</span><b>솔바람 마을</b></div>
              <button className="refresh" onClick={refreshWorld} aria-label="몬스터 새로 찾기">↻</button>
              <button className={`gps-button ${gps}`} onClick={startGps} aria-label="GPS 탐험 시작">
                <i>⌖</i><span>{gps === "on" ? "GPS 연결됨" : gps === "loading" ? "연결 중" : "GPS로 걷기"}</span>
              </button>
              <div className="move-pad" aria-label="이동 조작">
                <button onClick={() => move(0, -3)}>▲</button>
                <button onClick={() => move(-3, 0)}>◀</button>
                <button onClick={() => move(3, 0)}>▶</button>
                <button onClick={() => move(0, 3)}>▼</button>
              </div>
              <aside className="nearby">
                <div><b>주변 탐색</b><span>{spawns.length}마리</span></div>
                <div className="near-list">
                  {nearby.slice(0, 3).map((item) => (
                    <button key={item.key} onClick={() => openEncounter(item)}>
                      <em>{item.monster.sprite}</em><span>{item.monster.name}<small>{item.distance}m</small></span>
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
                    <div style={{ background: `${monster.color}22`, color: monster.color }}>{count ? monster.sprite : "?"}</div>
                    <span>NO.{String(MONSTERS.indexOf(monster) + 1).padStart(3, "0")}</span>
                    <b>{count ? monster.name : "미발견"}</b>
                    <small>{count ? `${monster.type} · ${count}마리` : "???"}</small>
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
                <div><span className="ball-icon" /><p><b>탐험볼</b><small>야생 몬스터를 포획하는 도구</small></p><strong>{save.balls}</strong></div>
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
            <div className="encounter-monster"><div>{selected.monster.sprite}</div><span /></div>
            <section>
              <span className="type">{selected.monster.type} 타입</span>
              <h1>{selected.monster.name}</h1>
              <p>{selected.monster.description}</p>
              <div className="catch-rate"><span>포획 난이도</span><i>{Array.from({length: 5}, (_, i) => <b key={i} className={i < selected.monster.rarity ? "on" : ""} />)}</i></div>
            </section>
            <button className={`throw ${throwing ? "throwing" : ""}`} onClick={throwBall} disabled={!save.balls}>
              <span className="ball-icon" /><b>{throwing ? "포획 중..." : "탐험볼 던지기"}</b><small>{save.balls}개 남음</small>
            </button>
          </div>
        )}
        {message && <div className="toast">{message}</div>}
      </div>
    </main>
  );
}
