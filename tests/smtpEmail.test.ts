import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:net';

// A tiny SMTP server on localhost that accepts one login and keeps what it is sent.
const got: { auth: string[]; from: string[]; to: string[]; data: string[] } = { auth: [], from: [], to: [], data: [] };
let server: Server;

beforeAll(async () => {
  server = createServer((sock) => {
    let inData = false, buf = '';
    sock.write('220 test ESMTP\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString();
      if (inData) {
        const end = buf.indexOf('\r\n.\r\n');
        if (end < 0) return;
        got.data.push(buf.slice(0, end));
        buf = buf.slice(end + 5);
        inData = false;
        sock.write('250 queued\r\n');
      }
      let nl;
      while (!inData && (nl = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-test\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (cmd === 'AUTH') (got.auth.push(line), sock.write('235 ok\r\n'));
        else if (cmd === 'MAIL') (got.from.push(line), sock.write('250 ok\r\n'));
        else if (cmd === 'RCPT') (got.to.push(line), sock.write('250 ok\r\n'));
        else if (cmd === 'DATA') ((inData = true), sock.write('354 go\r\n'));
        else if (cmd === 'QUIT') sock.end('221 bye\r\n');
        else sock.write('250 ok\r\n');
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_USER: 'owner@example.com', SMTP_PASS: 'abcd efgh ijkl mnop' });
  delete process.env.RESEND_API_KEY;
  delete process.env.BREVO_API_KEY;
});
afterAll(() => server.close());

describe('email over SMTP (Gmail)', () => {
  it('sends a staff invite from the owner, as a branded email with a plain-text copy', async () => {
    const { emailStaffLink } = await import('@/lib/server/staffAccess');
    const ok = await emailStaffLink({ name: 'Ahmed Raza', email: 'Rider@Example.com', role: 'rider' }, 'tok123', 'invite', 'Hassan Baig');
    expect(ok).toBe(true);
    // the App password is used without the spaces Google shows it with
    expect(Buffer.from(got.auth[0].split(' ').pop()!, 'base64').toString()).toBe('\0owner@example.com\0abcdefghijklmnop');
    expect(got.from[0]).toContain('owner@example.com');
    expect(got.to[0]).toContain('rider@example.com');
    const mail = got.data[0].replace(/=\r\n/g, '');
    expect(mail).toContain('Subject: You are invited to the brewns team');
    expect(mail).toContain('From: brewns <owner@example.com>');
    expect(mail).toContain('text/plain');
    expect(mail).toContain('text/html');
    expect(mail).toContain('/staff/invite/tok123');
    expect(mail).toContain('Welcome to the team, Ahmed');
  });

  it('reports failure (so the console shows the link) when the server is down', async () => {
    const { sendEmail } = await import('@/lib/server/email');
    server.close();
    const r = await sendEmail({ to: 'a@example.com', subject: 'x', text: 'y' });
    expect(r).toEqual({ ok: false, sentVia: 'none' });
  });
});
