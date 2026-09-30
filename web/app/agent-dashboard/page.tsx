import { redirect } from 'next/navigation'
import { getAgentDashboardData } from '../../lib/supabaseServer'
import { createUserSupabaseServerClient } from '../../lib/supabaseUserServer'
import AgentDashboardView from '../../components/AgentDashboardView'

export const dynamic = 'force-dynamic'

export default async function AgentDashboardPage() {
	const authClient = await createUserSupabaseServerClient()
	const { data: { user }, error } = await authClient.auth.getUser()
	if (error || !user) redirect('/login')
	if (user.app_metadata?.role !== 'admin') redirect('/')

	const data = await getAgentDashboardData()
	return <AgentDashboardView data={data} />
}
