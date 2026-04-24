# Messages 摘出方案（保存链路优化）

> 只解决"每次保存都全量 stringify 整份 chatHistory"这一个最大的性能隐患。
>
> **不做懒加载、不改内存模型、不改 currentChat computed、不动 mergeImportedChats。**
>
> 状态：方案设计稿，待讨论确认。

---

## 一、问题陈述

### 1.1 当前痛点（唯一聚焦点）

`saveChatHistory()` 每次保存时：

```js
// chatMethods.js
async saveChatHistory() {
    this.chatHistory = sortChatsByCreatedTime(this.chatHistory);
    await this.tryPersistChatHistory(this.chatHistory);  // JSON.stringify 整份 → IDB.put 整份
}
```

用户每发一句话、折叠一条推理、甚至 toggle 一个 `isReasoningCollapsed`，都会触发**整份 chatHistory 的 stringify + IDB 写入**。

| 数据量 | stringify 耗时（估） | 风险 |
|---|---|---|
| 30 MB（当前） | ~200ms | 用户几乎无感 |
| 100 MB（1~2 年后） | ~600ms | 偶尔卡顿 |
| 300 MB（极端） | ~2s | 明显卡顿，崩溃风险增大 |

### 1.2 当前不是痛点的东西（本方案不碰）

- **启动时全量加载** — 30MB parse ~300ms，可接受，暂不优化
- **内存占用** — 距浏览器上限还有 20 倍余量，暂不优化
- **mergeImportedChats** — 精细的合并逻辑，不需要改动
- **导入/导出格式** — 保持不变

---

## 二、目标

### 2.1 必须达成

- 保存某个对话时**只写该对话的 messages**，不重写其他对话
- 保存 chat 元数据变更时**只写元数据**，不重写 messages
- 从 O(总历史) 降到 O(单对话)

### 2.2 不改变的东西

- `this.chatHistory` 仍然是内存中完整的数组（包含 messages）
- `currentChat` computed 仍然是 `this.chatHistory.find(...)`
- 切换对话仍然是同步的（messages 已在内存）
- `mergeImportedChats`、`normalizeAndRepairChats` 等纯函数**零改动**
- 导入/导出存档格式不变
- 流式写入路径不变
- 编辑消息路径不变

### 2.3 可接受的代价

- IDB schema 升级到 v2，新增两个 store
- 启动时需从新 store 加载数据重建 chatHistory（与现在的 JSON.parse 类似，但数据源变了）
- 迁移期间首次启动会慢一点（一次性迁移）

---

## 三、设计

### 3.1 IndexedDB Schema 升级

`CHAT_DB_VERSION` 从 `1` → `2`，在 `onupgradeneeded` 里新增两个 store：

```
bs2-chat-db (v2)
  ├─ kv                 (旧 store，保留 current_chat_id)
  │
  ├─ chatMeta           (新 store，对话元数据)
  │     keyPath: id
  │     records: {
  │       id, title, isTitleManuallyEdited,
  │       mode, createdAt, createdAtMs,
  │       protection,
  │       // 注意：不含 messages
  │     }
  │
  └─ messages           (新 store，按对话存消息)
        keyPath: id
        index 'by_chat': chatId
        records: {
          id, chatId,
          role, content, reasoning_content,
          createdAt, createdAtMs,
          isReasoningCollapsed, isCollapsed,
          orderIndex,
          // 其余字段原样保留
        }
```

### 3.2 内存模型（不变！）

```js
// AppCore data — 完全不改
{
  chatHistory: [],      // 仍然是完整的 chat 数组（含 messages）
  currentChatId: null,
}

// currentChat computed — 完全不改
currentChat() {
  return this.chatHistory.find(chat => chat.id === this.currentChatId);
}
```

**关键决策**：内存模型不变意味着所有读取 chatHistory / currentChat 的代码**零改动**。变化只在"写入 IDB"和"从 IDB 加载"两条路径。

### 3.3 写入策略：从全量写变为按需写

废弃 `tryPersistChatHistory`（整份 stringify），替换为三个细粒度方法：

```js
// chatStorage.js 新增
saveChatMeta(chatMeta)              → Promise<void>   // 写 chatMeta store（不含 messages）
saveMessagesForChat(chatId, msgs)   → Promise<void>   // 全量替换某对话的 messages
saveMessage(chatId, msg)            → Promise<void>   // upsert 单条消息
deleteChatData(chatId)              → Promise<void>   // 删 chatMeta + messages
```

### 3.4 `saveChatHistory` 的改造

现有 19 处 `saveChatHistory()` 调用，按实际修改粒度分为三类：

#### 类型 A：只改了元数据（标题、模式、密码等）

| 调用位置 | 实际修改 | 替换为 |
|---|---|---|
| `changeChatTitle` | `chat.title` | `saveChatMeta(chat)` |
| `handleModeChange` | `chat.mode` | `saveChatMeta(chat)` |
| `configureChatProtection` | `chat.protection` | `saveChatMeta(chat)` |
| `removeChatProtection` | `delete chat.protection` | `saveChatMeta(chat)` |
| `loadChatHistory`（mode fallback） | `chat.mode` | `saveChatMeta(chat)` |

#### 类型 B：只改了当前对话的消息

| 调用位置 | 实际修改 | 替换为 |
|---|---|---|
| `@update-chat`（模式组件发送消息后） | 当前对话的 messages 增加了 | `saveMessagesForChat(chatId, msgs)` |
| `saveEditedMessageDialog` | 1 条消息的 content | `saveMessage(chatId, msg)` |
| `confirmRegenerateMessage` | pop + splice 消息 | `saveMessagesForChat(chatId, msgs)` |
| `confirmDeleteMessage` | splice 1 条消息 | `saveMessagesForChat(chatId, msgs)` |
| `toggleReasoning` | 1 条消息的 `isReasoningCollapsed` | `saveMessage(chatId, msg)` |
| `toggleMessageCollapse` | 1 条消息的 `isCollapsed` | `saveMessage(chatId, msg)` |

#### 类型 C：结构性变更（创建/删除/分叉对话）

| 调用位置 | 实际修改 | 替换为 |
|---|---|---|
| `createNewChat` | 新增 1 个 chat | `saveChatMeta(newChat)` |
| `deleteChat` | 删除 1 个 chat | `deleteChatData(chatId)` |
| `forkChatAt` | 新增 1 个 chat + messages | `saveChatMeta(newChat)` + `saveMessagesForChat(newChat.id, msgs)` |
| `loadChatHistory`（自动修复） | 批量修复 | `saveAllChatData(chatHistory)` （全量写，低频） |
| `repairChatData` | 批量修复 | `saveAllChatData(chatHistory)` （全量写，低频） |
| `handleImportFile` | 覆盖或合并 | `saveAllChatData(chatHistory)` （全量写，低频） |
| `pagehide / visibilitychange` | 保底持久化 | `saveCurrentChatMessages()` （只写当前对话） |

#### 兜底：`saveAllChatData`

对于低频的全量操作（导入、修复），提供一个 `saveAllChatData(chatHistory)` 批量写入方法：

```js
async saveAllChatData(chatHistory) {
    // 在单个 IDB 事务中：
    // 1. 清空 chatMeta store + messages store
    // 2. 遍历 chatHistory，拆分写入
    // 这是 O(总历史) 但只在导入/修复时触发
}
```

### 3.5 启动加载路径

```js
async loadChatHistory() {
    // 1. 尝试从新 store 加载
    const allMeta = await loadAllChatMeta();          // chatMeta store → getAll
    if (allMeta.length > 0) {
        // 2. 从 messages store 加载所有消息，按 chatId 分组
        const allMessages = await loadAllMessages();   // messages store → getAll
        const messagesByChatId = groupByChatId(allMessages);
        // 3. 拼回完整的 chatHistory（内存中完整的内联结构）
        this.chatHistory = allMeta.map(meta => ({
            ...meta,
            messages: messagesByChatId[meta.id] || []
        }));
        // 4. 后续流程不变（排序、修复、设置 currentChatId……）
        return;
    }
    // 5. 如果新 store 为空，走旧的 kv 加载 + 迁移流程
    await this.migrateFromLegacy();
}
```

> 注意：启动时仍然全量加载所有 messages 到内存。这是有意的 — 本方案只优化写入，不优化读取。

---

## 四、迁移方案

### 4.1 触发时机

IDB `onupgradeneeded`（version 1 → 2）里建好新 store 后，首次 `loadChatHistory` 时检测：

```
新 chatMeta store 为空 && 旧 kv.chat_history 存在
  → 走迁移
```

### 4.2 迁移流程

```
1. 从 kv 读出旧的 chat_history JSON 字符串
2. JSON.parse → normalizeAndRepairChats（沿用现有修复逻辑）
3. 在单个 IDB 事务中：
   for each chat:
     a. 拆出元数据 → chatMeta store put
     b. 给每条 message 注入 chatId + orderIndex → messages store put
4. 事务提交成功 → 在 kv 中写入 migration_completed_at 时间戳
5. 控制台输出迁移结果
```

### 4.3 message 的 chatId 注入

迁移时需要给每条 message 补上 `chatId` 和 `orderIndex`：

```js
chat.messages.forEach((msg, index) => {
    msg.chatId = chat.id;
    msg.orderIndex = index;
});
```

这是一次性的数据补全，迁移后新增的消息由 `createMessage` 在创建时注入。

### 4.4 `createMessage` 改造

```js
// 改造前
createMessage(role, content, extra = {}) {
    return { id: createUuid(), role, content, createdAt, createdAtMs, ...extra };
}

// 改造后 — 增加 chatId 参数
createMessage(role, content, chatId, extra = {}) {
    return { id: createUuid(), role, content, chatId, createdAt, createdAtMs, ...extra };
}
```

所有调用 `createMessage` 的地方补上 `chatId` 参数。`chatId` 在创建消息时一定是已知的（就是当前对话的 id）。

### 4.5 旧数据保留

- 迁移成功后**不立即删除** `kv.chat_history`
- 记录 `kv.migration_legacy_kept_until` = 当前时间 + 7 天
- 7 天后的某次启动时自动清理
- 这样用户如果回退旧版，7 天内仍可看到数据

### 4.6 失败回滚

- 迁移用单事务，失败自动回滚（IDB 事务天然特性）
- 失败时保留 `kv.chat_history`，下次启动重试
- 连续失败 3 次 → 弹窗提示用户导出存档后联系作者

---

## 五、对外部模块的影响

### 5.1 不需要改的（这是本方案的核心优势）

| 模块 | 原因 |
|---|---|
| `mergeImportedChats` | 操作的是内存中完整的 chatHistory 数组，不涉及 IDB |
| `normalizeAndRepairChats` | 同上 |
| `areChatsEqual` / `isPrefixOf` / `commonPrefixLength` | 同上 |
| `generateUniqueBranchTitle` | 同上 |
| `parseArchiveJson` | 同上 |
| 所有 `provider/*.js` | 只读写 currentChat.messages，内存中 |
| `StandardChatMode` / `DrawMode` | 只操作当前对话 |
| `MessageBubble` / `MarkdownRenderer` | 只渲染 |
| `ChatSidebar` | 只读 chatHistory 的 title/id 等 |
| `pdfExporter` / `txtExporter` | 只看当前对话 |

### 5.2 需要改的

| 模块 | 改动 |
|---|---|
| `chatStorage.js` | 新增 v2 schema、4 个新 API、迁移函数 |
| `chatMethods.js` | `saveChatHistory` 的 19 处调用按粒度替换；`loadChatHistory` 改为从新 store 加载；`createMessage` 增加 chatId 参数 |
| `archiveMethods.js` | `handleImportFile` 的最后一步 `saveChatHistory()` 改为 `saveAllChatData()` |
| `configMethods.js` | `handleModeChange` 的 `saveChatHistory()` 改为 `saveChatMeta()` |
| `AppCore.vue` | `@update-chat` 事件改为触发当前对话的 messages 保存；`pagehide` / `visibilitychange` 改为只保存当前对话 |
| 各模式组件中的 `createMessage` 调用 | 补上 chatId 参数 |

### 5.3 导入/导出流程

**导出**：完全不变。`this.chatHistory` 在内存中是完整的内联结构，直接 stringify 即可。

**导入**：
- 覆盖导入 → 解析文件后赋值给 `this.chatHistory`，然后调用 `saveAllChatData(this.chatHistory)`
- 合并导入 → 调用 `mergeImportedChats`（**不改**），然后调用 `saveAllChatData(this.chatHistory)`
- 导入是低频操作，全量写入可接受

---

## 六、实施清单

### Phase 1：底层存储（不影响现有功能）

- [ ] `chatStorage.js`：v2 schema，新建 `chatMeta` + `messages` store
- [ ] `chatStorage.js`：实现 `saveChatMeta` / `saveMessagesForChat` / `saveMessage` / `deleteChatData` / `saveAllChatData`
- [ ] `chatStorage.js`：实现 `loadAllChatMeta` / `loadAllMessages`
- [ ] `chatStorage.js`：实现 `migrateFromLegacy`（含 chatId 注入 + orderIndex）
- [ ] 测试：迁移、写入、读取

### Phase 2：业务层接入

- [ ] `chatMethods.js`：`loadChatHistory` 改为从新 store 加载 + 拼回内联结构
- [ ] `chatMethods.js`：`createMessage` 增加 chatId 参数
- [ ] `chatMethods.js`：逐一替换 19 处 `saveChatHistory()` 为细粒度调用
- [ ] `configMethods.js`：1 处替换
- [ ] `archiveMethods.js`：2 处替换（导入 + 修复）
- [ ] `AppCore.vue`：`@update-chat` 事件处理改造；pagehide / visibilitychange 改造

### Phase 3：模式组件

- [ ] `StandardChatMode.vue`：`createMessage` 调用补 chatId
- [ ] `DrawMode.vue`：同上
- [ ] 其他模式组件如有直接构造 message 的也需要补

### Phase 4：验证

- [ ] 首次启动迁移测试（从 v1 升级到 v2）
- [ ] 日常使用：发消息、编辑、删除、折叠、分叉 — 确认只写了必要的数据
- [ ] 导入/导出：全量导出 → 全量导入 → 合并导入 → 单对话导入
- [ ] 回退测试：降级回 v1 schema，确认旧数据可用（7 天内）
- [ ] 大数据量测试：300+ 对话的存档在新方案下的保存延迟

---

## 七、性能预期

| 指标 | 现状 | 目标 |
|---|---|---|
| 单次发消息保存延迟 | ~200ms（stringify 30MB） | ~5ms（写 1 条消息 + 更新 meta） |
| 折叠推理/消息保存 | ~200ms（stringify 30MB） | ~2ms（更新 1 条消息的 1 个字段） |
| 创建新对话保存 | ~200ms | ~3ms（写 1 条 meta） |
| 导入存档保存 | ~200ms | ~1s（全量写入，但只在导入时触发） |
| 启动加载时间 | ~300ms | ~300ms（仍全量加载，但数据源从单大 JSON 变为多条记录 getAll） |
| 内存占用 | 不变 | 不变（仍全量驻留） |

---

## 八、风险与对策

| 风险 | 对策 |
|---|---|
| 某处 `saveChatHistory` 替换遗漏，数据不同步 | 全文搜 `saveChatHistory` 确认清零；加 console.warn 兜底 |
| 迁移中断 | 单事务 + 保留旧数据 7 天 |
| 新旧 store 数据不一致（bug） | 启动时做一致性校验（chatMeta 数量 vs messages 的 distinct chatId 数量） |
| `createMessage` 忘记传 chatId | 在 `saveMessage` 里校验 chatId 必须存在，否则 console.error |
| 用户回退旧版 | 旧 `kv.chat_history` 保留 7 天 |

---

## 九、与其他方案的关系

- **本方案是第一期**，只动保存链路，风险最小
- **消息懒加载方案（V1）是第二期**，在本方案基础上改内存模型、加 LRU、做异步切换
- **内容池方案是第三期**，在消息已分行存储后给 messages store 增加 contentRef 字段
- 三个方案**完全解耦**，各自独立可回滚

### 什么时候做第二期？

不需要预估时间点。在启动时加一行埋点：

```js
console.time('[AppCore] chatHistory 加载耗时');
// ... loadChatHistory ...
console.timeEnd('[AppCore] chatHistory 加载耗时');
```

当这个数字超过 1 秒，就是该做第二期的时候。

---

## 十、收益总结

| 目标 | 是否达成 |
|---|---|
| 单次保存从 O(总历史) 降到 O(单对话) | ✅ |
| 不改内存模型 | ✅ |
| 不改 currentChat / chatHistory 的读取方式 | ✅ |
| 不动 mergeImportedChats | ✅ |
| 不破坏导出/导入格式 | ✅ |
| 不破坏流式 / 编辑路径 | ✅ |
| 不破坏加密存档 | ✅ |
| 为第二期（懒加载）铺路 | ✅ |
| 改动量可控 | ✅（主要是 chatStorage.js 新增 + 19 处调用替换） |
