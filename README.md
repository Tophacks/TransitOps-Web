# TransitOps Web

A lightweight browser-only transit operations simulator.

This repository is the simplified web prototype for TransitOps. It intentionally avoids SUMO, Docker, MapLibre, and external services so the operations concept can be demonstrated with basic graphics and zero backend setup.

## Current demo

The simulation models a Waterloo-inspired corridor:

```text
University of Waterloo
        │
     Signal 1
        │
Waterloo Public Square
        │
     Signal 2
        │
Grand River Hospital
        │
     Signal 3
        │
   Central Station
```

The browser simulates:

- a four-lane bidirectional corridor
- three buses and multiple cars
- lane-aware vehicle movement
- car-following / minimum spacing
- lane changes around slower traffic
- queues at red traffic signals
- four passenger stops
- a regional-rail transfer surge at Central
- fixed-signal baseline mode
- TransitOps bus signal priority
- boarding counts, lane changes, signal stops, and controller events

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

No backend, Docker container, API key, or environment variable is required.

## Build

```bash
npm run build
npm start
```

## Purpose

The visual design is intentionally lightweight, but the road behaviour is more detailed. Vehicles follow lane, spacing, speed, signal, and lane-change rules so students can see how network behaviour emerges:

```text
observe network state
        ↓
detect delay / demand
        ↓
make control decision
        ↓
change signal / service response
        ↓
measure the result
```

Once the interaction and control concepts are stable, this UI can be connected to the larger SUMO/TraCI TransitOps project.

## Stack

- Next.js
- React
- TypeScript
- CSS

## Deployment

The project is Vercel-ready. Import `Tophacks/TransitOps-Web` and use the repository root as the project root.
