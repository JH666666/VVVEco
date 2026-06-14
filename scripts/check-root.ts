import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/Users/jianghu/VVVEco-cursor/VVV_Eco_Project/.env.local' });

async function main() {
  const p = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const ROOT = '0xBd7928A836c9D7eaa5fbEEb0C1Ba9f2fB4C852F3';
  const STAKING = process.env.NEXT_PUBLIC_VVECO_STAKING!;
  const abi = ['function users(address) view returns (address referrer, uint256 teamVolume7, uint8 level, uint256 rewardClaimed)'];
  const c = new ethers.Contract(STAKING, abi, p);
  const u = await c.users(ROOT);
  console.log('referrer:    ', u.referrer);
  console.log('teamVolume7: ', ethers.formatEther(u.teamVolume7), 'USD');
  console.log('level:       ', Number(u.level));
  console.log('rewardClaimed:', ethers.formatEther(u.rewardClaimed), 'VVV');
}
main().catch(console.error);
