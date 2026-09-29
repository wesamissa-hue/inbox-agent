import 'server-only'

import { createClient } from '@supabase/supabase-js'

type Decision = {
  id: string
  created_at: string
  conversation_id: string | null
  input_text: string | null
  reply_text: string | null
  confidence: number | null
  flag_human: boolean | null
  reason: string | null
  tools: unknown
  model: string | null
  latency_ms: number | null
}

function createServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url) throw new Error('Missing Supabase URL. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_KEY. Add it to the server environment for web; never use a NEXT_PUBLIC_ variable for this key.')

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const decisionColumns = 'id,created_at,conversation_id,input_text,reply_text,confidence,flag_human,reason,tools,model,latency_ms'

export async function getAgentDashboardData() {
  try {
    const supabase = createServerSupabase()
    const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
    const [totalResult, lowCountResult, humanCountResult, recentResult, lowResult, humanResult, dailyResult] = await Promise.all([
      supabase.from('agent_decisions').select('id', { count: 'exact', head: true }),
      supabase.from('agent_decisions').select('id', { count: 'exact', head: true }).lt('confidence', 0.5),
      supabase.from('agent_decisions').select('id', { count: 'exact', head: true }).eq('flag_human', true),
      supabase.from('agent_decisions').select(decisionColumns).order('created_at', { ascending: false }).limit(25),
      supabase.from('agent_decisions').select(decisionColumns).lt('confidence', 0.5).order('created_at', { ascending: false }).limit(8),
      supabase.from('agent_decisions').select(decisionColumns).eq('flag_human', true).order('created_at', { ascending: false }).limit(8),
      supabase.from('agent_decisions').select('created_at,confidence,flag_human').gte('created_at', since).order('created_at', { ascending: false }).range(0, 999),
    ])

    const failed = [totalResult, lowCountResult, humanCountResult, recentResult, lowResult, humanResult, dailyResult]
      .find((result) => result.error)
    if (failed?.error) throw failed.error

    const dailyRows = [...(dailyResult.data || [])] as Array<Pick<Decision, 'created_at' | 'confidence' | 'flag_human'>>
    for (let offset = 1000; dailyRows.length % 1000 === 0 && dailyRows.length > 0; offset += 1000) {
      const { data, error } = await supabase
        .from('agent_decisions')
        .select('created_at,confidence,flag_human')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .range(offset, offset + 999)
      if (error) throw error
      const page = data || []
      dailyRows.push(...page as Array<Pick<Decision, 'created_at' | 'confidence' | 'flag_human'>>)
      if (page.length < 1000) break
    }

    let confidenceTotal = 0
    let confidenceCount = 0
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from('agent_decisions')
        .select('confidence')
        .range(offset, offset + 999)
      if (error) throw error
      const page = (data || []) as Array<{ confidence: number | null }>
      for (const row of page) {
        if (row.confidence !== null && Number.isFinite(row.confidence)) {
          confidenceTotal += row.confidence
          confidenceCount += 1
        }
      }
      if (page.length < 1000) break
    }

    return {
      error: null,
      total: totalResult.count || 0,
      lowConfidenceCount: lowCountResult.count || 0,
      humanFlaggedCount: humanCountResult.count || 0,
      averageConfidence: confidenceCount ? confidenceTotal / confidenceCount : null,
      recent: (recentResult.data || []) as Decision[],
      lowConfidence: (lowResult.data || []) as Decision[],
      humanFlagged: (humanResult.data || []) as Decision[],
      daily: dailyRows,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'An unexpected Supabase error occurred.',
      total: 0,
      lowConfidenceCount: 0,
      humanFlaggedCount: 0,
      averageConfidence: null,
      recent: [] as Decision[],
      lowConfidence: [] as Decision[],
      humanFlagged: [] as Decision[],
      daily: [] as Array<Pick<Decision, 'created_at' | 'confidence' | 'flag_human'>>,
    }
  }
}
