import * as THREE from 'three';

export function disposeThreeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });
}

export function getOptimalDPR(): number {
  if (typeof window === 'undefined') return 1;
  const isMobile = window.innerWidth < 768;
  const systemDPR = window.devicePixelRatio || 1;
  return Math.min(systemDPR, isMobile ? 1.0 : 1.5);
}

export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}
