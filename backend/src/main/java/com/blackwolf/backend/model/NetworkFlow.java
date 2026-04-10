package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "network_flows")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NetworkFlow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyId;
    private String srcIp;
    private String dstIp;
    private Integer srcPort;
    private Integer dstPort;
    private String protocol;
    private Long bytesSent;
    private Long bytesRecv;
    private Integer packets;
    private BigDecimal duration;
    private String flags;
    private String threatType;
    private LocalDateTime timestamp;
}
