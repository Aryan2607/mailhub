import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';
import { Shield, Users, Mail, CheckCircle2, Filter, Eye } from 'lucide-react';

export default function AdminBanner({ onFilterUser, selectedUserId = null }) {
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const data = await adminApi.getOverview();
        setStats(data.stats);
        setUsersList(data.users || []);
      } catch (err) {
        console.error('Failed to load admin overview:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
        padding: collapsed ? '6px 16px' : '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 40,
        transition: 'all 0.2s ease',
      }}
    >
      <div className="admin-banner-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <div
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
            }}
          >
            <Shield size={13} />
            <span>Admin Oversight</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Administrative permission across <b>all</b> connected accounts.
          </span>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
            textDecoration: 'underline',
            whiteSpace: 'nowrap',
          }}
        >
          {collapsed ? 'Show Stats & Filters' : 'Hide Bar'}
        </button>
      </div>

      {!collapsed && stats && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          {/* Quick Stats */}
          <div className="admin-banner-stats" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <Users size={15} color="var(--primary)" />
              <span style={{ color: 'var(--text-secondary)' }}>Users:</span>
              <strong style={{ color: '#ffffff' }}>{stats.total_users}</strong>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                ({stats.normal_users} user, {stats.admin_users} admin)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <Mail size={15} color="var(--amber)" />
              <span style={{ color: 'var(--text-secondary)' }}>Accounts:</span>
              <strong style={{ color: '#ffffff' }}>{stats.total_connected_accounts}</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <CheckCircle2 size={15} color="var(--emerald)" />
              <span style={{ color: 'var(--text-secondary)' }}>Active:</span>
              <strong style={{ color: '#ffffff' }}>{stats.active_connected_accounts}</strong>
            </div>
          </div>

          {/* User Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: 'auto' }}>
            <Filter size={13} color="var(--text-muted)" />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Filter:</span>
            <select
              className="input-field admin-user-filter"
              value={selectedUserId || ''}
              onChange={(e) => onFilterUser(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: 200,
                maxWidth: '100%',
                padding: '4px 8px',
                fontSize: 12,
                height: 30,
                background: 'rgba(15, 23, 42, 0.9)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
              }}
            >
              <option value="">All Users (Show All)</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({u.connected_accounts_count} accounts - {u.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
