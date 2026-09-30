"use client"

import Link from 'next/link'
import { useLanguage } from './LanguageProvider'
import LanguageSwitcher from './LanguageSwitcher'

type Decision = {
  id: string
  created_at: string
  input_text: string | null
  reply_text: string | null
  confidence: number | null
  flag_human: boolean | null
  reason: string | null
  tools: unknown
}

export type AgentDashboardData = {
  error: string | null
  total: number
  lowConfidenceCount: number
  humanFlaggedCount: number
  averageConfidence: number | null
  recent: Decision[]
  lowConfidence: Decision[]
  humanFlagged: Decision[]
  humanAttention: Array<{ id: string; contact: string; updated_at: string; reason: string | null }>
  daily: Array<{ created_at: string; confidence: number | null; flag_human: boolean | null }>
}

function formatDate(value: string, language: 'en' | 'ar') {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatConfidence(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${Math.round(value * 100)}%`
}

function describeTools(tools: unknown, emptyLabel: string): string[] {
  if (!Array.isArray(tools) || tools.length === 0) return [emptyLabel]
  return tools.map((tool: unknown) => {
    if (typeof tool === 'string') return tool
    if (tool && typeof tool === 'object') {
      const record = tool as Record<string, unknown>
      const name = record.name ?? record.tool ?? (record.function as Record<string, unknown> | undefined)?.name
      if (typeof name === 'string') return name
      return JSON.stringify(tool)
    }
    return String(tool)
  })
}

function DecisionList({ decisions, emptyText, language, emptyTools }: {
  decisions: Decision[]
  emptyText: string
  language: 'en' | 'ar'
  emptyTools: string
}) {
  const { t } = useLanguage()
  if (decisions.length === 0) return <p className="dashboard-empty">{emptyText}</p>

  return (
    <div className="decision-list">
      {decisions.map((decision) => (
        <article className="decision-item" key={decision.id}>
          <div className="decision-item-header">
            <time dateTime={decision.created_at}>{formatDate(decision.created_at, language)}</time>
            <span className={`confidence ${decision.confidence !== null && decision.confidence < 0.5 ? 'confidence-low' : ''}`}>
              {formatConfidence(decision.confidence)} {t('confidence')}
            </span>
          </div>
          <div className="decision-copy">
            <div><span className="field-label">{t('input')}</span><p>{decision.input_text || t('noInput')}</p></div>
            <div><span className="field-label">{t('reply')}</span><p>{decision.reply_text || t('noReply')}</p></div>
          </div>
          <p className="decision-reason"><span className="field-label">{t('reason')}</span> {decision.reason || t('noReason')}</p>
          <div className="tool-list">{describeTools(decision.tools, emptyTools).map((tool, index) => <span key={`${tool}-${index}`}>{tool}</span>)}</div>
        </article>
      ))}
    </div>
  )
}

export default function AgentDashboardView({ data }: { data: AgentDashboardData }) {
  const { language, t } = useLanguage()
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - (6 - index))
    return date.toISOString().slice(0, 10)
  })
  const dailyByDate = new Map(days.map((day) => [day, { total: 0, flagged: 0, confidenceSum: 0, confidenceCount: 0 }]))

  for (const decision of data.daily) {
    const summary = dailyByDate.get(decision.created_at.slice(0, 10))
    if (!summary) continue
    summary.total += 1
    if (decision.flag_human) summary.flagged += 1
    if (decision.confidence !== null && Number.isFinite(decision.confidence)) {
      summary.confidenceSum += decision.confidence
      summary.confidenceCount += 1
    }
  }

  const summaryCards = [
    { label: t('totalTurns'), value: data.error ? '—' : data.total.toLocaleString(language), detail: t('allDecisions') },
    { label: t('lowConfidence'), value: data.error ? '—' : data.lowConfidenceCount.toLocaleString(language), detail: t('below50') },
    { label: t('flaggedHuman'), value: data.error ? '—' : data.humanFlaggedCount.toLocaleString(language), detail: t('requiresHuman') },
    { label: t('averageConfidence'), value: data.error ? '—' : formatConfidence(data.averageConfidence), detail: t('nonNullScores') },
  ]

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <Link className="dashboard-back" href="/">&larr; {t('backToInbox')}</Link>
          <h1>{t('observability')}</h1>
          <p>{t('decisionQuality')}</p>
        </div>
        <div className="dashboard-header-actions">
          <LanguageSwitcher />
          <form action="/agent-dashboard" method="get">
            <button className="dashboard-refresh" type="submit" aria-label={t('refresh')}>
              <span aria-hidden="true">&#8635;</span> {t('refresh')}
            </button>
          </form>
        </div>
      </header>

      {data.error && <div className="dashboard-error" role="alert"><strong>{t('decisionUnavailable')}</strong> {data.error}</div>}

      <section className="summary-grid" aria-label={t('decisionSummary')}>
        {summaryCards.map((card) => (
          <article className="summary-card" key={card.label}>
            <span className="summary-label">{card.label}</span>
            <strong>{card.value}</strong>
            <span className="summary-detail">{card.detail}</span>
          </article>
        ))}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div><h2>{t('recentDecisions')}</h2><p>{t('newestFirst')}</p></div>
          <span className="section-count">{data.error ? t('unavailable') : `${data.recent.length} ${t('shown')}`}</span>
        </div>
        <div className="table-scroll">
          <table className="decisions-table">
            <thead><tr><th>{t('time')}</th><th>{t('input')}</th><th>{t('reply')}</th><th>{t('confidence')}</th><th>{t('human')}</th><th>{t('reason')}</th><th>{t('tools')}</th></tr></thead>
            <tbody>
              {data.recent.map((decision) => (
                <tr key={decision.id}>
                  <td className="time-cell"><time dateTime={decision.created_at}>{formatDate(decision.created_at, language)}</time></td>
                  <td className="long-cell" title={decision.input_text || ''}>{decision.input_text || '—'}</td>
                  <td className="long-cell" title={decision.reply_text || ''}>{decision.reply_text || '—'}</td>
                  <td><span className={`confidence ${decision.confidence !== null && decision.confidence < 0.5 ? 'confidence-low' : ''}`}>{formatConfidence(decision.confidence)}</span></td>
                  <td>{decision.flag_human === true ? <span className="human-badge">{t('needHuman')}</span> : decision.flag_human === false ? <span className="neutral-badge">{t('noValue')}</span> : <span className="neutral-badge">—</span>}</td>
                  <td className="long-cell" title={decision.reason || ''}>{decision.reason || '—'}</td>
                  <td><div className="tool-list">{describeTools(decision.tools, t('noTools')).map((tool, index) => <span key={`${tool}-${index}`}>{tool}</span>)}</div></td>
                </tr>
              ))}
              {data.recent.length === 0 && <tr><td className="table-empty" colSpan={7}>{data.error ? t('noDecisionData') : t('noDecisions')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div><h2>{t('humanAttentionConversations')}</h2><p>{t('humanAttentionHelp')}</p></div>
          <span className="alert-count">{data.error ? '—' : data.humanAttention.length.toLocaleString(language)}</span>
        </div>
        <div className="table-scroll">
          <table className="attention-conversations-table">
            <thead><tr><th>{t('customer')}</th><th>{t('time')}</th><th>{t('reason')}</th></tr></thead>
            <tbody>
              {data.humanAttention.map((conversation) => (
                <tr key={conversation.id}>
                  <td>{conversation.contact}</td>
                  <td className="time-cell"><time dateTime={conversation.updated_at}>{formatDate(conversation.updated_at, language)}</time></td>
                  <td className="long-cell" title={conversation.reason || ''}>{conversation.reason || t('noReason')}</td>
                </tr>
              ))}
              {data.humanAttention.length === 0 && <tr><td className="table-empty" colSpan={3}>{data.error ? t('noDecisionData') : t('noHumanAttention')}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="attention-grid">
        <section className="dashboard-section attention-section">
          <div className="section-heading"><div><h2>{t('lowConfidence')}</h2><p>{t('lowConfidenceTurns')}</p></div><span className="alert-count">{data.error ? '—' : data.lowConfidenceCount}</span></div>
          <DecisionList decisions={data.lowConfidence} emptyText={data.error ? t('noDecisionData') : t('noLowConfidence')} language={language} emptyTools={t('noTools')} />
        </section>
        <section className="dashboard-section attention-section">
          <div className="section-heading"><div><h2>{t('flaggedHuman')}</h2><p>{t('humanHandoffs')}</p></div><span className="alert-count">{data.error ? '—' : data.humanFlaggedCount}</span></div>
          <DecisionList decisions={data.humanFlagged} emptyText={data.error ? t('noDecisionData') : t('noHumanFlagged')} language={language} emptyTools={t('noTools')} />
        </section>
      </div>

      <section className="dashboard-section health-section">
        <div className="section-heading"><div><h2>{t('healthByDay')}</h2><p>{t('lastSevenDays')}</p></div></div>
        <div className="table-scroll">
          <table className="health-table">
            <thead><tr><th>{t('dateUtc')}</th><th>{t('dailyTotal')}</th><th>{t('dailyAverage')}</th><th>{t('flagged')}</th></tr></thead>
            <tbody>
              {days.map((day) => {
                const summary = dailyByDate.get(day)!
                return <tr key={day}>
                  <td>{new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))}</td>
                  <td>{data.error ? '—' : summary.total.toLocaleString(language)}</td>
                  <td>{data.error || summary.confidenceCount === 0 ? '—' : formatConfidence(summary.confidenceSum / summary.confidenceCount)}</td>
                  <td>{data.error ? '—' : summary.flagged.toLocaleString(language)}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}