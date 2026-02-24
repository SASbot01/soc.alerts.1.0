-- =============================================================
-- V16: Block known malicious IPs from 80.94.95.0/24
--      (UNMANAGED LTD / SS-Net bulletproof hoster, AS204428)
--      314k+ abuse reports on AbuseIPDB
-- =============================================================

-- Block the specific attacker IP and common offenders from same /24
-- Using the company ID from production deployment
INSERT IGNORE INTO blocked_ips (ip, company_id, reason, blocked_at, expires_at)
SELECT ip, '93efac91-9577-417a-b0ba-672670d02323' AS company_id,
       'Permanent block: UNMANAGED LTD / SS-Net bulletproof hoster (AS204428). 314k+ abuse reports.' AS reason,
       NOW() AS blocked_at,
       '2099-12-31 23:59:59' AS expires_at
FROM (
    SELECT '80.94.95.238' AS ip UNION ALL
    SELECT '80.94.95.15' UNION ALL
    SELECT '80.94.95.24' UNION ALL
    SELECT '80.94.95.112' UNION ALL
    SELECT '80.94.95.184' UNION ALL
    SELECT '80.94.95.226' UNION ALL
    SELECT '80.94.95.240'
) AS malicious_ips;
