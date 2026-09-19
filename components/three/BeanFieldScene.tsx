'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { getOptimalDPR } from '@/lib/three-utils';

interface BeanData {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  rotationSpeed: THREE.Vector3;
  driftSpeed: THREE.Vector3;
  driftPhase: THREE.Vector3;
  scale: number;
}

// ── Instanced Bean Field with Organic Physics ──
function InstancedBeans({ count = 36 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Seeded deterministic generation for beans
  const beans = useMemo<BeanData[]>(() => {
    let seed = 42;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const items: BeanData[] = [];
    for (let i = 0; i < count; i++) {
      const scale = 0.6 + random() * 0.9;
      items.push({
        position: new THREE.Vector3(
          (random() * 2 - 1) * 7.5,
          (random() * 2 - 1) * 4.5,
          -2.0 - random() * 6.0
        ),
        rotation: new THREE.Euler(
          random() * Math.PI * 2,
          random() * Math.PI * 2,
          random() * Math.PI * 2
        ),
        rotationSpeed: new THREE.Vector3(
          (random() * 2 - 1) * 0.35,
          (random() * 2 - 1) * 0.35,
          (random() * 2 - 1) * 0.35
        ),
        driftSpeed: new THREE.Vector3(
          0.15 + random() * 0.25,
          0.15 + random() * 0.25,
          0.1 + random() * 0.2
        ),
        driftPhase: new THREE.Vector3(
          random() * Math.PI * 2,
          random() * Math.PI * 2,
          random() * Math.PI * 2
        ),
        scale,
      });
    }
    return items;
  }, [count]);

  // Bean Geometry with Coffee Crease
  const beanGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.18, 16, 12);
    geo.scale(1.0, 1.45, 0.75); // Coffee bean oblong proportions
    return geo;
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();

    beans.forEach((bean, i) => {
      // Independent slow sinusoidal drift
      const dx = Math.sin(time * bean.driftSpeed.x + bean.driftPhase.x) * 0.45;
      const dy = Math.cos(time * bean.driftSpeed.y + bean.driftPhase.y) * 0.45;
      const dz = Math.sin(time * bean.driftSpeed.z + bean.driftPhase.z) * 0.3;

      dummy.position.set(
        bean.position.x + dx,
        bean.position.y + dy,
        bean.position.z + dz
      );

      // Slow rotation tumble
      bean.rotation.x += bean.rotationSpeed.x * delta;
      bean.rotation.y += bean.rotationSpeed.y * delta;
      bean.rotation.z += bean.rotationSpeed.z * delta;
      dummy.rotation.copy(bean.rotation);

      dummy.scale.setScalar(bean.scale);
      dummy.updateMatrix();

      meshRef.current?.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[beanGeometry, undefined, count]}
      castShadow
    >
      <meshStandardMaterial
        color="#2B180E"
        roughness={0.42}
        metalness={0.12}
      />
    </instancedMesh>
  );
}

// ── Tilted Hero Ceramic Cup ──
function TiltedHeroCup() {
  const cupRef = useRef<THREE.Group>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  useFrame((state, delta) => {
    if (!cupRef.current) return;
    const time = state.clock.getElapsedTime();

    // Subtle breathing float and mouse lean
    const targetRotZ = -0.26 + Math.sin(time * 0.8) * 0.04 + pointerRef.current.x * 0.08;
    const targetRotX = pointerRef.current.y * 0.08;
    const targetRotY = Math.PI + Math.sin(time * 0.4) * 0.2;

    cupRef.current.rotation.z = THREE.MathUtils.lerp(cupRef.current.rotation.z, targetRotZ, delta * 3);
    cupRef.current.rotation.x = THREE.MathUtils.lerp(cupRef.current.rotation.x, targetRotX, delta * 3);
    cupRef.current.rotation.y = THREE.MathUtils.lerp(cupRef.current.rotation.y, targetRotY, delta * 3);
  });

  return (
    <group ref={cupRef} position={[0, 0, 0]} scale={[1.4, 1.4, 1.4]}>
      {/* Cup Body */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.92, 0.65, 1.8, 32]} />
        <meshStandardMaterial
          color="#0E0D0C"
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* Rim Bevel */}
      <mesh position={[0, 0.9, 0]}>
        <torusGeometry args={[0.91, 0.04, 16, 32]} />
        <meshStandardMaterial color="#22201D" roughness={0.25} />
      </mesh>

      {/* Inner Coffee Surface */}
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.88, 0.88, 0.02, 32]} />
        <meshStandardMaterial color="#B07A45" roughness={0.4} />
      </mesh>

      {/* Gold Atelier Brand Foil Ring */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.81, 0.77, 0.22, 32]} />
        <meshStandardMaterial color="#D58C3D" metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  );
}

export function BeanFieldScene() {
  const [dpr, setDpr] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setDpr(getOptimalDPR());
    setIsMobile(window.innerWidth < 768);

    if (!containerRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 42 }}
        dpr={dpr}
        frameloop={isVisible ? 'always' : 'never'}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[-4, 5, 5]} intensity={2.4} color="#FFF2E2" />
        <directionalLight position={[4, 2, -4]} intensity={1.2} color="#FFD2A0" />

        <TiltedHeroCup />
        <InstancedBeans count={isMobile ? 18 : 38} />
      </Canvas>
    </div>
  );
}
