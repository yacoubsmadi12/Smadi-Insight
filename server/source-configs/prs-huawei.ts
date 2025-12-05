import type { SourceConfig } from "./types";

export const PRS_HUAWEI_CONFIG: SourceConfig = {
  name: "PRS Huawei",
  sourceIps: ["10.119.10.104"],
  blockedOperators: [],
  roles: [],
  parseRules: {
    treatMmlAsNormal: true,
    readOnlyRolesAreViolation: false,
    treatAllAsNormal: true,
    isManualUpload: false
  }
};
