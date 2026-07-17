"use client";

import { useEffect } from "react";

function decodeHash(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function scrollToId(id: string) {
  if (!id || typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

/**
 * Fixes TOC navigation: percent-encoded hashes + sticky header,
 * and ensures click / initial-load hash jumps work.
 */
export function HashNav() {
  useEffect(() => {
    // Initial load / back-forward with hash
    const go = () => {
      const id = decodeHash(window.location.hash);
      if (id) {
        // slight delay so layout is ready
        requestAnimationFrame(() => scrollToId(id));
      }
    };
    go();
    window.addEventListener("hashchange", go);

    // Click delegation for in-doc anchors
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const a = t?.closest?.("a[href^='#']") as HTMLAnchorElement | null;
      if (!a || !a.getAttribute("href")?.startsWith("#")) return;
      // only handle links inside the manual
      if (!a.closest(".manual-doc")) return;

      const href = a.getAttribute("href") || "";
      const id = decodeHash(href);
      if (!id) return;

      const el = document.getElementById(id);
      if (!el) return;

      e.preventDefault();
      scrollToId(id);
      window.history.pushState(null, "", `#${id}`);
    };

    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", go);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
