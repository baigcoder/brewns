'use client';

import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { getOptimalDPR } from '@/lib/three-utils';

interface CoffeeClockSceneProps {
  scrollProgress: number; // 0 to 1
}

// ── 3D Iced Latte Model with Floating Ice & Cream Swirl ──
function IcedLatteModel({ scrollProgress }: { scrollProgress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const smoothedAngle = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Check reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      groupRef.current.rotation.y = 0;
      groupRef.current.rotation.z = 0;
      return;
    }

    // Target rotation based on scroll: full 360 degrees (2 * PI)
    const targetAngle = scrollProgress * Math.PI * 2;
    smoothedAngle.current = THREE.MathUtils.lerp(smoothedAngle.current, targetAngle, delta * 5);

    groupRef.current.rotation.y = smoothedAngle.current;
    // Tactile slight precession tilt as it turns
    groupRef.current.rotation.z = Math.sin(smoothedAngle.current) * 0.06;
  });

  return (
    <group ref={groupRef} position={[0, 0.08, 0]} scale={[1.08, 1.08, 1.08]}>
      {/* 1. Clear Fluted Glass Body (Open Ended Cylinder) */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.92, 0.72, 2.2, 32, 1, true]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.92}
          opacity={1}
          transparent
          roughness={0.04}
          metalness={0.05}
          ior={1.52}
          thickness={0.5}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
        />
      </mesh>

      {/* 2. Polished Glass Rim Lip */}
      <mesh position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.915, 0.025, 16, 32]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.92}
          transparent
          roughness={0.04}
          ior={1.52}
          clearcoat={1.0}
        />
      </mesh>

      {/* 3. Solid Glass Sham Base Foot */}
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[0.73, 0.73, 0.2, 32]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.88}
          transparent
          roughness={0.06}
          ior={1.52}
          clearcoat={1.0}
        />
      </mesh>

      {/* 4. Layered Liquid: Bottom Dense Espresso */}
      <mesh position={[0, -0.66, 0]}>
        <cylinderGeometry args={[0.71, 0.7, 0.68, 32]} />
        <meshStandardMaterial
          color="#1E1008"
          roughness={0.25}
          metalness={0.08}
        />
      </mesh>

      {/* 5. Layered Liquid: Middle Swirled Macchiato / Caramel Transition */}
      <mesh position={[0, 0.0, 0]}>
        <cylinderGeometry args={[0.79, 0.71, 0.64, 32]} />
        <meshStandardMaterial
          color="#8C5329"
          roughness={0.32}
          metalness={0.05}
        />
      </mesh>

      {/* 6. Layered Liquid: Top Cold Foam / Steamed Oat Milk */}
      <mesh position={[0, 0.64, 0]}>
        <cylinderGeometry args={[0.88, 0.79, 0.64, 32]} />
        <meshStandardMaterial
          color="#F5EFEB"
          roughness={0.38}
          metalness={0.02}
        />
      </mesh>

      {/* 7. Liquid Surface Meniscus */}
      <mesh position={[0, 0.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.87, 32]} />
        <meshStandardMaterial
          color="#EFE7DD"
          roughness={0.3}
        />
      </mesh>

      {/* 8. Translucent Floating Ice Cubes */}
      <mesh position={[0.2, 0.75, 0.12]} rotation={[0.4, 0.3, 0.5]}>
        <boxGeometry args={[0.36, 0.36, 0.36]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.96}
          roughness={0.08}
          ior={1.31}
          thickness={0.5}
        />
      </mesh>
      <mesh position={[-0.22, 0.8, -0.1]} rotation={[-0.3, 0.6, 0.2]}>
        <boxGeometry args={[0.34, 0.34, 0.34]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.96}
          roughness={0.08}
          ior={1.31}
          thickness={0.5}
        />
      </mesh>
      <mesh position={[0.04, 0.86, 0.05]} rotation={[0.15, 0.75, -0.3]}>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.96}
          roughness={0.08}
          ior={1.31}
          thickness={0.5}
        />
      </mesh>
    </group>
  );
}

export function CoffeeClockScene({ scrollProgress }: CoffeeClockSceneProps) {
  const [dpr, setDpr] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setDpr(getOptimalDPR());

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
        camera={{ position: [0, 0.35, 4.3], fov: 36 }}
        dpr={dpr}
        frameloop={isVisible ? 'always' : 'never'}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
      >
        <ambientLight intensity={0.65} />
        {/* Warm Key Light */}
        <directionalLight position={[-3, 4.5, 3.5]} intensity={2.8} color="#FFF8F0" />
        {/* Golden Back Rim Light */}
        <directionalLight position={[0, 2.5, -3.5]} intensity={2.2} color="#D58C3D" />
        {/* Soft Cool Fill */}
        <directionalLight position={[3.5, 0.5, 2.0]} intensity={1.0} color="#D8ECF8" />

        {/* Soft Ground Shadow on Clock Dial */}
        <ContactShadows
          position={[0, -1.25, 0]}
          opacity={0.5}
          scale={3.8}
          blur={1.8}
          far={2.5}
          color="#1A0F08"
        />

        <IcedLatteModel scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}
