import React, { useState, useCallback } from 'react';
import { AlertTriangle, Shield, Bell, X } from 'lucide-react';
import { useSseEvents, type SseEvent } from '../hooks/useSseEvents';
import { useAuth } from '../context/AuthContext';

interface Notification {
    id: string;
    type: SseEvent['type'];
    title: string;
    message: string;
    severity?: string;
    timestamp: Date;
}

const NotificationToast: React.FC = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback((type: SseEvent['type'], data: Record<string, unknown>) => {
        const id = crypto.randomUUID();
        let title = '';
        let message = '';
        let severity = '';

        switch (type) {
            case 'threat':
                title = `Threat: ${data.threatType}`;
                message = `Severity ${data.severity}/10 from ${data.srcIp}`;
                severity = (data.severity as number) >= 8 ? 'critical' : (data.severity as number) >= 5 ? 'high' : 'medium';
                break;
            case 'incident':
                title = `Incident: ${data.title}`;
                message = `Severity: ${(data.severity as string).toUpperCase()}`;
                severity = data.severity as string;
                break;
            case 'alert':
                title = `Alert: ${data.alertType}`;
                message = data.message as string;
                severity = 'medium';
                break;
        }

        setNotifications(prev => [...prev, { id, type, title, message, severity, timestamp: new Date() }]);

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 8000);
    }, []);

    useSseEvents({
        companyId: user?.companyId || null,
        onThreat: (data) => addNotification('threat', data),
        onIncident: (data) => addNotification('incident', data),
        onAlert: (data) => addNotification('alert', data),
    });

    const dismiss = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
            {notifications.map(n => (
                <div
                    key={n.id}
                    className={`
                        p-4 rounded-[2px] border backdrop-blur-lg shadow-xl
                        animate-in slide-in-from-right fade-in duration-300
                        ${n.severity === 'critical' ? 'bg-red-950/90 border-red-500/50 text-red-100' :
                          n.severity === 'high' ? 'bg-orange-950/90 border-orange-500/50 text-orange-100' :
                          'bg-slate-900/90 border-slate-600/50 text-slate-100'}
                    `}
                >
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            {n.type === 'threat' ? <AlertTriangle className="w-5 h-5" /> :
                             n.type === 'incident' ? <Shield className="w-5 h-5" /> :
                             <Bell className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{n.title}</p>
                            <p className="text-xs opacity-80 mt-0.5">{n.message}</p>
                        </div>
                        <button onClick={() => dismiss(n.id)} className="flex-shrink-0 opacity-60 hover:opacity-100">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default NotificationToast;
