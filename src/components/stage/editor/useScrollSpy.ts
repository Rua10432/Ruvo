import { useEffect, useRef } from "react";

export interface UseScrollSpyOptions {
  editorRef: React.RefObject<HTMLDivElement | null>;
  requestedHeading?: string | null;
  onActiveHeadingChange?: (text: string, index: number) => void;
  activeNoteId?: string;
}

/**
 * Custom hook for:
 * 1. Smoothly scrolling editor viewport to a requested heading anchor.
 * 2. Listening to scroll events in .stage-scroll-area and updating the active heading index.
 */
export function useScrollSpy({
  editorRef,
  requestedHeading,
  onActiveHeadingChange,
  activeNoteId,
}: UseScrollSpyOptions) {
  const isProgrammaticScrollRef = useRef(false);
  const lastActiveIndexRef = useRef(-1);

  // Reset active heading index when note changes
  useEffect(() => {
    lastActiveIndexRef.current = -1;
  }, [activeNoteId]);

  // Scroll to heading when requested
  useEffect(() => {
    if (!requestedHeading || !editorRef.current) return;
    const cleanRequested = requestedHeading.trim().toLowerCase();
    const headings = Array.from(
      editorRef.current.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
    );
    const target =
      headings.find((el) => el.textContent?.trim().toLowerCase() === cleanRequested) ??
      headings.find((el) => el.textContent?.trim().toLowerCase().includes(cleanRequested));

    if (target) {
      isProgrammaticScrollRef.current = true;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      const timer = window.setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [requestedHeading, editorRef]);

  // Scroll Spy: monitor container scroll to sync outline highlight
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !onActiveHeadingChange) return;

    const scrollContainer = editor.closest<HTMLElement>(".stage-scroll-area");
    if (!scrollContainer) return;

    let ticking = false;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        if (!editorRef.current) return;

        const headings = Array.from(
          editorRef.current.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
        );
        if (headings.length === 0) return;

        const containerRect = scrollContainer.getBoundingClientRect();
        // Highlighting threshold: comfort zone right under toolbar
        const threshold = containerRect.top + 80;

        const isAtBottom =
          scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 30;

        let activeIndex = -1;

        if (isAtBottom) {
          activeIndex = headings.length - 1;
        } else {
          for (let i = 0; i < headings.length; i++) {
            const rect = headings[i].getBoundingClientRect();
            if (rect.top <= threshold) {
              activeIndex = i;
            } else {
              break;
            }
          }
        }

        if (activeIndex >= 0 && activeIndex < headings.length && activeIndex !== lastActiveIndexRef.current) {
          lastActiveIndexRef.current = activeIndex;
          const headingEl = headings[activeIndex];
          const cleanText = headingEl.textContent?.trim() ?? "";
          onActiveHeadingChange(cleanText, activeIndex);
        }
      });
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    const initTimer = window.setTimeout(handleScroll, 150);

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      window.clearTimeout(initTimer);
    };
  }, [activeNoteId, onActiveHeadingChange, editorRef]);
}
