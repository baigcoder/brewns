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
      className="mobile-menu-overlay"
    >
      <div>
        <p className="mobile-menu-kicker">
          <span style={{ color: 'var(--accent-amber)' }}>//</span> NAVIGATION
        </p>
        <nav className="mobile-menu-nav">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="mobile-menu-link"
            >
              <span className="mobile-menu-link-num">{link.num}</span>
              <span className="mobile-menu-link-text">{link.label}</span>
            </a>
          ))}
        </nav>
      </div>

      <div className="mobile-menu-footer">
        <a
          href="#order"
          onClick={onClose}
          className="mobile-menu-order-btn"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
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
          className="mobile-menu-bag-btn"
        >
          <span>VIEW YOUR BAG</span>
          <span style={{ fontWeight: 700 }}>({bagCount})</span>
        </button>
      </div>
    </div>
  );
}
