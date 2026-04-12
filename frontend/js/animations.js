/**
 * EduPro – GSAP Animations
 */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') return;

    // Helper to safely select and animate
    const safeAnimate = (selector, config) => {
        if (document.querySelector(selector)) {
            gsap.from(selector, config);
        }
    };

    // Entrance animations
    safeAnimate('.ep-nav', { y: -30, opacity: 0, duration: 0.7, ease: 'expo.out', delay: 0.05 });
    safeAnimate('.ep-sidebar', { x: -20, opacity: 0, duration: 0.7, ease: 'expo.out', delay: 0.15 });
    safeAnimate('.ep-page-header', { y: 20, opacity: 0, duration: 0.7, ease: 'expo.out', delay: 0.2 });
    
    if (document.querySelectorAll('.ep-stat-tile').length) {
        gsap.from('.ep-stat-tile', { y: 24, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out', delay: 0.25 });
    }
    
    if (document.querySelectorAll('.ep-panel').length) {
        gsap.from('.ep-panel', { y: 30, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out', delay: 0.35 });
    }

    // Ambient blob movement
    if (document.querySelector('.ep-blob-a')) {
        gsap.to('.ep-blob-a', { x: '12%', y: '8%', duration: 18, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }
    if (document.querySelector('.ep-blob-b')) {
        gsap.to('.ep-blob-b', { x: '-10%', y: '-10%', duration: 22, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }
});
