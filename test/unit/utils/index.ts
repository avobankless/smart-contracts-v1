import {BigNumber} from 'ethers';
import {parseEther} from 'ethers/lib/utils';
import {ethers} from 'hardhat';

import {
  BorrowerPools,
  PositionManager,
  Token1,
  YearnFinanceWrapper,
} from '../../../typechain';
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
  deployedYearnFinanceWrapper: YearnFinanceWrapper;
  deployedBorrowerPools: BorrowerPools;
  deployedToken1: Token1;
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

  const deployedToken1 = await deployer.Token1F.deploy();
  const testPositionManager = await setupUser(users[4].address, {
    PoolToken: deployedToken1,
    BorrowerPools: deployedBorrowerPools,
    PositionManager: deployedPositionManager,
  });
  await deployedToken1.mint(testPositionManager.address, parseEther('10000'));
  await deployedToken1
    .connect(await ethers.getSigner(testPositionManager.address))
    .increaseAllowance(deployedBorrowerPools.address, parseEther('10000'));

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

  const vault = await deployer.VaultF.deploy(
    deployedToken1.address,
    deployer.address,
    deployer.address,
    'Test Vault',
    'TV',
    deployer.address,
    deployer.address
  );
  await vault.setDepositLimit(1000000000000000000000000000000000000000000000n);

  const yearnRegistry = await deployer.YearnRegistryF.deploy();
  await yearnRegistry.newVault(deployedToken1.address, vault.address);

  const deployedYearnFinanceWrapper =
    await deployer.YearnFinanceWrapperF.deploy(
      deployedToken1.address,
      yearnRegistry.address,
      'Test',
      'TEST'
    );

  await testBorrower.BorrowerPools.createNewPool({
    poolOwner: testBorrower.address,
    underlyingToken: deployedToken1.address,
    yieldProvider: deployedYearnFinanceWrapper.address,
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

  await deployedBorrowerPools.grantRole(
    POSITION_ROLE,
    testPositionManager.address
  );
  await deployedBorrowerPools.grantRole(POSITION_ROLE, deployer.address);

  const poolTokenAddress = deployedToken1.address;
  const otherTokenAddress = mocks.DepositToken2.address;

  return {
    deployedYearnFinanceWrapper,
    deployedToken1,
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
