import * as THREE from "three";
import type { GraphNode } from "@orbit/core";

// Cache geometries & materials for peak GPU performance
const materialsCache = new Map<string, THREE.Material>();

function getMaterial(color: number, opacity = 1.0, wireframe = false, emissiveIntensity = 0.4): THREE.MeshStandardMaterial {
  const key = `${color}_${opacity}_${wireframe}_${emissiveIntensity}`;
  if (!materialsCache.has(key)) {
    materialsCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity,
        roughness: 0.25,
        metalness: 0.65,
        transparent: opacity < 1.0,
        opacity,
        wireframe,
      })
    );
  }
  return materialsCache.get(key) as THREE.MeshStandardMaterial;
}

/**
 * Creates custom 3D models for each AWS resource type:
 * - VPC: Ethereal glowing cloud cluster
 * - EC2: Enterprise server rack tower with blinking LED lights
 * - Lambda: Sleek serverless microchip with orbital ring
 * - RDS: Cylindrical database tier tower
 * - S3: Storage canister with tiered disks
 * - ALB: Load balancer routing hub
 * - Internet Gateway: Luminous portal arch
 * - Subnet: Glowing architectural zone pad
 */
export function create3DNodeObject(node: GraphNode, isSelected = false, isHovered = false): THREE.Object3D {
  const group = new THREE.Group();
  group.name = node.id;

  const baseHue = isSelected ? 0x38bdf8 : isHovered ? 0xa855f7 : 0xffffff;

  switch (node.type) {
    case "vpc:vpc": {
      // ─── VPC: TRANSLUCENT ETHEREAL CLOUD CLUSTER ─────────────────────────
      const cloudGroup = new THREE.Group();
      const cloudColor = isSelected ? 0x38bdf8 : 0x0284c7;

      // Puffy cloud puffs
      const cloudPuffs = [
        { x: 0, y: 0, z: 0, r: 16 },
        { x: -11, y: -2, z: 2, r: 12 },
        { x: 12, y: -1, z: -1, r: 13 },
        { x: 5, y: 7, z: 2, r: 11 },
        { x: -6, y: 6, z: -2, r: 10 },
        { x: 0, y: -4, z: 6, r: 11 },
      ];

      const cloudMat = new THREE.MeshStandardMaterial({
        color: cloudColor,
        emissive: cloudColor,
        emissiveIntensity: isSelected ? 0.8 : 0.45,
        transparent: true,
        opacity: isSelected ? 0.75 : 0.55,
        roughness: 0.1,
        metalness: 0.2,
      });

      cloudPuffs.forEach((p) => {
        const puffGeo = new THREE.SphereGeometry(p.r, 16, 16);
        const puffMesh = new THREE.Mesh(puffGeo, cloudMat);
        puffMesh.position.set(p.x, p.y, p.z);
        cloudGroup.add(puffMesh);
      });

      // Orbiting cloud shield ring
      const ringGeo = new THREE.TorusGeometry(26, 0.8, 12, 48);
      const ringMat = getMaterial(0x38bdf8, 0.8, false, 0.8);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.3;
      cloudGroup.add(ring);

      group.add(cloudGroup);
      break;
    }

    case "ec2:instance": {
      // ─── EC2: SERVER RACK / BLADE TOWER WITH LED LIGHTS ───────────────────
      const serverGroup = new THREE.Group();
      const bodyGeo = new THREE.BoxGeometry(9, 16, 9);
      const bodyMat = getMaterial(0x1e293b, 1.0, false, 0.15);
      const serverBody = new THREE.Mesh(bodyGeo, bodyMat);
      serverGroup.add(serverBody);

      // Server rack front face with horizontal bay slats
      for (let y = -6; y <= 6; y += 3) {
        const bayGeo = new THREE.BoxGeometry(8.2, 2.2, 0.4);
        const bayMat = getMaterial(0x0f172a, 1.0, false, 0.1);
        const bay = new THREE.Mesh(bayGeo, bayMat);
        bay.position.set(0, y, 4.6);
        serverGroup.add(bay);

        // Green / Blue Activity LED dot
        const ledGeo = new THREE.SphereGeometry(0.45, 8, 8);
        const ledColor = y % 2 === 0 ? 0x10b981 : 0x38bdf8;
        const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(3, y, 4.9);
        serverGroup.add(led);
      }

      // Edge accent borders
      const edges = new THREE.EdgesGeometry(bodyGeo);
      const lineMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0x38bdf8 : 0x0ea5e9,
        linewidth: 2,
      });
      const wireframe = new THREE.LineSegments(edges, lineMat);
      serverGroup.add(wireframe);

      group.add(serverGroup);
      break;
    }

    case "lambda:function": {
      // ─── LAMBDA: SERVERLESS MICROCHIP WITH PULSING ENERGY RING ───────────
      const lambdaGroup = new THREE.Group();

      // Main processor substrate
      const chipGeo = new THREE.BoxGeometry(11, 2.5, 11);
      const chipMat = getMaterial(0xf59e0b, 1.0, false, 0.4);
      const chip = new THREE.Mesh(chipGeo, chipMat);
      lambdaGroup.add(chip);

      // Inner glowing core
      const coreGeo = new THREE.BoxGeometry(6, 3.2, 6);
      const coreMat = getMaterial(0xfef08a, 1.0, false, 0.9);
      const core = new THREE.Mesh(coreGeo, coreMat);
      lambdaGroup.add(core);

      // Floating orbital energy ring
      const ringGeo = new THREE.TorusGeometry(9, 0.5, 12, 36);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 4;
      ring.rotation.y = Math.PI / 6;
      lambdaGroup.add(ring);

      group.add(lambdaGroup);
      break;
    }

    case "rds:db-instance":
    case "rds:db-cluster": {
      // ─── RDS: CYLINDRICAL DATABASE STORAGE TOWER ──────────────────────────
      const dbGroup = new THREE.Group();
      const dbColor = 0x8b5cf6; // Purple

      // Multi-tier storage cylinder
      const cylGeo = new THREE.CylinderGeometry(7, 7, 14, 24);
      const cylMat = getMaterial(dbColor, 0.9, false, 0.4);
      const cylinder = new THREE.Mesh(cylGeo, cylMat);
      dbGroup.add(cylinder);

      // Data rings around cylinder
      for (let y = -4; y <= 4; y += 4) {
        const diskGeo = new THREE.TorusGeometry(7.4, 0.5, 8, 32);
        const diskMat = new THREE.MeshBasicMaterial({ color: 0xc4b5fd });
        const disk = new THREE.Mesh(diskGeo, diskMat);
        disk.rotation.x = Math.PI / 2;
        disk.position.y = y;
        dbGroup.add(disk);
      }

      group.add(dbGroup);
      break;
    }

    case "s3:bucket": {
      // ─── S3: STORAGE CANISTER WITH DUAL DISKS ─────────────────────────────
      const s3Group = new THREE.Group();
      const s3Color = 0x10b981; // Emerald

      const canGeo = new THREE.CylinderGeometry(7.5, 7.5, 10, 20);
      const canMat = getMaterial(s3Color, 0.9, false, 0.5);
      const can = new THREE.Mesh(canGeo, canMat);
      s3Group.add(can);

      // Bucket rim
      const rimGeo = new THREE.TorusGeometry(8, 0.6, 8, 28);
      const rimMat = new THREE.MeshBasicMaterial({ color: 0x6ee7b7 });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 5.2;
      s3Group.add(rim);

      group.add(s3Group);
      break;
    }

    case "elb:load-balancer": {
      // ─── ALB: OCTAGONAL ROUTING HUB ───────────────────────────────────────
      const albGroup = new THREE.Group();
      const albColor = 0xec4899; // Pink / Magenta

      const hubGeo = new THREE.OctahedronGeometry(8.5, 1);
      const hubMat = getMaterial(albColor, 0.95, false, 0.6);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      albGroup.add(hub);

      // Outer distribution ring
      const ringGeo = new THREE.TorusGeometry(12, 0.6, 12, 36);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      albGroup.add(ring);

      group.add(albGroup);
      break;
    }

    case "vpc:subnet": {
      // ─── SUBNET: ZONE PAD ─────────────────────────────────────────────────
      const isPublic = node.tags?.Tier?.toLowerCase().includes("public") || node.name.toLowerCase().includes("public");
      const padColor = isPublic ? 0x059669 : 0x2563eb;

      const padGeo = new THREE.CylinderGeometry(12, 12, 1.8, 6);
      const padMat = getMaterial(padColor, 0.7, false, 0.4);
      const pad = new THREE.Mesh(padGeo, padMat);
      group.add(pad);

      // Perimeter wire
      const wireGeo = new THREE.EdgesGeometry(padGeo);
      const wire = new THREE.LineSegments(
        wireGeo,
        new THREE.LineBasicMaterial({ color: isPublic ? 0x34d399 : 0x60a5fa, linewidth: 2 })
      );
      group.add(wire);
      break;
    }

    case "vpc:internet-gateway": {
      // ─── INTERNET GATEWAY: PORTAL ARCH ────────────────────────────────────
      const igwGroup = new THREE.Group();
      const archGeo = new THREE.TorusGeometry(9, 1.2, 12, 32, Math.PI);
      const archMat = getMaterial(0x06b6d4, 1.0, false, 0.8);
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.rotation.z = Math.PI;
      arch.position.y = 4.5;
      igwGroup.add(arch);

      // Portal energy disc
      const discGeo = new THREE.CircleGeometry(7.5, 24);
      const discMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.y = 4.5;
      igwGroup.add(disc);

      group.add(igwGroup);
      break;
    }

    default: {
      // ─── DEFAULT RESOURCE: GLOWING CYBER SPHERE ───────────────────────────
      const sphereGeo = new THREE.SphereGeometry(6, 16, 16);
      const sphereMat = getMaterial(baseHue, 0.9, false, 0.4);
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      group.add(sphere);
      break;
    }
  }

  // Selection halo
  if (isSelected) {
    const haloGeo = new THREE.RingGeometry(16, 18, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    group.add(halo);
  }

  // Floating HTML-style Sprite Label
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(7, 11, 20, 0.85)";
    ctx.roundRect ? ctx.roundRect(8, 8, 368, 64, 12) : ctx.rect(8, 8, 368, 64);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isSelected ? "#38bdf8" : "rgba(56, 189, 248, 0.35)";
    ctx.stroke();

    ctx.font = "bold 22px 'Inter', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const shortName = node.name.length > 24 ? node.name.slice(0, 22) + "…" : node.name;
    ctx.fillText(shortName, 192, 40);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(24, 5, 1);
  sprite.position.y = 15;
  group.add(sprite);

  return group;
}
