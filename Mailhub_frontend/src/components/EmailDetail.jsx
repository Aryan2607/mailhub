import React, { useState } from 'react';
import { emailsApi } from '../api';
import {
  Reply,
  Forward,
  Trash2,
  Undo2,
  AlertTriangle,
  Star,
  Mail,
  Archive,
  Download,
  Paperclip,
  Code,
  FileText,
  User,
  Clock,
} from 'lucide-react';

export default function EmailDetail({
  email,
  activeAccount,
  onReply,
  onForward,
  onTrash,
  onRestore,
  onPermanentDelete,
  onToggleStar,
  onToggleRead,
  onArchive,
}) {
  const [viewMode, setViewMode] = useState('html'); // 'html' or 'text'

  if (!email) {
    return (
      <div
        className="email-detail-pane"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: 40,
        }}
      >
        <div>
          <Mail size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            No Email Selected
          </h3>
          <p style={{ fontSize: 13, maxWidth: 320 }}>
            Select an email from the list on the left to read its full content, download attachments, or reply.
          </p>
        </div>
      </div>
    );
  }

  const isTrashed = email.is_trashed || (email.labels && email.labels.includes('TRASH'));
  const hasHtml = Boolean(email.body_html && email.body_html.trim());
  const hasText = Boolean(email.body_text && email.body_text.trim());

  return (
    <div className="email-detail-pane">
      {/* Action Toolbar */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.4)',
        }}
      >
        {/* Left Actions: Reply & Forward */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onReply(email)}
            className="btn btn-secondary"
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            <Reply size={15} />
            <span>Reply</span>
          </button>

          <button
            onClick={() => onForward(email)}
            className="btn btn-secondary"
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            <Forward size={15} />
            <span>Forward</span>
          </button>
        </div>

        {/* Right Actions: Star, Read/Unread, Archive, Trash / Permanent Delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onToggleStar(email)}
            className="btn-icon"
            title={email.is_starred ? 'Unstar' : 'Star'}
            style={{ color: email.is_starred ? '#f59e0b' : 'var(--text-secondary)' }}
          >
            <Star size={16} fill={email.is_starred ? '#f59e0b' : 'none'} />
          </button>

          <button
            onClick={() => onToggleRead(email)}
            className="btn-icon"
            title="Mark as unread"
          >
            <Mail size={16} />
          </button>

          <button
            onClick={() => onArchive(email)}
            className="btn-icon"
            title="Archive"
          >
            <Archive size={16} />
          </button>

          {/* If in trash, show Restore and Permanent Delete */}
          {isTrashed ? (
            <>
              <button
                onClick={() => onRestore(email)}
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '5px 10px', color: 'var(--emerald)' }}
                title="Restore email back to inbox"
              >
                <Undo2 size={14} />
                <span>Restore</span>
              </button>

              <button
                onClick={() => onPermanentDelete(email)}
                className="btn btn-danger"
                style={{ fontSize: 12, padding: '5px 10px' }}
                title="Action 2: Permanently delete message from Gmail"
              >
                <AlertTriangle size={14} />
                <span>Delete Permanently</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onTrash(email)}
              className="btn-icon"
              title="Action 1: Move to Trash"
              style={{ color: 'var(--rose)' }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Email Header Details */}
      <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border-subtle)' }}>
        {/* Subject & Labels */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
            {email.subject || '(No Subject)'}
          </h2>

          {/* Labels */}
          {email.labels && email.labels.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {email.labels.map((lbl) => (
                <span
                  key={lbl}
                  className="badge"
                  style={{
                    background: lbl === 'TRASH' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: lbl === 'TRASH' ? '#fda4af' : 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {lbl}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Sender & Recipient Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'var(--gradient-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                color: '#ffffff',
                boxShadow: '0 4px 12px var(--primary-glow)',
              }}
            >
              {email.from ? email.from.charAt(0).toUpperCase() : 'U'}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                  {email.from}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                To: <span style={{ color: 'var(--text-secondary)' }}>{email.to}</span>
                {email.cc && <span> | Cc: {email.cc}</span>}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} />
            <span>{email.date}</span>
          </div>
        </div>
      </div>

      {/* Message Body Controls: HTML vs Plain Text Toggle */}
      <div
        style={{
          padding: '8px 28px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
          View Format:
        </span>
        <button
          onClick={() => setViewMode('html')}
          className="btn"
          disabled={!hasHtml}
          style={{
            padding: '3px 8px',
            fontSize: 11,
            background: viewMode === 'html' ? 'var(--bg-surface-active)' : 'transparent',
            color: viewMode === 'html' ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Code size={12} />
          <span>Rich HTML</span>
        </button>
        <button
          onClick={() => setViewMode('text')}
          className="btn"
          disabled={!hasText}
          style={{
            padding: '3px 8px',
            fontSize: 11,
            background: viewMode === 'text' ? 'var(--bg-surface-active)' : 'transparent',
            color: viewMode === 'text' ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <FileText size={12} />
          <span>Plain Text</span>
        </button>
      </div>

      {/* Email Body Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: '#0a0e17' }}>
        {viewMode === 'html' && hasHtml ? (
          <iframe
            title="Email Content"
            srcDoc={`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                      font-size: 14px;
                      line-height: 1.6;
                      color: #cbd5e1;
                      background-color: transparent;
                      margin: 0;
                      padding: 8px;
                      word-break: break-word;
                    }
                    a { color: #818cf8; text-decoration: underline; }
                    img { max-width: 100%; height: auto; }
                    pre, code { background: rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 4px; }
                  </style>
                </head>
                <body>${email.body_html}</body>
              </html>
            `}
            style={{
              width: '100%',
              minHeight: 400,
              height: '100%',
              border: 'none',
              background: 'transparent',
            }}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
          />
        ) : (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
            }}
          >
            {email.body_text || email.snippet || '(Empty message body)'}
          </div>
        )}

        {/* Attachments Section */}
        {email.attachments && email.attachments.length > 0 && (
          <div
            style={{
              marginTop: 32,
              paddingTop: 20,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 12 }}>
              <Paperclip size={16} />
              <span>Attachments ({email.attachments.length})</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {email.attachments.map((att, idx) => (
                <div
                  key={att.attachment_id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ minWidth: 0, marginRight: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.filename}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {(att.size / 1024).toFixed(1)} KB • {att.mime_type}
                    </div>
                  </div>

                  {att.attachment_id ? (
                    <a
                      href={emailsApi.downloadAttachmentUrl(activeAccount.id, email.id, att.attachment_id, att.filename)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      download={att.filename}
                    >
                      <Download size={14} />
                    </a>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Embedded</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
