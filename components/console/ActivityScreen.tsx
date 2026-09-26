'use client';

import React, { useEffect, useState } from 'react';
import type { AuditEntry } from '@/lib/server/storage';

export function ActivityScreen() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.audit || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 0);
    const interval = setInterval(fetchLogs, 6000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <div className="co-page-title">
        <div>
          <h1>Activity &amp; Audit Log</h1>
          <p>Chronological record of staff actions, order status changes, and menu adjustments.</p>
        </div>
      </div>

      <div style={{ background: 'var(--co-panel)', border: '1px solid var(--co-border)', borderRadius: '14px', overflow: 'hidden' }}>
        <table className="co-table">
          <thead>
            <tr>
              <th>TIME</th>
              <th>STAFF MEMBER</th>
              <th>ROLE</th>
              <th>ACTION</th>
              <th>TARGET</th>
              <th>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--co-cream-dim)', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td style={{ fontWeight: 600 }}>{log.actorName}</td>
                <td>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {log.role}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--co-amber-light)' }}>
                  {log.action}
                </td>
                <td style={{ fontWeight: 600 }}>{log.target}</td>
                <td style={{ color: 'var(--co-cream-dim)', fontSize: '12px' }}>{log.details}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--co-cream-dim)', padding: '30px' }}>
                  No activity logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
