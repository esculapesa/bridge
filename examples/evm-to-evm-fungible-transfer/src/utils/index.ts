import { Bridge, ERC20Burnable } from "@buildwithsygma/sygma-contracts";
import {
  Config,
  Environment,
  createProposalExecutionEventListener,
  EthereumConfig,
  EvmResource,
} from "@buildwithsygma/sygma-sdk-core";
import { providers, ethers } from "ethers";
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
      // @ts-ignore-next-line
      destinationBridge,
      () => {
        console.log(
          chalk.greenBright(`Proposal Execution event on ${networkName}`)
        );
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

export const approvalEvent = (erc20Handler: ERC20Burnable): void => {
  const approvalEvent = erc20Handler.filters.Approval(null, null, null);

  erc20Handler.once(approvalEvent, (owner, spender, amount) => {
    console.log(
      chalk.greenBright(
        `Approved ${ethers.utils.formatUnits(
          amount.toString(),
          18
        )} to Sygma Handler`
      )
    );
  });
};

export const getFungibleResource = (
  resources: EthereumConfig["resources"]
): EvmResource => {
  const resource = resources.find((resource) => resource.type === "fungible");

  if (!resource) throw new Error("Fungible resource not found");

  return resource as EvmResource;
};
