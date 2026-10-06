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

- three buses
- four stations
- passenger queues
- background cross traffic
- three traffic signals
- a regional-rail transfer surge at Central
- fixed-signal baseline mode
- TransitOps bus signal priority
- boarding counts
- red-light delay
- controller event feed

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

The visual design is intentionally basic. The goal is to make TransitOps control behavior easy to understand:

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
