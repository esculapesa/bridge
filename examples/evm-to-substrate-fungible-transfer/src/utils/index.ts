import {
  Config,
  Environment,
  EthereumConfig,
} from "@buildwithsygma/sygma-sdk-core";

export const getDomain = async (chainId: number): Promise<EthereumConfig> => {
  const config = new Config();
  await config.init(chainId, Environment.TESTNET);

  const domains = config.getDomains();

  const selectedDomain = domains.find((domain) => domain.chainId === chainId);

  if (!selectedDomain)
    throw new Error(`Domain with chainId ${chainId} not found`);

  const { id } = selectedDomain;

  const domainConfig = config.getDomainConfig(id);

  return domainConfig as EthereumConfig;
};
