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
  const [{ active, previous, isFading }, setCarousel] = useState({
    active: 0,
    previous: null as number | null,
    isFading: false,
  });

  useEffect(() => {
    const timer = window.setInterval(
      () => setCarousel((current) => ({
        active: (current.active + 1) % slides.length,
        previous: current.active,
        isFading: false,
      })),
      10_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (previous === null || !isFading) return;
    const cleanup = window.setTimeout(() => {
      setCarousel((current) => ({ ...current, previous: null }));
    }, 750);
    return () => window.clearTimeout(cleanup);
  }, [previous, isFading]);

  const slide = slides[active];
  const changeSlide = (direction: -1 | 1) => {
    setCarousel((current) => ({
      active: (current.active + direction + slides.length) % slides.length,
      previous: current.active,
      isFading: false,
    }));
  };
  const showPrevious = () => changeSlide(-1);
  const showNext = () => changeSlide(1);

  return (
    <div className="home-feature-carousel" role="region" aria-label="Featured BIDORA categories">
      {previous !== null && (
        <Image
          className={`home-feature-image home-feature-image-previous${isFading ? ' is-fading' : ''}`}
          src={slides[previous].image}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 680px) 82vw, (max-width: 1000px) 42vw, 380px"
        />
      )}
      <Image
        key={slide.image}
        className={`home-feature-image home-feature-image-current${previous !== null && !isFading ? ' is-loading' : ''}`}
        src={slide.image}
        alt={`${slide.category}: ${slide.title}`}
        fill
        priority={active === 0}
        onLoad={() => setCarousel((current) => ({ ...current, isFading: true }))}
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
