import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const RPC    = 'https://sepolia.base.org';
const STAKING = process.env.NEXT_PUBLIC_VVECO_STAKING!;
const PAYOUT  = process.env.NEXT_PUBLIC_VVECO_PAYOUT!;
const ROUTER  = process.env.NEXT_PUBLIC_MOCK_ROUTER!;
const ROOT    = process.env.NEXT_PUBLIC_ROOT_REFERRER_ADDRESS!;

const provider = new ethers.JsonRpcProvider(RPC);

async function main() {
  const staking = new ethers.Contract(STAKING, [
    'function rootReferrer() view returns (address)',
    'function durationRates(uint256) view returns (uint256)',
  ], provider);
  const payout  = new ethers.Contract(PAYOUT, [
    'function stakingContract() view returns (address)',
    'function ethBalance() view returns (uint256)',
  ], provider);
  const router  = new ethers.Contract(ROUTER, [
    'function ethPerVvv() view returns (uint256)',
  ], provider);

  const root    = await staking.rootReferrer();
  const r7      = await staking.durationRates(7);
  const r15     = await staking.durationRates(15);
  const r30     = await staking.durationRates(30);
  const r60     = await staking.durationRates(60);
  const pStk    = await payout.stakingContract();
  const ethBal  = await payout.ethBalance();
  const rate    = await router.ethPerVvv();

  console.log('=== 新合约状态检查 ===');
  console.log('Staking              :', STAKING);
  console.log('rootReferrer         :', root, root.toLowerCase()===ROOT.toLowerCase()?'✅':'❌ 期望:'+ROOT);
  console.log('Payout.staking       :', pStk, pStk.toLowerCase()===STAKING.toLowerCase()?'✅':'❌');
  console.log('durationRates 7/15/30/60:', Number(r7), Number(r15), Number(r30), Number(r60), '期望 7/8/9/10', (Number(r30)===9)?'✅':'❌');
  console.log('Payout ETH balance   :', ethers.formatEther(ethBal), 'ETH', Number(ethBal)>0?'✅':'❌ 需充值');
  console.log('MockRouter ethPerVvv :', rate.toString(), Number(rate)===10000000000?'✅':'(期望 1e10)');
}
main().catch(e => console.error(e.shortMessage || e.message));
