import { MainLayout } from '@/components/layout/main-layout'
import { TeamMatrix } from '@/components/team/team-matrix'

export const dynamic = 'force-dynamic'

export default function TeamPage() {
  return (
    <MainLayout>
      <TeamMatrix />
    </MainLayout>
  )
}
