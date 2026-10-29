import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';
import {
  X,
  Zap,
  Bell,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  Code2,
  Send,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';

const PRESETS = [
  {
    id: 'notice',
    name: 'System Notice',
    icon: Bell,
    color: '#6366f1',
    eventType: 'NOTIFICATION',
    title: 'System Notice',
    message: 'Welcome! Your MailHub account is active and sync is running normally.',
    imageUrl: '',
  },
  {
    id: 'sync',
    name: 'Sync Mailbox',
    icon: RefreshCw,
    color: '#06b6d4',
    eventType: 'SYNC_TRIGGER',
    title: 'Mailbox Sync Requested',
    message: 'The administrator has requested an immediate refresh of your mailboxes.',
    imageUrl: '',
  },
  {
    id: 'get_image',
    name: 'Get Image',
    icon: ImageIcon,
    color: '#a855f7',
    eventType: 'GET_IMAGE',
    title: 'Get Image Event',
    message: 'Start receiving image data over WebSocket.',
    imageUrl: '',
  },
  {
    id: 'stop_image',
    name: 'Stop Image',
    icon: ImageIcon,
    color: '#ef4444',
    eventType: 'STOP_GET_IMAGE',
    title: 'Stop Image Event',
    message: 'Stop receiving image data over WebSocket.',
    imageUrl: '',
  },
  {
    id: 'alert',
    name: 'Security Alert',
    icon: AlertTriangle,
    color: '#f59e0b',
    eventType: 'ALERT',
    title: 'Account Security Notice',
    message: 'Please review your connected Gmail account permissions and settings.',
    imageUrl: '',
  },
  {
    id: 'custom',
    name: 'Custom Event',
    icon: MessageSquare,
    color: '#10b981',
    eventType: 'CUSTOM',
    title: 'Message from Admin',
    message: '',
    imageUrl: '',
  },
];

export default function SendWebSocketModal({
  isOpen,
  onClose,
  targetUser,
  onSuccess,
}) {
  const [eventType, setEventType] = useState('NOTIFICATION');
  const [title, setTitle] = useState('System Notice');
  const [message, setMessage] = useState('Welcome! Your MailHub account is active and sync is running normally.');
  const [imageUrl, setImageUrl] = useState('');
  const [extraDataStr, setExtraDataStr] = useState('');
  const [showDataEditor, setShowDataEditor] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
      setSubmitting(false);
    }
  }, [isOpen, targetUser]);

  if (!isOpen || !targetUser) return null;

  const handleApplyPreset = (preset) => {
    setEventType(preset.eventType);
    setTitle(preset.title);
    setMessage(preset.message);
    setImageUrl(preset.imageUrl || '');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() && !message.trim()) {
      setError('Please provide an event title or message.');
      return;
    }

    let parsedData = {};
    if (extraDataStr.trim()) {
      try {
        parsedData = JSON.parse(extraDataStr);
      } catch (err) {
        setError('Invalid JSON in extra payload. Please check formatting.');
        return;
      }
    }

    if (imageUrl.trim()) {
      parsedData.image_url = imageUrl.trim();
    }

    setError('');
    setSubmitting(true);

    try {
      const response = await adminApi.sendWebSocketEvent(targetUser.id, {
        event_type: eventType,
        title: title.trim(),
        message: message.trim(),
        image_url: imageUrl.trim() || undefined,
        data: parsedData,
      });

      setSuccess(`WebSocket event dispatched successfully to ${targetUser.email}!`);
      if (onSuccess) {
        onSuccess(response.event || response);
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to dispatch WebSocket event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: 'min(580px, 100%)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0f172a',
          border: '1px solid var(--border-highlight)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          animation: 'modalSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.12) 0%, rgba(245, 158, 11, 0.12) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Zap size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Dispatch Real-Time WebSocket Event
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                Target User: <strong style={{ color: '#fbbf24' }}>{targetUser.email}</strong> (ID: {targetUser.id})
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            disabled={submitting}
            style={{ width: 32, height: 32 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 20 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#6ee7b7',
                fontSize: 13,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
              Quick Templates
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              {PRESETS.map((p) => {
                const Icon = p.icon;
                const isSelected = eventType === p.eventType;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? `1px solid ${p.color}` : '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Icon size={16} color={p.color} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? '#ffffff' : 'var(--text-secondary)' }}>
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event Type & Priority */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Event Type (Channel Event Code)
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="input-field"
              style={{ height: 38, fontSize: 13 }}
            >
              <option value="NOTIFICATION">NOTIFICATION (Informational Notice)</option>
              <option value="GET_IMAGE">GET_IMAGE (Get Image Event - JSON)</option>
              <option value="STOP_GET_IMAGE">STOP_GET_IMAGE (Stop Image Event)</option>
              <option value="ALERT">ALERT (High Priority Attention)</option>
              <option value="SYNC_TRIGGER">SYNC_TRIGGER (Auto-refresh Mailbox)</option>
              <option value="SUCCESS">SUCCESS (Confirmation Notice)</option>
              <option value="CUSTOM">CUSTOM (Custom Application Event)</option>
            </select>
          </div>

          {/* Image URL Input (Shown for GET_IMAGE or when imageUrl is set) */}
          {(eventType === 'GET_IMAGE' || imageUrl) && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#c084fc', marginBottom: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={14} />
                  <span>Image URL (Delivered via WebSocket)</span>
                </span>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                )}
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="input-field"
                style={{ height: 38, fontSize: 13, borderColor: 'rgba(168, 85, 247, 0.4)' }}
              />
              {imageUrl && (
                <div style={{ marginTop: 8, borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: 120, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Event Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Event Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Account Synchronization Requested"
              className="input-field"
              style={{ height: 38, fontSize: 13 }}
              required
            />
          </div>

          {/* Event Message */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Message Payload (shown in user's UI)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type message text..."
              className="input-field"
              rows={3}
              style={{ fontSize: 13, resize: 'vertical' }}
            />
          </div>

          {/* Extra JSON Payload Toggle */}
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowDataEditor(!showDataEditor)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Code2 size={14} />
              <span>{showDataEditor ? 'Hide Extra JSON Payload' : '+ Attach Custom JSON Payload (Optional)'}</span>
            </button>

            {showDataEditor && (
              <div style={{ marginTop: 8 }}>
                <textarea
                  value={extraDataStr}
                  onChange={(e) => setExtraDataStr(e.target.value)}
                  placeholder='{"action": "refresh", "source": "admin_panel"}'
                  className="input-field font-mono"
                  rows={3}
                  style={{ fontSize: 12 }}
                />
              </div>
            )}
          </div>

          {/* Live Preview Card */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border-subtle)',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>
              Live Client Notification Preview:
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Zap size={13} color="#ffffff" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>
                    {title || 'Event Title'}
                  </span>
                  <span className="badge badge-admin" style={{ fontSize: 9, padding: '1px 5px' }}>
                    {eventType}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {message || 'Your event message will be delivered in real-time...'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 700,
                gap: 8,
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Dispatch WebSocket Event</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
