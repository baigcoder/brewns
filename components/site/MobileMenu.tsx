'use client';

import React, { useEffect } from 'react';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBag: () => void;
  bagCount: number;
}

export function MobileMenu({ isOpen, onClose, onOpenBag, bagCount }: MobileMenuProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const links = [
    { num: '01', label: 'Shop', href: '#shop' },
    { num: '02', label: 'Menu', href: '#menu' },
    { num: '03', label: 'Locations', href: '#locations' },
    { num: '04', label: 'Our Story', href: '#story' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
      className="fixed inset-0 z-40 bg-[#070707] text-white flex flex-col justify-between p-6 pt-28 pb-10 md:hidden animate-in fade-in duration-200"
    >
      <div>
        <p className="font-mono text-xs text-white/40 tracking-widest uppercase mb-6">
          <span className="text-[#D58C3D]">//</span> NAVIGATION
        </p>
        <nav className="flex flex-col border-t border-white/15">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="group flex items-baseline gap-4 py-5 border-b border-white/10 hover:border-white transition-colors"
            >
              <span className="font-mono text-xs text-[#D58C3D]">{link.num}</span>
              <span className="font-mono text-2xl font-bold uppercase tracking-tight group-hover:translate-x-2 transition-transform duration-200">
                {link.label}
              </span>
            </a>
          ))}
        </nav>
      </div>

      <div className="space-y-4 pt-6 border-t border-white/10">
        <a
          href="#order"
          onClick={onClose}
          className="flex items-center justify-between p-4 bg-white/5 border border-white/15 font-mono text-xs uppercase tracking-wider hover:bg-[#D58C3D] hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="status-dot" />
            <span>ORDER ONLINE</span>
          </span>
          <span>→</span>
        </a>
        <button
          onClick={() => {
            onClose();
            onOpenBag();
          }}
          className="w-full flex items-center justify-between p-4 border border-white/15 font-mono text-xs uppercase tracking-wider text-white/70 hover:text-white transition-colors"
        >
          <span>VIEW YOUR BAG</span>
          <span className="font-bold">({bagCount})</span>
        </button>
      </div>
    </div>
  );
}
