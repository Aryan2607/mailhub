import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api';
import {
  Image as ImageIcon,
  Download,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  Eye,
  X,
  FileImage,
  Calendar,
  HardDrive,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Maximize2,
} from 'lucide-react';

export default function AdminCapturedImagesView({
  selectedUser,
  onBack,
  receiveImageActive = false,
  onToggleReceiveImage = null,
}) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // Lightbox preview
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);

  const showFeedback = (message, type = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 4500);
  };

  const loadImages = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await adminApi.getCapturedImages(selectedUser?.id, searchQuery);
      setImages(response.images || []);
    } catch (err) {
      console.error('Failed to load captured images:', err);
      showFeedback(err.message || 'Failed to fetch captured images.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedUser?.id, searchQuery]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleDelete = async (imageId) => {
    setDeletingId(imageId);
    try {
      await adminApi.deleteCapturedImage(imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      if (selectedImage?.id === imageId) setSelectedImage(null);
      setDeleteConfirmId(null);
      showFeedback('Image deleted successfully from Google Drive and database.');
    } catch (err) {
      showFeedback(err.message || 'Failed to delete image.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (img) => {
    const downloadUrl = img.web_content_link || img.image_url;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = img.original_filename || `captured_image_${img.id}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredImages = images.filter((img) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      img.original_filename?.toLowerCase().includes(q) ||
      img.caption?.toLowerCase().includes(q) ||
      img.user_email?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-app)',
      }}
    >
      {/* Toast Notification */}
      {feedbackToast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background:
              feedbackToast.type === 'error'
                ? 'rgba(239, 68, 68, 0.95)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))',
            color: '#ffffff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            fontSize: 13,
            fontWeight: 600,
            backdropFilter: 'blur(10px)',
          }}
        >
          {feedbackToast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div
        style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(99, 102, 241, 0.2) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d8b4fe',
            }}
          >
            <ImageIcon size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Captured Images Gallery
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'rgba(168, 85, 247, 0.18)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  color: '#d8b4fe',
                }}
              >
                {filteredImages.length} {filteredImages.length === 1 ? 'image' : 'images'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Google Drive monitored images for{' '}
              <strong style={{ color: '#fbbf24' }}>{selectedUser?.email || 'All Users'}</strong>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Search Box */}
          <div
            style={{
              position: 'relative',
              width: 220,
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter images..."
              className="input-field"
              style={{
                height: 34,
                paddingLeft: 30,
                fontSize: 12,
                borderRadius: 'var(--radius-sm)',
              }}
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadImages(true)}
            disabled={refreshing || loading}
            className="btn btn-secondary"
            style={{
              height: 34,
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 600,
              gap: 6,
            }}
            title="Refresh image gallery"
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Return to Inbox / Mailbox View Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="btn btn-secondary"
              style={{
                height: 34,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 600,
              }}
              title="Return to user's mailboxes"
            >
              <span>Back to Mailbox</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 280,
              gap: 12,
              color: 'var(--text-muted)',
            }}
          >
            <RefreshCw size={28} className="spin" color="var(--primary)" />
            <span style={{ fontSize: 13 }}>Loading captured images...</span>
          </div>
        ) : filteredImages.length === 0 ? (
          /* Empty State */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 340,
              padding: '40px 20px',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border-subtle)',
              maxWidth: 580,
              margin: '30px auto',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
                marginBottom: 16,
              }}
            >
              <FileImage size={30} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
              No Captured Images Found
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                margin: '0 0 20px 0',
                maxWidth: 420,
                lineHeight: 1.55,
              }}
            >
              {searchQuery
                ? `No images match your search query "${searchQuery}".`
                : `No images have been captured or uploaded to Google Drive for ${selectedUser?.email || 'this user'} yet.`}
            </p>

            {onToggleReceiveImage && (
              <button
                type="button"
                onClick={onToggleReceiveImage}
                className="btn btn-primary"
                style={{
                  height: 38,
                  padding: '0 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  gap: 8,
                  background: receiveImageActive
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.9))'
                    : 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                }}
              >
                <ImageIcon size={15} />
                <span>{receiveImageActive ? 'Stop Receive Image' : 'Start Receive Image'}</span>
              </button>
            )}
          </div>
        ) : (
          /* Images Grid */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            {filteredImages.map((img) => {
              const isDeleting = deletingId === img.id;
              const isConfirming = deleteConfirmId === img.id;

              return (
                <div
                  key={img.id}
                  className="glass-panel"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: 'rgba(30, 41, 59, 0.55)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.4)';
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  {/* Thumbnail / Image Preview Container */}
                  <div
                    style={{
                      height: 170,
                      position: 'relative',
                      background: 'rgba(15, 23, 42, 0.8)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedImage(img)}
                    title="Click to view full preview"
                  >
                    <img
                      src={img.image_url}
                      alt={img.original_filename}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.3s ease',
                      }}
                      onMouseEnter={(e) => (e.target.style.transform = 'scale(1.05)')}
                      onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
                      onError={(e) => {
                        // Fallback icon if preview fails
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'flex';
                        }
                      }}
                    />
                    <div
                      style={{
                        display: 'none',
                        width: '100%',
                        height: '100%',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 8,
                        color: 'var(--text-dim)',
                      }}
                    >
                      <FileImage size={36} />
                      <span style={{ fontSize: 11 }}>Preview in Drive</span>
                    </div>

                    {/* Quick Lightbox Action Overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(6px)',
                        borderRadius: 6,
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#ffffff',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      <Maximize2 size={11} />
                      <span>Zoom</span>
                    </div>

                    {/* File Size Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        background: 'rgba(0, 0, 0, 0.75)',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'rgba(255, 255, 255, 0.85)',
                      }}
                    >
                      {formatFileSize(img.file_size)}
                    </div>
                  </div>

                  {/* Card Info & Details */}
                  <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: 4,
                      }}
                      title={img.original_filename}
                    >
                      {img.original_filename}
                    </div>

                    {img.caption && (
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          margin: '0 0 8px 0',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {img.caption}
                      </p>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        color: 'var(--text-dim)',
                        marginTop: 'auto',
                        paddingTop: 8,
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <Calendar size={12} />
                      <span>{formatDate(img.created_at)}</span>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      {/* Download Button */}
                      <button
                        onClick={() => handleDownload(img)}
                        className="btn btn-secondary"
                        style={{
                          flex: 1,
                          height: 32,
                          padding: '0 8px',
                          fontSize: 12,
                          fontWeight: 600,
                          gap: 6,
                          justifyContent: 'center',
                          background: 'rgba(168, 85, 247, 0.12)',
                          borderColor: 'rgba(168, 85, 247, 0.35)',
                          color: '#d8b4fe',
                        }}
                        title="Download image file to local machine"
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </button>

                      {/* Open in Drive Link */}
                      <a
                        href={img.web_view_link || img.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{
                          width: 32,
                          height: 32,
                          minWidth: 32,
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Open in Google Drive / New tab"
                      >
                        <ExternalLink size={13} color="var(--text-secondary)" />
                      </a>

                      {/* Delete Button */}
                      {isConfirming ? (
                        <button
                          onClick={() => handleDelete(img.id)}
                          disabled={isDeleting}
                          className="btn btn-danger"
                          style={{
                            height: 32,
                            padding: '0 8px',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                          title="Confirm permanent deletion"
                        >
                          {isDeleting ? <RefreshCw size={12} className="spin" /> : 'Confirm?'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(img.id)}
                          disabled={isDeleting}
                          className="btn-icon"
                          style={{
                            width: 32,
                            height: 32,
                            color: 'var(--text-muted)',
                          }}
                          title="Delete image"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Fullview Modal */}
      {selectedImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(10px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            style={{
              maxWidth: 'min(900px, 94vw)',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#0f172a',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15, 23, 42, 0.95)',
              }}
            >
              <div style={{ minWidth: 0, marginRight: 12 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedImage.original_filename}
                </h4>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Uploaded: {formatDate(selectedImage.created_at)} • Size: {formatFileSize(selectedImage.file_size)} • User: {selectedImage.user_email}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => handleDownload(selectedImage)}
                  className="btn btn-secondary"
                  style={{
                    height: 32,
                    padding: '0 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    gap: 6,
                    color: '#d8b4fe',
                    borderColor: 'rgba(168, 85, 247, 0.4)',
                  }}
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="btn-icon"
                  style={{ width: 32, height: 32 }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Image Display */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                background: 'rgba(0, 0, 0, 0.4)',
              }}
            >
              <img
                src={selectedImage.image_url}
                alt={selectedImage.original_filename}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: 6,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

