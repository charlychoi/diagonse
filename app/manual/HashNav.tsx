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

function findTarget(id: string): HTMLElement | null {
  if (!id || typeof document === "undefined") return null;

  // 1) exact id
  let el = document.getElementById(id);
  if (el) return el;

  // 2) CSS.escape (handles special chars)
  try {
    el = document.querySelector(`#${CSS.escape(id)}`);
    if (el instanceof HTMLElement) return el;
  } catch {
    /* ignore */
  }

  // 3) prefix / startsWith match among headings (TOC slug drift)
  const headings = document.querySelectorAll<HTMLElement>(
    ".manual-doc h1[id], .manual-doc h2[id], .manual-doc h3[id]",
  );
  for (const h of headings) {
    if (h.id === id || h.id.startsWith(id) || id.startsWith(h.id)) return h;
  }

  // 4) normalize: strip punctuation variants
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[·•]/g, "")
      .replace(/[()]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  const nid = norm(id);
  for (const h of headings) {
    if (norm(h.id) === nid || norm(h.id).startsWith(nid) || nid.startsWith(norm(h.id))) {
      return h;
    }
  }

  return null;
}

function scrollToEl(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // brief focus ring for accessibility (no permanent outline)
  const prev = el.getAttribute("tabindex");
  if (prev === null) el.setAttribute("tabindex", "-1");
  try {
    el.focus({ preventScroll: true });
  } catch {
    /* ignore */
  }
  if (prev === null) el.removeAttribute("tabindex");
}

/**
 * Reliable TOC / in-doc hash navigation.
 * Handles percent-encoded Korean hashes, sticky header offset,
 * and minor slug mismatches between TOC and headings.
 */
export function HashNav() {
  useEffect(() => {
    const go = () => {
      const id = decodeHash(window.location.hash);
      if (!id) return;
      // layout pass then scroll (static content may paint late)
      requestAnimationFrame(() => {
        const el = findTarget(id);
        if (el) scrollToEl(el);
      });
    };

    go();
    window.addEventListener("hashchange", go);
    window.addEventListener("popstate", go);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const t = e.target as HTMLElement | null;
      const a = t?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || !a.closest(".manual-doc")) return;

      const raw = a.getAttribute("href") || "";
      // absolute or relative hash only
      let fragment = "";
      if (raw.startsWith("#")) {
        fragment = raw;
      } else {
        try {
          const u = new URL(raw, window.location.href);
          if (u.pathname === window.location.pathname && u.hash) {
            fragment = u.hash;
          }
        } catch {
          return;
        }
      }
      if (!fragment.startsWith("#") || fragment === "#") return;

      const id = decodeHash(fragment);
      const el = findTarget(id);
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();
      scrollToEl(el);
      const nextHash = `#${id}`;
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("hashchange", go);
      window.removeEventListener("popstate", go);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
