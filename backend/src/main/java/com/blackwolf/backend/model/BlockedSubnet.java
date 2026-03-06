package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "blocked_subnets")
@IdClass(BlockedSubnetId.class)
public class BlockedSubnet {
    @Id
    private String cidr;

    @Id
    private String companyId;

    private String reason;
    private LocalDateTime blockedAt;
    private LocalDateTime expiresAt;
    private String blockedBy;
}
