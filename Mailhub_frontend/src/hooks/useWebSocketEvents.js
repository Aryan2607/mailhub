import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from '../api';

/**
 * Custom hook to establish and maintain an authenticated WebSocket connection
 * for real-time user events from the MailHub backend.
 *
 * @param {Object} options
 * @param {Function} options.onEvent Callback when an event arrives from admin or system
 * @param {Function} options.onSyncTrigger Callback when a SYNC_TRIGGER event arrives
 * @param {boolean} options.enabled Whether the socket should be actively connected
 */
export function useWebSocketEvents({ user = null, onEvent, onSyncTrigger, enabled = true } = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef(null);
  const isExplicitCloseRef = useRef(false);

  // Store user & callbacks in refs to avoid reconnect loops when inline callbacks re-render
  const userRef = useRef(user);
  const onEventRef = useRef(onEvent);
  const onSyncTriggerRef = useRef(onSyncTrigger);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onSyncTriggerRef.current = onSyncTrigger;
  }, [onSyncTrigger]);

  const getUserTag = useCallback(() => {
    const u = userRef.current;
    if (!u) return '[User]';
    return `[${u.role || 'USER'}: ${u.email || 'unknown'}]`;
  }, []);

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token || !enabled) {
      if (socketRef.current) {
        isExplicitCloseRef.current = true;
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Do not reconnect if already open or connecting
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Determine WS URL dynamically based on environment, current host & protocol
    let wsUrl;
    if (import.meta.env.VITE_WS_BASE_URL) {
      const base = import.meta.env.VITE_WS_BASE_URL.replace(/\/+$/, '');
      wsUrl = `${base}/ws/events/?token=${encodeURIComponent(token)}`;
    } else if (import.meta.env.VITE_API_BASE_URL) {
      const apiBase = import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
      const wsBase = apiBase
        .replace(/^https:\/\//i, 'wss://')
        .replace(/^http:\/\//i, 'ws://');
      wsUrl = `${wsBase}/ws/events/?token=${encodeURIComponent(token)}`;
    } else {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const isLocal =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      // In local dev, backend runs on port 8000; in production, use standard host/port
      const wsHost = isLocal ? '127.0.0.1:8000' : window.location.host;
      wsUrl = `${wsProtocol}//${wsHost}/ws/events/?token=${encodeURIComponent(token)}`;
    }

    const tag = getUserTag();
    console.log(`%c[WebSocket] ${tag} Attempting connection to:`, 'color: #38bdf8; font-weight: bold;', wsUrl);

    if (wsUrl.includes('pythonanywhere.com')) {
      console.warn(
        `%c[WebSocket Warning] ${tag} PythonAnywhere uses WSGI and does not support persistent WebSockets (ASGI). WebSockets require Daphne/Uvicorn (e.g. Render, Railway, or VPS).`,
        'color: #f59e0b; font-weight: 600;'
      );
    }

    try {
      isExplicitCloseRef.current = false;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        console.log(
          `%c[WebSocket Connected] ${tag} Connected successfully!`,
          'color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.1); padding: 2px 6px; border-radius: 4px;',
          wsUrl
        );

        // Setup 30s heartbeat ping
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'PONG') {
            return;
          }

          if (data.type === 'CONNECTION_ESTABLISHED') {
            return;
          }

          if (data.type === 'ADMIN_EVENT' || data.event_type) {
            console.log('WebSocket event is received:');
            console.log('Event data:', data);
            setLastEvent(data);
            if (onEventRef.current) onEventRef.current(data);

            if (data.event_type === 'SYNC_TRIGGER' && onSyncTriggerRef.current) {
              onSyncTriggerRef.current(data);
            }
          }
        } catch (err) {
          console.debug('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        console.warn(
          `%c[WebSocket Disconnected] ${tag} Connection closed:`,
          'color: #f59e0b; font-weight: bold;',
          wsUrl,
          `(Code: ${event.code}${event.reason ? `, Reason: ${event.reason}` : ''})`
        );

        // Back off reconnect if host doesn't support WebSockets or fails repeatedly
        if (!isExplicitCloseRef.current && event.code !== 4001 && event.code !== 4002 && enabled) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(30000, 4000 + reconnectAttemptsRef.current * 3000);

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (err) => {
        console.error(
          `%c[WebSocket Error] ${tag} Connection failed:`,
          'color: #ef4444; font-weight: bold;',
          wsUrl
        );
      };
    } catch (err) {
      console.error(`%c[WebSocket Init Failed] ${tag}`, 'color: #ef4444; font-weight: bold;', wsUrl, err);
    }
  }, [enabled, getUserTag]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      if (socketRef.current) {
        isExplicitCloseRef.current = true;
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
    }

    return () => {
      isExplicitCloseRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [enabled, connect]);

  const sendPing = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'PING' }));
    }
  }, []);

  const sendGetImage = useCallback((options = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'GET_IMAGE',
          action: 'START',
          title: options.title || 'Get Image Event',
          message: options.message || 'Receive image requested (JSON format)',
          data: options.data || { mode: 'stream', active: true },
          timestamp: new Date().toISOString(),
          ...options,
        })
      );
    }
  }, []);

  const sendStopGetImage = useCallback((options = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'STOP_GET_IMAGE',
          action: 'STOP',
          title: options.title || 'Stop Image Event',
          message: options.message || 'Stop receive image requested',
          data: options.data || { mode: 'stream', active: false },
          timestamp: new Date().toISOString(),
          ...options,
        })
      );
    }
  }, []);

  return { isConnected, lastEvent, sendPing, sendGetImage, sendStopGetImage };
}
