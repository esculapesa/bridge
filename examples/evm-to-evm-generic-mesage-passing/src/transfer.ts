import dotenv from "dotenv";
import {
  EVMGenericMessageTransfer,
  Environment,
  Resource,
  createDepositEventListener,
} from "@buildwithsygma/sygma-sdk-core";
import { BigNumber, Wallet, providers, utils } from "ethers";
import chalk from "chalk";
import { Bridge__factory } from "@buildwithsygma/sygma-contracts";
import { Storage__factory } from "./Contracts";
import { getDomain, execProposalExecutionEventListener } from "./utils";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;
const destinationChainApiKey = process.env.DESTINATION_CHAIN_API_KEY;

if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

const DESTINATION_CHAIN_ID = 5; // Goerli
const SOURCE_CHAIN_ID = 11155111; // Sepolia
const RESOURCE_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000500"; // Generic Message Handler
const EXECUTE_CONTRACT_ADDRESS = "0xdFA5621F95675D37248bAc9e536Aab4D86766663";
const EXECUTE_FUNCTION_SIGNATURE = "0xa271ced2";
const MAX_FEE = "3000000";
const sourceProvider = new providers.JsonRpcProvider(destinationChainApiKey);
const destinationProvider = new providers.JsonRpcProvider(
  "https://rpc.goerli.eth.gateway.fm/"
);
const storageContract = Storage__factory.connect(
  EXECUTE_CONTRACT_ADDRESS,
  destinationProvider
);
const wallet = new Wallet(privateKey ?? "", sourceProvider);

const fetchAfterValue = async (): Promise<BigNumber> =>
  await storageContract.retrieve(await wallet.getAddress());

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const waitUntilBridged = async (
  valueBefore: BigNumber,
  intervalDuration: number = 15000,
  attempts: number = 8
): Promise<void> => {
  let i = 0;
  let contractValueAfter: BigNumber;
  for (;;) {
    await sleep(intervalDuration);
    contractValueAfter = await fetchAfterValue();
    if (!contractValueAfter.eq(valueBefore)) {
      console.log(chalk.greenBright("Transaction successfully bridged."));

      console.log(
        chalk.greenBright(
          `Value before update: ${new Date(valueBefore.toNumber()).toString()}`
        )
      );
      break;
    }
    i++;
    if (i > attempts) {
      // transaction should have been bridged already
      console.log(
        chalk.redBright("transaction is taking too much time to bridge!")
      );
      break;
    }
  }
};

export async function genericMessage(): Promise<void> {
  const sourceDomain = await getDomain(SOURCE_CHAIN_ID);
  const destinationDomain = await getDomain(DESTINATION_CHAIN_ID);

  const { bridge: sourceBridgeAddress } = sourceDomain;

  const bridge = Bridge__factory.connect(sourceBridgeAddress, wallet);

  const { bridge: destinationBridgeAddress } = destinationDomain;

  const destinationBridge = Bridge__factory.connect(
    destinationBridgeAddress,
    destinationProvider
  );

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

      void execProposalExecutionEventListener(
        destinationBridge,
        destinationProvider,
        destinationDepositNonce
      );
    }
  );

  const contractValueBefore = await storageContract.retrieve(
    await wallet.getAddress()
  );
  console.log(
    chalk.greenBright(
      `Value before update: ${new Date(
        contractValueBefore.toNumber()
      ).toString()}`
    )
  );
  const messageTransfer = new EVMGenericMessageTransfer();
  await messageTransfer.init(sourceProvider, Environment.TESTNET);

  const EXECUTION_DATA = utils.defaultAbiCoder.encode(["uint"], [Date.now()]);

  const transfer = messageTransfer.createGenericMessageTransfer(
    await wallet.getAddress(),
    DESTINATION_CHAIN_ID,
    RESOURCE_ID,
    EXECUTE_CONTRACT_ADDRESS,
    EXECUTE_FUNCTION_SIGNATURE,
    EXECUTION_DATA,
    MAX_FEE
  );

  const fee = await messageTransfer.getFee(transfer);
  const transferTx = await messageTransfer.buildTransferTransaction(
    transfer,
    fee
  );

  const response = await wallet.sendTransaction(
    transferTx as providers.TransactionRequest
  );
  console.log(chalk.greenBright(`Sent transfer with hash: ${response.hash}`));

  console.log(
    chalk.greenBright("Waiting for relayers to bridge transaction...")
  );

  await waitUntilBridged(contractValueBefore);
}

genericMessage().finally(() => {});
