import type { SourceConfig, SourceRole } from "./types";

export const NETECO_ROLES: SourceRole[] = [
  { name: "Access Control System Administrator", description: "A role that has all access control management permissions.", isReadOnly: false, isAdmin: true, canManageUsers: true },
  { name: "Access Control System Approver", description: "A role that has the permission to approve applications and view application records.", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Access Control System Data Entry Operator", description: "A role that has the permission to view and operate access user information and user groups.", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Administrators", description: "Has all rights except user management, query security log and view online users.", isReadOnly: false, isAdmin: true, canManageUsers: false },
  { name: "Full Privilege", description: "control evrey thing exept User mangment", isReadOnly: false, isAdmin: true, canManageUsers: false },
  { name: "NBI User Group", description: "Only used for northbound interface users. It has the permissions on operations and interface configurations for all northbound interfaces.", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Read only", description: "Read only", isReadOnly: true, isAdmin: false, canManageUsers: false },
  { name: "SMManagers", description: "Has rights of user management, license management, query security log and view online users.", isReadOnly: false, isAdmin: true, canManageUsers: true },
  { name: "Tasc-Towers-ObjectOriented", description: "Read only", isReadOnly: true, isAdmin: false, canManageUsers: false },
  { name: "TascTowers", description: "Read only", isReadOnly: true, isAdmin: false, canManageUsers: false },
];

export const NETECO_HUAWEI_CONFIG: SourceConfig = {
  name: "NetEco Huawei",
  sourceIps: [],
  blockedOperators: [],
  roles: NETECO_ROLES,
  parseRules: {
    treatMmlAsNormal: false,
    readOnlyRolesAreViolation: true,
    treatAllAsNormal: false,
    isManualUpload: true
  }
};
