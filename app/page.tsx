'use client';

import React, { useState, useEffect } from 'react';
import Lenis from 'lenis';
import { IntroLoader } from '@/components/intro/IntroLoader';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Hero } from '@/components/hero/Hero';
import { FeaturedMenu } from '@/components/menu/FeaturedMenu';
import { ShopSection } from '@/components/shop/ShopSection';
import { LocationsSection } from '@/components/locations/LocationsSection';
import { PhilosophySection } from '@/components/story/PhilosophySection';
import { OrderSection } from '@/components/order/OrderSection';
import { SiteFooter } from '@/components/site/SiteFooter';
import { BagDrawer, type BagItem } from '@/components/order/BagDrawer';
import { CheckoutModal } from '@/components/order/CheckoutModal';
import type { MenuItem } from '@/data/menu';
import type { Product } from '@/data/products';

export default function Home() {
  const [bagItems, setBagItems] = useState<BagItem[]>([]);
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Add Menu Item to Bag
  const handleAddMenuItem = (item: MenuItem) => {
    setBagItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.id === item.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].qty += 1;
        return next;
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          optionsLabel: 'PREPARED FRESH TO ORDER',
          qty: 1,
        },
      ];
    });
    showToast(`ADDED ${item.name}`);
  };

  // Add Product to Bag
  const handleAddProduct = (
    product: Product,
    options?: Record<string, number>,
    quantity: number = 1
  ) => {
    let price = product.price;
    const optionLabels: string[] = [];

    if (options) {
      product.options.forEach((opt) => {
        const selectedIdx = options[opt.key] ?? opt.defaultIndex ?? 0;
        const choice = opt.choices[selectedIdx];
        if (choice) {
          price += choice.priceDelta;
          optionLabels.push(choice.label);
        }
      });
    }

    const optionsText = optionLabels.length > 0 ? optionLabels.join(' · ') : undefined;
    const key = `${product.id}-${optionsText || 'standard'}`;

    setBagItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.id === key);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].qty += quantity;
        return next;
      }
      return [
        ...prev,
        {
          id: key,
          name: product.name,
          price,
          optionsLabel: optionsText,
          qty: quantity,
        },
      ];
    });
    showToast(`ADDED ${quantity}x ${product.name}`);
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    setBagItems((prev) => {
      const next = [...prev];
      next[index].qty = newQty;
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setBagItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalItemCount = bagItems.reduce((acc, item) => acc + item.qty, 0);

  return (
    <div className="relative w-full min-h-screen bg-[#070707] text-white">
      {/* 1. Animated Cup Intro Loader (FR-02) */}
      <IntroLoader />

      {/* 2. Global Site Header with Theme Detection (FR-01) */}
      <SiteHeader
        bagCount={totalItemCount}
        onOpenBag={() => setIsBagOpen(true)}
      />

      {/* 3. Main Narrative Sections */}
      <main>
        {/* Section 1: Hero & Opalesce Background (FR-03 & FR-04) */}
        <Hero />

        {/* Section 2: Featured Menu with 3D Card Tilt (FR-05) */}
        <FeaturedMenu onAddToCart={handleAddMenuItem} />

        {/* Section 3: Editorial Shop 07 Products (FR-06) */}
        <ShopSection onAddToCart={handleAddProduct} />

        {/* Section 4: Locations & Coffee Clock (FR-07 & FR-09) */}
        <LocationsSection />

        {/* Section 5: Story & 3D Instanced Bean Field (FR-08 & FR-10) */}
        <PhilosophySection />

        {/* Section 6: Order Section & Thermal Receipt (FR-11) */}
        <OrderSection onOrderClick={() => setIsCheckoutOpen(true)} />
      </main>

      {/* 4. Global Site Footer (FR-12) */}
      <SiteFooter />

      {/* 5. Slide-out Shopping Bag Drawer */}
      <BagDrawer
        isOpen={isBagOpen}
        onClose={() => setIsBagOpen(false)}
        items={bagItems}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onCheckout={() => setIsCheckoutOpen(true)}
      />

      {/* 6. Checkout / Order Confirmation Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderPlaced={() => {
          setBagItems([]);
          setTimeout(() => setIsCheckoutOpen(false), 3000);
          showToast('ORDER TRANSMITTED TO COUNTER!');
        }}
      />

      {/* 7. Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white text-[#070707] font-mono text-xs font-bold uppercase tracking-wider px-6 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
