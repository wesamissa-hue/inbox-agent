import { createClient } from '@supabase/supabase-js'

const targetUserId = '8c9ccd6c-7db4-4e90-8462-8a62e70c9952'
const targetEmail = 'admin@ideeps.com'
const applyChanges = process.argv.includes('--apply')

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and a server-only SUPABASE_SERVICE_ROLE_KEY in the local environment.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await supabase.auth.admin.getUserById(targetUserId)
if (error) {
  if (error.status === 401) {
    console.error('Supabase Auth Admin rejected this key. Configure a valid server-only service_role JWT as SUPABASE_SERVICE_ROLE_KEY. No changes were made.')
    process.exit(1)
  }
  console.error(`Supabase Auth Admin lookup failed${error.status ? ` (HTTP ${error.status})` : ''}: ${error.message}`)
  process.exit(1)
}

const user = data.user
if (user.id !== targetUserId || user.email?.toLowerCase() !== targetEmail) {
  console.error('The supplied UID did not resolve to the expected email. No changes were made.')
  process.exit(1)
}

if (user.app_metadata?.role === 'admin') {
  console.log('The target Auth user already has app_metadata.role=admin. No changes were needed.')
  process.exit(0)
}

if (!applyChanges) {
  console.log(`Verified target ${targetEmail} (${targetUserId}); current role: ${user.app_metadata?.role || 'unset'}. No changes made.`)
  console.log('Pass --apply to set app_metadata.role=admin for this exact user.')
  process.exit(0)
}

const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(targetUserId, {
  app_metadata: { ...user.app_metadata, role: 'admin' },
})

if (updateError) {
  console.error(`Supabase Auth Admin update failed${updateError.status ? ` (HTTP ${updateError.status})` : ''}: ${updateError.message}`)
  process.exit(1)
}

if (updateData.user.id !== targetUserId
  || updateData.user.email?.toLowerCase() !== targetEmail
  || updateData.user.app_metadata?.role !== 'admin') {
  console.error('The Auth Admin API did not confirm the expected role. Verify the user in Supabase Auth.')
  process.exit(1)
}

console.log(`Verified app_metadata.role=admin for ${targetEmail} (${targetUserId}).`)