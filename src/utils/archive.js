// 归档（存档）相关的纯函数模块
// 注意：不依赖 Vue 组件实例；所有输入输出均显式传入与返回

import { MAX_TITLE_LENGTH, BRANCH_SUFFIX } from '@/config/constants.js'

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
  return getDisplayLength(title) > MAX_TITLE_LENGTH ? (truncateByDisplayLength(title, MAX_TITLE_LENGTH) + '...') : title
}

export function getDisplayLength(text = '') {
  let length = 0
  for (const char of String(text)) {
    const codePoint = char.codePointAt(0) || 0
    length += codePoint <= 0x00ff ? 0.5 : 1
  }
  return length
}

export function truncateByDisplayLength(text = '', maxLength = MAX_TITLE_LENGTH) {
  if (maxLength <= 0) return ''
  let result = ''
  let length = 0
  for (const char of String(text)) {
    const codePoint = char.codePointAt(0) || 0
    const charLength = codePoint <= 0x00ff ? 0.5 : 1
    if (length + charLength > maxLength) break
    result += char
    length += charLength
  }
  return result
}

export function generateUniqueBranchTitle(baseTitle, forceBranch = false) {
  const title = (baseTitle && baseTitle.trim()) ? baseTitle.trim() : '新对话'
  
  const match = title.match(/^(.+?)（分支(\d+)?）$/)
  
  if (match) {
    const base = match[1]
    const currentIndex = match[2] ? parseInt(match[2], 10) : 1
    const nextIndex = currentIndex + 1
    const suffixWithNumber = `（分支${nextIndex}）`
    const maxSuffixLength = getDisplayLength(suffixWithNumber)
    const maxBaseLength = Math.max(0, MAX_TITLE_LENGTH - maxSuffixLength)
    const trimmedBase = truncateByDisplayLength(base, maxBaseLength)
    return `${trimmedBase}${suffixWithNumber}`
  }
  
  if (!forceBranch) {
    return truncateTitleIfNeeded(title)
  }
  
  const maxSuffixLength = getDisplayLength(BRANCH_SUFFIX)
  const maxBaseLength = Math.max(0, MAX_TITLE_LENGTH - maxSuffixLength)
  const trimmedTitle = truncateByDisplayLength(title, maxBaseLength)
  return `${trimmedTitle}${BRANCH_SUFFIX}`
}

export function mergeImportedChats(importedChats = [], existingChats = []) {
  if (!Array.isArray(importedChats) || importedChats.length === 0) return existingChats
  if (!Array.isArray(existingChats)) return importedChats

  const normalizeTitle = (value) => (typeof value === 'string' ? value.trim() : '')
  const getDefaultAutoTitle = (chat) => {
    const messages = Array.isArray(chat?.messages) ? chat.messages : []
    const firstUserMessage = messages.find(msg => msg?.role === 'user')
    const firstContent = normalizeText(firstUserMessage?.content || '')
    if (!firstContent) return '新对话'
    return firstContent.length > 20 ? `${firstContent.slice(0, 20)}...` : firstContent
  }
  const isManualTitle = (chat) => {
    const title = normalizeTitle(chat?.title)
    if (!title || title === '新对话') return false
    return title !== getDefaultAutoTitle(chat)
  }
  const pickMergedTitle = (existingChat, importedChat) => {
    const existingTitle = normalizeTitle(existingChat?.title)
    const importedTitle = normalizeTitle(importedChat?.title)
    const existingManual = isManualTitle(existingChat)
    const importedManual = isManualTitle(importedChat)
    if (existingManual && !importedManual) return existingTitle || existingChat?.title || '新对话'
    if (importedManual && !existingManual) return importedTitle || importedChat?.title || existingTitle || '新对话'
    if (existingManual && importedManual) return existingTitle || importedTitle || '新对话'
    if (existingTitle && existingTitle !== '新对话' && (!importedTitle || importedTitle === '新对话')) return existingTitle
    if (importedTitle && importedTitle !== '新对话' && (!existingTitle || existingTitle === '新对话')) return importedTitle
    return existingTitle || importedTitle || '新对话'
  }

  const existingById = new Map()
  for (let i = 0; i < existingChats.length; i++) {
    const chatId = typeof existingChats[i]?.id === 'string' ? existingChats[i].id : ''
    if (!chatId) continue
    existingById.set(chatId, existingChats[i])
  }

  for (const importedChat of [...importedChats].reverse()) {
    if (!importedChat || !Array.isArray(importedChat.messages)) {
      continue
    }
    const importedId = typeof importedChat.id === 'string' ? importedChat.id : ''
    const target = importedId ? existingById.get(importedId) : undefined
    if (target) {
      const targetMessages = Array.isArray(target?.messages) ? target.messages : []
      const importedMessages = Array.isArray(importedChat.messages) ? importedChat.messages : []
      const mergedTitle = pickMergedTitle({ ...target, messages: targetMessages }, importedChat)
      if (importedMessages.length > targetMessages.length) {
        target.messages = importedMessages
      }
      target.title = mergedTitle
      if (importedChat.createdAt && (!target.createdAt || importedChat.createdAt < target.createdAt)) {
        target.createdAt = importedChat.createdAt
      }
      if (importedChat.createdAtMs && (!target.createdAtMs || importedChat.createdAtMs < target.createdAtMs)) {
        target.createdAtMs = importedChat.createdAtMs
      }
      continue
    }

    const baseTitle = importedChat.title || '新对话'
    const uniqueTitle = generateUniqueBranchTitle(baseTitle)
    const chatWithUniqueTitle = { ...importedChat, title: uniqueTitle }
    existingChats.unshift(chatWithUniqueTitle)
    const nextId = typeof chatWithUniqueTitle.id === 'string' ? chatWithUniqueTitle.id : ''
    if (nextId) {
      existingById.set(nextId, chatWithUniqueTitle)
    }
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

