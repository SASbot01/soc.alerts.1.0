import { useEffect, useRef, useCallback, useState } from 'react';

export interface SseEvent {
    type: 'threat' | 'incident' | 'alert' | 'dashboard_update' | 'ai_agent_log';
    data: Record<string, unknown>;
    timestamp: Date;
}

export interface AiAgentLogEvent {
    level: string;
    action: string;
    message: string;
    timestamp: string;
    companyId: string;
}

interface UseSseEventsOptions {
    companyId: string | null;
    onThreat?: (data: Record<string, unknown>) => void;
    onIncident?: (data: Record<string, unknown>) => void;
    onAlert?: (data: Record<string, unknown>) => void;
    onDashboardUpdate?: () => void;
    onAiAgentLog?: (data: AiAgentLogEvent) => void;
}

export function useSseEvents({
    companyId,
    onThreat,
    onIncident,
    onAlert,
    onDashboardUpdate,
    onAiAgentLog,
}: UseSseEventsOptions) {
    const eventSourceRef = useRef<EventSource | null>(null);
    const [connected, setConnected] = useState(false);
    const [events, setEvents] = useState<SseEvent[]>([]);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const addEvent = useCallback((type: SseEvent['type'], data: Record<string, unknown>) => {
        setEvents(prev => {
            const newEvents = [...prev, { type, data, timestamp: new Date() }];
            // Keep last 50 events
            return newEvents.slice(-50);
        });
    }, []);

    const connect = useCallback(() => {
        if (!companyId) return;

        const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
        const url = `${baseUrl}/sse/events?companyId=${companyId}`;

        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        es.addEventListener('connected', () => {
            setConnected(true);
        });

        es.addEventListener('threat', (e) => {
            try {
                const data = JSON.parse(e.data);
                addEvent('threat', data);
                onThreat?.(data);
            } catch { /* ignore parse errors */ }
        });

        es.addEventListener('incident', (e) => {
            try {
                const data = JSON.parse(e.data);
                addEvent('incident', data);
                onIncident?.(data);
            } catch { /* ignore */ }
        });

        es.addEventListener('alert', (e) => {
            try {
                const data = JSON.parse(e.data);
                addEvent('alert', data);
                onAlert?.(data);
            } catch { /* ignore */ }
        });

        es.addEventListener('dashboard_update', () => {
            onDashboardUpdate?.();
        });

        es.addEventListener('ai_agent_log', (e) => {
            try {
                const data = JSON.parse(e.data);
                addEvent('ai_agent_log', data);
                onAiAgentLog?.(data as AiAgentLogEvent);
            } catch { /* ignore */ }
        });

        es.onerror = () => {
            setConnected(false);
            es.close();
            // Reconnect after 5 seconds
            reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };
    }, [companyId, onThreat, onIncident, onAlert, onDashboardUpdate, onAiAgentLog, addEvent]);

    useEffect(() => {
        connect();

        return () => {
            eventSourceRef.current?.close();
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [connect]);

    const clearEvents = useCallback(() => setEvents([]), []);

    return { connected, events, clearEvents };
}
