import { AdminLayout } from '@/components/admin/admin-layout'
import { OrdersAdmin } from '@/components/admin/orders-admin'

export default function OrdersAdminPage() {
  return (
    <AdminLayout>
      <OrdersAdmin />
    </AdminLayout>
  )
}
