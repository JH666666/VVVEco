import { ethers } from 'ethers';
const RPC = 'https://sepolia.base.org';
const OLD = '0xc451DdCdDbd9e8700E71960d190b55fE1eD57B34';
const NEW = '0xb6fd47994Bf4ffCE4F488091d1059d8cb51D1C97';
const WALLET = '0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3';
const abi = ['function ordersLength(address user) view returns (uint256)'];
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const oldC = new ethers.Contract(OLD, abi, provider);
  const newC = new ethers.Contract(NEW, abi, provider);
  console.log('旧合约 ordersLength:', String(await oldC.ordersLength(WALLET)));
  console.log('新合约 ordersLength:', String(await newC.ordersLength(WALLET)));
}
main().catch(console.error);
