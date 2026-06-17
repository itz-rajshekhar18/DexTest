"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const cardSelector = [
  "div[class*='backdrop-blur']",
  "div[class*='shadow-2xl']",
  "div[class*='bg-zinc-900/20']",
  "div[class*='bg-zinc-950/60']",
  ".glass-surface",
  ".premium-card",
].join(",");

const interactiveSelector = "button, a[href], [role='button']";

export function CinematicDomEffects() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];
    const context = gsap.context(() => {
      document.documentElement.classList.add("ai-effects-ready");

      const cards = gsap.utils.toArray<HTMLElement>(cardSelector).filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.width > 140 && rect.height > 80;
      });

      cards.forEach((card) => {
        card.classList.add("ai-glass-panel", "ai-depth-card");

        if (reduceMotion) return;

        const onMove = (event: MouseEvent) => {
          const rect = card.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;

          gsap.to(card, {
            rotateX: y * -5.5,
            rotateY: x * 6.5,
            z: 18,
            duration: 0.55,
            ease: "power3.out",
            transformPerspective: 1100,
            transformOrigin: "center",
          });

          card.style.setProperty("--spot-x", `${(x + 0.5) * 100}%`);
          card.style.setProperty("--spot-y", `${(y + 0.5) * 100}%`);
        };

        const onLeave = () => {
          gsap.to(card, {
            rotateX: 0,
            rotateY: 0,
            z: 0,
            duration: 0.8,
            ease: "elastic.out(1, 0.55)",
          });
        };

        card.addEventListener("mousemove", onMove);
        card.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          card.removeEventListener("mousemove", onMove);
          card.removeEventListener("mouseleave", onLeave);
        });
      });

      const interactiveElements = gsap.utils.toArray<HTMLElement>(interactiveSelector);
      interactiveElements.forEach((element) => {
        element.classList.add("ai-magnetic");
        if (reduceMotion) return;

        const moveX = gsap.quickTo(element, "x", { duration: 0.45, ease: "power3.out" });
        const moveY = gsap.quickTo(element, "y", { duration: 0.45, ease: "power3.out" });

        const onMove = (event: MouseEvent) => {
          const rect = element.getBoundingClientRect();
          const x = event.clientX - (rect.left + rect.width / 2);
          const y = event.clientY - (rect.top + rect.height / 2);
          moveX(x * 0.16);
          moveY(y * 0.18);
        };

        const onLeave = () => {
          moveX(0);
          moveY(0);
        };

        element.addEventListener("mousemove", onMove);
        element.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
          element.removeEventListener("mousemove", onMove);
          element.removeEventListener("mouseleave", onLeave);
        });
      });

      if (!reduceMotion) {
        const revealElements = gsap.utils.toArray<HTMLElement>(
          "body > div, section, article, form > *, .space-y-6 > *, .grid > *"
        );

        revealElements.forEach((element) => {
          if (element.closest("[aria-hidden='true']")) return;
          gsap.fromTo(
            element,
            {
              autoAlpha: 0,
              y: 34,
              z: -80,
              rotateX: 4,
              filter: "blur(10px)",
            },
            {
              autoAlpha: 1,
              y: 0,
              z: 0,
              rotateX: 0,
              filter: "blur(0px)",
              duration: 1.05,
              ease: "power3.out",
              scrollTrigger: {
                trigger: element,
                start: "top 88%",
                once: true,
              },
            }
          );
        });

        if (cards.length > 0) {
          gsap.to(cards, {
            yPercent: -3,
            ease: "none",
            scrollTrigger: {
              trigger: document.body,
              start: "top top",
              end: "bottom bottom",
              scrub: 1.2,
            },
          });
        }
      }
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      context.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      document.documentElement.classList.remove("ai-effects-ready");
    };
  }, []);

  return (
    <>
      <div className="ai-hologram-overlay" aria-hidden="true" />
      <div className="ai-ambient-lights" aria-hidden="true" />
    </>
  );
}
