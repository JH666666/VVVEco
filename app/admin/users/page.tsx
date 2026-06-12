import { AdminLayout } from '@/components/admin/admin-layout'
import { UserAdmin } from '@/components/admin/user-admin'

export default function UserAdminPage() {
  return (
    <AdminLayout>
      <UserAdmin />
    </AdminLayout>
  )
}
