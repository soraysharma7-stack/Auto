import { describe, expect, it } from "vitest";

import { isPathWithin } from "@/lib/devices/actions";

describe("device folder boundaries", () => {
  it("accepts files inside a granted Windows folder", () => {
    expect(isPathWithin("C:\\Users\\me\\Approved\\project\\file.txt", "C:\\Users\\me\\Approved")).toBe(true);
    expect(isPathWithin("c:\\users\\me\\approved\\file.txt", "C:\\Users\\me\\Approved")).toBe(true);
  });

  it("rejects sibling folders and traversal", () => {
    expect(isPathWithin("C:\\Users\\me\\Approved-other\\file.txt", "C:\\Users\\me\\Approved")).toBe(false);
    expect(isPathWithin("C:\\Users\\me\\Approved\\..\\secret.txt", "C:\\Users\\me\\Approved")).toBe(false);
  });

  it("enforces POSIX folder boundaries", () => {
    expect(isPathWithin("/home/me/approved/file.txt", "/home/me/approved")).toBe(true);
    expect(isPathWithin("/home/me/approved-other/file.txt", "/home/me/approved")).toBe(false);
  });
});
