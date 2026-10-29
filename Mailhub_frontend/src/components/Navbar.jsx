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
  FileText,
  Sparkles,
  Menu,
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
  userResume = null,
  onOpenResumeModal,
  sidebarOpen = false,
  onToggleSidebar,
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
      className="navbar-header"
      style={{
        height: 'var(--header-height)',
        background: 'rgba(13, 19, 31, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        gap: 12,
        zIndex: 50,
        position: 'relative',
      }}
    >
      {/* Brand & Account Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Mobile Hamburger Drawer Toggle */}
        <button
          type="button"
          className="btn-icon navbar-menu-toggle"
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Close Menu' : 'Open Menu'}
          aria-label="Toggle navigation menu"
          style={{
            display: 'none',
            color: 'var(--text-primary)',
          }}
        >
          <Menu size={20} />
        </button>

        {/* Brand Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px var(--primary-glow)',
              flexShrink: 0,
            }}
          >
            <Mail size={18} color="#ffffff" />
          </div>
          <span
            className="navbar-brand-title"
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            MailHub
          </span>
        </div>

        {/* Account Selector Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="btn btn-secondary"
            style={{
              padding: '6px 10px',
              height: 36,
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'var(--border-subtle)',
              gap: 6,
            }}
          >
            {activeAccount ? (
              <>
                <span className="pulse-dot" />
                <span
                  className="navbar-account-text"
                  style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {activeAccount.email_address}
                </span>
                {isAdmin && activeAccount.user && activeAccount.user.email !== user?.email && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }} className="navbar-account-owner">
                    ({activeAccount.user.email.split('@')[0]})
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No Accounts</span>
            )}
            <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>

          {dropdownOpen && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: 'min(320px, calc(100vw - 24px))',
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
                <span>Gmail Accounts</span>
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
      <div className="navbar-search-box" style={{ flex: 1, maxWidth: 520, minWidth: 0 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
          style={{ position: 'relative', width: '100%' }}
        >
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="input-field"
            placeholder={
              activeAccount
                ? `Search emails in ${activeAccount.email_address}...`
                : 'Select an account to search...'
            }
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={!activeAccount}
            style={{
              paddingLeft: 36,
              paddingRight: searchQuery ? 34 : 12,
              height: 36,
              background: 'rgba(15, 23, 42, 0.65)',
              fontSize: 13,
              borderRadius: 'var(--radius-md)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
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
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      {/* User Info & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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

        {/* Resume Management Button */}
        <button
          type="button"
          onClick={onOpenResumeModal}
          className="btn btn-secondary"
          style={{
            padding: '5px 10px',
            height: 36,
            background: userResume ? 'rgba(16, 185, 129, 0.08)' : 'rgba(99, 102, 241, 0.1)',
            borderColor: userResume ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)',
            color: userResume ? '#6ee7b7' : 'var(--primary)',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title={userResume ? `Resume: ${userResume.original_filename}. Click to manage.` : 'Upload resume for Gemini AI email generation'}
        >
          {userResume ? <FileText size={14} /> : <Sparkles size={14} />}
          <span className="navbar-resume-text" style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userResume ? userResume.original_filename : 'Resume'}
          </span>
          {userResume && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--emerald)',
                flexShrink: 0,
              }}
            />
          )}
        </button>

        {/* User Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
            height: 36,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: isAdmin ? 'var(--gradient-admin)' : 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 800,
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>

          <span
            className="navbar-user-text"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email}
          </span>

          <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-user'}`} style={{ padding: '2px 6px', fontSize: 10 }}>
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
