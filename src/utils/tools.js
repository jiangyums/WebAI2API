/**
 * @fileoverview 工具函数
 */

import { logger } from "./logger.js";

export function extractSessionTitle(text) {
    const regex = /[【\[]会话标题[:：](.+)[】\]]/;
    const match = text.match(regex);
    const targetSessionTitle = match ? match[1].trim() : "";
    const otherPrompt = text.replace(/[【\[]会话标题[:：].+[】\]]/, "").trim();
    return { targetSessionTitle, otherPrompt };
}

/**
 * 比较两个 URL 是否相同
 * @param {string} url1 - 第一个 URL（必须为非标准格式，如 foo.com/a）
 * @param {string} url2 - 第二个 URL（必须为非标准格式，如 foo.com/a）
 * @returns {boolean} 是否相同
 * @throws {process.exit} 参数格式无效时退出
 */
export function urlCheck(url1, url2) {
    const normalizeHostname = (hostname) => {
        return hostname.replace(/^www\./, "");
    };

    const comparePath = (path1, path2) => {
        const p1 = path1.endsWith("/") ? path1.slice(0, -1) : path1;
        const p2 = path2.endsWith("/") ? path2.slice(0, -1) : path2;

        if (p1 === p2) return true;

        if (p1.endsWith("/*")) {
            const prefix = p1.slice(0, -1);
            return p2.startsWith(prefix);
        }
        if (p2.endsWith("/*")) {
            const prefix = p2.slice(0, -1);
            return p1.startsWith(prefix);
        }

        if (p1.startsWith(p2) && p1.length > p2.length && p1[p2.length] === "/") return true;
        if (p2.startsWith(p1) && p2.length > p1.length && p2[p1.length] === "/") return true;

        return false;
    };

    const extractPath = (url) => {
        // 带协议输入：http:// 或 https://
        if (url.startsWith("http://") || url.startsWith("https://")) {
            url = url.replace(/^https?:\/\//, "");
        } else if (url.includes("://")) {
            // 其他协议报错退出
            console.error("暂不支持该协议:", url);
            process.exit(1);
        }

        // 无协议或去除协议后的输入
        const parts = url.split("/");
        if (parts.length > 0 && parts[0]) {
            const hostname = normalizeHostname(parts[0]);
            const path = parts.length > 1 ? "/" + parts.slice(1).join("/") : "/";
            return { hostname, path };
        }
        return null;
    };
    try {
        const p1 = extractPath(url1);
        const p2 = extractPath(url2);
        return p1.hostname === p2.hostname && comparePath(p1.path, p2.path);
    } catch (error) {
        logger.error("urlCheck", "参数无效", { url1, url2, error: error.message });
        process.exit(1);
    }
}
