"use client";

import { useEffect, useRef, useState } from "react";
import { Peer, type DataConnection } from "peerjs";
import type { Monster } from "./monster-data";

type RaidPhase = "lobby" | "battle" | "won" | "lost";
type RaidState = { phase: RaidPhase; hp: number; time: number; players: number };
type RaidMessage =
  | { type: "join" }
  | { type: "state"; state: RaidState }
  | { type: "attack"; damage: number }
  | { type: "start" };

function RaidSprite({ boss }: { boss: Monster }) {
  const src = `${import.meta.env.BASE_URL || "/"}${boss.sprite.replace(/^\//, "")}`;
  return <img src={src} alt={boss.name} draggable={false} />;
}

export function RaidBattle({ boss, onClose, onWin }: { boss: Monster; onClose: () => void; onWin: () => void }) {
  const [roomCode, setRoomCode] = useState("생성 중...");
  const [joinCode, setJoinCode] = useState("");
  const [isHost, setIsHost] = useState(true);
  const [raid, setRaid] = useState<RaidState>({ phase: "lobby", hp: 300, time: 45, players: 1 });
  const [energy, setEnergy] = useState(0);
  const [cooldown, setCooldown] = useState(false);
  const [status, setStatus] = useState("친구를 초대하거나 혼자 시작할 수 있어요.");
  const peerRef = useRef<Peer | null>(null);
  const hostConnectionRef = useRef<DataConnection | null>(null);
  const partyRef = useRef<DataConnection[]>([]);
  const raidRef = useRef(raid);
  const wonRef = useRef(false);
  const isHostRef = useRef(true);

  useEffect(() => { raidRef.current = raid; }, [raid]);

  useEffect(() => {
    const peer = new Peer(`raid-${Math.random().toString(36).slice(2, 8)}`);
    peerRef.current = peer;
    peer.on("open", (id) => setRoomCode(id));
    peer.on("connection", (connection) => {
      if (!isHostRef.current || raidRef.current.phase !== "lobby") {
        connection.close();
        return;
      }
      setupGuest(connection);
    });
    peer.on("error", () => setStatus("레이드 연결에 실패했어요. 코드를 확인해 주세요."));
    return () => peer.destroy();
  }, []);

  useEffect(() => {
    if (!isHost || raid.phase !== "battle") return;
    const timer = window.setInterval(() => {
      const nextTime = Math.max(0, raidRef.current.time - 1);
      const next = { ...raidRef.current, time: nextTime, phase: nextTime === 0 ? "lost" as const : raidRef.current.phase };
      publish(next);
      if (nextTime === 0) setStatus("시간 초과! 레이드에 실패했어요.");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isHost, raid.phase]);

  function send(connection: DataConnection, message: RaidMessage) {
    if (connection.open) connection.send(message);
  }

  function broadcast(state: RaidState) {
    partyRef.current = partyRef.current.filter((connection) => connection.open);
    partyRef.current.forEach((connection) => send(connection, { type: "state", state }));
  }

  function publish(state: RaidState) {
    raidRef.current = state;
    setRaid(state);
    broadcast(state);
    if (state.phase === "won" && !wonRef.current) {
      wonRef.current = true;
      setStatus("레이드 승리! 보상 포획으로 이동합니다.");
      window.setTimeout(onWin, 900);
    }
  }

  function applyDamage(damage: number) {
    if (!isHostRef.current || raidRef.current.phase !== "battle") return;
    const hp = Math.max(0, raidRef.current.hp - damage);
    publish({ ...raidRef.current, hp, phase: hp === 0 ? "won" : "battle" });
  }

  function handleMessage(message: RaidMessage, connection: DataConnection) {
    if (message.type === "join" && isHostRef.current) {
      const players = 1 + partyRef.current.filter((item) => item.open).length;
      publish({ ...raidRef.current, players });
      setStatus(`${players}명이 레이드에 참가했어요.`);
    }
    if (message.type === "attack" && isHostRef.current) applyDamage(message.damage);
    if (message.type === "state" && !isHostRef.current) {
      raidRef.current = message.state;
      setRaid(message.state);
      if (message.state.phase === "battle") setStatus("협동 레이드 진행 중!");
      if (message.state.phase === "lost") setStatus("시간 초과! 레이드에 실패했어요.");
      if (message.state.phase === "won" && !wonRef.current) {
        wonRef.current = true;
        setStatus("레이드 승리! 보상 포획으로 이동합니다.");
        window.setTimeout(onWin, 900);
      }
    }
    if (message.type === "start" && isHostRef.current) startBattle();
    void connection;
  }

  function setupGuest(connection: DataConnection) {
    partyRef.current.push(connection);
    connection.on("open", () => {
      send(connection, { type: "state", state: raidRef.current });
    });
    connection.on("data", (raw) => handleMessage(raw as RaidMessage, connection));
    connection.on("close", () => {
      partyRef.current = partyRef.current.filter((item) => item !== connection);
      if (isHostRef.current) publish({ ...raidRef.current, players: 1 + partyRef.current.filter((item) => item.open).length });
    });
  }

  function joinRoom() {
    if (!peerRef.current || !joinCode.trim()) return;
    isHostRef.current = false;
    setIsHost(false);
    setStatus("레이드 방에 연결 중...");
    const connection = peerRef.current.connect(joinCode.trim().toLowerCase(), { reliable: true });
    hostConnectionRef.current = connection;
    connection.on("open", () => {
      setStatus("레이드 방에 참가했어요. 방장이 시작하기를 기다리세요.");
      send(connection, { type: "join" });
    });
    connection.on("data", (raw) => handleMessage(raw as RaidMessage, connection));
    connection.on("close", () => setStatus("레이드 방과 연결이 끊어졌어요."));
  }

  function startBattle() {
    if (!isHostRef.current) return;
    wonRef.current = false;
    setEnergy(0);
    publish({ phase: "battle", hp: 300, time: 45, players: raidRef.current.players });
    setStatus("협동 레이드 시작!");
  }

  function attack(kind: "quick" | "charged") {
    if (raid.phase !== "battle" || cooldown || (kind === "charged" && energy < 100)) return;
    const damage = kind === "charged" ? 52 : 9 + Math.floor(Math.random() * 6);
    if (isHostRef.current) applyDamage(damage);
    else if (hostConnectionRef.current) send(hostConnectionRef.current, { type: "attack", damage });
    setEnergy((value) => kind === "charged" ? 0 : Math.min(100, value + 25));
    setCooldown(true);
    window.setTimeout(() => setCooldown(false), kind === "charged" ? 900 : 430);
  }

  return (
    <div className="raid-party-screen">
      <button className="close-raid" onClick={onClose}>×</button>
      <div className="raid-party-title"><span>CO-OP LEGEND RAID</span><h1>{boss.name}</h1><b>{raid.players}명</b></div>
      {raid.phase === "lobby" ? (
        <section className="raid-lobby">
          <div className="raid-lobby-boss"><RaidSprite boss={boss} /></div>
          <p>{status}</p>
          {isHost && <div className="raid-room-code"><span>내 레이드 코드</span><b>{roomCode}</b><button onClick={() => navigator.clipboard?.writeText(roomCode)}>복사</button></div>}
          <div className="raid-join"><input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="친구 레이드 코드" /><button onClick={joinRoom}>참가</button></div>
          {isHost && <button className="raid-start" onClick={startBattle}>레이드 시작 ({raid.players}명)</button>}
        </section>
      ) : (
        <section className="raid-fight">
          <div className="raid-timer">{raid.time}초</div>
          <div className={`raid-party-boss ${cooldown ? "hit" : ""}`}><RaidSprite boss={boss} /></div>
          <div className="raid-team"><b>참가자 {raid.players}명</b><span>모든 공격이 같은 HP에 적용됩니다</span></div>
          <div className="raid-party-hp"><span style={{ width: `${raid.hp / 3}%` }} /><b>{raid.hp} / 300</b></div>
          <p>{status}</p>
          {raid.phase === "battle" && <div className="raid-actions">
            <button onClick={() => attack("quick")} disabled={cooldown}>빠른 공격</button>
            <button className="charged" onClick={() => attack("charged")} disabled={cooldown || energy < 100}>강력 공격 {energy}%</button>
          </div>}
          {raid.phase === "lost" && isHost && <button className="raid-start" onClick={startBattle}>다시 도전</button>}
        </section>
      )}
    </div>
  );
}
