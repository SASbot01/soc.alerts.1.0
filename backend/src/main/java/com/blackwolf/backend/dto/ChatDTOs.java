package com.blackwolf.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

public class ChatDTOs {

    @Data
    public static class SendMessageRequest {
        private String message;
        private String sessionId;
    }

    @Data
    public static class ChatResponse {
        private String sessionId;
        private String messageId;
        private String content;
        private Integer tokensUsed;
    }

    @Data
    public static class ChatSessionSummary {
        private String id;
        private String title;
        private String status;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data
    public static class ChatHistoryResponse {
        private String sessionId;
        private String title;
        private List<ChatMessageDTO> messages;
    }

    @Data
    public static class ChatMessageDTO {
        private String id;
        private String role;
        private String content;
        private LocalDateTime createdAt;
    }
}
