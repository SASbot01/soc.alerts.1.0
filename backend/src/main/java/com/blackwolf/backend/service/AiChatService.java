package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.ChatDTOs.*;
import com.blackwolf.backend.model.ChatMessage;
import com.blackwolf.backend.model.ChatSession;
import com.blackwolf.backend.repository.ChatMessageRepository;
import com.blackwolf.backend.repository.ChatSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiChatService {

    private static final Logger log = LoggerFactory.getLogger(AiChatService.class);

    @Autowired
    private ChatSessionRepository sessionRepository;

    @Autowired
    private ChatMessageRepository messageRepository;

    @Autowired
    private SocContextService socContextService;

    @Value("${ai.claude.api-key:}")
    private String apiKey;

    @Value("${ai.claude.model:claude-sonnet-4-20250514}")
    private String model;

    @Value("${ai.claude.max-tokens:4096}")
    private int maxTokens;

    @Value("${ai.claude.enabled:false}")
    private boolean enabled;

    private final RestTemplate restTemplate = new RestTemplate();

    private static final String CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

    private static final String SYSTEM_PROMPT = """
            Eres el asistente de IA del SOC (Security Operations Center) de BlackWolf Security. \
            Tu rol es ayudar a los analistas de seguridad a interpretar datos, priorizar amenazas y recomendar acciones de remediación.

            Directrices:
            - Responde siempre en español
            - Sé conciso pero preciso en tus análisis
            - Prioriza las amenazas por severidad y riesgo real
            - Sugiere acciones concretas de remediación
            - Identifica patrones y correlaciones entre eventos
            - Alerta sobre SLAs próximos a vencer
            - Usa terminología de ciberseguridad apropiada
            - Si no tienes suficiente información, indícalo claramente
            - Formatea tus respuestas con markdown para mejor legibilidad

            A continuación se presenta el contexto actual del SOC de la empresa:

            """;

    public ChatResponse sendMessage(String companyId, String userId, SendMessageRequest request) {
        if (!enabled) {
            ChatResponse response = new ChatResponse();
            response.setContent("El asistente de IA no está habilitado. Contacta al administrador.");
            return response;
        }

        // Get or create session
        String sessionId = request.getSessionId();
        ChatSession session;
        if (sessionId != null && !sessionId.isBlank()) {
            session = sessionRepository.findById(sessionId)
                    .orElseThrow(() -> new RuntimeException("Session not found"));
        } else {
            session = createSession(companyId, userId);
            sessionId = session.getId();
        }

        // Save user message
        ChatMessage userMessage = new ChatMessage();
        userMessage.setId(UUID.randomUUID().toString());
        userMessage.setSessionId(sessionId);
        userMessage.setCompanyId(companyId);
        userMessage.setRole("user");
        userMessage.setContent(request.getMessage());
        userMessage.setTokensUsed(0);
        userMessage.setCreatedAt(LocalDateTime.now());
        messageRepository.save(userMessage);

        // Build SOC context
        String socContext = socContextService.buildContext(companyId);

        // Build conversation history (last 20 messages)
        List<ChatMessage> history = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Map<String, String>> conversationMessages = history.stream()
                .map(m -> Map.of("role", m.getRole(), "content", m.getContent()))
                .collect(Collectors.toList());

        // Limit to last 20 messages
        if (conversationMessages.size() > 20) {
            conversationMessages = conversationMessages.subList(conversationMessages.size() - 20, conversationMessages.size());
        }

        // Call Claude API
        String assistantContent;
        int tokensUsed = 0;
        try {
            Map<String, Object> apiResponse = callClaudeApi(socContext, conversationMessages);
            assistantContent = extractContent(apiResponse);
            tokensUsed = extractTokensUsed(apiResponse);
        } catch (Exception e) {
            log.error("Claude API call failed: {}", e.getMessage());
            assistantContent = "Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo.";
        }

        // Save assistant message
        ChatMessage assistantMessage = new ChatMessage();
        assistantMessage.setId(UUID.randomUUID().toString());
        assistantMessage.setSessionId(sessionId);
        assistantMessage.setCompanyId(companyId);
        assistantMessage.setRole("assistant");
        assistantMessage.setContent(assistantContent);
        assistantMessage.setTokensUsed(tokensUsed);
        assistantMessage.setCreatedAt(LocalDateTime.now());
        messageRepository.save(assistantMessage);

        // Update session title from first user message
        if (history.size() <= 1) {
            String title = request.getMessage().length() > 80
                    ? request.getMessage().substring(0, 80) + "..."
                    : request.getMessage();
            session.setTitle(title);
            session.setUpdatedAt(LocalDateTime.now());
            sessionRepository.save(session);
        } else {
            session.setUpdatedAt(LocalDateTime.now());
            sessionRepository.save(session);
        }

        // Build response
        ChatResponse response = new ChatResponse();
        response.setSessionId(sessionId);
        response.setMessageId(assistantMessage.getId());
        response.setContent(assistantContent);
        response.setTokensUsed(tokensUsed);
        return response;
    }

    public List<ChatSessionSummary> listSessions(String companyId, String userId) {
        List<ChatSession> sessions = sessionRepository.findByCompanyIdAndUserIdOrderByUpdatedAtDesc(companyId, userId);
        return sessions.stream().map(s -> {
            ChatSessionSummary summary = new ChatSessionSummary();
            summary.setId(s.getId());
            summary.setTitle(s.getTitle());
            summary.setStatus(s.getStatus());
            summary.setCreatedAt(s.getCreatedAt());
            summary.setUpdatedAt(s.getUpdatedAt());
            return summary;
        }).collect(Collectors.toList());
    }

    public ChatHistoryResponse getSessionHistory(String sessionId, String companyId) {
        ChatSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        if (!session.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        List<ChatMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);

        ChatHistoryResponse response = new ChatHistoryResponse();
        response.setSessionId(sessionId);
        response.setTitle(session.getTitle());
        response.setMessages(messages.stream().map(m -> {
            ChatMessageDTO dto = new ChatMessageDTO();
            dto.setId(m.getId());
            dto.setRole(m.getRole());
            dto.setContent(m.getContent());
            dto.setCreatedAt(m.getCreatedAt());
            return dto;
        }).collect(Collectors.toList()));

        return response;
    }

    public void deleteSession(String sessionId, String companyId) {
        ChatSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        if (!session.getCompanyId().equals(companyId)) {
            throw new RuntimeException("Access denied");
        }

        sessionRepository.delete(session);
    }

    private ChatSession createSession(String companyId, String userId) {
        ChatSession session = new ChatSession();
        session.setId(UUID.randomUUID().toString());
        session.setCompanyId(companyId);
        session.setUserId(userId);
        session.setTitle("New Chat");
        session.setStatus("active");
        session.setCreatedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        return sessionRepository.save(session);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> callClaudeApi(String socContext, List<Map<String, String>> messages) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("max_tokens", maxTokens);
        body.put("system", SYSTEM_PROMPT + socContext);
        body.put("messages", messages);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.exchange(
                CLAUDE_API_URL, HttpMethod.POST, entity, Map.class);

        return response.getBody();
    }

    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> apiResponse) {
        if (apiResponse == null) return "No response from AI";
        List<Map<String, Object>> content = (List<Map<String, Object>>) apiResponse.get("content");
        if (content != null && !content.isEmpty()) {
            return (String) content.get(0).get("text");
        }
        return "No response from AI";
    }

    @SuppressWarnings("unchecked")
    private int extractTokensUsed(Map<String, Object> apiResponse) {
        if (apiResponse == null) return 0;
        Map<String, Object> usage = (Map<String, Object>) apiResponse.get("usage");
        if (usage != null) {
            Object outputTokens = usage.get("output_tokens");
            if (outputTokens instanceof Number) {
                return ((Number) outputTokens).intValue();
            }
        }
        return 0;
    }
}
