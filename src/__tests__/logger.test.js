import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, setLogLevel, readLogs, clearLogs } from "#utils/logger";

describe("logger", () => {
    let originalLogLevel;

    beforeEach(() => {
        vi.restoreAllMocks();
        originalLogLevel = process.env.LOG_LEVEL;
    });

    afterEach(() => {
        process.env.LOG_LEVEL = originalLogLevel;
    });

    describe("log levels", () => {
        beforeEach(() => {
            setLogLevel("debug");
        });

        it("should log debug message", () => {
            const spy = vi.spyOn(console, "log").mockImplementation(() => {});
            logger.debug("测试", "debug消息", { id: "test-1" });
            expect(spy).toHaveBeenCalled();
        });

        it("should log info message", () => {
            const spy = vi.spyOn(console, "log").mockImplementation(() => {});
            logger.info("测试", "info消息", { id: "test-2" });
            expect(spy).toHaveBeenCalled();
        });

        it("should log warn message", () => {
            const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
            logger.warn("测试", "warn消息", { id: "test-3" });
            expect(spy).toHaveBeenCalled();
        });

        it("should log error message", () => {
            const spy = vi.spyOn(console, "error").mockImplementation(() => {});
            logger.error("测试", "error消息", { id: "test-4" });
            expect(spy).toHaveBeenCalled();
        });
    });

    describe("setLogLevel", () => {
        it("should set log level to debug", () => {
            const spy = vi.spyOn(console, "log").mockImplementation(() => {});
            setLogLevel("debug");
            logger.debug("测试", "debug消息", { id: "test-5" });
            expect(spy).toHaveBeenCalled();
        });

        it("should not set invalid log level", () => {
            const spy = vi.spyOn(console, "log").mockImplementation(() => {});
            setLogLevel("invalid");
            setLogLevel("debug");
            logger.debug("测试", "debug消息", { id: "test-6" });
            expect(spy).toHaveBeenCalled();
        });
    });

    describe("meta handling", () => {
        it("should include id in front meta", () => {
            const spy = vi.spyOn(console, "log").mockImplementation(() => {});
            logger.info("测试", "消息", { id: "front-id" });
            const output = spy.mock.calls[0][0];
            expect(output).toContain("[front-id]");
        });

        it("should include adapter in front meta", () => {
            const spy = vi.spyOn(console, "log").mockImplementation(() => {});
            logger.info("测试", "消息", { adapter: "lmarena" });
            const output = spy.mock.calls[0][0];
            expect(output).toContain("[lmarena]");
        });

        it("should include model in front meta", () => {
            const spy = vi.spyOn(console, "log").mockImplementation(() => {});
            logger.info("测试", "消息", { model: "gpt-4o" });
            const output = spy.mock.calls[0][0];
            expect(output).toContain("[gpt-4o]");
        });

        it("should handle Error object in meta", () => {
            const spy = vi.spyOn(console, "log").mockImplementation(() => {});
            const err = new Error("test error");
            logger.info("测试", "消息", { error: err });
            const output = spy.mock.calls[0][0];
            expect(output).toContain("error=test error");
        });
    });

    describe("readLogs", () => {
        beforeEach(() => {
            clearLogs();
        });

        it("should return empty logs when no logs", () => {
            const result = readLogs(10);
            expect(result.logs).toEqual([]);
            expect(result.total).toBe(0);
        });
    });
});
