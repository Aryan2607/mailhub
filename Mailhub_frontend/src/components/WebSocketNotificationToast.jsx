import React, { useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Zap,
  X,
  Radio,
  Image as ImageIcon,
} from 'lucide-react';

export default function WebSocketNotificationToast({
  event,
  onDismiss,
}) {
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 12000);
    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  if (!event) return null;

  const eventType = (event.event_type || 'NOTIFICATION').toUpperCase();
  const imageUrl = event.image_url || event.data?.image_url;

  let Icon = Bell;
  let borderColor = 'rgba(99, 102, 241, 0.4)';
  let bgGradient = 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)';
  let badgeClass = 'badge-user';
  let iconColor = 'var(--primary)';

  if (eventType === 'GET_IMAGE' || eventType === 'IMAGE') {
    Icon = ImageIcon;
    borderColor = 'rgba(168, 85, 247, 0.55)';
    iconColor = '#c084fc';
    badgeClass = 'badge-admin';
    bgGradient = 'linear-gradient(135deg, rgba(38, 20, 68, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)';
  } else if (eventType === 'ALERT') {
    Icon = AlertTriangle;
    borderColor = 'rgba(245, 158, 11, 0.5)';
    iconColor = '#fbbf24';
    badgeClass = 'badge-admin';
  } else if (eventType === 'SYNC_TRIGGER') {
    Icon = RefreshCw;
    borderColor = 'rgba(6, 182, 212, 0.5)';
    iconColor = '#22d3ee';
  } else if (eventType === 'SUCCESS') {
    Icon = CheckCircle2;
    borderColor = 'rgba(16, 185, 129, 0.5)';
    iconColor = 'var(--emerald)';
  } else if (eventType === 'CUSTOM') {
    Icon = Zap;
    borderColor = 'rgba(236, 72, 153, 0.5)';
    iconColor = '#f472b6';
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        width: 'min(420px, calc(100vw - 32px))',
        background: bgGradient,
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(99, 102, 241, 0.2)',
        padding: '14px 16px',
        animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: iconColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Radio size={11} className="pulse-dot" style={{ background: 'transparent' }} />
                <span>Live Event</span>
              </span>
              <span className={`badge ${badgeClass}`} style={{ fontSize: 9, padding: '1px 5px' }}>
                {eventType}
              </span>
            </div>

            <button
              onClick={onDismiss}
              className="btn-icon"
              style={{ width: 22, height: 22, minWidth: 22, minHeight: 22, color: 'var(--text-muted)' }}
              title="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>

          <h4
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 4px 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {event.title || 'Incoming WebSocket Event'}
          </h4>

          {event.message && (
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.45,
                wordBreak: 'break-word',
              }}
            >
              {event.message}
            </p>
          )}

          {imageUrl && (
            <div
              style={{
                marginTop: 10,
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(0, 0, 0, 0.35)',
                maxHeight: 180,
              }}
            >
              <img
                src={imageUrl}
                alt={event.title || 'WebSocket Image'}
                style={{
                  width: '100%',
                  height: '100%',
                  maxHeight: 180,
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          {event.sender && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}>
              Dispatched by: <strong style={{ color: 'var(--text-muted)' }}>{event.sender.email || 'Admin'}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
