import {Contract, ethers} from 'ethers';

import {MockContract} from '@ethereum-waffle/mock-contract';

import {
  BorrowerPools,
  BorrowerPools__factory,
  FlashLoanAttacker,
  PositionDescriptor,
  PositionDescriptor__factory,
  PositionManager,
  PositionManager__factory,
  Token1,
} from '../../typechain';

export interface PoolParameters {
  underlyingToken: string;
  minRate: ethers.BigNumber;
  maxRate: ethers.BigNumber;
  rateSpacing: ethers.BigNumber;
  maxBorrowableAmount: ethers.BigNumber;
  loanDuration: ethers.BigNumber;
  liquidityRewardsDistributionRate: ethers.BigNumber;
  cooldownPeriod: ethers.BigNumber;
  repaymentPeriod: ethers.BigNumber;
  lateRepayFeePerBondRate: ethers.BigNumber;
  liquidityRewardsActivationThreshold: ethers.BigNumber;
}

export interface PoolFeeRates {
  establishmentFeeRate: ethers.BigNumber;
  repaymentFeeRate: ethers.BigNumber;
}

export interface PoolState {
  active: boolean;
  defaulted: boolean;
  closed: boolean;
  currentMaturity: ethers.BigNumber;
  bondsIssuedQuantity: ethers.BigNumber;
  normalizedBorrowedAmount: ethers.BigNumber;
  normalizedAvailableDeposits: ethers.BigNumber;
  lowerInterestRate: ethers.BigNumber;
  nextLoanMinStart: ethers.BigNumber;
  remainingAdjustedLiquidityRewardsReserve: ethers.BigNumber;
  yieldProviderLiquidityRatio: ethers.BigNumber;
  currentBondsIssuanceIndex: ethers.BigNumber;
}

export type Deployer = {
  BorrowerPools: BorrowerPools;
  BorrowerPoolsF: BorrowerPools__factory;
  PositionManager: PositionManager;
  PositionManagerF: PositionManager__factory;
  PositionDescriptor: PositionDescriptor;
  PositionDescriptorF: PositionDescriptor__factory;
};

export type Mocks = {
  SafeERC20: MockContract;
  DepositToken1: MockContract;
  DepositToken2: MockContract;
  BorrowerPools: MockContract;
  ILendingPool: MockContract;
  YearnFinanceWrapper: MockContract;
};

export type User = {
  Token1?: Token1 | MockContract;
  address: string;
  aToken?: Contract;
  BorrowerPools: BorrowerPools | MockContract;
  PositionDescriptor?: PositionDescriptor;
  PositionManager: PositionManager;
  FlashLoanAttacker?: FlashLoanAttacker;
};
