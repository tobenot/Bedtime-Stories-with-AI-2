// 归档（存档）相关的纯函数模块
// 注意：不依赖 Vue 组件实例；所有输入输出均显式传入与返回

import { MAX_TITLE_LENGTH, BRANCH_SUFFIX } from '@/config/constants.js'
import { createUuid } from '@/utils/chatData'

export function normalizeText(text) {
  return (text || '').trim()
}

export function getMessageKey(msg) {
  const role = msg && msg.role ? msg.role : ''
  const content = normalizeText(msg && msg.content ? msg.content : '')
  return `${role}:${content}`
}

export function commonPrefixLength(messagesA = [], messagesB = []) {
  const len = Math.min(messagesA.length, messagesB.length)
  for (let i = 0; i < len; i++) {
    if (getMessageKey(messagesA[i]) !== getMessageKey(messagesB[i])) {
      return i
    }
  }
  return len
}

export function areChatsEqual(chatA, chatB) {
  if (!chatA || !chatB) return false
  const a = Array.isArray(chatA.messages) ? chatA.messages : []
  const b = Array.isArray(chatB.messages) ? chatB.messages : []
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (getMessageKey(a[i]) !== getMessageKey(b[i])) return false
  }
  return true
}

export function isPrefixOf(prefixMsgs = [], fullMsgs = []) {
  if (prefixMsgs.length > fullMsgs.length) return false
  for (let i = 0; i < prefixMsgs.length; i++) {
    if (getMessageKey(prefixMsgs[i]) !== getMessageKey(fullMsgs[i])) {
      return false
    }
  }
  return true
}

export function truncateTitleIfNeeded(title) {
  if (!title) return title
  return title.length > MAX_TITLE_LENGTH ? (title.slice(0, MAX_TITLE_LENGTH) + '...') : title
}

export function generateUniqueBranchTitle(baseTitle, existingTitlesIterable) {
  const existingTitles = new Set(existingTitlesIterable || [])
  const base = (baseTitle && baseTitle.trim()) ? baseTitle.trim() : '新对话'
  
  // 首先检查原始标题是否已经存在
  if (!existingTitles.has(base)) {
    return truncateTitleIfNeeded(base)
  }
  
  // 如果原始标题存在，则生成分支标题
  let candidate = base.endsWith(BRANCH_SUFFIX) ? base : `${base}${BRANCH_SUFFIX}`
  if (!existingTitles.has(candidate)) return truncateTitleIfNeeded(candidate)
  let index = 2
  while (existingTitles.has(`${base}（分支${index}）`)) index++
  return truncateTitleIfNeeded(`${base}（分支${index}）`)
}

/**
 * 智能合并导入的会话到现有会话数组。
 * - 去重相同会话
 * - 前缀关系时保留较长
 * - 分歧时新建分支并自动生成标题
 * 该函数会直接修改 existingChats（就地更新）。
 */
export function mergeImportedChats(importedChats = [], existingChats = []) {
  if (!Array.isArray(importedChats) || importedChats.length === 0) return existingChats
  if (!Array.isArray(existingChats)) return importedChats

  for (const importedChat of [...importedChats].reverse()) {
    if (!importedChat || !Array.isArray(importedChat.messages)) {
      continue
    }

    // 在现有对话中寻找与之最接近的会话（最长公共前缀）
    let bestIndex = -1
    let bestPrefixLen = -1
    for (let i = 0; i < existingChats.length; i++) {
      const prefixLen = commonPrefixLength(existingChats[i].messages || [], importedChat.messages || [])
      if (prefixLen > bestPrefixLen) {
        bestPrefixLen = prefixLen
        bestIndex = i
      }
    }

    if (bestIndex >= 0) {
      const target = existingChats[bestIndex]
      const aMsgs = target.messages || []
      const bMsgs = importedChat.messages || []
      const minLen = Math.min(aMsgs.length, bMsgs.length)

      // 完全相同：跳过
      if (aMsgs.length === bMsgs.length && bestPrefixLen === minLen) {
        continue
      }

      // 前缀：保留较长
      if (bestPrefixLen === minLen) {
        if (bMsgs.length > aMsgs.length) {
          target.messages = bMsgs
          if (importedChat.createdAt && (!target.createdAt || importedChat.createdAt < target.createdAt)) {
            target.createdAt = importedChat.createdAt
          }
        }
        continue
      }

      // 分歧：创建分支
      const branched = { ...importedChat }
      branched.id = typeof importedChat.id === 'string' ? importedChat.id : createUuid()
      const titles = existingChats.map(c => c.title)
      const baseTitle = importedChat.title || target.title || '新对话'
      branched.title = generateUniqueBranchTitle(baseTitle, titles)
      existingChats.splice(bestIndex, 0, branched)
      continue
    }

    // 无重叠：追加到前面，但需要确保标题唯一
    const titles = existingChats.map(c => c.title)
    const baseTitle = importedChat.title || '新对话'
    const uniqueTitle = generateUniqueBranchTitle(baseTitle, titles)
    const chatWithUniqueTitle = { ...importedChat, title: uniqueTitle }
    existingChats.unshift(chatWithUniqueTitle)
  }

  return existingChats
}

export function parseArchiveJson(text) {
  const data = JSON.parse(text)

  // 兼容老格式：直接是 chatHistory 数组
  if (Array.isArray(data)) {
    return { chats: data, singleChatOnly: false, meta: {} }
  }

  // 新格式：包含元数据和 chatHistory
  if (data && Array.isArray(data.chatHistory)) {
    const singleChatOnly = Boolean(data.singleChatOnly)
    const meta = typeof data.meta === 'object' && data.meta !== null ? data.meta : {}
    return { chats: data.chatHistory, singleChatOnly, meta }
  }

  throw new Error('导入文件格式错误，应该为聊天历史数组或包含 chatHistory 的对象')
}

