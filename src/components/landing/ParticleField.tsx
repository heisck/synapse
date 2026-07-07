'use client';

import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleData {
  positions: Float32Array;
  velocities: Float32Array;
}

function useParticles(count: number): ParticleData {
  return useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Arrange in a neural network-like pattern with some clusters
      const cluster = Math.floor(Math.random() * 5);
      const cx = (cluster % 3 - 1) * 4;
      const cy = (Math.floor(cluster / 3) - 0.5) * 3;

      positions[i * 3] = cx + (Math.random() - 0.5) * 3;
      positions[i * 3 + 1] = cy + (Math.random() - 0.5) * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;

      velocities[i * 3] = (Math.random() - 0.5) * 0.005;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }

    return { positions, velocities };
  }, [count]);
}

function Particles() {
  const PARTICLE_COUNT = 220;
  const CONNECTION_DISTANCE = 2.2;
  const { positions, velocities } = useParticles(PARTICLE_COUNT);
  const velocitiesRef = useRef(velocities);
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const { viewport } = useThree();

  const handlePointerMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    },
    []
  );

  useFrame(() => {
    if (!pointsRef.current) return;

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    // Update particle positions with mouse interaction
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      // Base velocity movement
      const vel = velocitiesRef.current;
      posArray[ix] += vel[ix];
      posArray[iy] += vel[iy];
      posArray[iz] += vel[iz];

      // Mouse interaction - repel nearby particles
      const mx = mouseRef.current.x * viewport.width * 0.4;
      const my = mouseRef.current.y * viewport.height * 0.4;
      const dx = posArray[ix] - mx;
      const dy = posArray[iy] - my;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2.5 && dist > 0.01) {
        const force = (2.5 - dist) * 0.002;
        posArray[ix] += (dx / dist) * force;
        posArray[iy] += (dy / dist) * force;
      }

      // Boundary bounce
      if (Math.abs(posArray[ix]) > 8) vel[ix] *= -1;
      if (Math.abs(posArray[iy]) > 5) vel[iy] *= -1;
      if (Math.abs(posArray[iz]) > 2) vel[iz] *= -1;
    }

    posAttr.needsUpdate = true;

    // Update connections
    if (linesRef.current) {
      const linePositions: number[] = [];
      const lineColors: number[] = [];

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const dx = posArray[i * 3] - posArray[j * 3];
          const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1];
          const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < CONNECTION_DISTANCE) {
            linePositions.push(
              posArray[i * 3], posArray[i * 3 + 1], posArray[i * 3 + 2],
              posArray[j * 3], posArray[j * 3 + 1], posArray[j * 3 + 2]
            );

            const alpha = 1 - dist / CONNECTION_DISTANCE;
            // Emerald to teal colors
            lineColors.push(0.063 * alpha, 0.725 * alpha, 0.506 * alpha);
            lineColors.push(0.078 * alpha, 0.722 * alpha, 0.651 * alpha);
          }
        }
      }

      const lineGeo = linesRef.current.geometry;
      lineGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(linePositions, 3)
      );
      lineGeo.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(lineColors, 3)
      );
      (lineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (lineGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <group onPointerMove={handlePointerMove as never}>
      {/* Particle points */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          color="#10b981"
          transparent
          opacity={0.8}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Connection lines */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(0), 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[new Float32Array(0), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

export default function ParticleField() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ background: 'transparent' }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.5} />
        <Particles />
      </Canvas>
    </div>
  );
}