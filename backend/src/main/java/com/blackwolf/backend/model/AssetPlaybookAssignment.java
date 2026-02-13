package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "asset_playbook_assignments")
@IdClass(AssetPlaybookAssignmentId.class)
public class AssetPlaybookAssignment {
    @Id
    private String assetId;

    @Id
    private String playbookId;

    private LocalDateTime assignedAt;
    private String assignedBy;
    private Boolean isActive;
    private Integer priority;
}
