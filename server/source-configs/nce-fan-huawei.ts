import type { SourceConfig, SourceRole } from "./types";

export const NCE_FAN_ROLES: SourceRole[] = [
  { name: "Administrators", description: "Administrators group", isReadOnly: false, isAdmin: true, canManageUsers: true },
  { name: "Analyzer User Group", description: "Analyzer User Group", isReadOnly: true, isAdmin: false, canManageUsers: false },
  { name: "BROADBAND", description: "System operator group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "CA Administrator Group", description: "CA administrator group has operation rights on all functions of the Certificate Authority Service.", isReadOnly: false, isAdmin: true, canManageUsers: false },
  { name: "CA Operator Group", description: "CA operator group has operation rights on some functions of the Certificate Authority Service.", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Core", description: "System maintenance group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "GPON_Call_Center", description: "This group for Call Centre Team Read only", isReadOnly: true, isAdmin: false, canManageUsers: false },
  { name: "GPON_Help_Desk", description: "System operator group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Guest_2", description: "this grp done based on support request", isReadOnly: true, isAdmin: false, canManageUsers: false },
  { name: "Guests", description: "Guest user group", isReadOnly: true, isAdmin: false, canManageUsers: false },
  { name: "HOFS Group", description: "System operator group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "ISSTAR_Access", description: "for people wat access ISSTAR", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "MADA-BROADBAND", description: "System operator group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "MADA-TRANSPORT", description: "System operator group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "MADA-TRANSPORT-RTN", description: "System operator group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Maintenance Group", description: "System maintenance group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Maintenance_2", description: "this grp done for based on support recommendation", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "NBI User Group", description: "NBI User Group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "NOC_OPERATIONS", description: "NOC_OPERATIONS", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Operator Group", description: "System operator group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Performance", description: "For Zain Performance Team", isReadOnly: true, isAdmin: false, canManageUsers: false },
  { name: "SMManagers", description: "Security managers user group", isReadOnly: false, isAdmin: true, canManageUsers: true },
  { name: "Task_Help_Desk", description: "Created for Task management for Help Desk Team", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "The role to invoke southbound APIs", description: "Indicates the role to invoke southbound APIs", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "Transport", description: "System maintenance group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "VAS", description: "System maintenance group", isReadOnly: false, isAdmin: false, canManageUsers: false },
  { name: "monitor_goup", description: "monitor_goup", isReadOnly: true, isAdmin: false, canManageUsers: false },
  { name: "uTraffic User Group", description: "uTraffic User Group", isReadOnly: false, isAdmin: false, canManageUsers: false },
];

export const NCE_FAN_HUAWEI_CONFIG: SourceConfig = {
  name: "NCE FAN Huawei",
  sourceIps: ["10.119.19.89", "10.119.19.87", "10.119.19.90"],
  blockedOperators: ["kazema", "IntegTeamAPIUser"],
  roles: NCE_FAN_ROLES,
  parseRules: {
    treatMmlAsNormal: false,
    readOnlyRolesAreViolation: true,
    treatAllAsNormal: false,
    isManualUpload: false
  }
};
