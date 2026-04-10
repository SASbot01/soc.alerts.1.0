-- =============================================================
-- V42: Emergency threat response — 2026-03-12
--      Block active attackers and whitelist Cloudflare infra
--
-- Threats observed against 192.168.1.39:
--   - BRUTE_FORCE (L9): 91.230.168.190, 91.230.168.36
--   - EXPLOIT     (L8): 182.92.11.80  (Alibaba Cloud / Aliyun)
--   - RECON       (L7): 2a02:9130:84a4:6f88:4517:406:b71c:19ab
--   - PORT_SCAN   (L6): 198.41.200.233, 198.41.200.193 (Cloudflare)
-- =============================================================

-- -------------------------------------------------------
-- 1. BLOCK MALICIOUS IPs — permanent (expires 2099)
-- -------------------------------------------------------

-- Brute-force attackers from 91.230.168.0/24
INSERT IGNORE INTO blocked_ips (ip, company_id, reason, blocked_at, expires_at)
SELECT ip, c.id,
       'Emergency block 2026-03-12: Brute-force attack (severity 9) against 192.168.1.39' AS reason,
       NOW() AS blocked_at,
       '2099-12-31 23:59:59' AS expires_at
FROM companies c
CROSS JOIN (
    SELECT '91.230.168.190' AS ip UNION ALL
    SELECT '91.230.168.36'
) AS attacker_ips;

-- Exploit attacker from Alibaba Cloud
INSERT IGNORE INTO blocked_ips (ip, company_id, reason, blocked_at, expires_at)
SELECT '182.92.11.80', c.id,
       'Emergency block 2026-03-12: Exploit attempt (severity 8) against 192.168.1.39 — Alibaba Cloud',
       NOW(), '2099-12-31 23:59:59'
FROM companies c;

-- Reconnaissance scanner (IPv6)
INSERT IGNORE INTO blocked_ips (ip, company_id, reason, blocked_at, expires_at)
SELECT '2a02:9130:84a4:6f88:4517:406:b71c:19ab', c.id,
       'Emergency block 2026-03-12: Persistent reconnaissance (severity 7) against 192.168.1.39',
       NOW(), '2099-12-31 23:59:59'
FROM companies c;

-- -------------------------------------------------------
-- 2. BLOCK SUBNETS — permanent
--    91.230.168.0/24 should already be blocked from V37,
--    but ensure it and add 182.92.11.0/24 (Aliyun attack range)
-- -------------------------------------------------------

INSERT IGNORE INTO blocked_subnets (cidr, company_id, reason, blocked_at, expires_at, blocked_by)
SELECT '91.230.168.0/24', c.id,
       'Permanent block: Coordinated brute-force campaign (multiple IPs: .190, .36). Reinforced 2026-03-12.',
       NOW(), NULL, 'security-admin'
FROM companies c;

INSERT IGNORE INTO blocked_subnets (cidr, company_id, reason, blocked_at, expires_at, blocked_by)
SELECT '182.92.11.0/24', c.id,
       'Permanent block: Exploit attempts from Alibaba Cloud range. Blocked 2026-03-12.',
       NOW(), NULL, 'security-admin'
FROM companies c;

-- -------------------------------------------------------
-- 3. WHITELIST CLOUDFLARE INFRASTRUCTURE
--    198.41.200.0/24 is Cloudflare Tunnel (argotunnel.com)
--    These are NOT attacks — they are health checks / CDN probes
-- -------------------------------------------------------

INSERT IGNORE INTO trusted_ips (id, company_id, ip, cidr, label, reason, created_by, created_at)
SELECT UUID(), c.id, '198.41.200.0', '198.41.200.0/24',
       'Cloudflare Tunnel Infrastructure',
       'Cloudflare Tunnel / Argo Tunnel IPs (198.41.200.x). Port scans are CDN health checks, not attacks.',
       'security-admin', NOW()
FROM companies c;

INSERT IGNORE INTO trusted_ips (id, company_id, ip, cidr, label, reason, created_by, created_at)
SELECT UUID(), c.id, '198.41.200.233', NULL,
       'Cloudflare Tunnel Node 233',
       'Cloudflare infrastructure IP — false positive port scan alerts',
       'security-admin', NOW()
FROM companies c;

INSERT IGNORE INTO trusted_ips (id, company_id, ip, cidr, label, reason, created_by, created_at)
SELECT UUID(), c.id, '198.41.200.193', NULL,
       'Cloudflare Tunnel Node 193',
       'Cloudflare infrastructure IP — false positive port scan alerts',
       'security-admin', NOW()
FROM companies c;
