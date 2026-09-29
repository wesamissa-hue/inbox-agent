import Link from 'next/link'
import { getAgentDashboardData } from '../../lib/supabaseServer'

export const dynamic = 'force-dynamic'

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

function formatDate(value: string) {
	return new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(value))
}

function formatConfidence(value: number | null) {
	return value === null || !Number.isFinite(value) ? '—' : `${Math.round(value * 100)}%`
}

function describeTools(tools: unknown): string[] {
	if (!Array.isArray(tools) || tools.length === 0) return ['No tools']
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

function DecisionList({ decisions, emptyText }: { decisions: Decision[]; emptyText: string }) {
	if (decisions.length === 0) return <p className="dashboard-empty">{emptyText}</p>

	return (
		<div className="decision-list">
			{decisions.map((decision) => (
				<article className="decision-item" key={decision.id}>
					<div className="decision-item-header">
						<time dateTime={decision.created_at}>{formatDate(decision.created_at)}</time>
						<span className={`confidence ${decision.confidence !== null && decision.confidence < 0.5 ? 'confidence-low' : ''}`}>
							{formatConfidence(decision.confidence)} confidence
						</span>
					</div>
					<div className="decision-copy">
						<div><span className="field-label">Input</span><p>{decision.input_text || 'No input recorded'}</p></div>
						<div><span className="field-label">Reply</span><p>{decision.reply_text || 'No reply recorded'}</p></div>
					</div>
					<p className="decision-reason"><span className="field-label">Reason</span> {decision.reason || 'No reason recorded'}</p>
				</article>
			))}
		</div>
	)
}

export default async function AgentDashboardPage() {
	const data = await getAgentDashboardData()
	const days = Array.from({ length: 7 }, (_, index) => {
		const date = new Date()
		date.setUTCHours(0, 0, 0, 0)
		date.setUTCDate(date.getUTCDate() - (6 - index))
		return date.toISOString().slice(0, 10)
	})
	const dailyByDate = new Map(days.map((day) => [day, { total: 0, flagged: 0, confidenceSum: 0, confidenceCount: 0 }]))

	for (const decision of data.daily) {
		const date = decision.created_at.slice(0, 10)
		const summary = dailyByDate.get(date)
		if (!summary) continue
		summary.total += 1
		if (decision.flag_human) summary.flagged += 1
		if (decision.confidence !== null && Number.isFinite(decision.confidence)) {
			summary.confidenceSum += decision.confidence
			summary.confidenceCount += 1
		}
	}

	const summaryCards = [
		{ label: 'Total Turns', value: data.error ? '—' : data.total.toLocaleString(), detail: 'All recorded decisions' },
		{ label: 'Low Confidence', value: data.error ? '—' : data.lowConfidenceCount.toLocaleString(), detail: 'Confidence below 50%' },
		{ label: 'Flagged to Human', value: data.error ? '—' : data.humanFlaggedCount.toLocaleString(), detail: 'Requires human review' },
		{ label: 'Average Confidence', value: data.error ? '—' : formatConfidence(data.averageConfidence), detail: 'Across non-null scores' },
	]

	return (
		<main className="dashboard-page">
			<header className="dashboard-header">
				<div>
					<Link className="dashboard-back" href="/">&larr; Team Inbox</Link>
					<h1>Agent observability</h1>
					<p>Decision quality and handoff activity</p>
				</div>
				<form action="/agent-dashboard" method="get">
					<button className="dashboard-refresh" type="submit" aria-label="Refresh dashboard data">
						<span aria-hidden="true">&#8635;</span> Refresh
					</button>
				</form>
			</header>

			{data.error && (
				<div className="dashboard-error" role="alert">
					<strong>Unable to load agent decisions.</strong> {data.error}
				</div>
			)}

			<section className="summary-grid" aria-label="Decision summary">
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
					<div><h2>Recent decisions</h2><p>Newest agent turns first</p></div>
					<span className="section-count">{data.error ? 'Unavailable' : `${data.recent.length} shown`}</span>
				</div>
				<div className="table-scroll">
					<table className="decisions-table">
						<thead><tr><th>Time</th><th>Input</th><th>Reply</th><th>Confidence</th><th>Human</th><th>Reason</th><th>Tools</th></tr></thead>
						<tbody>
							{data.recent.map((decision: Decision) => (
								<tr key={decision.id}>
									<td className="time-cell"><time dateTime={decision.created_at}>{formatDate(decision.created_at)}</time></td>
									<td className="long-cell" title={decision.input_text || ''}>{decision.input_text || '—'}</td>
									<td className="long-cell" title={decision.reply_text || ''}>{decision.reply_text || '—'}</td>
									<td><span className={`confidence ${decision.confidence !== null && decision.confidence < 0.5 ? 'confidence-low' : ''}`}>
										{formatConfidence(decision.confidence)}
									</span></td>
									<td>{decision.flag_human === true
										? <span className="human-badge">NEED HUMAN</span>
										: decision.flag_human === false
											? <span className="neutral-badge">No</span>
											: <span className="neutral-badge">—</span>}
									</td>
									<td className="long-cell" title={decision.reason || ''}>{decision.reason || '—'}</td>
									<td><div className="tool-list">{describeTools(decision.tools).map((tool, index) => <span key={`${tool}-${index}`}>{tool}</span>)}</div></td>
								</tr>
							))}
							{data.recent.length === 0 && <tr><td className="table-empty" colSpan={7}>{data.error ? 'Decision data is unavailable.' : 'No decisions yet.'}</td></tr>}
						</tbody>
					</table>
				</div>
			</section>

			<div className="attention-grid">
				<section className="dashboard-section attention-section">
					<div className="section-heading"><div><h2>Low confidence</h2><p>Recent turns below 50%</p></div><span className="alert-count">{data.error ? '—' : data.lowConfidenceCount}</span></div>
					<DecisionList decisions={data.lowConfidence} emptyText={data.error ? 'Decision data is unavailable.' : 'No low-confidence decisions.'} />
				</section>
				<section className="dashboard-section attention-section">
					<div className="section-heading"><div><h2>Human flagged</h2><p>Recent handoffs for review</p></div><span className="alert-count">{data.error ? '—' : data.humanFlaggedCount}</span></div>
					<DecisionList decisions={data.humanFlagged} emptyText={data.error ? 'Decision data is unavailable.' : 'No human-flagged decisions.'} />
				</section>
			</div>

			<section className="dashboard-section health-section">
				<div className="section-heading"><div><h2>Health by day</h2><p>Recent seven-day activity</p></div></div>
				<div className="table-scroll">
					<table className="health-table">
						<thead><tr><th>Date (UTC)</th><th>Total turns</th><th>Average confidence</th><th>Flagged</th></tr></thead>
						<tbody>
							{days.map((day) => {
								const summary = dailyByDate.get(day)!
								return <tr key={day}>
									<td>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`))}</td>
									<td>{data.error ? '—' : summary.total}</td>
									<td>{data.error || summary.confidenceCount === 0 ? '—' : formatConfidence(summary.confidenceSum / summary.confidenceCount)}</td>
									<td>{data.error ? '—' : summary.flagged}</td>
								</tr>
							})}
						</tbody>
					</table>
				</div>
			</section>
		</main>
	)
}
