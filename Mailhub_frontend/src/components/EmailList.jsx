import React, { useState } from 'react';
import {
  Star,
  Trash2,
  Mail,
  MailOpen,
  Archive,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  RefreshCw,
  Clock,
} from 'lucide-react';

export default function EmailList({
  emails = [],
  activeEmail = null,
  onSelectEmail,
  folder = 'inbox',
  searchQuery = '',
  loading = false,
  nextPageToken = null,
  onLoadMore,
  onToggleStar,
  onToggleRead,
  onTrashEmail,
  onArchiveEmail,
  onEmptyTrash,
}) {
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  // Filter messages if unread toggle is on
  const displayedEmails = filterUnreadOnly
    ? emails.filter((m) => !m.is_read)
    : emails;

  return (
    <div className="email-list-pane">
      {/* Pane Header */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.4)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{searchQuery ? `Search: "${searchQuery}"` : folder}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>
              ({displayedEmails.length} {displayedEmails.length === 1 ? 'message' : 'messages'})
            </span>
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Unread toggle */}
          <button
            onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
            className={`btn-icon ${filterUnreadOnly ? 'badge-user' : ''}`}
            title={filterUnreadOnly ? 'Show all messages' : 'Filter unread only'}
            style={{
              padding: '6px 8px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Filter size={14} color={filterUnreadOnly ? 'var(--primary)' : 'var(--text-muted)'} />
          </button>

          {/* Empty Trash Button (when inside trash) */}
          {folder === 'trash' && emails.length > 0 && (
            <button
              onClick={onEmptyTrash}
              className="btn btn-danger"
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <Trash2 size={13} />
              <span>Empty Trash</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages List Container */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && emails.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--primary)' }} />
            <span style={{ fontSize: 13 }}>Fetching emails from Gmail...</span>
          </div>
        ) : displayedEmails.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Mail size={36} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.3 }} />
            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {filterUnreadOnly ? 'No unread emails' : 'Folder is empty'}
            </h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {searchQuery ? 'No matching emails found for this query.' : `No emails currently in ${folder}.`}
            </p>
          </div>
        ) : (
          displayedEmails.map((email) => {
            const isSelected = activeEmail?.id === email.id;
            const isUnread = !email.is_read;

            return (
              <div
                key={email.id}
                onClick={() => onSelectEmail(email)}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  background: isSelected
                    ? 'rgba(99, 102, 241, 0.18)'
                    : isUnread
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'transparent',
                  borderLeft: isSelected
                    ? '3px solid var(--primary)'
                    : isUnread
                    ? '3px solid #38bdf8'
                    : '3px solid transparent',
                  transition: 'background var(--transition-fast)',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-hover)';
                  const actions = e.currentTarget.querySelector('.hover-actions');
                  if (actions) actions.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isUnread ? 'rgba(255, 255, 255, 0.03)' : 'transparent';
                  }
                  const actions = e.currentTarget.querySelector('.hover-actions');
                  if (actions) actions.style.opacity = '0';
                }}
              >
                {/* Header row: From, Star, Date */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    {/* Star button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(email);
                      }}
                      className="btn-icon"
                      style={{ padding: 2, color: email.is_starred ? '#f59e0b' : 'var(--text-dim)' }}
                      title={email.is_starred ? 'Unstar' : 'Star'}
                    >
                      <Star size={15} fill={email.is_starred ? '#f59e0b' : 'none'} />
                    </button>

                    {/* Sender */}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isUnread ? 700 : 500,
                        color: isUnread ? '#ffffff' : 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {email.from || '(Unknown Sender)'}
                    </span>
                  </div>

                  {/* Date */}
                  <span style={{ fontSize: 11, color: isUnread ? 'var(--text-secondary)' : 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                    {email.date ? email.date.split(' ').slice(0, 4).join(' ') : ''}
                  </span>
                </div>

                {/* Subject */}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isUnread ? 700 : 500,
                    color: isUnread ? '#f8fafc' : 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 4,
                  }}
                >
                  {email.subject || '(No Subject)'}
                </div>

                {/* Snippet preview */}
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.4,
                  }}
                >
                  {email.snippet}
                </div>

                {/* Floating Quick Actions on Hover */}
                <div
                  className="hover-actions"
                  style={{
                    position: 'absolute',
                    right: 12,
                    bottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#1e293b',
                    padding: '2px 4px',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-sm)',
                    opacity: 0,
                    transition: 'opacity var(--transition-fast)',
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRead(email);
                    }}
                    className="btn-icon"
                    title={email.is_read ? 'Mark as unread' : 'Mark as read'}
                    style={{ padding: 4 }}
                  >
                    {email.is_read ? <Mail size={13} /> : <MailOpen size={13} />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchiveEmail(email);
                    }}
                    className="btn-icon"
                    title="Archive"
                    style={{ padding: 4 }}
                  >
                    <Archive size={13} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrashEmail(email);
                    }}
                    className="btn-icon"
                    title="Move to Trash"
                    style={{ padding: 4, color: 'var(--rose)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {nextPageToken && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: 13 }}
          >
            {loading ? <RefreshCw size={14} className="spin" /> : <span>Load More Messages</span>}
          </button>
        </div>
      )}
    </div>
  );
}
