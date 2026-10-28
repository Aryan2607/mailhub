import React from 'react';
import {
  Inbox,
  Star,
  Tag,
  Send,
  FileText,
  AlertOctagon,
  Trash2,
  PenSquare,
  Plus,
  Unlink,
  Layers,
} from 'lucide-react';

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'important', label: 'Important', icon: Tag },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'spam', label: 'Spam', icon: AlertOctagon },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

export default function Sidebar({
  activeFolder = 'inbox',
  onSelectFolder,
  onOpenCompose,
  accounts = [],
  activeAccount = null,
  onSelectAccount,
  onConnectAccount,
  onDisconnectAccount,
  accountStats = null,
}) {
  return (
    <aside className="app-sidebar">
      {/* Compose Button */}
      <div style={{ padding: '16px 14px' }}>
        <button
          className="btn btn-primary"
          onClick={onOpenCompose}
          disabled={!activeAccount}
          style={{
            width: '100%',
            height: 44,
            fontSize: 15,
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 16px var(--primary-glow)',
          }}
        >
          <PenSquare size={18} />
          <span>Compose</span>
        </button>
      </div>

      {/* Folders List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', padding: '8px 12px 4px' }}>
          Mailboxes
        </div>

        {FOLDERS.map((f) => {
          const Icon = f.icon;
          const isActive = activeFolder === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onSelectFolder(f.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: isActive ? 'rgba(99, 102, 241, 0.16)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                marginBottom: 2,
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'var(--bg-surface-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon
                size={17}
                color={isActive ? 'var(--primary)' : 'var(--text-muted)'}
              />
              <span style={{ flex: 1 }}>{f.label}</span>
              {isActive && (
                <div
                  style={{
                    width: 4,
                    height: 16,
                    borderRadius: 2,
                    background: 'var(--primary)',
                  }}
                />
              )}
            </button>
          );
        })}

        {/* Account Mailbox Stats if available */}
        {accountStats && (
          <div
            style={{
              margin: '16px 4px',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Account Statistics
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Messages:</span>
              <span style={{ fontWeight: 600, color: '#ffffff' }}>{accountStats.messages_total?.toLocaleString() ?? '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Threads:</span>
              <span style={{ fontWeight: 600, color: '#ffffff' }}>{accountStats.threads_total?.toLocaleString() ?? '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Connected Accounts Section */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '12px 10px',
          background: 'rgba(9, 13, 22, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            <Layers size={13} />
            <span>Accounts ({accounts.length})</span>
          </div>
          <button
            onClick={onConnectAccount}
            className="btn-icon"
            title="Connect another Gmail account"
            style={{ padding: 2, color: 'var(--primary)' }}
          >
            <Plus size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
          {accounts.map((acc) => {
            const isSelected = activeAccount?.id === acc.id;
            return (
              <div
                key={acc.id}
                onClick={() => onSelectAccount(acc)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: isSelected ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span className="pulse-dot" />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {acc.email_address}
                  </span>
                </div>

                {/* <button
                  className="btn-icon"
                  title="Disconnect account"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDisconnectAccount(acc);
                  }}
                  style={{
                    padding: 3,
                    opacity: 0.6,
                    color: 'var(--rose)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.6)}
                >
                  <Unlink size={13} />
                </button> */}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
