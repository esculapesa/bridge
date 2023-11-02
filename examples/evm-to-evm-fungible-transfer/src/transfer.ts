import {
  EVMAssetTransfer,
  Environment,
  Resource,
  createDepositEventListener,
} from "@buildwithsygma/sygma-sdk-core";
import { Wallet, providers } from "ethers";
import dotenv from "dotenv";
import chalk from "chalk";
import {
  Bridge__factory,
  ERC20Burnable__factory,
} from "@buildwithsygma/sygma-contracts";
import {
  approvalEvent,
  execProposalExecutionEventListener,
  getDomain,
  getFungibleResource,
} from "./utils";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
const destinationChainApiKey = process.env.DESTINATION_CHAIN_API_KEY;

if (!privateKey) {
  throw new Error("Missing environment variable PRIVATE_KEY");
}

if (!destinationChainApiKey) {
  throw new Error("Missing environment variable DESTINATION_CHAIN_API_KEY");
}

const SEPOLIA_CHAIN_ID = 11155111;
const RESOURCE_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000300";

export async function erc20Transfer(): Promise<void> {
  const sourceChainProvider = new providers.JsonRpcProvider(
    "https://rpc.goerli.eth.gateway.fm/"
  );

  const destinationChainProvider = new providers.JsonRpcProvider(
    "https://rpc.notadegen.com/eth/sepolia"
  );

  const wallet = new Wallet(privateKey ?? "", sourceChainProvider);

  const network = await sourceChainProvider.getNetwork();

  const chainId = network.chainId;

  const sourceDomain = await getDomain(chainId);

  const destinationDomain = await getDomain(SEPOLIA_CHAIN_ID);

  const { bridge: sourceBridgeAddress, resources } = sourceDomain;

  const { address } = getFungibleResource(resources);

  const bridge = Bridge__factory.connect(sourceBridgeAddress, wallet);

  const Erc20Handler = ERC20Burnable__factory.connect(address, wallet);

  const { bridge: destinationBridgeAddress } = destinationDomain;

  const destinationBridge = Bridge__factory.connect(
    destinationBridgeAddress,
    destinationChainProvider
  );

  const assetTransfer = new EVMAssetTransfer();
  await assetTransfer.init(sourceChainProvider, Environment.TESTNET);

  createDepositEventListener(
    bridge,
    await wallet.getAddress(),
    (destinationDomainId, resourceId, depositNonce) => {
      const resource = sourceDomain.resources.find(
        (resource: Resource) => (resource.resourceId = resourceId)
      );

      const destinationDepositNonce = depositNonce.toNumber();

      console.log(
        chalk.greenBright(
          `Received deposit for resource: ${resource?.symbol}. Destination of the deposit is ${destinationDomain.name}`
        )
      );

      if (destinationDepositNonce) {
        void execProposalExecutionEventListener(
          destinationBridge,
          destinationChainProvider,
          destinationDepositNonce
        );
      }
    }
  );

  const transfer = await assetTransfer.createFungibleTransfer(
    await wallet.getAddress(),
    SEPOLIA_CHAIN_ID,
    await wallet.getAddress(), // Sending to the same address on a different chain
    RESOURCE_ID,
    "500000000000000000" // 18 decimal places
  );

  const fee = await assetTransfer.getFee(transfer);
  const approvals = await assetTransfer.buildApprovals(transfer, fee);
  for (const approval of approvals) {
    const response = await wallet.sendTransaction(
      approval as providers.TransactionRequest
    );

    console.log(chalk.greenBright(`Sent approval with hash: ${response.hash}`));
  }

  approvalEvent(Erc20Handler);

  const transferTx = await assetTransfer.buildTransferTransaction(
    transfer,
    fee
  );
  const response = await wallet.sendTransaction(
    transferTx as providers.TransactionRequest
  );

  console.log(
    chalk.greenBright(`Deposited funds on source chain: ${response.hash}`)
  );

  console.log(
    chalk.greenBright(
      `https://scan.test.buildwithsygma.com/transfer/${response.hash}`
    )
  );
}

erc20Transfer().finally(() => { });
