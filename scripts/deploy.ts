import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read compiled artifacts
const vvvArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "artifacts/contracts/VVVToken.sol/VVVToken.json"), "utf8")
);
const stakingArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "artifacts/contracts/VVVEcoStaking.sol/VVVEcoStaking.json"), "utf8")
);

async function main() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org";
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey || privateKey === "your_private_key_here") {
    console.log("Using Hardhat local EDR network (no PRIVATE_KEY set)");
  }

  const provider = privateKey && privateKey !== "your_private_key_here"
    ? new ethers.JsonRpcProvider(rpcUrl)
    : new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const wallet = privateKey && privateKey !== "your_private_key_here"
    ? new ethers.Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`, provider)
    : ethers.Wallet.createRandom().connect(provider);

  console.log("Deploying with account:", wallet.address);

  if (provider instanceof ethers.JsonRpcProvider) {
    console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH\n");
  }

  // ========== 1. Deploy VVV Token ==========
  console.log("1. Deploying VVVToken...");
  const vvvFactory = new ethers.ContractFactory(vvvArtifact.abi, vvvArtifact.bytecode, wallet);
  const vvvToken = await vvvFactory.deploy();
  await vvvToken.waitForDeployment();
  const tokenAddress = await vvvToken.getAddress();
  console.log("   VVV Token:", tokenAddress);

  // ========== 2. Deploy VVVEcoStaking ==========
  console.log("2. Deploying VVVEcoStaking...");
  const stakingFactory = new ethers.ContractFactory(stakingArtifact.abi, stakingArtifact.bytecode, wallet);
  const staking = await stakingFactory.deploy(tokenAddress, wallet.address, wallet.address);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("   Staking:", stakingAddress);

  // ========== 3. Mint test tokens to staking ==========
  console.log("3. Minting test tokens...");
  const mintAmount = ethers.parseEther("10000000");
  const mintTx = await vvvToken.mint(stakingAddress, mintAmount);
  await mintTx.wait();
  console.log("   Minted 10,000,000 VVV to Staking contract");

  // ========== Output ==========
  const output = {
    network: privateKey && privateKey !== "your_private_key_here" ? "Base Sepolia" : "localhost",
    chainId: privateKey && privateKey !== "your_private_key_here" ? 84532 : 31337,
    deployer: wallet.address,
    vvvToken: tokenAddress,
    vvvecoStaking: stakingAddress,
    deployedAt: new Date().toISOString(),
  };

  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("VVV Token:  ", tokenAddress);
  console.log("Staking:    ", stakingAddress);
  console.log("========================================\n");

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, output.network === "Base Sepolia" ? "base-sepolia.json" : "localhost.json"),
    JSON.stringify(output, null, 2)
  );

  const abiDir = path.join(outDir, "abi");
  fs.mkdirSync(abiDir, { recursive: true });
  fs.writeFileSync(path.join(abiDir, "VVVToken.json"), JSON.stringify(vvvArtifact.abi, null, 2));
  fs.writeFileSync(path.join(abiDir, "VVVEcoStaking.json"), JSON.stringify(stakingArtifact.abi, null, 2));

  console.log(`Addresses saved to deployments/${output.network === "Base Sepolia" ? "base-sepolia.json" : "localhost.json"}`);
  console.log("ABIs saved to deployments/abi/");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
