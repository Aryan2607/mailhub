// API Service for MailHub Backend
const rawBase = 'http://127.0.0.1:8000'
const API_BASE = (rawBase ? rawBase.replace(/\/+$/, '') : '') + '/api/v1';

// Token Management
export const getAccessToken = () => localStorage.getItem('mailhub_access_token');
export const getRefreshToken = () => localStorage.getItem('mailhub_refresh_token');

export const setTokens = (access, refresh) => {
  if (access) localStorage.setItem('mailhub_access_token', access);
  if (refresh) localStorage.setItem('mailhub_refresh_token', refresh);
};

export const clearTokens = () => {
  localStorage.removeItem('mailhub_access_token');
  localStorage.removeItem('mailhub_refresh_token');
  localStorage.removeItem('mailhub_user');
};

export const getSavedUser = () => {
  try {
    const raw = localStorage.getItem('mailhub_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setSavedUser = (user) => {
  localStorage.setItem('mailhub_user', JSON.stringify(user));
};

// Base Fetch Wrapper with Bearer Auth and Auto-Refresh
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    ...(options.headers || {}),
  };

  // If body is not FormData, ensure Content-Type is json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Handle Token Expiry (401)
  if (response.status === 401 && getRefreshToken() && !endpoint.includes('/auth/login')) {
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: getRefreshToken() }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setTokens(refreshData.access, refreshData.refresh || getRefreshToken());
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${refreshData.access}`;
        response = await fetch(url, { ...options, headers });
      } else {
        clearTokens();
        window.dispatchEvent(new Event('mailhub_auth_expired'));
      }
    } catch {
      clearTokens();
      window.dispatchEvent(new Event('mailhub_auth_expired'));
    }
  }

  // Parse response
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data.error || data.detail || (typeof data === 'object' ? Object.values(data)[0] : 'Request failed');
      throw new Error(Array.isArray(errorMsg) ? errorMsg[0] : errorMsg);
    }
    return data;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response;
}

// ----------------- Auth APIs -----------------
export const authApi = {
  login: async (email, password) => {
    const res = await apiRequest('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setTokens(res.tokens.access, res.tokens.refresh);
    setSavedUser(res.user);
    return res;
  },

  register: async (userData) => {
    const res = await apiRequest('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (res.tokens) {
      setTokens(res.tokens.access, res.tokens.refresh);
      setSavedUser(res.user);
    }
    return res;
  },

  getMe: async () => {
    const user = await apiRequest('/auth/me/');
    setSavedUser(user);
    return user;
  },

  logout: async () => {
    try {
      const refresh = getRefreshToken();
      if (refresh) {
        await apiRequest('/auth/logout/', {
          method: 'POST',
          body: JSON.stringify({ refresh }),
        });
      }
    } finally {
      clearTokens();
    }
  },
};

// ----------------- Gmail Accounts APIs -----------------
export const accountsApi = {
  getAccounts: async (userIdFilter = null) => {
    const query = userIdFilter ? `?user_id=${userIdFilter}` : '';
    return apiRequest(`/gmail/accounts/${query}`);
  },

  getConnectUrl: async () => {
    return apiRequest('/gmail/accounts/connect/', { method: 'POST' });
  },

  getAccountDetail: async (accountId) => {
    return apiRequest(`/gmail/accounts/${accountId}/`);
  },

  disconnectAccount: async (accountId) => {
    return apiRequest(`/gmail/accounts/${accountId}/`, { method: 'DELETE' });
  },

  getProfile: async (accountId) => {
    return apiRequest(`/gmail/accounts/${accountId}/profile/`);
  },
};

// ----------------- Email Actions APIs -----------------
export const emailsApi = {
  listEmails: async (accountId, { folder = 'inbox', q = '', page_token = null, max_results = 25 } = {}) => {
    const params = new URLSearchParams();
    if (folder) params.append('folder', folder);
    if (q) params.append('q', q);
    if (page_token) params.append('page_token', page_token);
    if (max_results) params.append('max_results', max_results);

    return apiRequest(`/gmail/accounts/${accountId}/emails/?${params.toString()}`);
  },

  getEmailDetail: async (accountId, messageId) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/`);
  },

  downloadAttachmentUrl: (accountId, messageId, attachmentId, filename) => {
    return `${API_BASE}/gmail/accounts/${accountId}/emails/${messageId}/attachments/${attachmentId}/?filename=${encodeURIComponent(filename)}`;
  },

  sendEmail: async (accountId, formDataOrJson) => {
    const isFormData = formDataOrJson instanceof FormData;
    return apiRequest(`/gmail/accounts/${accountId}/send/`, {
      method: 'POST',
      body: isFormData ? formDataOrJson : JSON.stringify(formDataOrJson),
    });
  },

  replyEmail: async (accountId, messageId, formDataOrJson) => {
    const isFormData = formDataOrJson instanceof FormData;
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/reply/`, {
      method: 'POST',
      body: isFormData ? formDataOrJson : JSON.stringify(formDataOrJson),
    });
  },

  forwardEmail: async (accountId, messageId, formDataOrJson) => {
    const isFormData = formDataOrJson instanceof FormData;
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/forward/`, {
      method: 'POST',
      body: isFormData ? formDataOrJson : JSON.stringify(formDataOrJson),
    });
  },

  trashEmail: async (accountId, messageId) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/trash/`, { method: 'POST' });
  },

  restoreEmail: async (accountId, messageId) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/restore/`, { method: 'POST' });
  },

  permanentlyDeleteEmail: async (accountId, messageId) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/`, { method: 'DELETE' });
  },

  emptyTrash: async (accountId) => {
    return apiRequest(`/gmail/accounts/${accountId}/trash/empty/`, { method: 'POST' });
  },

  markRead: async (accountId, messageId) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/read/`, { method: 'POST' });
  },

  markUnread: async (accountId, messageId) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/unread/`, { method: 'POST' });
  },

  starEmail: async (accountId, messageId) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/star/`, { method: 'POST' });
  },

  unstarEmail: async (accountId, messageId) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/unstar/`, { method: 'POST' });
  },

  archiveEmail: async (accountId, messageId) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/archive/`, { method: 'POST' });
  },

  modifyLabels: async (accountId, messageId, { add_labels = [], remove_labels = [] }) => {
    return apiRequest(`/gmail/accounts/${accountId}/emails/${messageId}/labels/`, {
      method: 'PATCH',
      body: JSON.stringify({ add_labels, remove_labels }),
    });
  },
};

// ----------------- Admin APIs -----------------
export const adminApi = {
  getOverview: async () => {
    return apiRequest('/gmail/admin/overview/');
  },
  getUsers: async () => {
    return apiRequest('/auth/admin/users/');
  },
};
