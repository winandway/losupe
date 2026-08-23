import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { MOBILE_QUERY, useMediaQuery, useMounted } from "@/lib/use-media";

describe("useMediaQuery / useMounted", () => {
  it("sin matchMedia (jsdom) devuelve false y no explota; montado da true en cliente", () => {
    const { result } = renderHook(() => useMediaQuery(MOBILE_QUERY));
    expect(result.current).toBe(false);
    const mounted = renderHook(() => useMounted());
    expect(mounted.result.current).toBe(true);
  });
  it("respeta matchMedia cuando existe", () => {
    const original = window.matchMedia;
    let listener: (() => void) | null = null;
    window.matchMedia = ((query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener: (_: string, cb: () => void) => {
          listener = cb;
        },
        removeEventListener: () => {
          listener = null;
        },
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    try {
      const { result, unmount } = renderHook(() => useMediaQuery("(max-width: 767px)"));
      expect(result.current).toBe(true);
      expect(listener).not.toBeNull();
      unmount();
      expect(listener).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });
});
