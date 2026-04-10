import React, { useState, useRef, useEffect } from 'react';
import { Shield, Send, CheckCircle2, Building2, Globe, Server, Lock } from 'lucide-react';
import apiClient from '../lib/api';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  step?: number;
}

interface OnboardingData {
  companyName: string;
  domain: string;
  contactName: string;
  contactEmail: string;
  industry: string;
  employeeCount: string;
  servers: string;
  endpoints: string;
  cloudProviders: string;
  domains: string;
  hasFirewall: string;
  hasAntivirus: string;
  hasBackups: string;
  hasMFA: string;
  hasVPN: string;
  mainConcerns: string;
  currentIncidents: string;
  complianceNeeds: string;
}

const STEPS = [
  { key: 'company', label: 'Empresa', icon: Building2, fields: ['companyName', 'domain', 'contactName', 'contactEmail'] },
  { key: 'industry', label: 'Sector', icon: Globe, fields: ['industry', 'employeeCount'] },
  { key: 'infrastructure', label: 'Infraestructura', icon: Server, fields: ['servers', 'endpoints', 'cloudProviders', 'domains'] },
  { key: 'security', label: 'Seguridad actual', icon: Lock, fields: ['hasFirewall', 'hasAntivirus', 'hasMFA', 'hasVPN', 'hasBackups'] },
  { key: 'needs', label: 'Necesidades', icon: Shield, fields: ['mainConcerns', 'currentIncidents', 'complianceNeeds'] },
  { key: 'review', label: 'Revision', icon: CheckCircle2, fields: [] },
];

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'assistant',
    content: `Bienvenido al asistente de onboarding de Black Wolf SOC.

Voy a guiarte paso a paso para configurar la proteccion de seguridad de tu empresa. Empecemos con lo basico.

**¿Como se llama tu empresa?**`,
    step: 0,
  },
];

const STEP_QUESTIONS: Record<string, string[]> = {
  companyName: ['Perfecto. **¿Cual es el dominio principal de la empresa?** (ej: tuempresa.com)'],
  domain: ['**¿Cual es tu nombre completo?** (persona de contacto principal)'],
  contactName: ['**¿Y tu email de contacto?**'],
  contactEmail: ['Datos de empresa registrados.\n\n**¿En que sector opera tu empresa?** (ej: tecnologia, manufactura, servicios, retail, salud...)'],
  industry: ['**¿Cuantos empleados tiene aproximadamente?** (ej: 10, 50, 200, +500)'],
  employeeCount: ['Ahora vamos a mapear tu infraestructura.\n\n**¿Cuantos servidores teneis?** (fisicos + cloud, aproximado)'],
  servers: ['**¿Cuantos endpoints/ordenadores de trabajo?** (portatiles, PCs, tablets)'],
  endpoints: ['**¿Usais algun proveedor cloud?** (AWS, Azure, Google Cloud, DigitalOcean, otro, ninguno)'],
  cloudProviders: ['**¿Cuantos dominios/subdominios tiene la empresa?** (lista los principales)'],
  domains: ['Infraestructura mapeada.\n\nAhora evaluemos tu postura de seguridad actual.\n\n**¿Teneis firewall configurado?** (si/no, y cual si lo sabeis)'],
  hasFirewall: ['**¿Teneis antivirus/EDR en los endpoints?** (si/no, y cual)'],
  hasAntivirus: ['**¿Usais autenticacion multifactor (MFA/2FA)?** (si/no, donde)'],
  hasMFA: ['**¿Teneis VPN para acceso remoto?** (si/no, cual)'],
  hasVPN: ['**¿Teneis sistema de backups automatico?** (si/no, frecuencia, destino)'],
  hasBackups: ['Ultima seccion — tus necesidades especificas.\n\n**¿Cuales son tus principales preocupaciones de seguridad?** (filtracion de datos, ransomware, cumplimiento normativo, ataques DDoS, phishing...)'],
  mainConcerns: ['**¿Habeis sufrido algun incidente de seguridad recientemente?** (si/no, descripcion breve)'],
  currentIncidents: ['**¿Teneis requisitos de cumplimiento normativo?** (GDPR, ISO 27001, ENS, PCI-DSS, HIPAA, otro, ninguno)'],
};

const FIELD_ORDER = [
  'companyName', 'domain', 'contactName', 'contactEmail',
  'industry', 'employeeCount',
  'servers', 'endpoints', 'cloudProviders', 'domains',
  'hasFirewall', 'hasAntivirus', 'hasMFA', 'hasVPN', 'hasBackups',
  'mainConcerns', 'currentIncidents', 'complianceNeeds',
];

function getStepForField(field: string): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].fields.includes(field)) return i;
  }
  return 0;
}

const OnboardingWizard: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [currentField, setCurrentField] = useState(0);
  const [data, setData] = useState<Partial<OnboardingData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentStep = getStepForField(FIELD_ORDER[currentField] || '');

  function handleSend() {
    const text = input.trim();
    if (!text || submitting) return;
    setInput('');

    const fieldName = FIELD_ORDER[currentField];
    const newData = { ...data, [fieldName]: text };
    setData(newData);

    const step = getStepForField(fieldName);
    setMessages(prev => [...prev, { role: 'user', content: text, step }]);

    const nextIdx = currentField + 1;

    if (nextIdx >= FIELD_ORDER.length) {
      // All fields collected — show review
      const review = generateReview(newData as OnboardingData);
      setMessages(prev => [...prev, { role: 'assistant', content: review, step: 5 }]);
      setCurrentField(nextIdx);
      return;
    }

    const nextField = FIELD_ORDER[nextIdx];
    const questions = STEP_QUESTIONS[fieldName];
    if (questions && questions.length > 0) {
      const nextStep = getStepForField(nextField);
      setMessages(prev => [...prev, { role: 'assistant', content: questions[0], step: nextStep }]);
    }
    setCurrentField(nextIdx);
  }

  function generateReview(d: OnboardingData): string {
    const security = [
      d.hasFirewall?.toLowerCase().startsWith('s') ? '✅ Firewall' : '❌ Firewall',
      d.hasAntivirus?.toLowerCase().startsWith('s') ? '✅ Antivirus/EDR' : '❌ Antivirus/EDR',
      d.hasMFA?.toLowerCase().startsWith('s') ? '✅ MFA/2FA' : '❌ MFA/2FA',
      d.hasVPN?.toLowerCase().startsWith('s') ? '✅ VPN' : '❌ VPN',
      d.hasBackups?.toLowerCase().startsWith('s') ? '✅ Backups' : '❌ Backups',
    ].join('\n');

    const gaps = [];
    if (!d.hasFirewall?.toLowerCase().startsWith('s')) gaps.push('Implementar firewall perimetral');
    if (!d.hasAntivirus?.toLowerCase().startsWith('s')) gaps.push('Desplegar EDR en todos los endpoints');
    if (!d.hasMFA?.toLowerCase().startsWith('s')) gaps.push('Activar MFA en todos los accesos criticos');
    if (!d.hasVPN?.toLowerCase().startsWith('s')) gaps.push('Configurar VPN para acceso remoto seguro');
    if (!d.hasBackups?.toLowerCase().startsWith('s')) gaps.push('Implementar sistema de backups automaticos');

    return `**Resumen de Onboarding — ${d.companyName}**

📋 **Empresa**
• Nombre: ${d.companyName}
• Dominio: ${d.domain}
• Sector: ${d.industry}
• Empleados: ${d.employeeCount}
• Contacto: ${d.contactName} (${d.contactEmail})

🖥️ **Infraestructura**
• Servidores: ${d.servers}
• Endpoints: ${d.endpoints}
• Cloud: ${d.cloudProviders}
• Dominios: ${d.domains}

🛡️ **Postura de Seguridad**
${security}

${gaps.length > 0 ? `⚠️ **Gaps Detectados (${gaps.length})**\n${gaps.map(g => `• ${g}`).join('\n')}` : '✅ **Todas las medidas basicas cubiertas**'}

🎯 **Necesidades**
• Preocupaciones: ${d.mainConcerns}
• Incidentes recientes: ${d.currentIncidents}
• Compliance: ${d.complianceNeeds}

---
**¿Todo correcto?** Escribe **"confirmar"** para enviar la solicitud de onboarding, o indica que quieres cambiar.`;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await apiClient.post('/api/v1/onboarding/requests', {
        companyName: data.companyName,
        domain: data.domain,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        plan: 'starter',
        notes: JSON.stringify(data),
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ **Solicitud enviada correctamente.**

Tu empresa **${data.companyName}** ha sido registrada para onboarding. El equipo de BlackWolf SOC revisara tu solicitud y te contactara en **${data.contactEmail}** con:

• Credenciales de acceso al panel SOC
• API Key para integracion de sensores
• Guia personalizada de configuracion

Mientras tanto, puedes revisar nuestra documentacion en la seccion de ayuda.

🛡️ *Black Wolf Security Operations Center*`,
        step: 5,
      }]);
      setCompleted(true);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error al enviar la solicitud. Por favor, intenta de nuevo o contacta a soporte en alejandro.cto@blackwolfsec.io`,
        step: 5,
      }]);
    }
    setSubmitting(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (currentField >= FIELD_ORDER.length && input.trim().toLowerCase().startsWith('confirm')) {
        handleSubmit();
      } else {
        handleSend();
      }
    }
  }

  const isReviewPhase = currentField >= FIELD_ORDER.length;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar — Progress Steps */}
      <div className="w-64 border-r border-slate-700/50 bg-slate-900/50 p-5 flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">Onboarding</div>
            <div className="text-slate-500 text-xs">Asistente guiado</div>
          </div>
        </div>

        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = currentStep === i;
          const isDone = currentStep > i || completed;

          return (
            <div key={step.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive ? 'bg-primary-500/10 border border-primary-500/20' : isDone ? 'opacity-70' : 'opacity-40'}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${isDone ? 'bg-green-500/20 text-green-400' : isActive ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-700/50 text-slate-500'}`}>
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-white' : isDone ? 'text-slate-400' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
          );
        })}

        <div className="mt-auto pt-4 border-t border-slate-700/50">
          <div className="text-xs text-slate-500">
            Paso {Math.min(currentStep + 1, STEPS.length)} de {STEPS.length}
          </div>
          <div className="w-full h-1.5 bg-slate-700/50 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary-500/15 border border-primary-500/20 text-white'
                  : 'bg-slate-800/60 border border-slate-700/40 text-slate-200'
              }`}>
                {msg.content.split('**').map((part, j) =>
                  j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{part}</strong> : <React.Fragment key={j}>{part}</React.Fragment>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEnd} />
        </div>

        {/* Input */}
        {!completed && (
          <div className="border-t border-slate-700/50 p-4">
            <div className="flex gap-3 max-w-3xl mx-auto">
              <input
                className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-primary-500/50 transition-colors"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isReviewPhase ? 'Escribe "confirmar" para enviar...' : 'Escribe tu respuesta...'}
                disabled={submitting}
                autoFocus
              />
              <button
                onClick={isReviewPhase ? handleSubmit : handleSend}
                disabled={!input.trim() || submitting}
                className="px-5 py-3 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-colors"
              >
                {submitting ? 'Enviando...' : <><Send className="w-4 h-4" /> Enviar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
