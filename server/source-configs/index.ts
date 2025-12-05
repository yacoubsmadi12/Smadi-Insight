import { 
  NCE_IPT_HUAWEI_CONFIG, 
  isOperatorBlocked, 
  getOperatorInfo, 
  isSourceIpMatch 
} from "./nce-ipt-huawei";
import type { SourceConfig, SourceUser } from "./nce-ipt-huawei";

const ALL_SOURCE_CONFIGS: SourceConfig[] = [
  NCE_IPT_HUAWEI_CONFIG
];

export function getSourceConfigByIp(sourceIp: string): SourceConfig | undefined {
  return ALL_SOURCE_CONFIGS.find(config => isSourceIpMatch(config, sourceIp));
}

export function isOperatorBlockedForSource(sourceIp: string, operatorUsername: string): boolean {
  const config = getSourceConfigByIp(sourceIp);
  if (!config) {
    return false;
  }
  return isOperatorBlocked(config, operatorUsername);
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

export type { SourceConfig, SourceUser };
export { NCE_IPT_HUAWEI_CONFIG };
