package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "login_attempts")
public class LoginAttempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String identifier;

    @Enumerated(EnumType.STRING)
    private AttemptType attemptType;

    private String ipAddress;
    private boolean success;
    private LocalDateTime attemptedAt;

    public enum AttemptType {
        LOGIN, REGISTER, SENSOR_UPLOAD
    }
}
