/**
 * @fileoverview 服务器启动前自检模块
 * @description 检查补丁、Camoufox 可执行文件、version.json、GeoLite2 数据库和 better-sqlite3 是否就绪。
 */

import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { logger } from "../utils/logger.js";
import { CAMOUFOX_PATCHES } from "../../scripts/postinstall.js";

const PROJECT_ROOT = process.cwd();
logger.debug("预检", `PROJECT_ROOT: ${PROJECT_ROOT}`);

// 检测 Camoufox 目录位置（支持符号链接或实际目录）
function resolveCamoufoxPath(camoufoxDir) {
    logger.debug("预检", "尝试: " + camoufoxDir + " 存在: " + fs.existsSync(camoufoxDir));
    if (fs.existsSync(camoufoxDir)) {
        return camoufoxDir;
    }
    // 回退到 WebAI2API 目录（硬编码路径用于测试）
    const altPath = "C:\\workplace\\api\\WebAI2API\\camoufox";
    logger.debug("预检", "尝试备选: " + altPath + " 存在: " + fs.existsSync(altPath));
    if (fs.existsSync(altPath)) {
        return altPath;
    }
    return camoufoxDir;
}

/**
 * 计算文件的 MD5 哈希值
 * @param {string} filePath - 文件路径
 * @returns {string|null} MD5 哈希值，文件不存在返回 null
 */
function getFileMD5(filePath) {
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(content).digest("hex");
}

/**
 * 获取 Camoufox 可执行文件路径（根据平台）
 * @returns {string}
 */
function getCamoufoxExecutablePath() {
    const baseDir = resolveCamoufoxPath(path.join(PROJECT_ROOT, "camoufox"));
    const platform = os.platform();

    if (platform === "win32") {
        return path.join(baseDir, "camoufox.exe");
    } else if (platform === "darwin") {
        return path.join(baseDir, "Camoufox.app", "Contents", "MacOS", "camoufox");
    } else {
        return path.join(baseDir, "camoufox");
    }
}

/**
 * 执行服务器启动前自检
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function preflight() {
    const errors = [];

    // 1. 检查 better-sqlite3 预编译文件
    let sqlitePath = path.join(
        PROJECT_ROOT,
        "node_modules",
        "better-sqlite3",
        "build",
        "Release",
        "better_sqlite3.node"
    );
    // 回退检查：如果当前目录没有，检查 WebAI2API 目录
    if (!fs.existsSync(sqlitePath)) {
        const altPath = path.join(
            path.dirname(PROJECT_ROOT),
            "..",
            "WebAI2API",
            "node_modules",
            "better-sqlite3",
            "build",
            "Release",
            "better_sqlite3.node"
        );
        if (fs.existsSync(altPath)) {
            sqlitePath = altPath;
        }
    }
    if (!fs.existsSync(sqlitePath)) {
        errors.push("better-sqlite3 预编译文件缺失，请运行: npm run init");
    }

    // 2. 检查 camoufox-js 补丁（通过 MD5 对比，使用 postinstall.js 导出的补丁列表）
    const patchDir = path.join(PROJECT_ROOT, "patches");
    const targetDir = path.join(PROJECT_ROOT, "node_modules", "camoufox-js", "dist");

    for (const [patchName, targetName] of Object.entries(CAMOUFOX_PATCHES)) {
        const patchPath = path.join(patchDir, patchName);
        const targetPath = path.join(targetDir, targetName);

        const patchHash = getFileMD5(patchPath);
        const targetHash = getFileMD5(targetPath);

        if (!patchHash) {
            // 补丁源文件不存在，跳过检查
            continue;
        }

        if (patchHash !== targetHash) {
            errors.push("camoufox-js 补丁未应用，请运行: pnpm install");
            break; // 只报告一次
        }
    }

    // 3. 检查 Camoufox 可执行文件
    const executablePath = getCamoufoxExecutablePath();
    if (!fs.existsSync(executablePath)) {
        errors.push(`Camoufox 可执行文件缺失，请运行: npm run init`);
    }

    // 4. 检查 version.json
    const resolvedCamoufoxDir = resolveCamoufoxPath(path.join(PROJECT_ROOT, "camoufox"));
    const versionJsonPath = path.join(resolvedCamoufoxDir, "version.json");
    if (!fs.existsSync(versionJsonPath)) {
        errors.push("camoufox/version.json 缺失，请运行: npm run init");
    }

    // 5. 检查 GeoLite2-City.mmdb
    const geoDbPath = path.join(resolvedCamoufoxDir, "GeoLite2-City.mmdb");
    if (!fs.existsSync(geoDbPath)) {
        errors.push("camoufox/GeoLite2-City.mmdb 缺失，请运行: npm run init");
    }

    return {
        ok: errors.length === 0,
        errors
    };
}

/**
 * 执行自检并在失败时退出程序
 */
export function runPreflight() {
    logger.info("服务器", "正在执行自检...");

    const result = preflight();

    if (!result.ok) {
        logger.error("服务器", "自检失败，以下依赖缺失:");
        for (const err of result.errors) {
            logger.error("服务器", `  - ${err}`);
        }
        logger.error("服务器", "提示: 您可以使用 npm run init -- -custom 来自定义初始化步骤");
        // 退出码 78 表示配置/依赖错误，看门狗不应自动重启
        process.exit(78);
    }

    logger.info("服务器", "自检通过");
}
