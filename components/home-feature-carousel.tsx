'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const slides = [
  { image: '/category-images/watches-rolex.jpg', category: 'Watches', title: 'Classic timepieces' },
  { image: '/category-images/watches-classic.jpg', category: 'Watches', title: 'A refined everyday watch' },
  { image: '/category-images/watches-red.jpg', category: 'Watches', title: 'A bold red-dial watch' },
  { image: '/category-images/electronics-samsung.jpg', category: 'Electronics', title: 'Modern mobile technology' },
  { image: '/category-images/electronics-headphones.jpg', category: 'Electronics', title: 'Wireless listening' },
  { image: '/category-images/electronics-apple.jpg', category: 'Electronics', title: 'Apple devices' },
  { image: '/category-images/fashion-menswear.jpg', category: 'Fashion', title: 'Contemporary menswear' },
  { image: '/category-images/fashion-womenswear.jpg', category: 'Fashion', title: 'Timeless womenswear' },
  { image: '/category-images/collectibles-figures.jpg', category: 'Collectibles', title: 'Figures for collectors' },
  { image: '/category-images/collectibles-sculptures.jpg', category: 'Collectibles', title: 'Hand-finished sculptures' },
  { image: '/category-images/home-decor.jpg', category: 'Home', title: 'Considered home design' },
  { image: '/category-images/jewellery-gold-set.jpg', category: 'Jewellery', title: 'Traditional gold jewellery' },
  { image: '/category-images/jewellery-necklace.jpg', category: 'Jewellery', title: 'Gold necklace and earrings' },
  { image: '/category-images/jewellery-sapphire.jpg', category: 'Jewellery', title: 'Sapphire statement necklace' },
];

export function HomeFeatureCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const slide = slides[active];
  const showPrevious = () => setActive((current) => (current - 1 + slides.length) % slides.length);
  const showNext = () => setActive((current) => (current + 1) % slides.length);

  return (
    <div className="home-feature-carousel" role="region" aria-label="Featured BIDORA categories">
      <Image
        key={slide.image}
        className="home-feature-image"
        src={slide.image}
        alt={`${slide.category}: ${slide.title}`}
        fill
        priority={active === 0}
        sizes="(max-width: 680px) 82vw, (max-width: 1000px) 42vw, 380px"
      />
      <div className="home-feature-shade" />
      <div className="home-feature-caption" aria-live="polite">
        <span>{slide.category}</span>
        <strong>{slide.title}</strong>
      </div>
      <div className="home-feature-controls">
        <button type="button" onClick={showPrevious} aria-label="Previous featured item"><ChevronLeft size={16}/></button>
        <span>{String(active + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
        <button type="button" onClick={showNext} aria-label="Next featured item"><ChevronRight size={16}/></button>
      </div>
    </div>
  );
}
