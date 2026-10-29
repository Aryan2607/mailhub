import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';
import { Shield, Users, ArrowLeft, ChevronDown, Check, UserCheck, Zap, Image as ImageIcon } from 'lucide-react';

export default function AdminBanner({
  selectedUser,
  onExit,
  onSwitchUser,
  onOpenSendEvent,
  receiveImageActive = false,
  onToggleReceiveImage = null,
}) {
  const [usersList, setUsersList] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const data = await adminApi.getOverview();
        setUsersList(data.users || []);
      } catch (err) {
        console.error('Failed to load user list for admin banner:', err);
      }
    }
    fetchUsers();
  }, []);

  if (!selectedUser) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.16) 0%, rgba(99, 102, 241, 0.16) 100%)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
        padding: '8px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        zIndex: 45,
        position: 'relative',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        flexWrap: 'wrap',
      }}
    >
      {/* Left: Active Session Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
        <div
          style={{
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(245, 158, 11, 0.25)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            color: '#fbbf24',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}
        >
          <Shield size={13} />
          <span>Admin Oversight Active</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#f8fafc', minWidth: 0 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Managing User:</span>
          <strong style={{ color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedUser.email}
          </strong>
          <span className={`badge ${selectedUser.role === 'ADMIN' ? 'badge-admin' : 'badge-user'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
            {selectedUser.role}
          </span>
        </div>
      </div>

      {/* Right Actions: Switch User Dropdown & Exit to Directory */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Switch User Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="btn btn-secondary"
            style={{
              padding: '4px 10px',
              height: 32,
              fontSize: 12,
              gap: 6,
              background: 'rgba(15, 23, 42, 0.85)',
              borderColor: 'rgba(245, 158, 11, 0.35)',
              color: '#fbbf24',
            }}
          >
            <UserCheck size={13} />
            <span>Switch User</span>
            <ChevronDown size={13} />
          </button>

          {dropdownOpen && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 280,
                maxHeight: 280,
                overflowY: 'auto',
                padding: 6,
                background: '#111827',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                animation: 'fadeIn 0.15s ease',
              }}
            >
              <div
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: 4,
                }}
              >
                Select Target User ({usersList.length})
              </div>

              {usersList.map((u) => {
                const isCurrent = u.id === selectedUser.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      onSwitchUser(u);
                      setDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      background: isCurrent ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = 'var(--bg-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ minWidth: 0, marginRight: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {u.connected_accounts_count} {u.connected_accounts_count === 1 ? 'account' : 'accounts'} • {u.role}
                      </div>
                    </div>
                    {isCurrent && <Check size={14} color="#fbbf24" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Receive Image WebSocket Toggle Button for Target User */}
        {onToggleReceiveImage && (
          <button
            type="button"
            onClick={onToggleReceiveImage}
            style={{
              height: 32,
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              borderRadius: 'var(--radius-md)',
              border: receiveImageActive
                ? '1px solid rgba(168, 85, 247, 0.6)'
                : '1px solid rgba(255, 255, 255, 0.15)',
              background: receiveImageActive
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.28) 0%, rgba(99, 102, 241, 0.22) 100%)'
                : 'rgba(255, 255, 255, 0.05)',
              color: receiveImageActive ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
            title={
              receiveImageActive
                ? `Receive Image is ON for ${selectedUser.email} — Click to stop`
                : `Receive Image is OFF for ${selectedUser.email} — Click to start`
            }
          >
            <ImageIcon size={13} color={receiveImageActive ? '#d8b4fe' : 'var(--text-muted)'} />
            <span>Receive Image</span>
            <div
              style={{
                width: 24,
                height: 14,
                borderRadius: 7,
                background: receiveImageActive ? '#a855f7' : 'rgba(255, 255, 255, 0.2)',
                position: 'relative',
                flexShrink: 0,
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: 2,
                  left: receiveImageActive ? 12 : 2,
                  transition: 'all 0.2s ease',
                }}
              />
            </div>
          </button>
        )}

        {/* Send WebSocket Event Button */}
        <button
          onClick={() => onOpenSendEvent?.(selectedUser)}
          className="btn btn-secondary"
          style={{
            padding: '4px 10px',
            height: 32,
            fontSize: 12,
            fontWeight: 700,
            gap: 6,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(236, 72, 153, 0.2) 100%)',
            borderColor: 'rgba(99, 102, 241, 0.45)',
            color: '#ffffff',
          }}
          title={`Dispatch real-time WebSocket event to ${selectedUser.email}`}
        >
          <Zap size={13} color="#a5b4fc" />
          <span>Send Event</span>
        </button>

        {/* Exit to Users Directory Button */}
        <button
          onClick={onExit}
          className="btn btn-secondary"
          style={{
            padding: '4px 12px',
            height: 32,
            fontSize: 12,
            fontWeight: 700,
            gap: 6,
            background: 'rgba(255, 255, 255, 0.08)',
            borderColor: 'var(--border-highlight)',
            color: '#ffffff',
          }}
          title="Exit to Admin Users Directory"
        >
          <ArrowLeft size={14} />
          <span>Exit to Users Directory</span>
        </button>
      </div>
    </div>
  );
}
