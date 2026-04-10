package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "honey_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HoneyToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String tokenType;
    private String name;
    private String value;

    @Column(columnDefinition = "text")
    private String description;

    private LocalDateTime deployedAt;
    private Boolean active;
    private Integer hitCount;
}
