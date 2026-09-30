export type Priority = 'High' | 'Medium' | 'Low'

type PrioritySignals = {
  status: string
  last_message: string | null
}

const urgentLanguage = /\b(urgent|asap|immediately|emergency|critical|still not working|cannot access|can't access|cannot log in|can't log in|locked out|charged twice|fraud|not resolved|unresolved|never resolved|not fixed|still broken)\b/i
const resolvedLanguage = /\b(resolved|fixed now|working again|issue is fixed|all set now|no further help needed)\b/i

export function getConversationPriority(conversation: PrioritySignals): Priority {
  const latestText = conversation.last_message || ''
  if (conversation.status === 'needs_human' || urgentLanguage.test(latestText)) return 'High'
  if (resolvedLanguage.test(latestText)) return 'Low'
  return 'Medium'
}