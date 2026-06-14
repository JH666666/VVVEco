// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Aerodrome vAMM pool — token0=WETH, token1=VVV
interface IAeroPool {
    function getReserves() external view returns (uint256 reserve0, uint256 reserve1, uint256 blockTimestampLast);
}

// Chainlink ETH/USD price feed (8 decimals)
interface IChainlinkFeed {
    function latestRoundData() external view returns (
        uint80  roundId,
        int256  answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80  answeredInRound
    );
    function decimals() external view returns (uint8);
}
