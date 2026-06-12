import { redirect } from 'next/navigation'
import { clearAdminSession } from '@/lib/admin-auth'

export async function GET() {
  await clearAdminSession()
  redirect('/admin')
}
