import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Mail,
  ChevronDown,
  Search,
  RefreshCw,
  LogOut,
  Plus,
  Shield,
  User as UserIcon,
  Check,
  X,
} from 'lucide-react';

export default function Navbar({
  accounts = [],
  activeAccount = null,
  onSelectAccount,
  onConnectAccount,
  onRefresh,
  refreshing = false,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
}) {
  const { user, isAdmin, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      style={{
        height: 'var(--header-height)',
        background: 'rgba(13, 19, 31, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        gap: 16,
        zIndex: 50,
      }}
    >
      {/* Brand & Account Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px var(--primary-glow)',
            }}
          >
            <Mail size={18} color="#ffffff" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>
            MailHub
          </span>
        </div>

        {/* Account Selector Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              height: 36,
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {activeAccount ? (
              <>
                <span className="pulse-dot" />
                <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeAccount.email_address}
                </span>
                {isAdmin && activeAccount.user && activeAccount.user.email !== user?.email && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    ({activeAccount.user.email})
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>No Accounts Connected</span>
            )}
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          {dropdownOpen && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: 320,
                padding: 6,
                background: '#111827',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                animation: 'fadeIn 0.15s ease',
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-subtle)',
                  marginBottom: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Connected Gmail Accounts</span>
                <span>{accounts.length} Total</span>
              </div>

              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {accounts.length === 0 ? (
                  <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No Gmail accounts connected yet.
                  </div>
                ) : (
                  accounts.map((acc) => {
                    const isSelected = activeAccount?.id === acc.id;
                    return (
                      <div
                        key={acc.id}
                        onClick={() => {
                          onSelectAccount(acc);
                          setDropdownOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          transition: 'background var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            className="pulse-dot"
                            style={{
                              background: acc.is_active ? 'var(--emerald)' : 'var(--rose)',
                              boxShadow: acc.is_active ? '0 0 8px var(--emerald)' : 'none',
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {acc.email_address}
                            </div>
                            {isAdmin && acc.user && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                User: {acc.user.email}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check size={16} color="var(--primary)" />}
                      </div>
                    );
                  })
                )}
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  marginTop: 4,
                  paddingTop: 4,
                }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setDropdownOpen(false);
                    onConnectAccount();
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    border: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    color: 'var(--primary)',
                  }}
                >
                  <Plus size={16} />
                  <span>Connect Another Gmail</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Search Bar */}
      <div style={{ flex: 1, maxWidth: 540 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
          style={{ position: 'relative' }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="input-field"
            placeholder={
              activeAccount
                ? `Search emails in ${activeAccount.email_address} (e.g. from:client, has:attachment)...`
                : 'Select an account to search emails...'
            }
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={!activeAccount}
            style={{
              paddingLeft: 38,
              paddingRight: searchQuery ? 36 : 14,
              height: 38,
              background: 'rgba(15, 23, 42, 0.6)',
              fontSize: 13,
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              className="btn-icon"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: 4,
              }}
            >
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      {/* User Info & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Refresh button */}
        <button
          className="btn-icon"
          onClick={onRefresh}
          disabled={refreshing || !activeAccount}
          title="Refresh emails"
          style={{ width: 36, height: 36 }}
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        </button>

        {/* User Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 10px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: isAdmin ? 'var(--gradient-admin)' : 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.email}
            </span>
          </div>

          <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-user'}`}>
            {isAdmin ? 'Admin' : 'User'}
          </span>
        </div>

        {/* Logout */}
        <button
          className="btn-icon"
          onClick={logout}
          title="Sign out of MailHub"
          style={{ width: 36, height: 36, color: 'var(--rose)' }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
