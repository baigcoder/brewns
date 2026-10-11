import { homeFor, ROLE_INFO } from '@/lib/rbac';
import { currentCustomer, currentStaff } from '@/lib/server/auth';
import { json, route } from '@/lib/server/http';

/**
 * Who is signed in in this browser, for the site's header button: a customer's first name, and/or a team member's
 * name and the screen their role lands on. Customers and staff sign in separately, so both can be present. It reads
 * the browser's own cookies, grants nothing, and says nothing about anyone else.
 */
export const GET = route(async () => {
  const [customer, staff] = await Promise.all([currentCustomer(), currentStaff()]);
  return json({
    customer: customer ? { name: customer.name } : null,
    staff: staff ? { name: staff.user.name, role: staff.role, label: ROLE_INFO[staff.role].label, href: homeFor(staff.role, staff.perms) } : null,
  });
});
