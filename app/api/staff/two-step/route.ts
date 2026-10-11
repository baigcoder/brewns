import { requireStaff, verifyPassword } from '@/lib/server/auth';
import { audit, readAudit } from '@/lib/server/audit';
import { clientIp, fail, json, rateLimit, readBody, route, str } from '@/lib/server/http';
import { beginEnrol, checkSecondFactor, confirmEnrol, newRecovery, switchOff } from '@/lib/server/twostep';

/** Your own two-step sign-in: its state, and your recent sign-in activity. */
export const GET = route(async () => {
  const ctx = await requireStaff();
  const t = ctx.user.totp;
  const mine = (await readAudit(500)).filter((e) => e.uid === ctx.user.id && e.kind === 'security').slice(0, 8);
  return json({
    enabled: !!t?.on,
    pending: !!t && !t.on,
    since: t?.on ? t.since : 0,
    recoveryLeft: t?.on ? t.recovery.length : 0,
    lastLoginAt: ctx.user.lastLoginAt,
    events: mine.map(({ t, action, detail }) => ({ t, action, detail })),
  });
});

/**
 * `{ action: 'start', password }` begins set-up and returns the QR code.
 * `{ action: 'confirm', code }` proves the app works, switches it on and returns the recovery codes (once).
 * `{ action: 'disable', password, code }` and `{ action: 'recovery', password, code }` need the password and a current code.
 */
export const POST = route(async (req) => {
  const ctx = await requireStaff();
  await rateLimit(`2fa-manage:${ctx.user.id}:${clientIp(req)}`, 12, 900);
  const b = await readBody(req);
  const actor = { id: ctx.user.id, name: ctx.user.name, role: ctx.role };
  const action = str(b.action, 20);

  const needPassword = async () => {
    if (!(await verifyPassword(String(b.password || ''), ctx.user.passHash))) fail(403, "Your password isn't right.");
  };

  if (action === 'start') {
    await needPassword();
    return json(await beginEnrol(ctx.user));
  }

  if (action === 'confirm') {
    const { user, recovery } = await confirmEnrol(ctx.user, str(b.code, 12));
    await audit(actor, 'Turned on two-step sign-in', `${user.totp?.recovery.length ?? 0} recovery codes issued`, 'security');
    return json({ recovery });
  }

  if (action === 'disable' || action === 'recovery') {
    await needPassword();
    if (ctx.user.totp?.on) {
      if (!(await checkSecondFactor(ctx.user, str(b.code, 24)))) {
        await audit(actor, `Wrong two-step code while ${action === 'disable' ? 'turning it off' : 'making new recovery codes'}`, '', 'security');
        fail(403, "That code isn't right.");
      }
    }
    if (action === 'disable') {
      await switchOff(ctx.user);
      await audit(actor, 'Turned off two-step sign-in', '', 'security');
      return json({ ok: true });
    }
    const { recovery } = await newRecovery(ctx.user);
    await audit(actor, 'Made new two-step recovery codes', 'The old ones stopped working', 'security');
    return json({ recovery });
  }

  return fail(400, 'Pick an action: start, confirm, disable or recovery.') as never;
});
