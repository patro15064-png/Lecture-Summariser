'use client';

import anime from 'animejs';

/**
 * Animates vertical cascade entrance of list or card items.
 */
export function animateStaggerCards(selector: string | HTMLElement[] | NodeListOf<Element>, delay = 0) {
  if (typeof window === 'undefined') return;

  anime({
    targets: selector,
    translateY: [24, 0],
    opacity: [0, 1],
    easing: 'easeOutCubic',
    duration: 600,
    delay: anime.stagger(60, { start: delay }),
  });
}

/**
 * Smooth tab transition animation with subtle scale and fade.
 */
export function animateTabSwitch(target: HTMLElement | string) {
  if (typeof window === 'undefined') return;

  anime({
    targets: target,
    opacity: [0.3, 1],
    scale: [0.985, 1],
    easing: 'easeOutQuad',
    duration: 350,
  });
}

/**
 * Highlights an element with an elastic border/glow pulse when seeking to a timestamp.
 */
export function animateTimestampPulse(target: HTMLElement | string) {
  if (typeof window === 'undefined') return;

  anime({
    targets: target,
    scale: [1, 1.03, 1],
    borderColor: ['#6366f1', '#a855f7', '#6366f1'],
    boxShadow: [
      '0 0 0px rgba(168, 85, 247, 0)',
      '0 0 25px rgba(168, 85, 247, 0.45)',
      '0 0 0px rgba(168, 85, 247, 0)',
    ],
    easing: 'easeOutElastic(1, .7)',
    duration: 800,
  });
}

/**
 * Animate metric circle gauge or numerical progress.
 */
export function animateScoreGauge(target: HTMLElement | string, targetValue: number) {
  if (typeof window === 'undefined') return;

  const obj = { val: 0 };
  anime({
    targets: obj,
    val: targetValue,
    round: 1,
    easing: 'easeOutExpo',
    duration: 1200,
    update: () => {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (el) {
        el.textContent = `${obj.val}%`;
      }
    },
  });
}
