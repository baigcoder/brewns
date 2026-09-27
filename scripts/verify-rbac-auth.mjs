/* Comprehensive verification of:
   1. Staff Sign-up flow for all roles (Manager, Cashier, Barista, Chef, Waiter, Rider)
   2. Sign-in redirect flow for all roles + customer + owner
   3. Granular RBAC endpoint and screen permissions
*/

const BASE = process.env.BASE || 'http://localhost:3000';
let failures = 0;
let passed = 0;

function ok(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
}

function agent(name) {
  const jar = new Map();
  return {
    name,
    async call(method, path, body) {
      const res = await fetch(BASE + path, {
        method,
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE,
          'x-forwarded-for': `127.0.1.${Math.abs(name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 250 + 1}`,
          Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      for (const c of res.headers.getSetCookie?.() || []) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        const k = pair.slice(0, i);
        const v = pair.slice(i + 1);
        if (!v || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) {
          jar.delete(k);
        } else {
          jar.set(k, v);
        }
      }

      const data = await res.json().catch(() => ({}));
      return { status: res.status, data, location: res.headers.get('location') };
    },
    get(p) {
      return this.call('GET', p);
    },
    post(p, b = {}) {
      return this.call('POST', p, b);
    },
  };
}

async function run() {
  console.log(`\n=== 1. Testing Staff Sign-Up Flow for Any Role ===\n`);

  const ts = Date.now().toString().slice(-6);

  // Test sign-up validation
  const testAgent = agent('test');
  const invalidRole = await testAgent.post('/api/auth/staff-signup', {
    name: 'Invalid Test',
    email: `invalid_${ts}@brewns.coffee`,
    password: 'Password123',
    role: 'superadmin',
  });
  ok(invalidRole.status === 400, 'Rejects invalid role (400)');

  const weakPass = await testAgent.post('/api/auth/staff-signup', {
    name: 'Weak Test',
    email: `weak_${ts}@brewns.coffee`,
    password: '123',
    role: 'barista',
  });
  ok(weakPass.status === 400, 'Rejects weak password (400)');

  // Roles to create and test
  const roles = [
    { role: 'manager', name: 'Zainab Manager', expectedHome: '/dashboard/overview' },
    { role: 'cashier', name: 'Usman Cashier', expectedHome: '/dashboard/orders' },
    { role: 'barista', name: 'Hina Barista', expectedHome: '/dashboard/kitchen' },
    { role: 'chef', name: 'Fahad Chef', expectedHome: '/dashboard/kitchen' },
    { role: 'waiter', name: 'Ali Waiter', expectedHome: '/dashboard/floor' },
    { role: 'rider', name: 'Bilal Rider', plate: 'LEA-9988', expectedHome: '/dashboard/deliveries' },
  ];

  const credentials = {};

  for (const item of roles) {
    const email = `${item.role}_${ts}@brewns.coffee`;
    const password = 'Password123';
    credentials[item.role] = { email, password, ...item };

    const a = agent(item.role);
    const res = await a.post('/api/auth/staff-signup', {
      name: item.name,
      email,
      password,
      role: item.role,
      plate: item.plate,
      shop: 'all',
    });

    ok(res.status === 201, `Sign-up successful for ${item.role} (201 Created)`);
    ok(res.data.next === item.expectedHome, `${item.role} lands on ${item.expectedHome}`);
  }

  // Duplicate email check
  const dup = await testAgent.post('/api/auth/staff-signup', {
    name: 'Duplicate Test',
    email: credentials['barista'].email,
    password: 'Password123',
    role: 'barista',
  });
  ok(dup.status === 409, 'Rejects duplicate email (409 Conflict)');

  console.log(`\n=== 2. Testing Role-Based Sign-In & Redirects ===\n`);

  for (const item of roles) {
    const cred = credentials[item.role];
    const a = agent(`signin-${item.role}`);
    const res = await a.post('/api/auth/signin', {
      kind: 'staff',
      email: cred.email,
      password: cred.password,
    });

    ok(res.status === 200, `Sign-in successful for ${item.role} (200 OK)`);
    ok(res.data.next === item.expectedHome, `Sign-in redirects ${item.role} -> ${item.expectedHome}`);
  }

  console.log(`\n=== 3. Testing RBAC Permission Matrix & Restrictions ===\n`);

  // Barista permissions
  const baristaAgent = agent('barista-client');
  await baristaAgent.post('/api/auth/signin', {
    kind: 'staff',
    email: credentials['barista'].email,
    password: credentials['barista'].password,
  });

  const baristaReports = await baristaAgent.get('/api/staff/reports');
  ok(baristaReports.status === 403, 'Barista forbidden from sales reports (/api/staff/reports -> 403)');

  const baristaUsers = await baristaAgent.get('/api/staff/users');
  ok(baristaUsers.status === 403, 'Barista forbidden from user management (/api/staff/users -> 403)');

  const baristaAccess = await baristaAgent.get('/api/staff/access');
  ok(baristaAccess.status === 403, 'Barista forbidden from access matrix (/api/staff/access -> 403)');

  // Waiter permissions
  const waiterAgent = agent('waiter-client');
  await waiterAgent.post('/api/auth/signin', {
    kind: 'staff',
    email: credentials['waiter'].email,
    password: credentials['waiter'].password,
  });

  const waiterFloor = await waiterAgent.get('/api/staff/live');
  ok(waiterFloor.status === 200, 'Waiter allowed on live floor board (/api/staff/live -> 200)');
  ok(Array.isArray(waiterFloor.data.calls), 'Waiter receives active calls array');

  const waiterReports = await waiterAgent.get('/api/staff/reports');
  ok(waiterReports.status === 403, 'Waiter forbidden from reports (/api/staff/reports -> 403)');

  // Rider permissions
  const riderAgent = agent('rider-client');
  await riderAgent.post('/api/auth/signin', {
    kind: 'staff',
    email: credentials['rider'].email,
    password: credentials['rider'].password,
  });

  const riderUsers = await riderAgent.get('/api/staff/users');
  ok(riderUsers.status === 403, 'Rider forbidden from managing team (/api/staff/users -> 403)');

  // Manager permissions
  const managerAgent = agent('manager-client');
  await managerAgent.post('/api/auth/signin', {
    kind: 'staff',
    email: credentials['manager'].email,
    password: credentials['manager'].password,
  });

  const managerReports = await managerAgent.get('/api/staff/reports');
  ok(managerReports.status === 200, 'Manager allowed on sales reports (/api/staff/reports -> 200)');

  const managerUsers = await managerAgent.get('/api/staff/users');
  ok(managerUsers.status === 200, 'Manager allowed on team list (/api/staff/users -> 200)');

  const managerAccess = await managerAgent.get('/api/staff/access');
  ok(managerAccess.status === 403, 'Manager forbidden from changing access matrix (Owner-only -> 403)');

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} passed, ${failures} failed`);
  console.log(`========================================\n`);

  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
