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
export function useWebSocketEvents({ onEvent, onSyncTrigger, enabled = true } = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const isExplicitCloseRef = useRef(false);

  // Store callbacks in refs to avoid reconnect loops when inline callbacks re-render
  const onEventRef = useRef(onEvent);
  const onSyncTriggerRef = useRef(onSyncTrigger);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onSyncTriggerRef.current = onSyncTrigger;
  }, [onSyncTrigger]);

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

    try {
      console.log("wsUrl:", wsUrl)
      isExplicitCloseRef.current = false;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);

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

        // If not deliberately closed (e.g. 4001/4002 unauthenticated or component unmount), retry after 6s
        if (!isExplicitCloseRef.current && event.code !== 4001 && event.code !== 4002 && enabled) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 6000);
        }
      };

      ws.onerror = (err) => {
        console.debug('WebSocket error encountered:', err);
      };
    } catch (err) {
      console.debug('Failed to initialize WebSocket connection:', err);
    }
  }, [enabled]);

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
