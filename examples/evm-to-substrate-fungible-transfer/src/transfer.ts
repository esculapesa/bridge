import {
  EVMAssetTransfer,
  Environment,
  Resource,
  createDepositEventListener,
} from "@buildwithsygma/sygma-sdk-core";
import { Wallet, providers } from "ethers";
import dotenv from "dotenv";
import chalk from "chalk";
import { Bridge__factory } from "@buildwithsygma/sygma-contracts";
import { getDomain } from "./utils";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

const ROCOCO_PHALA_CHAIN_ID = 5231;
const DESTINATION_ADDRESS = "5CDQJk6kxvBcjauhrogUc9B8vhbdXhRscp1tGEUmniryF1Vt";
const RESOURCE_ID =
  "0x0000000000000000000000000000000000000000000000000000000000001000";

export async function erc20Transfer(): Promise<void> {
  const provider = new providers.JsonRpcProvider(
    "https://rpc.goerli.eth.gateway.fm/"
  );
  const wallet = new Wallet(privateKey ?? "", provider);
  const assetTransfer = new EVMAssetTransfer();
  await assetTransfer.init(provider, Environment.TESTNET);

  const networkInfo = await provider.getNetwork();

  const chainId = networkInfo.chainId;

  const sourceDomain = await getDomain(chainId);

  const destinationDomain = await getDomain(ROCOCO_PHALA_CHAIN_ID);

  const { bridge: sourceBridge } = sourceDomain;

  const bridge = Bridge__factory.connect(sourceBridge, provider);

  createDepositEventListener(bridge, await wallet.getAddress(), () => {
    const resource = sourceDomain.resources.find(
      (resource: Resource) => (resource.resourceId = RESOURCE_ID)
    );

    console.log(
      chalk.greenBright(
        `Received deposit for resource: ${resource?.symbol}. Destination of the deposit is ${destinationDomain.name}`
      )
    );
  });

  const transfer = await assetTransfer.createFungibleTransfer(
    await wallet.getAddress(),
    ROCOCO_PHALA_CHAIN_ID,
    DESTINATION_ADDRESS,
    RESOURCE_ID,
    "5000000000000000000" // 18 decimal places
    // optional parachainID (e.g. KusamaParachain.SHIDEN)
  );

  const fee = await assetTransfer.getFee(transfer);
  const approvals = await assetTransfer.buildApprovals(transfer, fee);
  for (const approval of approvals) {
    const response = await wallet.sendTransaction(
      approval as providers.TransactionRequest
    );
    console.log("Sent approval with hash: ", response.hash);
  }
  const transferTx = await assetTransfer.buildTransferTransaction(
    transfer,
    fee
  );
  const response = await wallet.sendTransaction(
    transferTx as providers.TransactionRequest
  );
  console.log("Sent transfer with hash: ", response.hash);
}

erc20Transfer().finally(() => {});
