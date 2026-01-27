import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { renderIcon, clearIconCache } from "../src/icon-renderer";

describe("icon-renderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearIconCache();
    vi.mocked(readFile).mockResolvedValue(Buffer.from("mock-png-data"));
  });

  describe("renderIcon", () => {
    it("returns SVG data URI with tinted icon", async () => {
      const result = await renderIcon("lightbulb", "#ff9500", false);

      expect(result).toMatch(/^data:image\/svg\+xml,/);
      expect(result).toContain("feColorMatrix");
    });

    it("uses fill variant when isOn is true", async () => {
      await renderIcon("lightbulb", "#ff9500", true);

      expect(readFile).toHaveBeenCalledWith(expect.stringContaining("lightbulb-fill@2x.png"));
    });

    it("uses regular variant when isOn is false", async () => {
      await renderIcon("lightbulb", "#ff9500", false);

      expect(readFile).toHaveBeenCalledWith(expect.stringContaining("lightbulb-regular@2x.png"));
    });

    it("includes text in SVG when provided", async () => {
      const result = await renderIcon("lightbulb", "#ff9500", true, "75%");
      const decoded = decodeURIComponent(result);

      expect(decoded).toContain("75%");
      expect(decoded).toContain("<text");
      expect(decoded).toContain("text-anchor");
    });

    it("does not include text element when text is undefined", async () => {
      const result = await renderIcon("lightbulb", "#ff9500", true);
      const decoded = decodeURIComponent(result);

      expect(decoded).not.toContain("<text");
    });

    it("caches results with same parameters", async () => {
      await renderIcon("lightbulb", "#ff9500", true, "50%");
      await renderIcon("lightbulb", "#ff9500", true, "50%");

      expect(readFile).toHaveBeenCalledTimes(1);
    });

    it("does not cache when text differs", async () => {
      await renderIcon("lightbulb", "#ff9500", true, "50%");
      await renderIcon("lightbulb", "#ff9500", true, "75%");

      expect(readFile).toHaveBeenCalledTimes(2);
    });

    it("falls back to question icon when file not found", async () => {
      vi.mocked(readFile)
        .mockRejectedValueOnce(new Error("ENOENT"))
        .mockResolvedValueOnce(Buffer.from("question-icon"));

      const result = await renderIcon("nonexistent", "#ff9500", false);

      expect(readFile).toHaveBeenCalledWith(expect.stringContaining("question-regular@2x.png"));
      expect(result).toMatch(/^data:image\/svg\+xml,/);
    });

    it("returns empty SVG when question icon also fails", async () => {
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await renderIcon("question", "#ff9500", false);
      const decoded = decodeURIComponent(result);

      expect(decoded).toContain('width="144"');
      expect(decoded).toContain('height="144"');
    });
  });

  describe("clearIconCache", () => {
    it("clears cached icons", async () => {
      await renderIcon("lightbulb", "#ff9500", true);
      clearIconCache();
      await renderIcon("lightbulb", "#ff9500", true);

      expect(readFile).toHaveBeenCalledTimes(2);
    });
  });
});
