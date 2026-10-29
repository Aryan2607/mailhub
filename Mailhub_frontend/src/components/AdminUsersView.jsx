import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';
import {
  Shield,
  Users,
  Mail,
  CheckCircle2,
  Search,
  RefreshCw,
  ExternalLink,
  UserCheck,
  FileText,
  FileCheck,
  Calendar,
  Layers,
  X,
  ArrowRight,
  Filter,
  Zap,
} from 'lucide-react';
import SendWebSocketModal from './SendWebSocketModal';

export default function AdminUsersView({ onSelectUser }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'USER' | 'ADMIN' | 'HAS_ACCOUNTS'
  const [error, setError] = useState('');
  const [eventTargetUser, setEventTargetUser] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const data = await adminApi.getOverview();
      setStats(data.stats || null);
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load users directory.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter users based on search and selected filter chip
  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase().trim();
    const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    const matchesSearch =
      !query ||
      u.email.toLowerCase().includes(query) ||
      fullName.includes(query) ||
      u.role.toLowerCase().includes(query) ||
      (u.connected_accounts &&
        u.connected_accounts.some((acc) => acc.email.toLowerCase().includes(query)));

    if (!matchesSearch) return false;

    if (roleFilter === 'USER') return u.role === 'USER';
    if (roleFilter === 'ADMIN') return u.role === 'ADMIN';
    if (roleFilter === 'HAS_ACCOUNTS') return u.connected_accounts_count > 0;
    return true;
  });

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        background: 'radial-gradient(ellipse at 50% 0%, #111a2e 0%, #080c14 70%)',
        padding: 'clamp(16px, 3.5vw, 36px)',
        display: 'flex',
        flexDirection: 'column',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ maxWidth: 1280, width: '100%', margin: '0 auto' }}>
        {/* Header Hero */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#fbbf24',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              <Shield size={14} />
              <span>Admin Oversight Portal</span>
            </div>
            <h1
              style={{
                fontSize: 'clamp(22px, 3vw, 32px)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: 6,
              }}
            >
              Users Directory & Multi-Account Oversight
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 650, lineHeight: 1.5 }}>
              Select any registered user below to inspect their connected Gmail accounts, read emails, compose messages, and manage outreach in the exact same view as that user.
            </p>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="btn btn-secondary"
            style={{
              gap: 8,
              padding: '8px 16px',
              fontSize: 13,
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>Refresh Directory</span>
          </button>
        </div>

        {/* Global Stats Strip */}
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div
              className="glass-panel"
              style={{
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Users size={16} color="var(--primary)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Total Users</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>{stats.total_users}</div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <UserCheck size={16} color="#38bdf8" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Normal Users</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>{stats.normal_users}</div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Shield size={16} color="var(--amber)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Admin Staff</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>{stats.admin_users}</div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Mail size={16} color="var(--primary)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Linked Gmails</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>{stats.total_connected_accounts}</div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <CheckCircle2 size={16} color="var(--emerald)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Active Syncs</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#34d399' }}>{stats.active_connected_accounts}</div>
            </div>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          {/* Search Bar */}
          <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 440 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search by email, name, role, or gmail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 36,
                paddingRight: searchQuery ? 32 : 12,
                height: 38,
                fontSize: 13,
                background: 'rgba(15, 23, 42, 0.75)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="btn-icon"
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: 4,
                  minWidth: 24,
                  minHeight: 24,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setRoleFilter('ALL')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: roleFilter === 'ALL' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                color: roleFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              All Users ({users.length})
            </button>

            <button
              onClick={() => setRoleFilter('USER')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: roleFilter === 'USER' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                color: roleFilter === 'USER' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              Normal Users ({stats?.normal_users ?? 0})
            </button>

            <button
              onClick={() => setRoleFilter('ADMIN')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: roleFilter === 'ADMIN' ? 'var(--amber)' : 'rgba(255, 255, 255, 0.05)',
                color: roleFilter === 'ADMIN' ? '#000000' : 'var(--text-secondary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              Admins ({stats?.admin_users ?? 0})
            </button>

            <button
              onClick={() => setRoleFilter('HAS_ACCOUNTS')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: roleFilter === 'HAS_ACCOUNTS' ? 'var(--emerald)' : 'rgba(255, 255, 255, 0.05)',
                color: roleFilter === 'HAS_ACCOUNTS' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              With Accounts
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#fda4af',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--primary)' }} />
            <span style={{ fontSize: 14 }}>Loading registered users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              No Users Found
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              {searchQuery ? `No users match "${searchQuery}".` : 'No users currently registered under this filter.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          /* User Cards Grid */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            {filteredUsers.map((user) => {
              const isAdminUser = user.role === 'ADMIN';
              const nameDisplay = `${user.first_name || ''} ${user.last_name || ''}`.trim();

              return (
                <div
                  key={user.id}
                  className="glass-panel glass-panel-interactive"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: 'rgba(17, 24, 39, 0.75)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Card Header: Avatar, Name, Email, Role */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: isAdminUser ? 'var(--gradient-admin)' : 'var(--gradient-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            fontWeight: 800,
                            color: '#ffffff',
                            boxShadow: isAdminUser ? '0 4px 12px rgba(245, 158, 11, 0.3)' : '0 4px 12px var(--primary-glow)',
                            flexShrink: 0,
                          }}
                        >
                          {user.email.charAt(0).toUpperCase()}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          {nameDisplay && (
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {nameDisplay}
                            </div>
                          )}
                          <div style={{ fontSize: 13, fontWeight: nameDisplay ? 500 : 700, color: nameDisplay ? 'var(--text-secondary)' : '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.email}
                          </div>
                        </div>
                      </div>

                      <span className={`badge ${isAdminUser ? 'badge-admin' : 'badge-user'}`}>
                        {isAdminUser ? 'Admin' : 'User'}
                      </span>
                    </div>

                    {/* Meta Row: Member Since & Resume Status */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        marginBottom: 14,
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                        <Calendar size={12} />
                        <span>
                          {user.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'Active Member'}
                        </span>
                      </div>

                      {user.has_resume ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6ee7b7', fontWeight: 600 }}>
                          <FileCheck size={12} color="var(--emerald)" />
                          <span>Resume Ready</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)' }}>
                          <FileText size={12} />
                          <span>No Resume</span>
                        </div>
                      )}
                    </div>

                    {/* Connected Accounts Section */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>
                        <span>Connected Gmail Accounts</span>
                        <span style={{ color: user.connected_accounts_count > 0 ? 'var(--primary)' : 'var(--text-dim)' }}>
                          {user.connected_accounts_count} {user.connected_accounts_count === 1 ? 'Account' : 'Accounts'}
                        </span>
                      </div>

                      {user.connected_accounts && user.connected_accounts.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 100, overflowY: 'auto' }}>
                          {user.connected_accounts.map((acc) => (
                            <div
                              key={acc.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--border-subtle)',
                                fontSize: 12,
                              }}
                            >
                              <span
                                className="pulse-dot"
                                style={{
                                  background: acc.is_active ? 'var(--emerald)' : 'var(--text-dim)',
                                  boxShadow: acc.is_active ? '0 0 8px var(--emerald)' : 'none',
                                }}
                              />
                              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {acc.email}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px dashed var(--border-subtle)',
                            color: 'var(--text-dim)',
                            fontSize: 12,
                            textAlign: 'center',
                          }}
                        >
                          No Gmail accounts connected yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <button
                      onClick={() => onSelectUser(user)}
                      className="btn btn-primary"
                      style={{
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        gap: 8,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--gradient-primary)',
                        boxShadow: '0 4px 14px var(--primary-glow)',
                        justifyContent: 'center',
                      }}
                      title={`Access ${user.email}'s mailbox & workspace`}
                    >
                      <span>Access Workspace</span>
                      <ArrowRight size={15} />
                    </button>

                    {/* <button
                      type="button"
                      onClick={() => setEventTargetUser(user)}
                      className="btn btn-secondary"
                      style={{
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 700,
                        gap: 6,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(168, 85, 247, 0.45)',
                        background: 'rgba(168, 85, 247, 0.12)',
                        color: '#d8b4fe',
                        justifyContent: 'center',
                      }}
                      title={`Dispatch real-time WebSocket event to ${user.email}`}
                    >
                      <Zap size={15} />
                      <span>Send Event</span>
                    </button> */}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Real-time WebSocket Event Dispatcher Modal */}
      <SendWebSocketModal
        isOpen={!!eventTargetUser}
        targetUser={eventTargetUser}
        onClose={() => setEventTargetUser(null)}
        onSuccess={(evt) => {
          setFeedbackToast(`WebSocket event "${evt.title || 'Notification'}" dispatched to ${eventTargetUser?.email}!`);
          setTimeout(() => setFeedbackToast(null), 5000);
        }}
      />

      {/* Success Feedback Toast */}
      {feedbackToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#6ee7b7',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{feedbackToast}</span>
        </div>
      )}
    </div>
  );
}
