'use client';

import { useEffect, useState, useMemo } from 'react';
import { api, ago } from './api';
import { useRun } from './Toasts';
import type { Moment } from '@/lib/server/moments';

type MomentsResponse = {
  moments: Moment[];
  counts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
};

const isVideo = (url: string, mediaType?: string) => {
  if (mediaType === 'video') return true;
  if (mediaType === 'image') return false;
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(url);
};

export function MomentsScreen() {
  const run = useRun();
  const [data, setData] = useState<MomentsResponse | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [activeMedia, setActiveMedia] = useState<{ url: string; isVideo: boolean; caption?: string; author?: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Add Moment state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addPreview, setAddPreview] = useState<string>('');
  const [addIsVideo, setAddIsVideo] = useState(false);
  const [addName, setAddName] = useState('Brewns Team');
  const [addAuthor, setAddAuthor] = useState('@brewns.coffee');
  const [addLocation, setAddLocation] = useState('Gulberg');
  const [addProduct, setAddProduct] = useState('');
  const [addCaption, setAddCaption] = useState('');
  const [addStatus, setAddStatus] = useState<'approved' | 'pending'>('approved');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const handleSelectFile = (file: File) => {
    const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);
    setAddFile(file);
    setAddIsVideo(isVid);
    setAddPreview(URL.createObjectURL(file));
    setAddError('');
  };

  const handleCreateMoment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFile) {
      setAddError('Please select a photo or video to upload.');
      return;
    }
    if (!addCaption.trim()) {
      setAddError('Please enter a caption.');
      return;
    }
    setIsSubmitting(true);
    setAddError('');
    try {
      const fd = new FormData();
      fd.append('file', addFile);
      fd.append('name', addName.trim());
      fd.append('author', addAuthor.trim());
      fd.append('location', addLocation);
      fd.append('caption', addCaption.trim());
      if (addProduct.trim()) fd.append('product', addProduct.trim());
      fd.append('status', addStatus);

      const res = await fetch('/api/console/moments', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create moment');

      setShowAddModal(false);
      setAddFile(null);
      setAddPreview('');
      setAddCaption('');
      setAddProduct('');
      await fetchMoments();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create moment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchMoments = async () => {
    const res = await run(() => api<MomentsResponse>('/api/console/moments'));
    if (res) setData(res);
  };

  useEffect(() => {
    fetchMoments();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      const res = await fetch('/api/console/moments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error('Action failed');
      await fetchMoments();
    } catch (err: any) {
      alert(err.message || 'Failed to update moment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this moment?')) return;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/console/moments?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      await fetchMoments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete moment');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.moments;
    if (filter !== 'all') {
      list = list.filter((m) => m.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.author.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.caption.toLowerCase().includes(q) ||
          m.location.toLowerCase().includes(q) ||
          (m.product && m.product.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data, filter, search]);

  const counts = data?.counts || { total: 0, pending: 0, approved: 0, rejected: 0 };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Page Header */}
      <div className="cx-pagehead" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="cx-eyebrow">
            <b>{'//'}</b> Community &amp; Customer Moments
          </p>
          <h1 className="cx-h1">Moments Gallery</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cx-btn"
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '0.5rem 1.1rem',
              fontSize: '0.8125rem',
              background: 'var(--accent, #c99355)',
              color: '#070707',
              fontWeight: 700,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>+</span> Add Photo / Video
          </button>
          <button
            type="button"
            className="cx-btn"
            onClick={fetchMoments}
            style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
          >
            ↻ Refresh
          </button>
          <a
            href="/#moments"
            target="_blank"
            rel="noopener noreferrer"
            className="cx-btn cx-btn-primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', textDecoration: 'none' }}
          >
            View Live on Site ↗
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            background: 'var(--surface, #18181b)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)' }}>
            PENDING APPROVAL
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: counts.pending > 0 ? '#f59e0b' : '#fff' }}>
              {counts.pending}
            </span>
            {counts.pending > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>● Awaiting review</span>
            )}
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface, #18181b)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)' }}>
            LIVE ON WEBSITE
          </p>
          <span style={{ fontSize: '2rem', fontWeight: 700, color: '#22c55e' }}>
            {counts.approved}
          </span>
        </div>

        <div
          style={{
            background: 'var(--surface, #18181b)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)' }}>
            REJECTED / ARCHIVED
          </p>
          <span style={{ fontSize: '2rem', fontWeight: 700, color: '#6b7280' }}>
            {counts.rejected}
          </span>
        </div>

        <div
          style={{
            background: 'var(--surface, #18181b)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '1.25rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)' }}>
            TOTAL SUBMISSIONS
          </p>
          <span style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
            {counts.total}
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'pending', label: `Pending (${counts.pending})` },
            { key: 'approved', label: `Approved & Live (${counts.approved})` },
            { key: 'rejected', label: `Rejected (${counts.rejected})` },
            { key: 'all', label: `All (${counts.total})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key as any)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                borderRadius: '6px',
                border: filter === tab.key ? '1px solid #c99355' : '1px solid rgba(255,255,255,0.1)',
                background: filter === tab.key ? 'rgba(201, 147, 85, 0.15)' : 'rgba(255,255,255,0.03)',
                color: filter === tab.key ? '#c99355' : '#9ca3af',
                cursor: 'pointer',
                fontWeight: filter === tab.key ? 600 : 400,
                transition: 'all 150ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ minWidth: 260 }}>
          <input
            type="text"
            placeholder="Search by author, caption, or place…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: '0.8125rem',
            }}
          />
        </div>
      </div>

      {/* Moments Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            background: 'var(--surface, #18181b)',
            borderRadius: '8px',
            border: '1px dashed rgba(255,255,255,0.12)',
          }}
        >
          <p style={{ color: '#9ca3af', margin: '0 0 0.5rem', fontSize: '1rem' }}>No moments found</p>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '0.8125rem' }}>
            {filter === 'pending'
              ? 'No pending moments awaiting review. Great job!'
              : 'Try changing the filter or search keyword.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filtered.map((m) => (
            <div
              key={m.id}
              style={{
                background: 'var(--surface, #18181b)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'border-color 150ms ease',
              }}
            >
              {/* Media Preview (Photo or Video) */}
              {(() => {
                const isVid = isVideo(m.imageUrl, m.mediaType);
                return (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: 220,
                      backgroundColor: '#000',
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                    onClick={() => setActiveMedia({ url: m.imageUrl, isVideo: isVid, caption: m.caption, author: m.author })}
                  >
                    {isVid ? (
                      <video
                        src={m.imageUrl}
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          pointerEvents: 'none',
                        }}
                      />
                    ) : (
                      <img
                        src={m.imageUrl}
                        alt={m.caption}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          transition: 'transform 250ms ease',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    )}

                    {isVid && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '0.75rem',
                          left: '0.75rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          backdropFilter: 'blur(8px)',
                          background: 'rgba(7,7,7,0.75)',
                          color: '#c99355',
                          border: '1px solid rgba(201, 147, 85, 0.4)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        ▶ VIDEO
                      </span>
                    )}

                    <span
                      style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        backdropFilter: 'blur(8px)',
                        background:
                          m.status === 'approved'
                            ? 'rgba(34, 197, 94, 0.85)'
                            : m.status === 'pending'
                            ? 'rgba(245, 158, 11, 0.85)'
                            : 'rgba(239, 68, 68, 0.85)',
                        color: '#fff',
                      }}
                    >
                      {m.status}
                    </span>

                    <span
                      style={{
                        position: 'absolute',
                        bottom: '0.75rem',
                        left: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        background: 'rgba(0,0,0,0.65)',
                        color: '#e5e7eb',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      📍 {m.location}
                    </span>
                  </div>
                );
              })()}

              {/* Moment Info */}
              <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                  <b style={{ color: '#fff', fontSize: '0.9375rem' }}>{m.author}</b>
                  <span style={{ color: '#71717a', fontSize: '0.75rem' }}>{ago(m.createdAt)}</span>
                </div>

                <p style={{ margin: '0 0 0.75rem', color: '#d1d5db', fontSize: '0.8125rem', lineHeight: 1.4, flex: 1 }}>
                  &ldquo;{m.caption}&rdquo;
                </p>

                {m.product && (
                  <div style={{ marginBottom: '1rem' }}>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        padding: '0.15rem 0.45rem',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--accent, #c99355)',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-space-mono)',
                      }}
                    >
                      ☕ {m.product}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {m.status !== 'approved' && (
                    <button
                      type="button"
                      disabled={processingId === m.id}
                      onClick={() => handleAction(m.id, 'approve')}
                      style={{
                        flex: 1,
                        padding: '0.45rem 0.75rem',
                        background: '#15803d',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span>✓</span> Approve &amp; Publish
                    </button>
                  )}

                  {m.status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={processingId === m.id}
                      onClick={() => handleAction(m.id, 'reject')}
                      style={{
                        padding: '0.45rem 0.75rem',
                        background: 'rgba(255,255,255,0.08)',
                        color: '#d1d5db',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Reject
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={processingId === m.id}
                    onClick={() => handleDelete(m.id)}
                    title="Delete permanently"
                    style={{
                      padding: '0.45rem 0.65rem',
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zoom Lightbox */}
      {activeMedia && (
        <div
          onClick={() => setActiveMedia(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveMedia(null)}
              style={{
                position: 'absolute',
                top: '-2.5rem',
                right: 0,
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                fontSize: '1.25rem',
                width: 32,
                height: 32,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>

            {activeMedia.isVideo ? (
              <video
                src={activeMedia.url}
                controls
                autoPlay
                playsInline
                loop
                style={{
                  maxWidth: '90vw',
                  maxHeight: '75vh',
                  borderRadius: '8px',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
                  outline: 'none',
                }}
              />
            ) : (
              <img
                src={activeMedia.url}
                alt={activeMedia.caption || 'Enlarged moment'}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '75vh',
                  borderRadius: '8px',
                  objectFit: 'contain',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
                }}
              />
            )}

            {(activeMedia.author || activeMedia.caption) && (
              <div
                style={{
                  marginTop: '1rem',
                  color: '#fff',
                  fontFamily: 'var(--font-space-mono)',
                  fontSize: '0.8125rem',
                  textAlign: 'center',
                  maxWidth: 600,
                }}
              >
                {activeMedia.author && <b style={{ color: '#c99355' }}>{activeMedia.author} · </b>}
                <span>{activeMedia.caption}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Moment Modal */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 540,
              background: '#12100e',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '1.75rem',
              color: '#f4f2ec',
              boxShadow: '0 25px 60px -15px rgba(0,0,0,0.85)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <p style={{ margin: 0, color: 'var(--accent, #c99355)', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)', fontWeight: 600 }}>
                  {'//'} OWNER UPLOAD
                </p>
                <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700 }}>
                  Add Photo or Video Moment
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: '1.1rem',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMoment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Dropzone / Preview */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)', color: '#d1d5db' }}>
                  MEDIA FILE (PHOTO OR VIDEO) *
                </label>
                <div
                  style={{
                    border: '1px dashed rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '1rem',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    position: 'relative',
                    minHeight: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectFile(file);
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      cursor: 'pointer',
                      zIndex: addPreview ? -1 : 1,
                    }}
                  />
                  {addPreview ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                      {addIsVideo ? (
                        <video
                          src={addPreview}
                          muted
                          loop
                          playsInline
                          autoPlay
                          style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: '6px' }}
                        />
                      ) : (
                        <img
                          src={addPreview}
                          alt="Preview"
                          style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: '6px' }}
                        />
                      )}
                      <label
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          background: 'rgba(0,0,0,0.85)',
                          color: '#fff',
                          border: '1px solid rgba(255,255,255,0.3)',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          cursor: 'pointer',
                        }}
                      >
                        Change Media
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSelectFile(file);
                          }}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '0.35rem' }}>📷 / 🎥</span>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#e5e7eb' }}>
                        Click or drag &amp; drop to upload
                      </p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.6875rem', color: '#6b7280' }}>
                        Supports JPG, PNG, WebP or MP4, WebM (up to 60MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Creator & Handle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)', color: '#d1d5db' }}>
                    CREATOR / NAME *
                  </label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.8125rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)', color: '#d1d5db' }}>
                    HANDLE (INSTA / SOCIAL)
                  </label>
                  <input
                    type="text"
                    value={addAuthor}
                    onChange={(e) => setAddAuthor(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.8125rem',
                    }}
                  />
                </div>
              </div>

              {/* Location & Product */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)', color: '#d1d5db' }}>
                    LOCATION
                  </label>
                  <select
                    value={addLocation}
                    onChange={(e) => setAddLocation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: '#1c1917',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <option value="Gulberg">MM Alam Road · Gulberg</option>
                    <option value="DHA">CCA Phase 5 · DHA</option>
                    <option value="Johar Town">Main Boulevard · Johar Town</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)', color: '#d1d5db' }}>
                    PRODUCT (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Slow Roast Espresso"
                    value={addProduct}
                    onChange={(e) => setAddProduct(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.8125rem',
                    }}
                  />
                </div>
              </div>

              {/* Caption */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)', color: '#d1d5db' }}>
                  CAPTION / STORY *
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={280}
                  placeholder="Tell the story behind this moment..."
                  value={addCaption}
                  onChange={(e) => setAddCaption(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.8125rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Publishing Status */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)', color: '#d1d5db' }}>
                  PUBLISH STATUS
                </label>
                <select
                  value={addStatus}
                  onChange={(e) => setAddStatus(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: '#1c1917',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="approved">✓ Publish Live Immediately to Website</option>
                  <option value="pending">● Save as Pending Review</option>
                </select>
              </div>

              {/* Error Banner */}
              {addError && (
                <div style={{ color: '#ef4444', fontSize: '0.75rem', fontFamily: 'var(--font-space-mono)' }}>
                  ⚠ {addError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#d1d5db',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: 'var(--accent, #c99355)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#070707',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? 'Uploading...' : 'Publish Moment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
