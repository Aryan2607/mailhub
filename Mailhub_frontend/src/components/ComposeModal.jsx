import React, { useState, useEffect, useRef } from 'react';
import { emailsApi } from '../api';
import {
  X,
  Send,
  Paperclip,
  Trash2,
  Minimize2,
  Maximize2,
  AlertCircle,
  File,
} from 'lucide-react';

export default function ComposeModal({
  isOpen,
  onClose,
  activeAccount,
  mode = 'new', // 'new', 'reply', 'forward'
  originalEmail = null,
  onEmailSent,
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Initialize values based on mode and originalEmail
  useEffect(() => {
    if (!isOpen) return;

    setError('');
    setAttachments([]);

    if (mode === 'reply' && originalEmail) {
      setTo(originalEmail.from || '');
      const s = originalEmail.subject || '';
      setSubject(s.toLowerCase().startsWith('re:') ? s : `Re: ${s}`);
      setBodyText('');
    } else if (mode === 'forward' && originalEmail) {
      setTo('');
      const s = originalEmail.subject || '';
      setSubject(s.toLowerCase().startsWith('fwd:') ? s : `Fwd: ${s}`);
      setBodyText('');
    } else {
      setTo('');
      setCc('');
      setBcc('');
      setSubject('');
      setBodyText('');
      setShowCc(false);
      setShowBcc(false);
    }
  }, [isOpen, mode, originalEmail]);

  if (!isOpen || !activeAccount) return null;

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setAttachments((prev) => [...prev, ...selectedFiles]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const toList = to.split(',').map((s) => s.trim()).filter(Boolean);
    if (toList.length === 0) {
      setError('Please specify at least one recipient (To).');
      return;
    }

    if (!subject.trim()) {
      setError('Please provide an email subject.');
      return;
    }

    setSending(true);

    try {
      const ccList = cc.split(',').map((s) => s.trim()).filter(Boolean);
      const bccList = bcc.split(',').map((s) => s.trim()).filter(Boolean);

      // Use FormData so attachments can be seamlessly uploaded
      const formData = new FormData();
      toList.forEach((addr) => formData.append('to', addr));
      ccList.forEach((addr) => formData.append('cc', addr));
      bccList.forEach((addr) => formData.append('bcc', addr));
      formData.append('subject', subject);
      formData.append('body_text', bodyText);
      formData.append('body_html', bodyText.replace(/\n/g, '<br>'));

      attachments.forEach((file) => {
        formData.append('attachments', file);
      });

      if (mode === 'reply' && originalEmail) {
        await emailsApi.replyEmail(activeAccount.id, originalEmail.id, formData);
      } else if (mode === 'forward' && originalEmail) {
        await emailsApi.forwardEmail(activeAccount.id, originalEmail.id, formData);
      } else {
        await emailsApi.sendEmail(activeAccount.id, formData);
      }

      onEmailSent?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="compose-window">
      {/* Header */}
      <div
        style={{
          padding: '12px 18px',
          background: '#0d131f',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
          {mode === 'reply'
            ? 'Reply to Message'
            : mode === 'forward'
            ? 'Forward Message'
            : 'New Message'}
        </span>
        <button className="btn-icon" onClick={onClose} disabled={sending} style={{ padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* From Sender info */}
      <div
        style={{
          padding: '8px 18px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 12,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>From:</span>
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{activeAccount.email_address}</span>
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            margin: '12px 18px 0',
            padding: '10px 14px',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#fda4af',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* To */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 44, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
            <input
              type="text"
              required
              className="input-field"
              placeholder="recipient@example.com (comma separated for multiple)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                >
                  Cc
                </button>
              )}
              {!showBcc && (
                <button
                  type="button"
                  onClick={() => setShowBcc(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                >
                  Bcc
                </button>
              )}
            </div>
          </div>

          {/* CC */}
          {showCc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 44, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Cc:</span>
              <input
                type="text"
                className="input-field"
                placeholder="cc@example.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
              />
            </div>
          )}

          {/* BCC */}
          {showBcc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 44, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Bcc:</span>
              <input
                type="text"
                className="input-field"
                placeholder="bcc@example.com"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
              />
            </div>
          )}

          {/* Subject */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 44, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Subject:</span>
            <input
              type="text"
              required
              className="input-field"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
            />
          </div>
        </div>

        {/* Text Body Area */}
        <div style={{ padding: '0 18px', flex: 1, minHeight: 200, display: 'flex' }}>
          <textarea
            className="input-field"
            placeholder="Write your email here..."
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            style={{
              flex: 1,
              resize: 'none',
              padding: '12px 14px',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              background: 'transparent',
              borderColor: 'var(--border-subtle)',
            }}
          />
        </div>

        {/* Selected Attachments Pills */}
        {attachments.length > 0 && (
          <div
            style={{
              padding: '10px 18px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              borderTop: '1px solid var(--border-subtle)',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            {attachments.map((file, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 12,
                }}
              >
                <File size={13} color="var(--primary)" />
                <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>({(file.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="btn-icon"
                  style={{ padding: 2, marginLeft: 2 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer Toolbar: Attach button & Send */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            background: '#0d131f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Hidden file input */}
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              <Paperclip size={15} />
              <span>Attach Files</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: 13 }}
            >
              Discard
            </button>

            <button
              type="submit"
              disabled={sending}
              className="btn btn-primary"
              style={{ padding: '6px 18px', fontSize: 13 }}
            >
              {sending ? (
                <span>Sending...</span>
              ) : (
                <>
                  <Send size={15} />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
