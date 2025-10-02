import { ReactNode, useEffect, useRef, useState } from 'react';

type RevealOnScrollProps = {
  children: ReactNode;
  delayMs?: number;
  threshold?: number;
  once?: boolean;
  className?: string;
};

export function RevealOnScroll({
  children,
  delayMs = 0,
  threshold = 0.15,
  once = true,
  className = '',
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // If user prefers reduced motion, show immediately
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once && ref.current) {
              observer.unobserve(ref.current);
            }
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, once]);

  const style = delayMs ? ({ animationDelay: `${delayMs}ms` } as const) : undefined;

  return (
    <div
      ref={ref}
      className={`${className} ${visible ? 'animate-fade-in-up' : 'opacity-0 translate-y-2'} will-change-transform`}
      style={style}
    >
      {children}
    </div>
  );
}

