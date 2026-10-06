"use client";

import { useEffect, useMemo, useState } from "react";

type Bus = {
  id: string;
  progress: number;
  direction: 1 | -1;
  occupancy: number;
};

type EventItem = {
  time: number;
  text: string;
};

type SimState = {
  time: number;
  buses: Bus[];
  queues: number[];
  boarded: number;
  priorityActions: number;
  redDelay: number;
  surgeTriggered: boolean;
  lastPriorityAt: number[];
  events: EventItem[];
};

const STOPS = [
  { name: "University of Waterloo", short: "UW", progress: 0.06 },
  { name: "Waterloo Public Square", short: "Uptown", progress: 0.34 },
  { name: "Grand River Hospital", short: "Hospital", progress: 0.65 },
  { name: "Central Station", short: "Central", progress: 0.94 },
];

const SIGNALS = [0.2, 0.5, 0.8];

function initialState(): SimState {
  return {
    time: 0,
    buses: [
      { id: "B101", progress: 0.06, direction: 1, occupancy: 18 },
      { id: "B102", progress: 0.94, direction: -1, occupancy: 27 },
      { id: "B103", progress: 0.34, direction: 1, occupancy: 8 },
    ],
    queues: [14, 11, 8, 19],
    boarded: 0,
    priorityActions: 0,
    redDelay: 0,
    surgeTriggered: false,
    lastPriorityAt: [-99, -99, -99],
    events: [{ time: 0, text: "Waterloo Corridor Test Scenario ready" }],
  };
}

function baselineSignalGreen(signalIndex: number, time: number) {
  return (time + signalIndex * 3) % 10 < 5;
}

function approachingSignal(bus: Bus, signalProgress: number) {
  const distance = signalProgress - bus.progress;
  if (bus.direction === 1) return distance >= 0 && distance < 0.055;
  return distance <= 0 && distance > -0.055;
}

function crossesStop(from: number, to: number, stop: number, direction: 1 | -1) {
  if (direction === 1) return from < stop && to >= stop;
  return from > stop && to <= stop;
}

function clockLabel(time: number) {
  const hours = Math.floor(time / 60);
  const minutes = time % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
        if (!surgeTriggered && nextTime >= 12) {
          queues[3] += 34;
          surgeTriggered = true;
          events.push({
            time: nextTime,
            text: "Regional train arrival: +34 transfer passengers at Central",
          });
        }

        let boarded = current.boarded;
        let priorityActions = current.priorityActions;
        let redDelay = current.redDelay;

        const buses = current.buses.map((bus) => {
          const baseStep = 0.024 / Math.max(0.65, traffic);
          let step = baseStep * bus.direction;
          let blocked = false;

          for (let index = 0; index < SIGNALS.length; index += 1) {
            const signal = SIGNALS[index];
            if (!approachingSignal(bus, signal)) continue;

            const baselineGreen = baselineSignalGreen(index, nextTime);
            const priorityGreen = transitOps && !baselineGreen;

            if (priorityGreen && nextTime - lastPriorityAt[index] >= 4) {
              priorityActions += 1;
              lastPriorityAt[index] = nextTime;
              events.push({
                time: nextTime,
                text: `${bus.id} granted signal priority at Signal ${index + 1}`,
              });
            }

            if (!baselineGreen && !transitOps) {
              step = 0;
              blocked = true;
              redDelay += 1;
            }
          }

          let nextProgress = bus.progress + step;
          let direction = bus.direction;

          if (nextProgress >= 0.96) {
            nextProgress = 0.94;
            direction = -1;
          } else if (nextProgress <= 0.04) {
            nextProgress = 0.06;
            direction = 1;
          }

          let occupancy = bus.occupancy;

          for (let index = 0; index < STOPS.length; index += 1) {
            const stop = STOPS[index];
            if (!crossesStop(bus.progress, nextProgress, stop.progress, bus.direction)) {
              continue;
            }

            const exiting = Math.min(occupancy, 3 + ((nextTime + index) % 5));
            occupancy -= exiting;

            const capacity = 48 - occupancy;
            const boarding = Math.min(queues[index], Math.min(capacity, 12));
            queues[index] -= boarding;
            occupancy += boarding;
            boarded += boarding;

            if (boarding > 0) {
              events.push({
                time: nextTime,
                text: `${bus.id} boarded ${boarding} at ${stop.short}`,
              });
            }
          }

          return {
            ...bus,
            progress: blocked ? bus.progress : nextProgress,
            direction,
            occupancy,
          };
        });

        return {
          time: nextTime,
          buses,
          queues,
          boarded,
          priorityActions,
          redDelay,
          surgeTriggered,
          lastPriorityAt,
          events: events.slice(-12),
        };
      });
    }, Math.max(90, 700 / speed));

    return () => window.clearInterval(timer);
  }, [running, speed, traffic, transitOps]);

  useEffect(() => {
    if (sim.time >= 60) setRunning(false);
  }, [sim.time]);

  const totalWaiting = sim.queues.reduce((sum, value) => sum + value, 0);

  const signalStates = useMemo(
    () =>
      SIGNALS.map((signal, index) => {
        const baselineGreen = baselineSignalGreen(index, sim.time);
        const priority =
          transitOps &&
          !baselineGreen &&
          sim.buses.some((bus) => approachingSignal(bus, signal));

        return {
          green: baselineGreen || priority,
          priority,
        };
      }),
    [sim.time, sim.buses, transitOps]
  );

  function reset() {
    setRunning(false);
    setSim(initialState());
  }

  function injectSurge() {
    setSim((current) => {
      const queues = [...current.queues];
      queues[3] += 30;
      return {
        ...current,
        queues,
        events: [
          ...current.events,
          { time: current.time, text: "Manual surge: +30 passengers at Central" },
        ].slice(-12),
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
          <p>Lightweight browser transit-control simulator</p>
        </div>
        <div className="runState">
          <span className={running ? "liveDot live" : "liveDot"} />
          {running ? "SIMULATION RUNNING" : "SIMULATION READY"}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">WATERLOO CORRIDOR TEST SCENARIO</p>
          <h1>See the control decisions, not the graphics engine.</h1>
          <p className="heroCopy">
            Three buses, four stations, three traffic signals, background demand,
            and a transfer surge. TransitOps can grant signal priority when buses
            approach a red light.
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
            <div>
              <p className="eyebrow">CONTROL</p>
              <h2>Scenario</h2>
            </div>
            <span>{transitOps ? "SMART" : "BASELINE"}</span>
          </div>

          <label className="switchRow">
            <span>
              <strong>TransitOps control</strong>
              <small>Bus signal priority</small>
            </span>
            <button
              type="button"
              className={transitOps ? "toggle on" : "toggle"}
              onClick={() => setTransitOps((value) => !value)}
              aria-pressed={transitOps}
            >
              <i />
            </button>
          </label>

          <label>
            <div className="labelRow">
              <span>Road traffic</span>
              <strong>{traffic.toFixed(1)}×</strong>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.8"
              step="0.1"
              value={traffic}
              onChange={(event) => setTraffic(Number(event.target.value))}
            />
          </label>

          <label>
            <div className="labelRow">
              <span>Playback</span>
              <strong>{speed}×</strong>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </label>

          <div className="buttonGrid">
            <button
              type="button"
              className="primaryButton"
              onClick={() => setRunning((value) => !value)}
            >
              {running ? "Pause" : sim.time >= 60 ? "Finished" : "Run"}
            </button>
            <button type="button" onClick={reset}>Reset</button>
          </div>

          <button type="button" className="surgeButton" onClick={injectSurge}>
            Inject Central surge
          </button>
        </aside>

        <section className="simulationCard">
          <div className="streetLabels">
            <span>WEST</span>
            <span>TRANSIT CORRIDOR</span>
            <span>EAST</span>
          </div>

          <div className="corridor">
            <div className="roadLine" />

            {STOPS.map((stop, index) => (
              <div
                className="station"
                key={stop.name}
                style={{ top: `${8 + stop.progress * 84}%` }}
              >
                <div className="stationNode" />
                <div className="stationLabel">
                  <strong>{stop.short}</strong>
                  <span>{sim.queues[index]} waiting</span>
                </div>
              </div>
            ))}

            {SIGNALS.map((signal, index) => (
              <div
                className="intersection"
                key={signal}
                style={{ top: `${8 + signal * 84}%` }}
              >
                <div className="crossRoad" />
                <div className={signalStates[index].green ? "signal green" : "signal red"}>
                  <i />
                </div>
                {signalStates[index].priority && (
                  <span className="priorityTag">PRIORITY</span>
                )}
              </div>
            ))}

            {sim.buses.map((bus) => (
              <div
                className="bus"
                key={bus.id}
                style={{ top: `${8 + bus.progress * 84}%` }}
              >
                <strong>{bus.id}</strong>
                <span>{bus.occupancy}/48</span>
              </div>
            ))}

            {SIGNALS.map((signal, index) => (
              <div
                className="car westCar"
                key={`w-${index}`}
                style={{
                  top: `calc(${8 + signal * 84}% - 4px)`,
                  animationDelay: `${-index * 1.4}s`,
                  animationDuration: `${5.5 + traffic * 1.5}s`,
                }}
              />
            ))}

            {SIGNALS.map((signal, index) => (
              <div
                className="car eastCar"
                key={`e-${index}`}
                style={{
                  top: `calc(${8 + signal * 84}% + 8px)`,
                  animationDelay: `${-index * 1.8}s`,
                  animationDuration: `${6 + traffic * 1.2}s`,
                }}
              />
            ))}
          </div>
        </section>

        <aside className="panel metrics">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">NETWORK</p>
              <h2>Live metrics</h2>
            </div>
          </div>

          <div className="metricGrid">
            <div><span>Waiting</span><strong>{totalWaiting}</strong></div>
            <div><span>Boarded</span><strong>{sim.boarded}</strong></div>
            <div><span>Priority grants</span><strong>{sim.priorityActions}</strong></div>
            <div><span>Red-light delay</span><strong>{sim.redDelay}</strong></div>
          </div>

          <div className="eventHeader">
            <span>DECISION FEED</span>
            <small>latest events</small>
          </div>
          <div className="eventFeed">
            {[...sim.events].reverse().slice(0, 7).map((event, index) => (
              <div className="event" key={`${event.time}-${index}-${event.text}`}>
                <span>{clockLabel(event.time)}</span>
                <p>{event.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="explain">
        <div>
          <p className="eyebrow">THE IDEA</p>
          <h2>TransitOps sits above the vehicles.</h2>
        </div>
        <p>
          This web version intentionally uses basic graphics. The useful part is
          the network logic: observe demand and vehicle state, make an operational
          decision, then measure whether service improves.
        </p>
      </section>

      <footer>
        <span>TransitOps Web · browser-only MVP</span>
        <span>Next.js · TypeScript · React</span>
      </footer>
    </main>
  );
}
