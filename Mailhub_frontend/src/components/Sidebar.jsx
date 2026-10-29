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
  Layers,
  Sparkles,
  X,
  Mail,
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
  userResume = null,
  onOpenResumeModal,
  isOpen = false,
  onClose,
}) {
  return (
    <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile Drawer Header Bar (Visible on mobile/tablet) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail size={15} color="#ffffff" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 800 }}>MailHub</span>
        </div>

        {/* Close Drawer Button */}
        <button
          className="btn-icon"
          onClick={onClose}
          title="Close Navigation"
          aria-label="Close Navigation"
          style={{ width: 32, height: 32 }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Compose Button */}
      <div style={{ padding: '16px 14px 10px' }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            onOpenCompose();
            onClose?.();
          }}
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
              onClick={() => {
                onSelectFolder(f.id);
                onClose?.();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
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

        {/* AI Resume Status Card */}
        <div
          onClick={() => {
            onOpenResumeModal();
            onClose?.();
          }}
          style={{
            margin: '14px 4px 6px',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            background: userResume
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(99, 102, 241, 0.05))'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(236, 72, 153, 0.08))',
            border: userResume
              ? '1px solid rgba(16, 185, 129, 0.25)'
              : '1px solid rgba(99, 102, 241, 0.3)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="var(--primary)" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                AI Job Outreach
              </span>
            </div>
            {userResume && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#6ee7b7',
                }}
              >
                READY
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: userResume ? '#6ee7b7' : 'var(--text-secondary)', fontWeight: 500 }}>
            {userResume ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileText size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userResume.original_filename}
                </span>
              </span>
            ) : (
              <span>+ Upload Resume for Gemini</span>
            )}
          </div>
        </div>

        {/* Account Mailbox Stats if available */}
        {accountStats && (
          <div
            style={{
              margin: '14px 4px',
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
            onClick={() => {
              onConnectAccount();
              onClose?.();
            }}
            className="btn-icon"
            title="Connect another Gmail account"
            style={{ padding: 2, minWidth: 28, minHeight: 28, color: 'var(--primary)' }}
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
                onClick={() => {
                  onSelectAccount(acc);
                  onClose?.();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 8px',
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
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
