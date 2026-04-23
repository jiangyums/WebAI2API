import { describe, it, expect } from "vitest";
import {
    ERROR_CODES,
    ERROR_TYPES,
    getErrorMessage,
    getErrorStatus,
    getErrorDetails,
    ADAPTER_ERRORS
} from "#server/errors";

describe("errors", () => {
    describe("ERROR_CODES", () => {
        it("should have UNAUTHORIZED code", () => {
            expect(ERROR_CODES.UNAUTHORIZED).toBe("UNAUTHORIZED");
        });

        it("should have BROWSER_NOT_INITIALIZED code", () => {
            expect(ERROR_CODES.BROWSER_NOT_INITIALIZED).toBe("BROWSER_NOT_INITIALIZED");
        });

        it("should have SERVER_BUSY code", () => {
            expect(ERROR_CODES.SERVER_BUSY).toBe("SERVER_BUSY");
        });

        it("should have INVALID_MODEL code", () => {
            expect(ERROR_CODES.INVALID_MODEL).toBe("INVALID_MODEL");
        });

        it("should have RECAPTCHA code", () => {
            expect(ERROR_CODES.RECAPTCHA).toBe("RECAPTCHA");
        });
    });

    describe("getErrorMessage", () => {
        it("should return message for UNAUTHORIZED", () => {
            expect(getErrorMessage("UNAUTHORIZED")).toBe("未授权（Token 无效或缺失）");
        });

        it("should return message for SERVER_BUSY", () => {
            expect(getErrorMessage("SERVER_BUSY")).toBe("服务器繁忙（队列已满）");
        });

        it("should return message for INVALID_MODEL", () => {
            expect(getErrorMessage("INVALID_MODEL")).toBe("模型无效/后端不支持");
        });

        it("should return unknown error for invalid code", () => {
            expect(getErrorMessage("INVALID_CODE")).toBe("未知错误");
        });
    });

    describe("getErrorStatus", () => {
        it("should return 401 for UNAUTHORIZED", () => {
            expect(getErrorStatus("UNAUTHORIZED")).toBe(401);
        });

        it("should return 503 for BROWSER_NOT_INITIALIZED", () => {
            expect(getErrorStatus("BROWSER_NOT_INITIALIZED")).toBe(503);
        });

        it("should return 429 for SERVER_BUSY", () => {
            expect(getErrorStatus("SERVER_BUSY")).toBe(429);
        });

        it("should return 400 for INVALID_MODEL", () => {
            expect(getErrorStatus("INVALID_MODEL")).toBe(400);
        });

        it("should return 500 for unknown code", () => {
            expect(getErrorStatus("UNKNOWN")).toBe(500);
        });
    });

    describe("getErrorDetails", () => {
        it("should return full details for RECAPTCHA", () => {
            const details = getErrorDetails("RECAPTCHA");
            expect(details.message).toBe("触发人机验证（reCAPTCHA）");
            expect(details.status).toBe(403);
            expect(details.type).toBe(ERROR_TYPES.SERVER_ERROR);
        });

        it("should return default for unknown code", () => {
            const details = getErrorDetails("UNKNOWN");
            expect(details.message).toBe("未知错误");
            expect(details.status).toBe(500);
        });
    });

    describe("ADAPTER_ERRORS", () => {
        it("should have PAGE_CLOSED", () => {
            expect(ADAPTER_ERRORS.PAGE_CLOSED).toBe("PAGE_CLOSED");
        });

        it("should have NETWORK_ERROR", () => {
            expect(ADAPTER_ERRORS.NETWORK_ERROR).toBe("NETWORK_ERROR");
        });

        it("should have TIMEOUT_ERROR", () => {
            expect(ADAPTER_ERRORS.TIMEOUT_ERROR).toBe("TIMEOUT_ERROR");
        });

        it("should have AUTH_REQUIRED", () => {
            expect(ADAPTER_ERRORS.AUTH_REQUIRED).toBe("AUTH_REQUIRED");
        });

        it("should have CONTENT_BLOCKED", () => {
            expect(ADAPTER_ERRORS.CONTENT_BLOCKED).toBe("CONTENT_BLOCKED");
        });
    });
});
