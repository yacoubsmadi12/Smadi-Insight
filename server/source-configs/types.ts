export interface SourceRole {
  name: string;
  description: string;
  isReadOnly: boolean;
  isAdmin: boolean;
  canManageUsers: boolean;
  region?: string;
}

export interface SourceUser {
  username: string;
  fullName: string;
  type: "Local user" | "Third-party user";
  description: string;
  roles: string[];
  blocked: boolean;
}

export interface ParseRules {
  treatMmlAsNormal: boolean;
  readOnlyRolesAreViolation: boolean;
  treatAllAsNormal?: boolean;
  isManualUpload?: boolean;
}

export interface SourceConfig {
  name: string;
  sourceIps: string[];
  logFormat?: string;
  blockedOperators: string[];
  users?: SourceUser[];
  roles: SourceRole[];
  parseRules: ParseRules;
}

export const WRITE_OPERATIONS = [
  'add', 'modify', 'delete', 'set', 'create', 'update', 'remove', 
  'execute', 'run', 'mml', 'cfg', 'mod', 'lst', 'dsp'
];

export const USER_MANAGEMENT_OPERATIONS = [
  'add user', 'delete user', 'modify user', 'create user', 
  'remove user', 'user management', 'adduser', 'deluser', 'moduser'
];
