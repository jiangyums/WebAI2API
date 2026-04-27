import { describe, it, expect } from "vitest";
import { extractSessionTitle, urlCheck } from "#utils/tools";

describe("extractSessionTitle", () => {
    it("should extract session title from text", () => {
        const result = extractSessionTitle("【会话标题: 我的会话】你好");
        expect(result.targetSessionTitle).toBe("我的会话");
        expect(result.otherPrompt).toBe("你好");
    });

    it("should handle empty session title", () => {
        const result = extractSessionTitle("你好");
        expect(result.targetSessionTitle).toBe("");
        expect(result.otherPrompt).toBe("你好");
    });

    it("should handle bracket variations", () => {
        const result = extractSessionTitle("[会话标题: 测试]内容");
        expect(result.targetSessionTitle).toBe("测试");
        expect(result.otherPrompt).toBe("内容");
    });

    it("should handle colon variations", () => {
        const result = extractSessionTitle("【会话标题：会话】内容");
        expect(result.targetSessionTitle).toBe("会话");
    });
});

describe("urlCheck", () => {
    it("should return true for same URL", () => {
        expect(urlCheck("foo.com/a", "foo.com/a")).toBe(true);
    });

    it("should return false for different paths", () => {
        expect(urlCheck("foo.com/a", "foo.com/b")).toBe(false);
    });

    it("should return false for different hostnames", () => {
        expect(urlCheck("foo.com/a", "bar.com/a")).toBe(false);
    });

    it("should return true for paths with trailing slash", () => {
        expect(urlCheck("foo.com/a/", "foo.com/a")).toBe(true);
    });

    it("should handle bare domain", () => {
        expect(urlCheck("foo.com", "foo.com")).toBe(true);
    });

    it("should return false for invalid URLs", () => {
        expect(() => urlCheck("", "foo.com/a")).toThrow();
    });

    it("should return true for different protocol same path", () => {
        expect(urlCheck("http://example.com/a", "example.com/a")).toBe(true);
    });

    it("should return true for URLs with http protocol", () => {
        expect(urlCheck("http://example.com/a", "http://example.com/a")).toBe(true);
    });

    it("should return true for URLs with https protocol", () => {
        expect(urlCheck("https://example.com/a", "https://example.com/a")).toBe(true);
    });

    it("should return false for different paths with https protocol", () => {
        expect(urlCheck("https://example.com/a", "https://example.com/b")).toBe(false);
    });
});
