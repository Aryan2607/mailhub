import React, { useState, useEffect, useRef } from 'react';
import { emailsApi, geminiApi } from '../api';
import {
  X,
  Send,
  Paperclip,
  Trash2,
  AlertCircle,
  File,
  Sparkles,
  Users,
  Mail,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Square,
  FileText,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function ComposeModal({
  isOpen,
  onClose,
  activeAccount,
  mode = 'new', // 'new', 'reply', 'forward'
  originalEmail = null,
  onEmailSent,
  userResume = null,
  onOpenResumeModal,
}) {
  // Mode selection: 'single' (targeted) or 'bulk' (mail list)
  const [tabMode, setTabMode] = useState('single'); // 'single' | 'bulk'

  // Single Mail fields
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [attachResume, setAttachResume] = useState(false);

  // Gemini Single Job Application Generator
  const [showSingleAiBox, setShowSingleAiBox] = useState(false);
  const [jobPostText, setJobPostText] = useState('');
  const [generatingSingle, setGeneratingSingle] = useState(false);
  const [singleAiSuccess, setSingleAiSuccess] = useState(false);

  // Bulk Outreach fields
  const [bulkEmailsRaw, setBulkEmailsRaw] = useState('');
  const [targetJobRole, setTargetJobRole] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [bulkAiSuccess, setBulkAiSuccess] = useState(false);

  // Bulk Campaign Execution state
  const [isCampaignRunning, setIsCampaignRunning] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState(0); // index of current recipient
  const [campaignCountdown, setCampaignCountdown] = useState(0); // seconds until next send
  const [campaignResults, setCampaignResults] = useState([]); // [{ email, status: 'sent'|'failed'|'queued'|'sending', error }]
  const abortCampaignRef = useRef(false);

  // General UI state
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const fileInputRef = useRef(null);

  // Reset or initialize on open
  useEffect(() => {
    if (!isOpen) return;

    setError('');
    setAttachments([]);
    setGeneratingSingle(false);
    setGeneratingBulk(false);
    setSingleAiSuccess(false);
    setBulkAiSuccess(false);
    setIsCampaignRunning(false);
    setCampaignResults([]);

    if (mode === 'reply' && originalEmail) {
      setTabMode('single');
      setTo(originalEmail.from || '');
      const s = originalEmail.subject || '';
      setSubject(s.toLowerCase().startsWith('re:') ? s : `Re: ${s}`);
      setBodyText('');
      setAttachResume(false);
    } else if (mode === 'forward' && originalEmail) {
      setTabMode('single');
      setTo('');
      const s = originalEmail.subject || '';
      setSubject(s.toLowerCase().startsWith('fwd:') ? s : `Fwd: ${s}`);
      setBodyText('');
      setAttachResume(false);
    } else {
      setTo('');
      setCc('');
      setBcc('');
      setSubject('');
      setBodyText('');
      setJobPostText('');
      setBulkEmailsRaw('');
      setTargetJobRole('');
      setBulkNotes('');
      setShowCc(false);
      setShowBcc(false);
      // If user has a resume, default attachResume to true when generating
      setAttachResume(Boolean(userResume));
    }
  }, [isOpen, mode, originalEmail, userResume]);

  if (!isOpen || !activeAccount) return null;

  // Parse bulk emails from raw string
  const getParsedBulkEmails = () => {
    const rawList = bulkEmailsRaw
      .split(/[\n,; ]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.includes('@'));
    // Unique emails preserving order
    return Array.from(new Set(rawList));
  };

  const parsedBulkEmails = getParsedBulkEmails();

  // Handle local file attachments
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setAttachments((prev) => [...prev, ...selectedFiles]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // 1. Generate Single Job Application Email with Gemini
  const handleGenerateSingle = async () => {
    if (!userResume) {
      setError('Please upload your resume first to use Gemini AI generation.');
      return;
    }
    if (!jobPostText.trim()) {
      setError('Please enter the job vacancy or job post details.');
      return;
    }

    setError('');
    setGeneratingSingle(true);
    setSingleAiSuccess(false);

    try {
      const res = await geminiApi.generateSingle({
        recipient_email: to.trim(),
        job_post: jobPostText.trim(),
      });

      setSubject(res.subject || subject);
      setBodyText(res.body || bodyText);
      setAttachResume(true);
      setSingleAiSuccess(true);
      setShowSingleAiBox(false); // collapse after successful generation
    } catch (err) {
      setError(err.message || 'Failed to generate email with Gemini.');
    } finally {
      setGeneratingSingle(false);
    }
  };

  // 2. Generate Bulk Cold Outreach Email with Gemini
  const handleGenerateBulk = async () => {
    if (!userResume) {
      setError('Please upload your resume first to use Gemini AI outreach generation.');
      return;
    }
    if (!targetJobRole.trim()) {
      setError('Please specify which kind of job / role you are searching for.');
      return;
    }

    setError('');
    setGeneratingBulk(true);
    setBulkAiSuccess(false);

    try {
      const res = await geminiApi.generateBulk({
        target_job_role: targetJobRole.trim(),
        notes: bulkNotes.trim(),
      });

      setSubject(res.subject || subject);
      setBodyText(res.body || bodyText);
      setAttachResume(true);
      setBulkAiSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to generate bulk outreach email with Gemini.');
    } finally {
      setGeneratingBulk(false);
    }
  };

  // 3. Submit Single Email Send
  const handleSingleSubmit = async (e) => {
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

      const formData = new FormData();
      toList.forEach((addr) => formData.append('to', addr));
      ccList.forEach((addr) => formData.append('cc', addr));
      bccList.forEach((addr) => formData.append('bcc', addr));
      formData.append('subject', subject);
      formData.append('body_text', bodyText);
      formData.append('body_html', bodyText.replace(/\n/g, '<br>'));

      if (attachResume && userResume) {
        formData.append('attach_resume', 'true');
      }

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

  // 4. Start Sequential Bulk Campaign (5s interval between sends)
  const handleStartBulkCampaign = async () => {
    if (parsedBulkEmails.length === 0) {
      setError('Please add at least one valid recipient email to the list.');
      return;
    }
    if (!subject.trim()) {
      setError('Please provide a subject line for your outreach campaign.');
      return;
    }
    if (!bodyText.trim()) {
      setError('Please provide the email body content.');
      return;
    }

    setError('');
    setIsCampaignRunning(true);
    abortCampaignRef.current = false;

    // Initialize campaign results
    const initialResults = parsedBulkEmails.map((email, idx) => ({
      email,
      status: idx === 0 ? 'sending' : 'queued',
      error: null,
    }));
    setCampaignResults(initialResults);

    for (let i = 0; i < parsedBulkEmails.length; i++) {
      if (abortCampaignRef.current) {
        break;
      }

      const currentRecipient = parsedBulkEmails[i];
      setCampaignProgress(i);

      // Update status to 'sending'
      setCampaignResults((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'sending' } : item))
      );

      try {
        const formData = new FormData();
        formData.append('to', currentRecipient);
        formData.append('subject', subject);
        formData.append('body_text', bodyText);
        formData.append('body_html', bodyText.replace(/\n/g, '<br>'));

        if (attachResume && userResume) {
          formData.append('attach_resume', 'true');
        }

        attachments.forEach((file) => {
          formData.append('attachments', file);
        });

        // Send through active Gmail account
        await emailsApi.sendEmail(activeAccount.id, formData);

        // Mark current as sent
        setCampaignResults((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'sent' } : item))
        );
      } catch (err) {
        setCampaignResults((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'failed', error: err.message || 'Send failed' } : item
          )
        );
      }

      // If there are more emails, wait 5 seconds with countdown
      if (i < parsedBulkEmails.length - 1 && !abortCampaignRef.current) {
        for (let s = 5; s > 0; s--) {
          if (abortCampaignRef.current) break;
          setCampaignCountdown(s);
          await new Promise((res) => setTimeout(res, 1000));
        }
        setCampaignCountdown(0);
      }
    }

    setIsCampaignRunning(false);
    onEmailSent?.();
  };

  const handleStopCampaign = () => {
    abortCampaignRef.current = true;
    setIsCampaignRunning(false);
    setCampaignCountdown(0);
  };

  return (
    <div
      className="compose-window"
      style={{
        width: isMaximized ? '92vw' : 640,
        height: isMaximized ? '92vh' : 'auto',
        maxHeight: isMaximized ? '92vh' : '88vh',
        transition: 'all 0.25s ease',
      }}
    >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
            {mode === 'reply'
              ? 'Reply to Message'
              : mode === 'forward'
              ? 'Forward Message'
              : 'Compose Message'}
          </span>

          {/* Mode Switcher Tabs (Only when mode === 'new') */}
          {mode === 'new' && !isCampaignRunning && (
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: 2,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                marginLeft: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setTabMode('single')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: tabMode === 'single' ? 'var(--primary)' : 'transparent',
                  color: tabMode === 'single' ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Mail size={13} />
                <span>Single Mail</span>
              </button>

              <button
                type="button"
                onClick={() => setTabMode('bulk')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: tabMode === 'bulk' ? 'var(--primary)' : 'transparent',
                  color: tabMode === 'bulk' ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Users size={13} />
                <span>Mail List (Bulk)</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="btn-icon"
            onClick={() => setIsMaximized(!isMaximized)}
            style={{ padding: 4, color: 'var(--text-muted)' }}
            title={isMaximized ? 'Restore down' : 'Maximize'}
          >
            {isMaximized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button className="btn-icon" onClick={onClose} disabled={sending || isCampaignRunning} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* From Sender & Resume Status Header */}
      <div
        style={{
          padding: '8px 18px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
          <span>From:</span>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{activeAccount.email_address}</span>
        </div>

        {/* User Resume Indicator */}
        {userResume ? (
          <div
            onClick={onOpenResumeModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              color: 'var(--emerald)',
              fontSize: 11,
              fontWeight: 600,
            }}
            title="Click to view or replace resume"
          >
            <FileText size={13} />
            <span>Resume: {userResume.original_filename}</span>
          </div>
        ) : (
          <div
            onClick={onOpenResumeModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              color: '#f59e0b',
              fontSize: 11,
              fontWeight: 600,
            }}
            title="Click to upload resume"
          >
            <AlertCircle size={13} />
            <span>Upload Resume for AI</span>
          </div>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            margin: '10px 18px 0',
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
          <span style={{ flex: 1 }}>{error}</span>
          {!userResume && (
            <button
              type="button"
              onClick={onOpenResumeModal}
              className="btn btn-secondary"
              style={{ padding: '3px 8px', fontSize: 11 }}
            >
              Upload Resume
            </button>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* -------------------- CAMPAIGN RUNNING VIEW -------------------- */}
      {isCampaignRunning || (campaignResults.length > 0 && tabMode === 'bulk' && !error) ? (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', flex: 1, gap: 14 }}>
          <div
            style={{
              padding: 16,
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                {isCampaignRunning ? 'Bulk Outreach Campaign in Progress...' : 'Campaign Completed!'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {campaignResults.filter((r) => r.status === 'sent').length} / {campaignResults.length} sent
              </span>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                height: 8,
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(campaignResults.filter((r) => r.status === 'sent' || r.status === 'failed').length / Math.max(campaignResults.length, 1)) * 100}%`,
                  background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {/* Countdown timer */}
            {isCampaignRunning && campaignCountdown > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--primary)' }}>
                <Clock size={14} className="spinner" />
                <span>
                  Waiting 5s interval to ensure deliverability... Next email in <strong>{campaignCountdown}s</strong>
                </span>
              </div>
            )}
          </div>

          {/* Results List */}
          <div
            style={{
              flex: 1,
              maxHeight: 220,
              overflowY: 'auto',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            {campaignResults.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: 12,
                }}
              >
                <span style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{item.email}</span>
                <div>
                  {item.status === 'sent' && (
                    <span style={{ color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={13} /> Sent
                    </span>
                  )}
                  {item.status === 'sending' && (
                    <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Loader2 size={13} className="spinner" /> Sending...
                    </span>
                  )}
                  {item.status === 'queued' && (
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} /> Queued
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span style={{ color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={13} /> Failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Campaign Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {isCampaignRunning ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleStopCampaign}
                style={{ fontSize: 13 }}
              >
                <Square size={14} />
                <span>Stop Campaign</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setCampaignResults([]);
                  onClose();
                }}
                style={{ fontSize: 13 }}
              >
                <span>Done</span>
              </button>
            )}
          </div>
        </div>
      ) : tabMode === 'bulk' && mode === 'new' ? (
        /* -------------------- TAB 2: BULK MAIL LIST OUTREACH -------------------- */
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', flex: 1, gap: 12, overflowY: 'auto' }}>
          {/* Step 1: Recipients List Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                Recipients List (Enter multiple emails):
              </label>
              {parsedBulkEmails.length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: 'var(--primary)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                  }}
                >
                  ⚡ {parsedBulkEmails.length} recipients detected
                </span>
              )}
            </div>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Paste email addresses separated by comma, space, or new lines...&#10;e.g. hr@company.com, recruiter@startup.io, talent@corp.com"
              value={bulkEmailsRaw}
              onChange={(e) => setBulkEmailsRaw(e.target.value)}
              style={{ fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
            />
          </div>

          {/* Step 2: Gemini Job Outreach Parameters */}
          <div
            style={{
              padding: 12,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.05))',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 13, fontWeight: 700 }}>
              <Sparkles size={15} />
              <span>Google Gemini AI Cold Outreach Generator</span>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                Which kind of job / role are you searching for? *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Full Stack Developer, Python Backend Engineer, React Specialist"
                value={targetJobRole}
                onChange={(e) => setTargetJobRole(e.target.value)}
                style={{ fontSize: 12, padding: '7px 10px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 3 }}>
                Additional Notes / Location / Preferences (optional):
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Seeking remote or hybrid roles in New York/India, available immediately"
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                style={{ fontSize: 12, padding: '7px 10px' }}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerateBulk}
              disabled={generatingBulk}
              style={{
                marginTop: 4,
                justifyContent: 'center',
                fontSize: 12,
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                border: 'none',
              }}
            >
              {generatingBulk ? <Loader2 size={14} className="spinner" /> : <Sparkles size={14} />}
              <span>{generatingBulk ? 'Analyzing Resume & Generating with Gemini...' : 'Generate Subject & Body with Gemini'}</span>
            </button>
          </div>

          {/* Step 3: Subject & Body */}
          <div>
            <input
              type="text"
              className="input-field"
              placeholder="Email Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ fontSize: 13, fontWeight: 600, padding: '7px 10px' }}
            />
          </div>

          <div style={{ flex: 1, minHeight: 120 }}>
            <textarea
              className="input-field"
              rows={6}
              placeholder="Email body text..."
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              style={{ fontSize: 13, lineHeight: 1.6, resize: 'vertical', minHeight: 120 }}
            />
          </div>

          {/* Attachments & Resume pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Resume Badge */}
              {userResume && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: attachResume ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: attachResume ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                    fontSize: 11,
                    color: attachResume ? '#6ee7b7' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={attachResume}
                    onChange={(e) => setAttachResume(e.target.checked)}
                    style={{ accentColor: 'var(--emerald)' }}
                  />
                  <FileText size={12} />
                  <span>Attach Resume ({userResume.original_filename})</span>
                </label>
              )}

              <button
                type="button"
                className="btn-icon"
                onClick={() => fileInputRef.current?.click()}
                title="Add Extra Attachment"
                style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Paperclip size={14} />
                <span>Attach Files</span>
              </button>

              {attachments.map((f, i) => (
                <span
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    fontSize: 11,
                  }}
                >
                  <File size={11} />
                  <span>{f.name}</span>
                  <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeAttachment(i)} />
                </span>
              ))}
            </div>

            {/* Start Bulk Campaign Button */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartBulkCampaign}
              disabled={parsedBulkEmails.length === 0}
              style={{
                fontSize: 13,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
              }}
            >
              <Send size={14} />
              <span>Send to {parsedBulkEmails.length || 0} Emails (5s interval)</span>
            </button>
          </div>
        </div>
      ) : (
        /* -------------------- TAB 1: SINGLE MAIL (TARGETED JOB APPLICATION) -------------------- */
        <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Recipient To */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 44, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
              <input
                type="text"
                required
                className="input-field"
                placeholder="recruiter@company.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
              />
              <div style={{ display: 'flex', gap: 6, fontSize: 12 }}>
                {!showCc && (
                  <button type="button" className="btn-icon" onClick={() => setShowCc(true)} style={{ padding: '2px 6px' }}>
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button type="button" className="btn-icon" onClick={() => setShowBcc(true)} style={{ padding: '2px 6px' }}>
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {/* CC / BCC fields */}
            {showCc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 44, fontSize: 13, color: 'var(--text-muted)' }}>Cc:</span>
                <input
                  type="text"
                  className="input-field"
                  placeholder="cc@example.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                />
              </div>
            )}

            {showBcc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 44, fontSize: 13, color: 'var(--text-muted)' }}>Bcc:</span>
                <input
                  type="text"
                  className="input-field"
                  placeholder="bcc@example.com"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                />
              </div>
            )}

            {/* Gemini AI Job Post Assistant Box Toggle */}
            {mode === 'new' && (
              <div
                style={{
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(236, 72, 153, 0.05))',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => setShowSingleAiBox(!showSingleAiBox)}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={15} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                      Google Gemini AI: Tailor Email to Job Vacancy
                    </span>
                    {singleAiSuccess && (
                      <span style={{ fontSize: 11, color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Check size={13} /> Generated & Attached!
                      </span>
                    )}
                  </div>
                  {showSingleAiBox ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {showSingleAiBox && (
                  <div style={{ padding: '10px 12px 14px', borderTop: '1px solid rgba(99, 102, 241, 0.15)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                      Paste the job post or requirements below. Gemini will match your resume with the vacancy to generate a personalized email pitch.
                    </p>
                    <textarea
                      className="input-field"
                      rows={3}
                      placeholder="Paste job posting / role description here..."
                      value={jobPostText}
                      onChange={(e) => setJobPostText(e.target.value)}
                      style={{ fontSize: 12, resize: 'vertical' }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleGenerateSingle}
                      disabled={generatingSingle}
                      style={{
                        alignSelf: 'flex-start',
                        fontSize: 12,
                        padding: '6px 14px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                        border: 'none',
                      }}
                    >
                      {generatingSingle ? <Loader2 size={13} className="spinner" /> : <Sparkles size={13} />}
                      <span>{generatingSingle ? 'Analyzing Resume & Job Post...' : 'Generate Subject & Body'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Subject */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 44, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Subj:</span>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Email Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', fontSize: 13, fontWeight: 600 }}
              />
            </div>

            {/* Body */}
            <textarea
              required
              className="input-field"
              rows={8}
              placeholder="Write your email here, or use the Gemini AI Assistant above..."
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                padding: '10px 12px',
                minHeight: 140,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Footer Controls & Attachments */}
          <div
            style={{
              padding: '10px 18px',
              background: '#0d131f',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            {/* Left: Attachments & Resume pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {userResume && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: attachResume ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: attachResume ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                    fontSize: 11,
                    color: attachResume ? '#6ee7b7' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={attachResume}
                    onChange={(e) => setAttachResume(e.target.checked)}
                    style={{ accentColor: 'var(--emerald)' }}
                  />
                  <FileText size={12} />
                  <span>Resume Attached ({userResume.original_filename})</span>
                </label>
              )}

              <button
                type="button"
                className="btn-icon"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Files"
                style={{ padding: 6 }}
              >
                <Paperclip size={16} />
              </button>

              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 11,
                    color: 'var(--text-main)',
                  }}
                >
                  <File size={12} />
                  <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                  <X size={12} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => removeAttachment(idx)} />
                </div>
              ))}
            </div>

            {/* Right: Send Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending}
                style={{ fontSize: 13, padding: '7px 18px' }}
              >
                <Send size={14} className={sending ? 'spinner' : ''} />
                <span>{sending ? 'Sending...' : 'Send'}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
