/**
 * @fileoverview 豆包 (Doubao) 文本生成适配器
 */

import { sleep, humanType, safeClick, uploadFilesViaChooser } from "../engine/utils.js";
import { normalizePageError, waitForInput, gotoWithCheck } from "../utils/index.js";
import { logger } from "../../utils/logger.js";
import { extractSessionTitle, urlCheck } from "../../utils/tools.js";

// --- 配置常量 ---
const TARGET_URL = "https://www.doubao.com/chat/";

/**
 * 执行文本生成任务
 * @param {object} context - 浏览器上下文 { page, config }
 * @param {string} prompt - 提示词
 * @param {string[]} imgPaths - 图片路径数组
 * @param {string} [modelId] - 模型 ID
 * @param {object} [meta={}] - 日志元数据
 * @returns {Promise<{text?: string, reasoning?: string, error?: string}>}
 */
async function generate(context, prompt, imgPaths, modelId, meta = {}) {
    const { page, config } = context;
    const waitTimeout = config?.backend?.pool?.waitTimeout ?? 120000;

    // 是否使用深度思考模式
    const useThinking = modelId === "seed-thinking" || modelId === "seed-pro";

    // 模型 ID 到菜单项无障碍名称的正则表达式映射（兼容英文、简繁体中文）
    const MODEL_MENU_MAP = {
        'seed': /Fast Solves most questions|快速 适用于大部分情况|快速 適用於大部分情況/,
        'seed-thinking': /Think Solves more complex problems|思考 擅长解决更难的问题|思考 擅長解決更難的問題/,
        'seed-pro': /Pro Advanced Pro model|专家 研究级智能模型|專家 研究級智慧模型/
    };
    const MODEL_MENU_MAP_SIMPLE = {
        'seed': /Fast|快速|快速/,
        'seed-thinking': /Think|思考|思考/,
        'seed-pro': /Pro|专家|專家/
    };
    try {
        // 检查当前页面 URL，如果不是则跳转
        const currentUrl = page.url();
        logger.debug("适配器", `URL 检查: 当前=${currentUrl}, 目标=${TARGET_URL}`, meta);
        const needsNavigation = !urlCheck(currentUrl, TARGET_URL);
        logger.debug("适配器", `需要跳转: ${needsNavigation}`, meta);
        if (needsNavigation) {
            logger.info("适配器", "跳转到目标页面...", meta);
            await gotoWithCheck(page, TARGET_URL);
            await sleep(2000, 3000);
        } else {
            logger.debug("适配器", "无需跳转，停留在当前页面", meta);
        }
        logger.debug("适配器", `当前页面: ${page.url()}`, meta);

        // 提取会话标题
        const { targetSessionTitle, otherPrompt } = extractSessionTitle(prompt);
        prompt = otherPrompt;

        // 获取历史会话列表
        async function getSessionList() {
            try {
                const container = page.locator("div[data-empty-conversation]");
                await container.waitFor({ state: "attached", timeout: 3000 });
                const sessions = container.locator('div[class^="title-"]');
                const count = await sessions.count();
                const list = [];
                for (let i = 0; i < count; i++) {
                    const title = await sessions.nth(i).textContent();
                    if (title) list.push(title.trim());
                }
                return list;
            } catch {
                return [];
            }
        }

        // 检查当前页面是否在新会话
        async function isNewConversation() {
            try {
                const navElement = page.locator("div.flex-row.flex.flex-1.justify-center.gap-8");
                await navElement.waitFor({ state: "visible", timeout: 2000 });
                const text = await navElement.textContent();
                return text?.includes("新会话");
            } catch {
                return false;
            }
        }

        // 跳转到指定会话
        async function goToConversation(title = "新会话") {
            const btn = page
                .locator("div.flex.flex-row.gap-6.items-center.w-full")
                .filter({ hasText: title });
            await btn.click();
            await sleep(500, 800);
        }

        // 会话管理逻辑
        async function manageSession() {
            if (targetSessionTitle) {
                const list = await getSessionList();
                if (list.length > 0) {
                    const matchedIndex = list.findIndex((t) => t.includes(targetSessionTitle));
                    if (matchedIndex !== -1) {
                        await goToConversation(targetSessionTitle);
                        logger.info("适配器", `跳转到已有会话: ${targetSessionTitle}`, meta);
                        return;
                    }
                }
                if (!(await isNewConversation())) {
                    await goToConversation();
                    logger.info("适配器", `新建会话: ${targetSessionTitle}`, meta);
                    return;
                }
            }
            logger.info("适配器", "继续当前会话", meta);
        }

        await manageSession();

        // 1. 等待输入框加载
        const inputLocator = page.locator("textarea.semi-input-textarea");
        await waitForInput(page, inputLocator, { click: false });

        // 2. 选择模型
        const modelMenuName = MODEL_MENU_MAP[modelId] || MODEL_MENU_MAP["seed"];
        const modelMenuNameSimple = MODEL_MENU_MAP_SIMPLE[modelId] || MODEL_MENU_MAP_SIMPLE["seed"];
        logger.debug("适配器", `选择模型: ${modelId} -> ${String(modelMenuName)}`, meta);
        await sleep(300, 500);

        // 给予 1 秒的缓冲时间等待 React 渲染按钮
        await sleep(1000); // 确保有一定的渲染时间
        const modelSelectorBtn = page
            .locator('#input-engine-container button[aria-haspopup="menu"]')
            .filter({ hasText: /Fast|Think|Pro|快速|思考|专家|專家/ })
            .first();
        const btnText = await modelSelectorBtn.innerText();
        logger.info("豆包", "btnText值", { btnText });
        if (!modelMenuNameSimple.test(btnText)) {
            //如果就是当前菜单项，就不需要去点开菜单了

            let selectorExists = false;
            try {
                await modelSelectorBtn.waitFor({ state: "attached", timeout: 5000 });
                selectorExists = true;
            } catch (e) {
                selectorExists = false;
            }

            if (selectorExists) {
                const menuItem = page.getByRole("menuitem", { name: modelMenuName });
                // 点击模型选择按钮，最多重试 3 次（菜单偶尔不弹出）
                for (let attempt = 1; attempt <= 3; attempt++) {
                    await sleep(500, 1000);
                    await safeClick(page, modelSelectorBtn, { bias: "button" });
                    try {
                        await menuItem.waitFor({ state: "visible", timeout: 3000 });
                        break; // 菜单弹出，退出重试
                    } catch {
                        logger.warn("适配器", `模型菜单未弹出，重试 ${attempt}/3`, meta);
                        if (attempt === 3) throw new Error("模型选择菜单未弹出");
                    }
                }
                await safeClick(page, menuItem, { bias: "button" });
                await sleep(600, 1000); // 留出充足时间等待模型选择浮窗自动关闭，防止遮挡上传图标
            }
        }
        // 3. 上传图片 (如果有)
        if (imgPaths && imgPaths.length > 0) {
            logger.info("适配器", `开始上传 ${imgPaths.length} 张图片...`, meta);

            // 预先拦截 ApplyImageUpload 响应，动态收集实际上传路径
            const expectedUploadPaths = new Set();
            const applyUploadHandler = async (response) => {
                try {
                    const url = response.url();
                    if (!url.includes("Action=ApplyImageUpload") || response.status() !== 200)
                        return;
                    const json = await response.json();
                    const storeUri = json.Result?.UploadAddress?.StoreInfos?.[0]?.StoreUri;
                    if (storeUri) {
                        expectedUploadPaths.add(storeUri);
                        logger.debug("适配器", `已获取上传路径: ${storeUri}`, meta);
                    }
                } catch {
                    /* 忽略解析错误 */
                }
            };
            page.on("response", applyUploadHandler);

            try {
                // 点击上传菜单按钮（排除掉含有模型名称或带有“更多”文案的按钮）
                const uploadMenuBtn = page
                    .locator('#input-engine-container button[aria-haspopup="menu"]')
                    .filter({
                        hasNot: page.locator("text=/Fast|Think|Pro|快速|思考|专家|專家|更多/")
                    })
                    .first();
                await safeClick(page, uploadMenuBtn, { bias: "button" });
                await sleep(300, 500);

                // 点击上传文件选项
                const uploadItem = page.locator('div[role="menuitem"]').filter({
                    hasText: /上传文件或图片|上傳檔案或圖片|Upload File or Image/
                });
                await uploadFilesViaChooser(
                    page,
                    uploadItem,
                    imgPaths,
                    {
                        uploadValidator: (response) => {
                            if (response.status() !== 200 || response.request().method() !== "POST")
                                return false;
                            const url = response.url();
                            for (const path of expectedUploadPaths) {
                                if (url.includes(path)) return true;
                            }
                            return false;
                        }
                    },
                    meta
                );
            } catch (uploadErr) {
                logger.error("适配器", `图片上传失败: ${uploadErr.message}`, meta);
                // 不抛出异常，继续尝试发送纯文本
            } finally {
                page.off("response", applyUploadHandler);
            }

            logger.info("适配器", "图片上传完成", meta);
        }

        // 4. 填写提示词 - 使用 fill 直接填入
        await inputLocator.fill(prompt);

        // 5. 设置 SSE 监听
        logger.debug("适配器", "启动 SSE 监听...", meta);

        let resultText = "";
        let reasoningText = "";
        let isResolved = false;

        const resultPromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    reject(
                        new Error(`API_TIMEOUT: 响应超时 (${Math.round(waitTimeout / 1000)}秒)`)
                    );
                }
            }, waitTimeout);

            // 监听页面响应
            const handleResponse = async (response) => {
                try {
                    const url = response.url();
                    logger.info("适配器", `收到响应: ${url}`, meta);
                    // 只处理 chat/completion 接口的 SSE 响应
                    if (!url.includes("chat/completion")) {
                        logger.info("适配器", "跳过非 chat/completion 响应", meta);
                        return;
                    }
                    logger.info("适配器", "开始处理 SSE 响应", meta);

                    const contentType = response.headers()["content-type"] || "";
                    logger.info("适配器", `content-type: ${contentType}`, meta);
                    if (!contentType.includes("text/event-stream")) {
                        logger.info("适配器", "跳过非 SSE 响应", meta);
                        return;
                    }
                    logger.info("适配器", "读取响应体...", meta);

                    // 读取响应体并解析 SSE
                    const body = await response.text();
                    logger.info("适配器", `响应体长度: ${body.length}`, meta);
                    const result = parseSSEResponse(body, useThinking);

                    if (result.text) {
                        resultText = result.text;
                        reasoningText = result.reasoning || "";
                        logger.info(
                            "适配器",
                            `解析到文本: ${result.text.substring(0, 50)}...`,
                            meta
                        );

                        if (!isResolved) {
                            isResolved = true;
                            clearTimeout(timeoutId);
                            page.off("response", handleResponse);
                            resolve();
                        }
                    }
                } catch (e) {
                    // 忽略解析错误，继续等待
                }
            };

            page.on("response", handleResponse);
        });

        // 6. 点击发送
        const sendBtn = page.locator("button#flow-end-msg-send");
        await sendBtn.waitFor({ state: "visible", timeout: 10000 });
        logger.info("适配器", "点击发送...", meta);
        await safeClick(page, sendBtn, { bias: "button" });

        // 7. 等待响应
        logger.info("适配器", "等待生成结果...", meta);
        await resultPromise;

        if (resultText) {
            logger.info("适配器", `生成完成，文本长度: ${resultText.length}`, meta);
            const result = { text: resultText };
            if (reasoningText) {
                result.reasoning = reasoningText;
            }
            return result;
        } else {
            return { error: "未能从响应中提取文本" };
        }
    } catch (err) {
        const pageError = normalizePageError(err, meta);
        if (pageError) return pageError;

        logger.error("适配器", "生成任务失败", { ...meta, error: err.message });
        return { error: `生成任务失败: ${err.message}` };
    } finally {
    }
}

/**
 * 解析 SSE 响应体，提取最终文本
 * @param {string} body - SSE 响应体
 * @param {boolean} useThinking - 是否使用深度思考模式
 * @returns {{text: string, reasoning?: string}}
 */
function parseSSEResponse(body, useThinking) {
    const lines = body.split("\n");
    let resultText = "";
    let reasoningText = "";
    let inThinkingBlock = false;
    let thinkingBlockId = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 解析事件类型
        if (line.startsWith("event:")) {
            const eventType = line.substring(6).trim();

            // 找到对应的 data 行
            if (i + 1 < lines.length && lines[i + 1].startsWith("data:")) {
                const dataLine = lines[i + 1].substring(5).trim();
                if (!dataLine || dataLine === "{}") continue;

                try {
                    const data = JSON.parse(dataLine);

                    // SSE_REPLY_END with end_type: 1 的 brief 仅作兜底
                    if (eventType === "SSE_REPLY_END" && data.end_type === 1) {
                        const brief = data.msg_finish_attr?.brief || "";
                        if (!resultText && brief) {
                            resultText = brief;
                        }
                    }

                    // STREAM_MSG_NOTIFY 检测深度思考块
                    if (eventType === "STREAM_MSG_NOTIFY") {
                        const blocks = data.content?.content_block || [];
                        for (const block of blocks) {
                            if (block.block_type === 10040 && block.content?.thinking_block) {
                                inThinkingBlock = true;
                                thinkingBlockId = block.block_id;
                            }
                        }
                    }

                    // STREAM_CHUNK 处理内容块
                    if (eventType === "STREAM_CHUNK" && data.patch_op) {
                        for (const op of data.patch_op) {
                            if (op.patch_object === 1 && op.patch_value?.content_block) {
                                for (const block of op.patch_value.content_block) {
                                    // 思考块结束标记
                                    if (block.block_type === 10040 && block.is_finish) {
                                        inThinkingBlock = false;
                                    }
                                    // 思考内容 (parent_id 指向 thinking_block)
                                    if (useThinking && block.parent_id === thinkingBlockId) {
                                        const text = block.content?.text_block?.text || "";
                                        if (text) reasoningText += text;
                                    }
                                    // 正文内容 (block_type 10000，非思考子块)
                                    else if (
                                        block.block_type === 10000 &&
                                        block.parent_id !== thinkingBlockId
                                    ) {
                                        const text = block.content?.text_block?.text || "";
                                        if (text) resultText += text;
                                    }
                                }
                            }
                        }
                    }

                    // CHUNK_DELTA 增量文本
                    if (eventType === "CHUNK_DELTA") {
                        const text = data.text || "";
                        if (text) {
                            if (useThinking && inThinkingBlock) {
                                reasoningText += text;
                            } else {
                                resultText += text;
                            }
                        }
                    }
                } catch (e) {
                    // JSON 解析失败，跳过
                }
            }
        }
    }

    return { text: resultText, reasoning: reasoningText };
}

/**
 * 适配器 manifest
 */
export const manifest = {
    id: "doubao_text",
    displayName: "豆包 (文本生成)",
    description: "使用字节跳动豆包生成文本，支持深度思考模式和图片上传。需要已登录的豆包账户。",

    getTargetUrl(config, workerConfig) {
        return TARGET_URL;
    },

    models: [
        { id: "seed", imagePolicy: "optional", type: "text" },
        { id: "seed-thinking", imagePolicy: "optional", type: "text" },
        { id: "seed-pro", imagePolicy: "optional", type: "text" }
    ],

    navigationHandlers: [],

    generate
};
