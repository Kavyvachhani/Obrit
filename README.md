# Orbit — Live 3D AWS Infrastructure Explorer & Simulator

[![Orbit CI](https://github.com/Kavyvachhani/Obrit/actions/workflows/ci.yml/badge.svg)](https://github.com/Kavyvachhani/Obrit/actions/workflows/ci.yml)
[![Build Windows Executable](https://github.com/Kavyvachhani/Obrit/actions/workflows/build-exe.yml/badge.svg)](https://github.com/Kavyvachhani/Obrit/actions/workflows/build-exe.yml)

**Orbit** is a high-performance, interactive 3D and 2D topology visualizer for AWS infrastructure. It connects to AWS via strictly read-only APIs and renders living cloud topologies with rich procedural models, real-time spatial clustering, and deep configuration inspection.

---

## 🌟 Key Features

- **Puffy 3D Cloud VPCs**: VPCs appear as ethereal glowing translucent cloud clusters enclosing their subnets and network boundaries.
- **Enterprise Compute Racks**: EC2 instances render as metallic server chassis with active blinking green/blue LED status lights.
- **Serverless Microchips**: Lambda functions render as sleek compute microchips with glowing orbital energy rings.
- **Cylindrical Storage & Database Towers**: RDS clusters render as multi-tiered database cylinders with illuminated data rings, and S3 buckets as armored storage canisters.
- **Animated Energy Flows**: Directional particle streams flow continuously along active relationship edges (routing, targeting, attachments).
- **Interactive Inspector Panel**: Click any node to fly the camera toward it and inspect full AWS configurations, tags, ARN, and direct AWS Console links.
- **2D CPU-Only Fallback**: Full Canvas2D fallback mode that operates seamlessly on any device without WebGL requirements.
- **Zero-Config Standalone Mode (No Docker Required)**: Runs out of the box with an embedded resilient in-memory database store when PostgreSQL is not present.
- **Strict Read-Only & Local Encryption**: AWS credentials never leave your machine; they are encrypted at rest with **AES-256-GCM** using keys held strictly in memory. All AWS SDK calls pass through a strict allow-list gateway that blocks any mutating operations.

---

## 🚀 Quickstart (No Docker Required)

### 1. Clone & Install
```bash
git clone https://github.com/Kavyvachhani/Obrit.git
cd Obrit
npm install
npm run build
```

### 2. Start Orbit
```bash
npm run dev
```
Open **http://localhost:3000** (or **http://localhost:4000** for standalone backend + SPA).

### 3. Immediate 3D Demo Experience
Click **"Demo Cloud"** in the top navigation bar to instantly populate a multi-tier AWS production architecture (VPC, Public/Private Subnets, Internet Gateway, NAT Gateway, ALB, EC2 Workers, Lambdas, Aurora RDS, S3, Security Groups, IAM Roles) in live 3D!

---

## 📦 Standalone Executable (.exe) for Windows

Orbit includes automated GitHub Actions that build and package the standalone Windows `.exe` on every push to `main`:

1. Go to the **Actions** tab in this GitHub repository: [Build Windows Executable (.exe)](https://github.com/Kavyvachhani/Obrit/actions/workflows/build-exe.yml).
2. Click on the latest workflow run.
3. Download the **`Orbit-Windows-x64`** artifact.
4. Extract the folder and double-click **`Start-Orbit.bat`** (or run `Orbit-Server.exe`).
5. Your browser will automatically open Orbit at `http://localhost:4000` — zero dependencies, zero Docker needed!

To build the executable locally:
```bash
npm run build:exe
```

---

## 🔒 Security Architecture

- **Allow-List Only**: Orbit only calls AWS `Describe*`, `List*`, and `Get*` APIs. Commands like `Create*`, `Delete*`, `Modify*`, and `Terminate*` are rejected at the code level.
- **AES-256-GCM**: Credentials entered in the UI are encrypted before reaching the database layer.
- **Audit Logging**: Every single AWS API invocation is recorded in an audit trail with timestamps, latency, service, and action name.

---

## 🛠️ Repository Structure

```
Obrit/
├── packages/
│   ├── core/          # Pure TypeScript shared domain models, constants, and utilities
│   ├── backend/       # Fastify API server, AWS discovery engine & resilient store
│   ├── web/           # React 19 + Three.js 3D Force Graph + Tailwind CSS
│   └── desktop/       # Desktop shell placeholder
├── .github/
│   └── workflows/
│       ├── ci.yml             # Build & typecheck validation
│       └── build-exe.yml      # Automated Windows .exe compilation & artifact upload
├── docs/              # IAM least-privilege policy & onboarding documentation
└── package.json       # Monorepo workspaces
```
