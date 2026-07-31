"use client";

import { useEffect, useRef, useState } from "react";
import { Peer, type DataConnection } from "peerjs";
import type { Monster } from "./monster-data";

type BattleMessage =
  | { type: "ready"; monster: Monster }
  | { type: "damage"; amount: number }
  | { type: "hp"; hp: number }
  | { type: "restart"; monster: Monster };

function BattleSprite({ monster }: { monster: Monster }) {
  const src = `${import.meta.env.BASE_URL || "/"}${monster.sprite.replace(/^\//, "")}`;
  return <img src={src} alt={monster.name} draggable={false} />;
}

export function BattleArena({ owned }: { owned: Monster[] }) {
  const [peerCode, setPeerCode] = useState("생성 중...");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("친구에게 내 코드를 알려주거나 친구 코드를 입력하세요.");
  const [connected, setConnected] = useState(false);
  const [selectedId, setSelectedId] = useState(owned[0]?.id || "");
  const [opponent, setOpponent] = useState<Monster | null>(null);
  const [myHp, setMyHp] = useState(100);
  const [opponentHp, setOpponentHp] = useState(100);
  const [cooldown, setCooldown] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const selectedRef = useRef(selectedId);
  const selected = owned.find((monster) => monster.id === selectedId) || owned[0];

  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    if (!selectedId && owned[0]) setSelectedId(owned[0].id);
  }, [owned, selectedId]);

  useEffect(() => {
    const peer = new Peer(`pt-${Math.random().toString(36).slice(2, 8)}`);
    peerRef.current = peer;
    peer.on("open", (id) => setPeerCode(id));
    peer.on("connection", (connection) => prepareConnection(connection));
    peer.on("error", () => setStatus("연결에 실패했어요. 새로고침한 뒤 다시 시도하세요."));
    return () => peer.destroy();
  }, []);

  function prepareConnection(connection: DataConnection) {
    connectionRef.current?.close();
    connectionRef.current = connection;
    connection.on("open", () => {
      setConnected(true);
      setMyHp(100);
      setOpponentHp(100);
      setStatus("친구와 연결됐어요. 배틀 시작!");
      const monster = owned.find((item) => item.id === selectedRef.current) || owned[0];
      if (monster) connection.send({ type: "ready", monster } satisfies BattleMessage);
    });
    connection.on("data", (raw) => {
      const message = raw as BattleMessage;
      if (message.type === "ready" || message.type === "restart") {
        setOpponent(message.monster);
        setOpponentHp(100);
        if (message.type === "restart") setMyHp(100);
      }
      if (message.type === "damage") {
        setMyHp((hp) => {
          const next = Math.max(0, hp - message.amount);
          connection.send({ type: "hp", hp: next } satisfies BattleMessage);
          if (next === 0) setStatus("패배! 다시 배틀할 수 있어요.");
          return next;
        });
      }
      if (message.type === "hp") {
        setOpponentHp(message.hp);
        if (message.hp === 0) setStatus("승리! 친구 포켓몬을 쓰러뜨렸어요.");
      }
    });
    connection.on("close", () => {
      setConnected(false);
      setOpponent(null);
      setStatus("친구와 연결이 끊어졌어요.");
    });
  }

  function joinBattle() {
    if (!peerRef.current || !joinCode.trim() || !selected) return;
    setStatus("친구에게 연결 중...");
    prepareConnection(peerRef.current.connect(joinCode.trim().toLowerCase(), { reliable: true }));
  }

  function attack() {
    if (!connectionRef.current?.open || !selected || !opponent || cooldown || myHp <= 0 || opponentHp <= 0) return;
    const damage = 7 + selected.rarity * 2 + Math.floor(Math.random() * 6);
    connectionRef.current.send({ type: "damage", amount: damage } satisfies BattleMessage);
    setCooldown(true);
    setTimeout(() => setCooldown(false), 850);
  }

  function restart() {
    if (!connectionRef.current?.open || !selected) return;
    setMyHp(100);
    setOpponentHp(100);
    setStatus("재대결 시작!");
    connectionRef.current.send({ type: "restart", monster: selected } satisfies BattleMessage);
  }

  if (!owned.length) {
    return <div className="battle-empty"><span>⚔️</span><h2>배틀할 포켓몬이 없어요</h2><p>먼저 포켓몬을 한 마리 잡아 주세요.</p></div>;
  }

  return (
    <div className="battle-arena">
      <div className="battle-heading"><span>LIVE P2P BATTLE</span><h1>친구 배틀</h1><p>{status}</p></div>
      {!connected ? (
        <section className="battle-lobby">
          <label>내 배틀 포켓몬
            <select value={selected?.id || ""} onChange={(event) => setSelectedId(event.target.value)}>
              {owned.map((monster) => <option key={monster.id} value={monster.id}>{monster.name}</option>)}
            </select>
          </label>
          <div className="my-peer-code"><span>내 방 코드</span><b>{peerCode}</b><button onClick={() => navigator.clipboard?.writeText(peerCode)}>복사</button></div>
          <div className="join-peer"><input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="친구 코드 입력" /><button onClick={joinBattle}>참가</button></div>
          <small>두 사람 모두 이 페이지를 켜 둔 상태에서 연결해야 합니다.</small>
        </section>
      ) : (
        <section className="live-battle">
          <div className="battle-fighter opponent">
            <div className="hp-bar"><span style={{ width: `${opponentHp}%` }} /></div>
            {opponent ? <><BattleSprite monster={opponent} /><b>{opponent.name}</b></> : <div className="waiting-opponent">상대 선택 대기 중…</div>}
          </div>
          <div className="battle-vs">VS</div>
          <div className="battle-fighter mine">
            <div className="hp-bar"><span style={{ width: `${myHp}%` }} /></div>
            {selected && <><BattleSprite monster={selected} /><b>{selected.name}</b></>}
          </div>
          {myHp > 0 && opponentHp > 0
            ? <button className="battle-attack" onClick={attack} disabled={!opponent || cooldown}>{cooldown ? "기술 충전 중…" : "공격!"}</button>
            : <button className="battle-attack rematch" onClick={restart}>재대결</button>}
        </section>
      )}
    </div>
  );
}
