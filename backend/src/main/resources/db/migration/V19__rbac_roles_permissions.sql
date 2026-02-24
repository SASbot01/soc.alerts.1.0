-- =============================================
-- V19: RBAC - Roles & Permissions
-- =============================================

-- Permissions table (granular resource:action pairs)
CREATE TABLE permissions (
    id VARCHAR(100) PRIMARY KEY,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    UNIQUE KEY uk_resource_action (resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Roles table (system + custom per-company)
CREATE TABLE roles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    company_id VARCHAR(36),
    is_system BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Role-Permission mapping
CREATE TABLE role_permissions (
    role_id VARCHAR(36) NOT NULL,
    permission_id VARCHAR(100) NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- Seed Permissions (~35)
-- =============================================
INSERT INTO permissions (id, resource, action, description) VALUES
-- Dashboard
('dashboard:read', 'dashboard', 'read', 'View dashboard and overview'),
-- Threats
('threats:read', 'threats', 'read', 'View threat events'),
('threats:write', 'threats', 'write', 'Update threat status'),
-- Incidents
('incidents:read', 'incidents', 'read', 'View incidents'),
('incidents:write', 'incidents', 'write', 'Create and update incidents'),
('incidents:delete', 'incidents', 'delete', 'Delete incidents'),
-- Playbooks
('playbooks:read', 'playbooks', 'read', 'View playbooks'),
('playbooks:write', 'playbooks', 'write', 'Create and edit playbooks'),
('playbooks:execute', 'playbooks', 'execute', 'Execute playbooks'),
-- Assets
('assets:read', 'assets', 'read', 'View assets'),
('assets:write', 'assets', 'write', 'Create and update assets'),
('assets:delete', 'assets', 'delete', 'Delete assets'),
-- Sensors
('sensors:read', 'sensors', 'read', 'View sensors'),
('sensors:write', 'sensors', 'write', 'Deploy and manage sensors'),
-- Alerts
('alerts:read', 'alerts', 'read', 'View alert configurations and history'),
('alerts:write', 'alerts', 'write', 'Configure alert rules'),
-- Audits
('audits:read', 'audits', 'read', 'View security audits'),
('audits:write', 'audits', 'write', 'Create and manage audits'),
-- Pentests
('pentests:read', 'pentests', 'read', 'View penetration tests'),
('pentests:write', 'pentests', 'write', 'Create and manage pentests'),
-- Vulnerabilities
('vulnerabilities:read', 'vulnerabilities', 'read', 'View vulnerabilities'),
('vulnerabilities:write', 'vulnerabilities', 'write', 'Create and manage vulnerabilities'),
-- Certifications
('certifications:read', 'certifications', 'read', 'View certifications'),
('certifications:write', 'certifications', 'write', 'Issue and revoke certifications'),
-- Users
('users:read', 'users', 'read', 'View user list'),
('users:write', 'users', 'write', 'Create and update users'),
('users:delete', 'users', 'delete', 'Delete users'),
-- Billing
('billing:read', 'billing', 'read', 'View billing and subscription'),
('billing:write', 'billing', 'write', 'Manage billing and subscriptions'),
-- MITRE
('mitre:read', 'mitre', 'read', 'View MITRE ATT&CK data'),
('mitre:write', 'mitre', 'write', 'Map MITRE techniques'),
-- AI Agent
('ai_agent:read', 'ai_agent', 'read', 'View AI decisions and stats'),
('ai_agent:write', 'ai_agent', 'write', 'Manage AI agent settings'),
-- Reports
('reports:read', 'reports', 'read', 'View and download reports'),
-- Roles
('roles:read', 'roles', 'read', 'View roles and permissions'),
('roles:write', 'roles', 'write', 'Manage roles and permissions'),
-- Settings
('settings:read', 'settings', 'read', 'View settings'),
('settings:write', 'settings', 'write', 'Manage settings');

-- =============================================
-- Seed System Roles (5)
-- =============================================
INSERT INTO roles (id, name, display_name, description, company_id, is_system) VALUES
('role-viewer', 'viewer', 'Viewer', 'Read-only access to SOC data', NULL, TRUE),
('role-analyst', 'analyst', 'SOC Analyst', 'Day-to-day threat analysis and incident response', NULL, TRUE),
('role-soc-manager', 'soc_manager', 'SOC Manager', 'Full SOC operations management', NULL, TRUE),
('role-compliance', 'compliance_officer', 'Compliance Officer', 'Audit, pentest, vulnerability and certification management', NULL, TRUE),
('role-admin', 'admin', 'Administrator', 'Full access to all features including user and billing management', NULL, TRUE);

-- =============================================
-- Seed Role-Permission Mappings
-- =============================================

-- VIEWER: Read-only access
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role-viewer', 'dashboard:read'),
('role-viewer', 'threats:read'),
('role-viewer', 'incidents:read'),
('role-viewer', 'playbooks:read'),
('role-viewer', 'assets:read'),
('role-viewer', 'sensors:read'),
('role-viewer', 'alerts:read'),
('role-viewer', 'audits:read'),
('role-viewer', 'pentests:read'),
('role-viewer', 'vulnerabilities:read'),
('role-viewer', 'certifications:read'),
('role-viewer', 'mitre:read'),
('role-viewer', 'ai_agent:read'),
('role-viewer', 'settings:read');

-- ANALYST: Viewer + write threats/incidents/playbooks/assets/sensors/alerts + execute playbooks
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role-analyst', 'dashboard:read'),
('role-analyst', 'threats:read'),
('role-analyst', 'threats:write'),
('role-analyst', 'incidents:read'),
('role-analyst', 'incidents:write'),
('role-analyst', 'playbooks:read'),
('role-analyst', 'playbooks:execute'),
('role-analyst', 'assets:read'),
('role-analyst', 'assets:write'),
('role-analyst', 'sensors:read'),
('role-analyst', 'sensors:write'),
('role-analyst', 'alerts:read'),
('role-analyst', 'alerts:write'),
('role-analyst', 'audits:read'),
('role-analyst', 'pentests:read'),
('role-analyst', 'vulnerabilities:read'),
('role-analyst', 'certifications:read'),
('role-analyst', 'mitre:read'),
('role-analyst', 'mitre:write'),
('role-analyst', 'ai_agent:read'),
('role-analyst', 'settings:read');

-- SOC MANAGER: Analyst + manage incidents/playbooks + audits/pentests/vulns/certs write + reports + users read + AI write
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role-soc-manager', 'dashboard:read'),
('role-soc-manager', 'threats:read'),
('role-soc-manager', 'threats:write'),
('role-soc-manager', 'incidents:read'),
('role-soc-manager', 'incidents:write'),
('role-soc-manager', 'incidents:delete'),
('role-soc-manager', 'playbooks:read'),
('role-soc-manager', 'playbooks:write'),
('role-soc-manager', 'playbooks:execute'),
('role-soc-manager', 'assets:read'),
('role-soc-manager', 'assets:write'),
('role-soc-manager', 'assets:delete'),
('role-soc-manager', 'sensors:read'),
('role-soc-manager', 'sensors:write'),
('role-soc-manager', 'alerts:read'),
('role-soc-manager', 'alerts:write'),
('role-soc-manager', 'audits:read'),
('role-soc-manager', 'audits:write'),
('role-soc-manager', 'pentests:read'),
('role-soc-manager', 'pentests:write'),
('role-soc-manager', 'vulnerabilities:read'),
('role-soc-manager', 'vulnerabilities:write'),
('role-soc-manager', 'certifications:read'),
('role-soc-manager', 'certifications:write'),
('role-soc-manager', 'users:read'),
('role-soc-manager', 'mitre:read'),
('role-soc-manager', 'mitre:write'),
('role-soc-manager', 'ai_agent:read'),
('role-soc-manager', 'ai_agent:write'),
('role-soc-manager', 'reports:read'),
('role-soc-manager', 'settings:read');

-- COMPLIANCE OFFICER: Viewer + write audits/pentests/vulns/certs + reports
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role-compliance', 'dashboard:read'),
('role-compliance', 'threats:read'),
('role-compliance', 'incidents:read'),
('role-compliance', 'playbooks:read'),
('role-compliance', 'assets:read'),
('role-compliance', 'sensors:read'),
('role-compliance', 'alerts:read'),
('role-compliance', 'audits:read'),
('role-compliance', 'audits:write'),
('role-compliance', 'pentests:read'),
('role-compliance', 'pentests:write'),
('role-compliance', 'vulnerabilities:read'),
('role-compliance', 'vulnerabilities:write'),
('role-compliance', 'certifications:read'),
('role-compliance', 'certifications:write'),
('role-compliance', 'mitre:read'),
('role-compliance', 'ai_agent:read'),
('role-compliance', 'reports:read'),
('role-compliance', 'settings:read');

-- ADMIN: All permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-admin', id FROM permissions;
