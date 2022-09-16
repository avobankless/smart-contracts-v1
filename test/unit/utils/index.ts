import {BigNumber} from 'ethers';
import {BorrowerPools, PositionManager} from '../../../typechain';
import {setupUser} from '../../utils';
import {
  cooldownPeriod,
  distributionRate,
  establishmentFeeRate,
  GOVERNANCE_ROLE,
  lateRepayFeePerBondRate,
  liquidityRewardsActivationThreshold,
  loanDuration,
  maxBorrowableAmount,
  maxRateInput,
  minRateInput,
  poolHash,
  POSITION_ROLE,
  rateSpacingInput,
  repaymentFeeRate,
  repaymentPeriod,
  TEST_RETURN_YIELD_PROVIDER_LR_RAY,
} from '../../utils/constants';
import {Mocks, User} from '../../utils/types';

//Functional setup for Position Contract Tests :
//Deploying Contracts, mocking returned values from Aave LendingPool Contract, returning users
export const setupTestContracts = async (
  deployer: any,
  mocks: Mocks,
  users: any,
  customLateRepayFeePerBondRate?: BigNumber
): Promise<{
  deployedBorrowerPools: BorrowerPools;
  deployedPositionManager: PositionManager;
  governance: User;
  testUser1: User;
  testUser2: User;
  testBorrower: User;
  testPositionManager: User;
  poolHash: string;
  poolTokenAddress: string;
  otherTokenAddress: string;
}> => {
  const deployedPositionManagerDescriptor =
    await deployer.PositionDescriptorF.deploy();
  const deployedBorrowerPools = await deployer.BorrowerPoolsF.deploy();
  const deployedPositionManager = await deployer.PositionManagerF.deploy();

  const deployerAddress =
    await deployedPositionManagerDescriptor.signer.getAddress();
  await deployedBorrowerPools.initialize(deployerAddress);
  await deployedPositionManager.initialize(
    'My New Position',
    '📍',
    deployedBorrowerPools.address,
    deployedPositionManagerDescriptor.address
  );

  await mocks.ILendingPool.mock.deposit.returns();
  await mocks.ILendingPool.mock.withdraw.returns(
    1 /* uint256 corresponding to withdrawn amount*/
  );
  await mocks.ILendingPool.mock.getReserveNormalizedIncome.returns(
    TEST_RETURN_YIELD_PROVIDER_LR_RAY
  );
  await mocks.DepositToken1.mock.allowance.returns(maxBorrowableAmount);
  await mocks.DepositToken1.mock.approve.returns(true);
  await mocks.DepositToken1.mock.transferFrom.returns(true);
  await mocks.DepositToken1.mock.decimals.returns(18);
  await mocks.DepositToken2.mock.decimals.returns(18);

  await deployedBorrowerPools.grantRole(
    POSITION_ROLE,
    deployedPositionManager.address
  );

  const governance = await setupUser(users[0].address, {
    BorrowerPools: deployedBorrowerPools,
    PositionManager: deployedPositionManager,
  });
  await deployedBorrowerPools.grantRole(GOVERNANCE_ROLE, governance.address);

  const testBorrower = await setupUser(users[3].address, {
    BorrowerPools: deployedBorrowerPools,
    PositionManager: deployedPositionManager,
  });

  await testBorrower.BorrowerPools.createNewPool({
    poolOwner: testBorrower.address,
    underlyingToken: mocks.DepositToken1.address,
    yieldProvider: mocks.ILendingPool.address,
    minRate: minRateInput,
    maxRate: maxRateInput,
    rateSpacing: rateSpacingInput,
    maxBorrowableAmount: maxBorrowableAmount,
    loanDuration: loanDuration,
    distributionRate: distributionRate,
    cooldownPeriod: cooldownPeriod,
    repaymentPeriod: repaymentPeriod,
    lateRepayFeePerBondRate: customLateRepayFeePerBondRate
      ? customLateRepayFeePerBondRate
      : lateRepayFeePerBondRate,
    establishmentFeeRate: establishmentFeeRate,
    repaymentFeeRate: repaymentFeeRate,
    liquidityRewardsActivationThreshold: liquidityRewardsActivationThreshold,
    earlyRepay: true,
  });

  const testUser1 = await setupUser(users[1].address, {
    BorrowerPools: deployedBorrowerPools,
    PositionManager: deployedPositionManager,
  });

  const testUser2 = await setupUser(users[2].address, {
    BorrowerPools: deployedBorrowerPools,
    PositionManager: deployedPositionManager,
  });

  // await governance.BorrowerPools.allow(
  //   testBorrower.address,
  //   governance.address
  // );

  const testPositionManager = await setupUser(users[4].address, {
    BorrowerPools: deployedBorrowerPools,
    PositionManager: deployedPositionManager,
  });
  await deployedBorrowerPools.grantRole(
    POSITION_ROLE,
    testPositionManager.address
  );

  const poolTokenAddress = mocks.DepositToken1.address;
  const otherTokenAddress = mocks.DepositToken2.address;

  return {
    deployedBorrowerPools,
    deployedPositionManager,
    governance,
    testUser1,
    testUser2,
    testBorrower,
    testPositionManager,
    poolHash,
    poolTokenAddress,
    otherTokenAddress,
  };
};