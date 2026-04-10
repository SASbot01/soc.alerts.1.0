package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ioc_entries")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IocEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String iocType;
    private String value;
    private String source;
    private Integer confidence;
    private String severity;

    @Column(columnDefinition = "json")
    private String tags;

    private LocalDateTime firstSeen;
    private LocalDateTime lastSeen;
    private Boolean active;
    private String stixId;
}
