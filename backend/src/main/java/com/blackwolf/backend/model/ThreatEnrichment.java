package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "threat_enrichments")
public class ThreatEnrichment {
    @Id
    private String ip;
    private Integer abuseConfidenceScore;
    private String countryCode;
    private String isp;
    private String domain;
    private boolean isTor;
    private boolean isVpn;
    private Integer totalReports;
    private LocalDateTime lastReportedAt;
    private LocalDateTime enrichedAt;

    // VirusTotal
    @Column(name = "virustotal_malicious")
    private Integer virustotalMalicious;

    @Column(name = "virustotal_suspicious")
    private Integer virustotalSuspicious;

    @Column(name = "virustotal_harmless")
    private Integer virustotalHarmless;

    // GreyNoise
    @Column(name = "greynoise_classification")
    private String greynoiseClassification;

    @Column(name = "greynoise_name")
    private String greynoiseName;

    @Column(name = "greynoise_noise")
    private boolean greynoiseNoise;

    @Column(name = "greynoise_riot")
    private boolean greynoiseRiot;

    // Shodan
    @Column(name = "shodan_ports")
    private String shodanPorts;

    @Column(name = "shodan_os")
    private String shodanOs;

    @Column(name = "shodan_vulns")
    private String shodanVulns;

    @Column(name = "shodan_org")
    private String shodanOrg;

    // OTX (AlienVault)
    @Column(name = "otx_pulse_count")
    private Integer otxPulseCount;

    @Column(name = "otx_tags")
    private String otxTags;

    // Which providers have been queried
    @Column(name = "enrichment_sources")
    private String enrichmentSources;
}
