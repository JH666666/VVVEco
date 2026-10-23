import { GlobalStatsAdmin } from '@/components/admin/global-stats-admin'
import { FundAdjustAdmin } from '@/components/admin/fund-adjust-admin'
import { QueryWhitelistAdmin } from '@/components/admin/query-whitelist-admin'

export default function GlobalStatsAdminPage() {
  return (
    <div className="space-y-6">
      <QueryWhitelistAdmin />
      <FundAdjustAdmin />
      <GlobalStatsAdmin />
    </div>
  )
}
