import { NCE_IPT_HUAWEI_CONFIG } from "./nce-ipt-huawei";
import { NCE_FAN_HUAWEI_CONFIG } from "./nce-fan-huawei";
import { RADIO_U2020_HUAWEI_CONFIG } from "./radio-u2020-huawei";
import { CORE_U2020_HUAWEI_CONFIG } from "./core-u2020-huawei";
import { PRS_HUAWEI_CONFIG } from "./prs-huawei";
import { NETECO_HUAWEI_CONFIG } from "./neteco-huawei";
import type { SourceConfig, SourceRole, SourceUser, ParseRules } from "./types";
import { WRITE_OPERATIONS, USER_MANAGEMENT_OPERATIONS } from "./types";

const ALL_SOURCE_CONFIGS: SourceConfig[] = [
  NCE_IPT_HUAWEI_CONFIG,
  NCE_FAN_HUAWEI_CONFIG,
  RADIO_U2020_HUAWEI_CONFIG,
  CORE_U2020_HUAWEI_CONFIG,
  PRS_HUAWEI_CONFIG,
  NETECO_HUAWEI_CONFIG
];

export function getSourceConfigByIp(sourceIp: string): SourceConfig | undefined {
  return ALL_SOURCE_CONFIGS.find(config => config.sourceIps.includes(sourceIp));
}

export function isOperatorBlockedForSource(sourceIp: string, operatorUsername: string): boolean {
  const config = getSourceConfigByIp(sourceIp);
  if (!config) {
    return false;
  }
  const normalizedUsername = operatorUsername.toLowerCase().trim();
  return config.blockedOperators.some(
    blocked => blocked.toLowerCase().trim() === normalizedUsername
  );
}

export function getBlockedOperatorsForSource(sourceIp: string): string[] {
  const config = getSourceConfigByIp(sourceIp);
  if (!config) {
    return [];
  }
  return config.blockedOperators;
}

export function getAllSourceConfigs(): SourceConfig[] {
  return ALL_SOURCE_CONFIGS;
}

export function getSourceConfigByName(name: string): SourceConfig | undefined {
  return ALL_SOURCE_CONFIGS.find(config => config.name === name);
}

export function getRoleForSource(sourceIp: string, roleName: string): SourceRole | undefined {
  const config = getSourceConfigByIp(sourceIp);
  if (!config) {
    return undefined;
  }
  return config.roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
}

export function getRoleByNameFromConfig(config: SourceConfig, roleName: string): SourceRole | undefined {
  return config.roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
}

export function isRoleReadOnlyForSource(sourceIp: string, roleName: string): boolean {
  const role = getRoleForSource(sourceIp, roleName);
  return role?.isReadOnly ?? false;
}

export function isRoleAdminForSource(sourceIp: string, roleName: string): boolean {
  const role = getRoleForSource(sourceIp, roleName);
  return role?.isAdmin ?? false;
}

export function shouldTreatMmlAsNormal(sourceIp: string): boolean {
  const config = getSourceConfigByIp(sourceIp);
  return config?.parseRules.treatMmlAsNormal ?? false;
}

export function shouldTreatAllAsNormal(sourceIp: string): boolean {
  const config = getSourceConfigByIp(sourceIp);
  return config?.parseRules.treatAllAsNormal ?? false;
}

export function isManualUploadSource(sourceName: string): boolean {
  const config = getSourceConfigByName(sourceName);
  return config?.parseRules.isManualUpload ?? false;
}

function isMmlCommand(operationType: string): boolean {
  const mmlPatterns = ['mml', 'lst', 'dsp', 'mod', 'add', 'rmv', 'cfg', 'set'];
  const lowerOp = operationType.toLowerCase();
  return mmlPatterns.some(p => lowerOp.startsWith(p) || lowerOp.includes(`:${p}`));
}

function isWriteOperation(operationType: string): boolean {
  const lowerOp = operationType.toLowerCase();
  return WRITE_OPERATIONS.some(op => lowerOp.includes(op));
}

function isUserManagementOperation(operationType: string): boolean {
  const lowerOp = operationType.toLowerCase();
  return USER_MANAGEMENT_OPERATIONS.some(op => lowerOp.includes(op));
}

export interface ViolationResult {
  isViolation: boolean;
  reason?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export function checkViolation(
  sourceIp: string, 
  roleName: string, 
  operationType: string,
  operatorUsername?: string
): ViolationResult {
  const config = getSourceConfigByIp(sourceIp);
  
  if (!config) {
    return { isViolation: false };
  }
  
  if (config.parseRules.treatAllAsNormal) {
    return { isViolation: false };
  }
  
  if (operatorUsername) {
    const normalizedUsername = operatorUsername.toLowerCase().trim();
    const isBlocked = config.blockedOperators.some(
      blocked => blocked.toLowerCase().trim() === normalizedUsername
    );
    if (isBlocked) {
      return { 
        isViolation: true, 
        reason: `Blocked operator: ${operatorUsername}`,
        severity: 'high'
      };
    }
  }
  
  const normalizedRoleName = roleName.trim();
  const role = getRoleByNameFromConfig(config, normalizedRoleName);
  
  if (!role) {
    return { 
      isViolation: true, 
      reason: `Unknown role: ${roleName}`,
      severity: 'medium'
    };
  }
  
  const isMml = isMmlCommand(operationType);
  
  if (role.isReadOnly && config.parseRules.readOnlyRolesAreViolation) {
    if (isWriteOperation(operationType) || isMml) {
      return { 
        isViolation: true, 
        reason: `Read-only role "${roleName}" performed write/MML operation: ${operationType}`,
        severity: 'high'
      };
    }
  }
  
  if (isMml && config.parseRules.treatMmlAsNormal && !role.isReadOnly) {
    return { isViolation: false };
  }
  
  if (isUserManagementOperation(operationType) && !role.canManageUsers) {
    return { 
      isViolation: true, 
      reason: `Role "${roleName}" performed user management without permission: ${operationType}`,
      severity: 'critical'
    };
  }
  
  return { isViolation: false };
}

export function isViolation(sourceIp: string, roleName: string, operationType: string): boolean {
  return checkViolation(sourceIp, roleName, operationType).isViolation;
}

export function checkUserManagementViolation(sourceIp: string, roleName: string, operationType: string): boolean {
  const config = getSourceConfigByIp(sourceIp);
  if (!config) {
    return false;
  }
  
  const role = getRoleByNameFromConfig(config, roleName);
  if (!role) {
    return true;
  }
  
  if (isUserManagementOperation(operationType) && !role.canManageUsers) {
    return true;
  }
  
  return false;
}

export type { SourceConfig, SourceRole, SourceUser, ParseRules };

export { 
  NCE_IPT_HUAWEI_CONFIG,
  NCE_FAN_HUAWEI_CONFIG,
  RADIO_U2020_HUAWEI_CONFIG,
  CORE_U2020_HUAWEI_CONFIG,
  PRS_HUAWEI_CONFIG,
  NETECO_HUAWEI_CONFIG,
  WRITE_OPERATIONS,
  USER_MANAGEMENT_OPERATIONS
};
