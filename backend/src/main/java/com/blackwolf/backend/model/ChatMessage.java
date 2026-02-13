package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "chat_messages")
public class ChatMessage {
    @Id
    private String id;

    private String sessionId;
    private String companyId;
    private String role;

    @Column(columnDefinition = "TEXT")
    private String content;

    private Integer tokensUsed;
    private LocalDateTime createdAt;
}
