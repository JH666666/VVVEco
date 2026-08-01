import { GlobalStatsAdmin } from '@/components/admin/global-stats-admin'
import { FundAdjustAdmin } from '@/components/admin/fund-adjust-admin'

export default function GlobalStatsAdminPage() {
  return (
    <div className="space-y-6">
      <FundAdjustAdmin />
      <GlobalStatsAdmin />
    </div>
  )
}
