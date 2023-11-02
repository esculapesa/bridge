import { Bridge } from "@buildwithsygma/sygma-contracts";
import {
  Config,
  Environment,
  EthereumConfig,
  createProposalExecutionEventListener,
} from "@buildwithsygma/sygma-sdk-core";
import { providers } from "ethers";
import chalk from "chalk";

export const execProposalExecutionEventListener = async (
  destinationBridge: Bridge,
  destinationChainProvider: providers.JsonRpcProvider,
  destinationDepositNonce: number
): Promise<void> => {
  const networkInfo = await destinationChainProvider.getNetwork();
  const networkName = networkInfo.name;

  if (destinationDepositNonce) {
    createProposalExecutionEventListener(
      destinationDepositNonce,
      destinationBridge,
      (_, __, ___, tx) => {
        console.log(chalk.greenBright(`Proposal Executed on ${networkName}`));
        console.log(`https://goerli.etherscan.io/tx/${tx}`);
        process.exit(0);
      }
    );
  }
};

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
