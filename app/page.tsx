"use client";

import { useEffect, useMemo, useState } from "react";

type Direction = 1 | -1;
type VehicleKind = "car" | "bus";

type Vehicle = {
  id: string;
  kind: VehicleKind;
  progress: number;
  direction: Direction;
  lane: 0 | 1;
  speed: number;
  targetSpeed: number;
  occupancy?: number;
  dwell?: number;
};

type EventItem = {
  time: number;
  text: string;
};

type SimState = {
  time: number;
  vehicles: Vehicle[];
  queues: number[];
  boarded: number;
  laneChanges: number;
  priorityActions: number;
  stoppedAtSignals: number;
  surgeTriggered: boolean;
  lastPriorityAt: number[];
  events: EventItem[];
};

const STOPS = [
  { name: "University of Waterloo", short: "UW", progress: 0.07 },
  { name: "Waterloo Public Square", short: "Uptown", progress: 0.34 },
  { name: "Grand River Hospital", short: "Hospital", progress: 0.65 },
  { name: "Central Station", short: "Central", progress: 0.93 },
];

const SIGNALS = [0.2, 0.5, 0.8];
const LANE_X = {
  north0: 46,
  north1: 42,
  south0: 54,
  south1: 58,
};

function laneX(vehicle: Vehicle) {
  if (vehicle.direction === 1) {
    return vehicle.lane === 0 ? LANE_X.north0 : LANE_X.north1;
  }
  return vehicle.lane === 0 ? LANE_X.south0 : LANE_X.south1;
}

function vehicle(id: string, kind: VehicleKind, progress: number, direction: Direction, lane: 0 | 1, speed: number, occupancy?: number): Vehicle {
  return {
    id,
    kind,
    progress,
    direction,
    lane,
    speed,
    targetSpeed: kind === "bus" ? 0.015 : 0.019,
    occupancy,
  };
}

function initialState(): SimState {
  return {
    time: 0,
    vehicles: [
      vehicle("B101", "bus", 0.07, 1, 0, 0.013, 18),
      vehicle("B102", "bus", 0.93, -1, 0, 0.013, 27),
      vehicle("B103", "bus", 0.34, 1, 0, 0.013, 8),

      vehicle("C01", "car", 0.14, 1, 0, 0.017),
      vehicle("C02", "car", 0.22, 1, 1, 0.018),
      vehicle("C03", "car", 0.29, 1, 0, 0.016),
      vehicle("C04", "car", 0.43, 1, 1, 0.019),
      vehicle("C05", "car", 0.56, 1, 0, 0.017),
      vehicle("C06", "car", 0.73, 1, 1, 0.018),
      vehicle("C07", "car", 0.86, 1, 0, 0.018),

      vehicle("C08", "car", 0.87, -1, 0, 0.018),
      vehicle("C09", "car", 0.76, -1, 1, 0.017),
      vehicle("C10", "car", 0.61, -1, 0, 0.019),
      vehicle("C11", "car", 0.48, -1, 1, 0.018),
      vehicle("C12", "car", 0.36, -1, 0, 0.016),
      vehicle("C13", "car", 0.25, -1, 1, 0.019),
      vehicle("C14", "car", 0.12, -1, 0, 0.017),
    ],
    queues: [14, 11, 8, 19],
    boarded: 0,
    laneChanges: 0,
    priorityActions: 0,
    stoppedAtSignals: 0,
    surgeTriggered: false,
    lastPriorityAt: [-99, -99, -99],
    events: [{ time: 0, text: "Detailed corridor simulation ready" }],
  };
}

function baselineSignalGreen(signalIndex: number, time: number) {
  return (time + signalIndex * 4) % 12 < 7;
}

function distanceAhead(a: Vehicle, b: Vehicle) {
  if (a.direction !== b.direction || a.lane !== b.lane) return Infinity;
  const distance = (b.progress - a.progress) * a.direction;
  return distance > 0 ? distance : Infinity;
}

function nearestLeader(vehicle: Vehicle, all: Vehicle[]) {
  let leader: Vehicle | null = null;
  let gap = Infinity;

  for (const other of all) {
    if (other.id === vehicle.id) continue;
    const d = distanceAhead(vehicle, other);
    if (d < gap) {
      gap = d;
      leader = other;
    }
  }

  return { leader, gap };
}

function laneClear(vehicle: Vehicle, targetLane: 0 | 1, all: Vehicle[]) {
  for (const other of all) {
    if (other.id === vehicle.id || other.direction !== vehicle.direction || other.lane !== targetLane) continue;
    if (Math.abs(other.progress - vehicle.progress) < 0.055) return false;
  }
  return true;
}

function approachingSignal(vehicle: Vehicle, signal: number) {
  const d = (signal - vehicle.progress) * vehicle.direction;
  return d >= 0 && d < 0.045;
}

function crossesStop(from: number, to: number, stop: number, direction: Direction) {
  return direction === 1 ? from < stop && to >= stop : from > stop && to <= stop;
}

function clockLabel(time: number) {
  return `00:${String(time).padStart(2, "0")}`;
}

export default function Home() {
  const [sim, setSim] = useState<SimState>(() => initialState());
  const [running, setRunning] = useState(false);
  const [transitOps, setTransitOps] = useState(true);
  const [traffic, setTraffic] = useState(1);
  const [speed, setSpeed] = useState(2);

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      setSim((current) => {
        if (current.time >= 60) return current;

        const nextTime = current.time + 1;
        const queues = [...current.queues];
        const events = [...current.events];
        const lastPriorityAt = [...current.lastPriorityAt];

        if (nextTime % 3 === 0) queues[0] += 2;
        if (nextTime % 4 === 0) queues[1] += 2;
        if (nextTime % 5 === 0) queues[2] += 1;
        if (nextTime % 3 === 0) queues[3] += 2;

        let surgeTriggered = current.surgeTriggered;
        if (!surgeTriggered && nextTime === 12) {
          queues[3] += 34;
          surgeTriggered = true;
          events.push({ time: nextTime, text: "Train arrival: 34 transfer passengers at Central" });
        }

        let laneChanges = current.laneChanges;
        let priorityActions = current.priorityActions;
        let stoppedAtSignals = current.stoppedAtSignals;
        let boarded = current.boarded;

        const nextVehicles = current.vehicles.map((original) => {
          let v = { ...original };

          if (v.dwell && v.dwell > 0) {
            v.dwell -= 1;
            v.speed = 0;
            return v;
          }

          const leader = nearestLeader(v, current.vehicles);
          const desiredGap = v.kind === "bus" ? 0.052 : 0.038;
          let desiredSpeed = v.targetSpeed / Math.max(0.65, traffic);

          if (leader.leader && leader.gap < desiredGap) {
            desiredSpeed = Math.max(0, leader.leader.speed * 0.82);

            if (
              v.kind === "car" &&
              leader.gap < 0.045 &&
              laneClear(v, v.lane === 0 ? 1 : 0, current.vehicles)
            ) {
              v.lane = v.lane === 0 ? 1 : 0;
              laneChanges += 1;
            }
          }

          let signalBlocked = false;
          SIGNALS.forEach((signal, index) => {
            if (!approachingSignal(v, signal)) return;

            const baselineGreen = baselineSignalGreen(index, nextTime);
            let green = baselineGreen;

            if (v.kind === "bus" && transitOps && !baselineGreen && nextTime - lastPriorityAt[index] >= 4) {
              green = true;
              lastPriorityAt[index] = nextTime;
              priorityActions += 1;
              events.push({ time: nextTime, text: `${v.id} requested priority at Signal ${index + 1}` });
            }

            if (!green) {
              desiredSpeed = 0;
              signalBlocked = true;
            }
          });

          if (signalBlocked) stoppedAtSignals += 1;

          const accel = 0.004;
          if (v.speed < desiredSpeed) v.speed = Math.min(desiredSpeed, v.speed + accel);
          else v.speed = Math.max(desiredSpeed, v.speed - accel * 1.6);

          let nextProgress = v.progress + v.speed * v.direction;

          if (v.kind === "bus") {
            STOPS.forEach((stop, stopIndex) => {
              if (!crossesStop(v.progress, nextProgress, stop.progress, v.direction)) return;

              nextProgress = stop.progress;
              v.dwell = 2;

              const leaving = Math.min(v.occupancy ?? 0, 2 + ((nextTime + stopIndex) % 5));
              const afterAlight = Math.max(0, (v.occupancy ?? 0) - leaving);
              const capacity = 48 - afterAlight;
              const boarding = Math.min(queues[stopIndex], capacity, 10);

              queues[stopIndex] -= boarding;
              v.occupancy = afterAlight + boarding;
              boarded += boarding;

              if (boarding > 0) {
                events.push({ time: nextTime, text: `${v.id}: ${boarding} boarded at ${stop.short}` });
              }
            });
          }

          if (nextProgress >= 0.97) {
            nextProgress = 0.95;
            v.direction = -1;
            v.lane = 0;
          } else if (nextProgress <= 0.03) {
            nextProgress = 0.05;
            v.direction = 1;
            v.lane = 0;
          }

          v.progress = nextProgress;
          return v;
        });

        return {
          time: nextTime,
          vehicles: nextVehicles,
          queues,
          boarded,
          laneChanges,
          priorityActions,
          stoppedAtSignals,
          surgeTriggered,
          lastPriorityAt,
          events: events.slice(-14),
        };
      });
    }, Math.max(75, 650 / speed));

    return () => window.clearInterval(timer);
  }, [running, speed, traffic, transitOps]);

  useEffect(() => {
    if (sim.time >= 60) setRunning(false);
  }, [sim.time]);

  const totalWaiting = sim.queues.reduce((sum, value) => sum + value, 0);
  const buses = sim.vehicles.filter((v) => v.kind === "bus");

  const signalStates = useMemo(
    () =>
      SIGNALS.map((signal, index) => {
        const baselineGreen = baselineSignalGreen(index, sim.time);
        const priority =
          transitOps &&
          !baselineGreen &&
          buses.some((bus) => approachingSignal(bus, signal));

        return { green: baselineGreen || priority, priority };
      }),
    [sim.time, buses, transitOps]
  );

  function reset() {
    setRunning(false);
    setSim(initialState());
  }

  function injectTraffic() {
    setSim((current) => {
      const additions: Vehicle[] = [
        vehicle(`X${current.time}A`, "car", 0.08, 1, 1, 0.016),
        vehicle(`X${current.time}B`, "car", 0.92, -1, 1, 0.016),
      ];
      return {
        ...current,
        vehicles: [...current.vehicles, ...additions],
        events: [...current.events, { time: current.time, text: "Traffic injected into both directions" }].slice(-14),
      };
    });
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <div className="brandRow">
            <span className="brandMark">T</span>
            <strong>TransitOps Web</strong>
          </div>
          <p>Student transit operations simulator</p>
        </div>
        <div className="runState">
          <span className={running ? "liveDot live" : "liveDot"} />
          {running ? "SIMULATION RUNNING" : "SIMULATION READY"}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">MULTI-LANE CORRIDOR LAB</p>
          <h1>Traffic moves like traffic now.</h1>
          <p className="heroCopy">
            Cars maintain spacing, change lanes around slower vehicles, queue at red signals,
            and buses stop for passengers while TransitOps can request signal priority.
          </p>
        </div>
        <div className="clock">
          <span>SIM TIME</span>
          <strong>{clockLabel(sim.time)}</strong>
          <small>60-minute scenario</small>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel controls">
          <div className="panelTitle">
            <div><p className="eyebrow">CONTROL</p><h2>Scenario</h2></div>
            <span>{transitOps ? "SMART" : "BASELINE"}</span>
          </div>

          <label className="switchRow">
            <span><strong>TransitOps control</strong><small>Bus signal priority</small></span>
            <button type="button" className={transitOps ? "toggle on" : "toggle"} onClick={() => setTransitOps(v => !v)}>
              <i />
            </button>
          </label>

          <label>
            <div className="labelRow"><span>Traffic density</span><strong>{traffic.toFixed(1)}×</strong></div>
            <input type="range" min="0.7" max="1.8" step="0.1" value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} />
          </label>

          <label>
            <div className="labelRow"><span>Playback</span><strong>{speed}×</strong></div>
            <input type="range" min="1" max="5" step="1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>

          <div className="buttonGrid">
            <button className="primaryButton" type="button" onClick={() => setRunning(v => !v)}>
              {running ? "Pause" : sim.time >= 60 ? "Finished" : "Run"}
            </button>
            <button type="button" onClick={reset}>Reset</button>
          </div>

          <button type="button" className="surgeButton" onClick={injectTraffic}>Add traffic</button>
        </aside>

        <section className="simulationCard">
          <div className="streetLabels">
            <span>NORTHBOUND ↑</span>
            <span>4-LANE TRANSIT CORRIDOR</span>
            <span>↓ SOUTHBOUND</span>
          </div>

          <div className="corridor">
            <div className="roadSurface">
              <div className="centerMedian" />
              <div className="laneMark laneMarkA" />
              <div className="laneMark laneMarkB" />
            </div>

            {STOPS.map((stop, index) => (
              <div className="station" key={stop.name} style={{ top: `${7 + stop.progress * 86}%` }}>
                <div className="stationBay" />
                <div className="stationLabel">
                  <strong>{stop.short}</strong>
                  <span>{sim.queues[index]} waiting</span>
                </div>
              </div>
            ))}

            {SIGNALS.map((signal, index) => (
              <div className="intersection" key={signal} style={{ top: `${7 + signal * 86}%` }}>
                <div className="crossRoad">
                  <div className="crossLane" />
                </div>
                <div className={signalStates[index].green ? "signal green" : "signal red"}><i /></div>
                <div className={signalStates[index].green ? "signal opposite green" : "signal opposite red"}><i /></div>
                {signalStates[index].priority && <span className="priorityTag">BUS PRIORITY</span>}
              </div>
            ))}

            {sim.vehicles.map((v) => (
              <div
                key={v.id}
                className={v.kind === "bus" ? "roadVehicle bus" : "roadVehicle car"}
                style={{
                  top: `${7 + v.progress * 86}%`,
                  left: `${laneX(v)}%`,
                  transform: `translate(-50%, -50%) rotate(${v.direction === 1 ? 0 : 180}deg)`,
                }}
                title={`${v.id} · lane ${v.lane + 1} · speed ${v.speed.toFixed(3)}`}
              >
                {v.kind === "bus" ? (
                  <>
                    <strong>{v.id}</strong>
                    <span>{v.occupancy}/48</span>
                  </>
                ) : (
                  <i />
                )}
              </div>
            ))}
          </div>
        </section>

        <aside className="panel metrics">
          <div className="panelTitle">
            <div><p className="eyebrow">NETWORK</p><h2>Live metrics</h2></div>
          </div>

          <div className="metricGrid">
            <div><span>Vehicles</span><strong>{sim.vehicles.length}</strong></div>
            <div><span>Waiting</span><strong>{totalWaiting}</strong></div>
            <div><span>Lane changes</span><strong>{sim.laneChanges}</strong></div>
            <div><span>Priority grants</span><strong>{sim.priorityActions}</strong></div>
            <div><span>Signal stops</span><strong>{sim.stoppedAtSignals}</strong></div>
            <div><span>Boarded</span><strong>{sim.boarded}</strong></div>
          </div>

          <div className="eventHeader"><span>DECISION FEED</span><small>latest events</small></div>
          <div className="eventFeed">
            {[...sim.events].reverse().slice(0, 8).map((event, index) => (
              <div className="event" key={`${event.time}-${index}-${event.text}`}>
                <span>{clockLabel(event.time)}</span>
                <p>{event.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="explain">
        <div><p className="eyebrow">STUDENT MODEL</p><h2>Simple rules, visible consequences.</h2></div>
        <p>
          This is still an educational browser simulation rather than a microscopic traffic engine.
          Each vehicle follows lane, spacing, speed, signal, and lane-change rules so students can
          see how operations decisions affect traffic without installing specialist software.
        </p>
      </section>

      <footer>
        <span>TransitOps Web · multi-lane student simulator</span>
        <span>Next.js · TypeScript · React</span>
      </footer>
    </main>
  );
}
