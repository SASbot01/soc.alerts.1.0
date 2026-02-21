import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Terminal, Trash2 } from 'lucide-react';
import { useSseEvents } from '../hooks/useSseEvents';
import type { AiAgentLogEvent } from '../hooks/useSseEvents';
import { useAuth } from '../context/AuthContext';

interface LogEntry {
    id: number;
    level: string;
    action: string;
    message: string;
    timestamp: Date;
}

let logIdCounter = 0;

const LEVEL_STYLES: Record<string, { text: string; badge: string }> = {
    CRITICAL: { text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/40' },
    ERROR: { text: 'text-red-400', badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
    WARN: { text: 'text-orange-400', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    INFO: { text: 'text-cyan-400', badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    DEBUG: { text: 'text-slate-500', badge: 'bg-slate-600/15 text-slate-500 border-slate-600/30' },
};

const AiAgentConsole: React.FC = () => {
    const [expanded, setExpanded] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();

    const addLog = useCallback((data: AiAgentLogEvent) => {
        setLogs(prev => {
            const newLogs = [...prev, {
                id: ++logIdCounter,
                level: data.level,
                action: data.action,
                message: data.message,
                timestamp: new Date(data.timestamp),
            }];
            return newLogs.slice(-200); // Keep last 200 entries
        });
    }, []);

    useSseEvents({
        companyId: user?.companyId || null,
        onAiAgentLog: addLog,
    });

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    };

    const clearLogs = () => setLogs([]);

    const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const getStyle = (level: string) => LEVEL_STYLES[level] || LEVEL_STYLES.INFO;

    const criticalCount = logs.filter(l => l.level === 'CRITICAL' || l.level === 'ERROR').length;

    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] backdrop-blur-sm overflow-hidden">
            {/* Header - always visible, clickable to toggle */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">AI Agent Console</span>
                    <span className="text-xs text-slate-500 font-mono">({logs.length} events)</span>
                    {criticalCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-mono animate-pulse">
                            {criticalCount} alerts
                        </span>
                    )}
                    {logs.length > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {expanded && (
                        <span
                            onClick={(e) => { e.stopPropagation(); clearLogs(); }}
                            className="text-slate-500 hover:text-slate-300 p-1 transition-colors cursor-pointer"
                            title="Clear logs"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </span>
                    )}
                    {expanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                    )}
                </div>
            </button>

            {/* Expandable console body */}
            {expanded && (
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="bg-slate-950/80 border-t border-slate-700/50 font-mono text-xs overflow-y-auto max-h-[320px] scrollbar-thin scrollbar-thumb-slate-700"
                >
                    {logs.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-slate-600">
                            <Terminal className="w-4 h-4 mr-2 opacity-50" />
                            Waiting for AI agent events...
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/50">
                            {logs.map((entry) => {
                                const style = getStyle(entry.level);
                                return (
                                    <div key={entry.id} className="flex items-start gap-2 px-3 py-1.5 hover:bg-slate-900/50">
                                        {/* Timestamp */}
                                        <span className="text-slate-600 whitespace-nowrap shrink-0">
                                            {formatTime(entry.timestamp)}
                                        </span>
                                        {/* Level badge */}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${style.badge}`}>
                                            {entry.level}
                                        </span>
                                        {/* Action */}
                                        <span className="text-slate-400 whitespace-nowrap shrink-0">
                                            [{entry.action}]
                                        </span>
                                        {/* Message */}
                                        <span className={`${style.text} break-all`}>
                                            {entry.message}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AiAgentConsole;
