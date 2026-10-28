import React, { useState, useEffect, useRef } from 'react';
import { resumeApi } from '../api';
import {
  X,
  Upload,
  FileText,
  Trash2,
  Download,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Loader2,
  RefreshCw,
  FileCheck,
} from 'lucide-react';

export default function ResumeModal({ isOpen, onClose, onResumeUpdated }) {
  const [resumeData, setResumeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch resume info on open
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSuccessMsg('');
    fetchResume();
  }, [isOpen]);

  const fetchResume = async () => {
    setLoading(true);
    try {
      const data = await resumeApi.getResume();
      if (data.has_resume) {
        setResumeData(data.resume);
      } else {
        setResumeData(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch resume status.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit. Please upload a resume file under 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError('');
    setSuccessMsg('');
    setUploading(true);

    try {
      const res = await resumeApi.uploadResume(file);
      setResumeData(res.resume);
      setSuccessMsg(`Successfully uploaded: ${file.name}`);
      onResumeUpdated?.(res.resume);
    } catch (err) {
      setError(err.message || 'Failed to upload and parse resume.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete your resume? AI email features require a resume.')) {
      return;
    }
    setError('');
    setSuccessMsg('');
    setDeleting(true);

    try {
      await resumeApi.deleteResume();
      setResumeData(null);
      setSuccessMsg('Resume deleted successfully.');
      onResumeUpdated?.(null);
    } catch (err) {
      setError(err.message || 'Failed to delete resume.');
    } finally {
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 540,
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#111827',
          padding: 24,
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 16,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(236, 72, 153, 0.2))',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Resume Management
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Each user can have one resume for Google Gemini AI automated outreach
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".pdf,.docx,.txt,.md"
          onChange={handleFileUpload}
        />

        {/* Alerts */}
        {error && (
          <div
            style={{
              marginTop: 14,
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

        {successMsg && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: '#6ee7b7',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div style={{ marginTop: 18 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
              <Loader2 size={28} className="spinner" style={{ margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13 }}>Loading resume status...</p>
            </div>
          ) : resumeData ? (
            // Resume exists card
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--emerald)',
                    flexShrink: 0,
                  }}
                >
                  <FileCheck size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={resumeData.original_filename}
                    >
                      {resumeData.original_filename}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 10,
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#6ee7b7',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Active
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                    <span>Size: {formatFileSize(resumeData.file_size)}</span>
                    <span>Uploaded: {new Date(resumeData.uploaded_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Gemini Ready Badge */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                <Sparkles size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>
                  Your resume text is extracted and ready for Gemini AI to match with job posts and generate custom emails.
                </span>
              </div>

              {/* Text Preview Toggle */}
              {resumeData.preview_text && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                  >
                    {showPreview ? 'Hide Resume Text Preview' : 'Show Resume Text Preview for AI'}
                  </button>

                  {showPreview && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 12,
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        maxHeight: 140,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'monospace',
                        lineHeight: 1.5,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {resumeData.preview_text}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <a
                  href={resumeApi.getDownloadUrl()}
                  download={resumeData.original_filename}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ flex: 1, textDecoration: 'none', justifyContent: 'center', fontSize: 13 }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ flex: 1, fontSize: 13 }}
                >
                  <RefreshCw size={14} className={uploading ? 'spinner' : ''} />
                  <span>{uploading ? 'Uploading...' : 'Replace Resume'}</span>
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    background: 'rgba(244, 63, 94, 0.1)',
                    color: 'var(--rose)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    padding: '8px 12px',
                  }}
                  title="Delete Resume"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ) : (
            // No resume uploaded state
            <div
              style={{
                border: '2px dashed rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '36px 20px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.015)',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)')}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                {uploading ? <Loader2 size={24} className="spinner" /> : <Upload size={24} />}
              </div>

              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-main)' }}>
                {uploading ? 'Parsing Resume with AI...' : 'Upload Your Resume'}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', maxWidth: 360, marginInline: 'auto' }}>
                Upload your resume in <strong>PDF, DOCX, or TXT</strong> format (max 5MB). Google Gemini will use it to match job descriptions and craft personalized application emails.
              </p>

              <button
                type="button"
                className="btn btn-primary"
                disabled={uploading}
                style={{ margin: '0 auto', fontSize: 13, pointerEvents: 'none' }}
              >
                <Upload size={14} />
                <span>{uploading ? 'Processing File...' : 'Choose File to Upload'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 11,
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Note: Uploading a new resume automatically replaces your previous one.</span>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px 14px', fontSize: 12 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
