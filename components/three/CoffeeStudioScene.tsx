'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, ContactShadows } from '@react-three/drei';
import { getOptimalDPR } from '@/lib/three-utils';

interface StudioProps {
  onHoverObject?: (objectName: 'bag' | 'cup' | null) => void;
}

// ── 1. Coffee Bag 3D Mesh ──
function CoffeeBag({ onHover }: { onHover: (hovered: boolean) => void }) {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Procedural Bag Label Texture
  const labelTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark paper base
    ctx.fillStyle = '#11100E';
    ctx.fillRect(0, 0, 512, 512);

    // Border
    ctx.strokeStyle = '#D58C3D';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, 464, 464);

    // Text details
    ctx.fillStyle = '#D58C3D';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('// VELDT COFFEE ATELIER', 50, 80);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('SLOW ROAST', 50, 160);
    ctx.fillText('NO. 4', 50, 210);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '22px monospace';
    ctx.fillText('ORIGIN: HUILA & SIDAMA', 50, 290);
    ctx.fillText('PROCESS: FULLY WASHED', 50, 330);
    ctx.fillText('NET WT: 250G / 8.8 OZ', 50, 370);

    // Stamp mark
    ctx.fillStyle = '#D58C3D';
    ctx.fillRect(50, 420, 120, 28);
    ctx.fillStyle = '#070707';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('CERTIFIED 2026', 58, 440);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const targetScale = hovered ? 1.03 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 8);
    }
  });

  return (
    <group
      ref={meshRef}
      position={[-0.42, 0.95, 0]}
      rotation={[0, 0.32, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(true);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(false);
      }}
    >
      {/* Main Bag Body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.3, 1.9, 0.85]} />
        <meshStandardMaterial
          color="#161513"
          roughness={0.75}
          metalness={0.15}
        />
      </mesh>

      {/* Bag Top Fold / Seal */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[1.35, 0.18, 0.3]} />
        <meshStandardMaterial color="#22201D" roughness={0.8} />
      </mesh>

      {/* Foil Seal Clip */}
      <mesh position={[0, 1.06, 0.16]}>
        <boxGeometry args={[0.7, 0.08, 0.04]} />
        <meshStandardMaterial color="#D58C3D" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Front Label Plate */}
      {labelTexture && (
        <mesh position={[0, -0.05, 0.43]}>
          <planeGeometry args={[1.05, 1.35]} />
          <meshStandardMaterial
            map={labelTexture}
            roughness={0.6}
            metalness={0.1}
          />
        </mesh>
      )}

      {/* Degassing Valve */}
      <mesh position={[0, 0.68, 0.435]}>
        <cylinderGeometry args={[0.065, 0.065, 0.02, 16]} />
        <meshStandardMaterial color="#2B211B" roughness={0.5} />
      </mesh>
    </group>
  );
}

// ── 2. Ceramic Takeaway Cup & Saucer ──
function CeramicCup({ onHover }: { onHover: (hovered: boolean) => void }) {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const targetScale = hovered ? 1.04 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 8);
    }
  });

  return (
    <group
      ref={meshRef}
      position={[0.22, 0.48, 0.25]}
      rotation={[0, -0.38, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(true);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(false);
      }}
    >
      {/* Ceramic Saucer */}
      <mesh position={[0, -0.62, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.82, 0.65, 0.08, 32]} />
        <meshStandardMaterial color="#EAE7E1" roughness={0.18} metalness={0.05} />
      </mesh>

      {/* Ceramic Cup Body */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.45, 1.15, 32]} />
        <meshStandardMaterial color="#FAF8F5" roughness={0.15} metalness={0.08} />
      </mesh>

      {/* Cup Lip / Rim */}
      <mesh position={[0, 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.61, 0.03, 16, 32]} />
        <meshStandardMaterial color="#FAF8F5" roughness={0.15} />
      </mesh>

      {/* Coffee Crema Surface */}
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.59, 0.59, 0.02, 32]} />
        <meshStandardMaterial color="#B07A45" roughness={0.35} metalness={0.05} />
      </mesh>

      {/* Crema Swirl Center */}
      <mesh position={[0.08, 0.535, 0.05]} rotation={[-Math.PI / 2, 0, 0.4]}>
        <ringGeometry args={[0.08, 0.28, 32]} />
        <meshStandardMaterial color="#E8DDD0" roughness={0.4} />
      </mesh>
    </group>
  );
}

// ── 3. Loose Scattered Coffee Beans ──
function ScatteredBeans() {
  const beanPositions: [number, number, number, number, number, number][] = [
    [0.05, 0.04, 0.7, 0.2, 0.5, 0.1],
    [-0.15, 0.04, 0.85, 0.8, -0.4, 0.3],
    [0.25, 0.04, 0.65, 0.4, 0.9, -0.2],
    [-0.32, 0.04, 0.68, 0.1, -0.8, 0.5],
    [0.0, 0.04, 0.95, 0.7, 0.2, -0.6],
    [0.35, 0.04, 0.92, -0.3, 0.6, 0.4],
    [-0.22, 0.04, 1.0, 0.5, -0.2, -0.3],
  ];

  return (
    <group>
      {beanPositions.map((pos, idx) => (
        <mesh
          key={idx}
          position={[pos[0], pos[1], pos[2]]}
          rotation={[pos[3], pos[4], pos[5]]}
          castShadow
        >
          {/* Coffee bean shape via scaled sphere */}
          <sphereGeometry args={[0.075, 16, 12]} />
          <meshStandardMaterial
            color="#321D12"
            roughness={0.45}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── 4. Main Interactive Studio Scene ──
function StudioScene({ onHoverObject }: StudioProps) {
  const groupRef = useRef<THREE.Group>(null);
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    rotX: 0,
    rotY: 0,
    velX: 0,
    velY: 0,
  });

  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;

      if (dragRef.current.isDragging) {
        const deltaX = (e.clientX - dragRef.current.startX) * 0.007;
        const deltaY = (e.clientY - dragRef.current.startY) * 0.007;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.velX = deltaX;
        dragRef.current.velY = deltaY;
        dragRef.current.rotY += deltaX;
        dragRef.current.rotX = Math.max(-0.25, Math.min(0.25, dragRef.current.rotX + deltaY));
      }
    };

    const handlePointerUp = () => {
      dragRef.current.isDragging = false;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Apply inertia damping
    if (!dragRef.current.isDragging) {
      dragRef.current.rotY += dragRef.current.velX;
      dragRef.current.rotX += dragRef.current.velY;
      dragRef.current.velX *= 0.92;
      dragRef.current.velY *= 0.92;

      // Soft return to rest orientation
      dragRef.current.rotY = THREE.MathUtils.lerp(dragRef.current.rotY, 0, delta * 1.5);
      dragRef.current.rotX = THREE.MathUtils.lerp(dragRef.current.rotX, 0, delta * 1.5);
    }

    // Pointer Parallax
    const parallaxYaw = pointerRef.current.x * 0.18;
    const parallaxPitch = -pointerRef.current.y * 0.1;

    // Combined rotation
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      dragRef.current.rotY + parallaxYaw,
      delta * 6
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      dragRef.current.rotX + parallaxPitch,
      delta * 6
    );
  });

  return (
    <group
      ref={groupRef}
      scale={[1.05, 1.05, 1.05]}
      position={[-0.12, -0.62, 0]}
      onPointerDown={(e) => {
        dragRef.current.isDragging = true;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.velX = 0;
        dragRef.current.velY = 0;
      }}
    >
      <Float speed={1.2} rotationIntensity={0.06} floatIntensity={0.08}>
        <CoffeeBag onHover={(h) => onHoverObject?.(h ? 'bag' : null)} />
        <CeramicCup onHover={(h) => onHoverObject?.(h ? 'cup' : null)} />
        <ScatteredBeans />
      </Float>

      {/* Matte Studio Table Plane */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <shadowMaterial opacity={0.35} />
      </mesh>
    </group>
  );
}

export function CoffeeStudioScene({ onHoverObject }: StudioProps) {
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
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <Canvas
        camera={{ position: [0.0, 0.42, 4.2], fov: 38 }}
        dpr={dpr}
        shadows={{ type: THREE.PCFShadowMap }}
        frameloop={isVisible ? 'always' : 'never'}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
      >
        {/* Studio Lighting Rig */}
        <ambientLight intensity={0.5} />
        {/* Warm Key Light */}
        <directionalLight
          position={[-3.0, 4.0, 3.2]}
          intensity={3.4}
          color="#FFF5EB"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0001}
        />
        {/* Soft Warm Fill Light */}
        <directionalLight
          position={[3.5, 1.8, 2.2]}
          intensity={1.2}
          color="#E8D5C0"
        />
        {/* Golden Back Rim Light */}
        <directionalLight
          position={[1.0, 3.2, -3.2]}
          intensity={2.2}
          color="#D58C3D"
        />

        {/* Soft Ground Contact Shadows */}
        <ContactShadows
          position={[0, -0.15, 0]}
          opacity={0.7}
          scale={8}
          blur={2.0}
          far={3.5}
          color="#1A0F08"
        />

        <StudioScene onHoverObject={onHoverObject} />
      </Canvas>
    </div>
  );
}
