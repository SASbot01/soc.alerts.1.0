import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Plus, Trash2, ArrowLeft, Loader2, Bot } from 'lucide-react';
import { chatService } from '../lib/services';
import type { ChatMessageType, ChatSessionSummary } from '../types';

const AiChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'chat' | 'sessions'>('chat');
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    const loadSessions = async () => {
        setSessionsLoading(true);
        try {
            const data = await chatService.listSessions();
            setSessions(data);
        } catch {
            // ignore
        } finally {
            setSessionsLoading(false);
        }
    };

    const loadSessionHistory = async (id: string) => {
        try {
            const data = await chatService.getSessionHistory(id);
            setMessages(data.messages);
            setSessionId(id);
            setView('chat');
        } catch {
            // ignore
        }
    };

    const handleNewChat = () => {
        setMessages([]);
        setSessionId(null);
        setView('chat');
    };

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await chatService.deleteSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
            if (sessionId === id) {
                handleNewChat();
            }
        } catch {
            // ignore
        }
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMsg: ChatMessageType = {
            id: 'temp-' + Date.now(),
            role: 'user',
            content: trimmed,
            createdAt: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await chatService.sendMessage({
                message: trimmed,
                sessionId: sessionId || undefined,
            });

            if (!sessionId) {
                setSessionId(response.sessionId);
            }

            const assistantMsg: ChatMessageType = {
                id: response.messageId,
                role: 'assistant',
                content: response.content,
                createdAt: new Date().toISOString(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch {
            const errorMsg: ChatMessageType = {
                id: 'error-' + Date.now(),
                role: 'assistant',
                content: 'Error al conectar con el asistente. Intenta de nuevo.',
                createdAt: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatContent = (content: string) => {
        // Basic markdown-like formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code class="bg-slate-700 px-1 rounded text-sm">$1</code>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <>
            {/* Floating Button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-6 z-[35] w-14 h-14 bg-white hover:bg-[#E0E0E0] text-black rounded-full shadow-lg shadow-primary-900/30 flex items-center justify-center transition-colors"
                    >
                        <MessageCircle className="w-6 h-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-6 right-6 z-[35] w-[420px] h-[600px] bg-slate-900 border border-slate-700 rounded-[2px] shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700">
                            <div className="flex items-center gap-3">
                                {view === 'sessions' && (
                                    <button
                                        onClick={() => setView('chat')}
                                        className="text-slate-400 hover:text-white transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                )}
                                <div className="w-8 h-8 rounded-[2px] bg-primary-600/20 flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-primary-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-white">SOC Assistant</div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                                        {view === 'sessions' ? 'Historial' : 'Powered by Claude'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        if (view === 'sessions') {
                                            handleNewChat();
                                        } else {
                                            loadSessions();
                                            setView('sessions');
                                        }
                                    }}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-[2px] transition-all"
                                    title={view === 'sessions' ? 'Nuevo chat' : 'Historial'}
                                >
                                    {view === 'sessions' ? <Plus className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-[2px] transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        {view === 'sessions' ? (
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {sessionsLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                                        <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
                                        No hay conversaciones previas
                                    </div>
                                ) : (
                                    sessions.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => loadSessionHistory(s.id)}
                                            className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-[2px] transition-all group"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-white font-medium truncate">
                                                        {s.title}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-1">
                                                        {new Date(s.updatedAt).toLocaleDateString('es-ES', {
                                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => handleDeleteSession(s.id, e)}
                                                    className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {messages.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                            <div className="w-16 h-16 rounded-[2px] bg-primary-600/10 flex items-center justify-center mb-4">
                                                <Bot className="w-8 h-8 text-primary-400" />
                                            </div>
                                            <h3 className="text-white font-semibold mb-1">SOC Assistant</h3>
                                            <p className="text-slate-400 text-sm leading-relaxed">
                                                Analizo tu postura de seguridad en tiempo real. Pregunta sobre amenazas, incidentes, vulnerabilidades o pide recomendaciones.
                                            </p>
                                        </div>
                                    )}

                                    {messages.map(msg => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] px-4 py-2.5 rounded-[2px] text-sm leading-relaxed ${
                                                    msg.role === 'user'
                                                        ? 'bg-white text-black rounded-br-md'
                                                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-md'
                                                }`}
                                                dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                                            />
                                        </div>
                                    ))}

                                    {loading && (
                                        <div className="flex justify-start">
                                            <div className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-[2px] rounded-bl-md">
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
                                                    <span className="text-sm text-slate-400">Analizando...</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <div className="p-3 border-t border-slate-700 bg-slate-800/50">
                                    <div className="flex items-end gap-2">
                                        <textarea
                                            ref={textareaRef}
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Pregunta sobre tu SOC..."
                                            rows={1}
                                            className="flex-1 bg-slate-800 border border-slate-600 rounded-[2px] px-4 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-primary-500 transition-colors"
                                        />
                                        <button
                                            onClick={handleSend}
                                            disabled={!input.trim() || loading}
                                            className="p-2.5 bg-white hover:bg-[#E0E0E0] disabled:bg-slate-700 disabled:text-[#666666] text-black rounded-[2px] transition-colors flex-shrink-0"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default AiChatWidget;
