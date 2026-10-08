"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Fade/slide-in on scroll.
 *
 * Content is never hidden before hydration: an element only enters the pending
 * state if it is still below the viewport when the client takes over, so
 * nothing already visible blinks and no-JS users always see everything.
 * Reduced-motion users get no animation at all.
 */
export function Reveal({
  children, className, delay = 0, as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top <= window.innerHeight) return;

    // Toggled on the DOM directly: React never sets this class, so re-renders leave it alone.
    el.classList.add("is-pending");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.remove("is-pending");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Comp = Tag as any;
  return (
    <Comp ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Comp>
  );
}
