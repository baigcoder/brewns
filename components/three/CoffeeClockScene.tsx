'use client';

import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
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
    // Slight tactile tilt as it turns
    groupRef.current.rotation.z = Math.sin(smoothedAngle.current) * 0.08;
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Clear Glass Cup Body */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 0.72, 2.3, 32]} />
        <meshPhysicalMaterial
          color="#FAF7F2"
          transmission={0.88}
          opacity={1}
          transparent
          roughness={0.08}
          ior={1.48}
          thickness={0.4}
        />
      </mesh>

      {/* Layered Iced Coffee Liquid */}
      {/* Bottom dense espresso layer */}
      <mesh position={[0, -0.65, 0]}>
        <cylinderGeometry args={[0.76, 0.7, 0.8, 32]} />
        <meshStandardMaterial color="#22130B" roughness={0.3} />
      </mesh>

      {/* Middle swirling milk + coffee marbling */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.85, 0.76, 0.65, 32]} />
        <meshStandardMaterial color="#A96B3F" roughness={0.4} />
      </mesh>

      {/* Top cold oat milk cream layer */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.91, 0.85, 0.6, 32]} />
        <meshStandardMaterial color="#EAE2D7" roughness={0.35} />
      </mesh>

      {/* Realistic Ice Cubes Inside */}
      <mesh position={[0.2, 0.45, 0.15]} rotation={[0.4, 0.2, 0.5]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.92}
          roughness={0.1}
          ior={1.31}
          thickness={0.5}
        />
      </mesh>
      <mesh position={[-0.22, 0.52, -0.1]} rotation={[-0.3, 0.6, 0.2]}>
        <boxGeometry args={[0.38, 0.38, 0.38]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.92}
          roughness={0.1}
          ior={1.31}
          thickness={0.5}
        />
      </mesh>
      <mesh position={[0.05, 0.75, 0.05]} rotation={[0.1, 0.8, -0.4]}>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.92}
          roughness={0.1}
          ior={1.31}
          thickness={0.5}
        />
      </mesh>

      {/* Glass Cup Base Foot */}
      <mesh position={[0, -1.18, 0]}>
        <cylinderGeometry args={[0.73, 0.73, 0.1, 32]} />
        <meshPhysicalMaterial
          color="#FFFFFF"
          transmission={0.8}
          roughness={0.1}
          ior={1.5}
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
        camera={{ position: [0, 0.4, 4.6], fov: 38 }}
        dpr={dpr}
        frameloop={isVisible ? 'always' : 'never'}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[-3, 4, 3]} intensity={2.2} color="#FFF8F0" />
        <directionalLight position={[3, -1, 2]} intensity={0.8} color="#C4DCF2" />
        <directionalLight position={[0, 2, -3]} intensity={1.5} color="#FFD5A5" />

        <IcedLatteModel scrollProgress={scrollProgress} />
      </Canvas>
    </div>
  );
}
