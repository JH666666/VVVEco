export const VVV_TOKEN_ADDRESS = '0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf'

type AbiInput = {
  name?: string
  type: string
}

export type VvvEcoAbiItem = {
  type: 'constructor' | 'function'
  name?: string
  stateMutability?: 'nonpayable' | 'view'
  inputs?: readonly AbiInput[]
  outputs?: readonly AbiInput[]
}

export const VVV_ECO_STAKING_CONTRACT = {
  name: 'VVVValueEcoStakingFinal',
  network: 'Base',
  chainId: 8453,
  address: '',
  sourceFile: '../VVV_Eco_Final.sol.txt',
} as const

export const VVV_ECO_STAKING_ABI: readonly VvvEcoAbiItem[] = [
  {
    type: 'constructor',
    inputs: [
      { name: '_vvvToken', type: 'address' },
      { name: '_projectWallet', type: 'address' },
      { name: '_feeWallet', type: 'address' },
    ],
  },
  {
    type: 'function',
    name: 'stake',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_vvvAmount', type: 'uint256' },
      { name: '_duration', type: 'uint256' },
      { name: '_isCoinBased', type: 'bool' },
      { name: '_referrerCode', type: 'address' },
    ],
    outputs: [],
  },
  { type: 'function', name: 'claimAllRewards', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'withdrawOrderPrincipal',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_orderId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'transferOwnership',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_newOwner', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setProjectWallet',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_newWallet', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setFeeWallet',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_newFeeWallet', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setFeePercent',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_newFee', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setDurationRate',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_durationDays', type: 'uint256' },
      { name: '_rateNew', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setFreezeStatus',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_target', type: 'address' },
      { name: '_status', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawSurplusETH',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'projectWallet', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'feeWallet', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vvvToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'minStakeUsd', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'feePercent', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'durationRates',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isFrozen',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getLatestPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const CONTRACT_WRITE_FUNCTIONS = VVV_ECO_STAKING_ABI.filter(
  item => item.type === 'function' && item.stateMutability === 'nonpayable',
)
