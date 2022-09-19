import {MockContract} from 'ethereum-waffle';
import {deployments, ethers} from 'hardhat';

import {parseEther} from 'ethers/lib/utils';
import {setupFixture} from '../utils';
import {
  cooldownPeriod,
  distributionRate,
  establishmentFeeRate,
  lateRepayFeePerBondRate,
  liquidityRewardsActivationThreshold,
  loanDuration,
  maxBorrowableAmount,
  maxRateInput,
  minRateInput,
  rateSpacingInput,
  repaymentFeeRate,
  repaymentPeriod,
} from '../utils/constants';
import {User} from '../utils/types';
import {expect} from './helpers/chai-setup';
import {setupTestContracts} from './utils';

const setup = deployments.createFixture(async () => {
  return setupFixture('All');
});

describe('Borrower Pools - Governance functions', function () {
  let governanceUser: User, user1: User, borrower: User;
  let poolToken: string, otherToken: string;
  let mockLendingPool: MockContract;

  beforeEach(async () => {
    const {deployer, mocks, users} = await setup();
    const {
      governance,
      testBorrower,
      testUser1,
      poolTokenAddress,
      otherTokenAddress,
    } = await setupTestContracts(deployer, mocks, users);
    borrower = testBorrower;
    user1 = testUser1;
    governanceUser = governance;
    poolToken = poolTokenAddress;
    otherToken = otherTokenAddress;
    mockLendingPool = mocks.ILendingPool;
  });

  it('Creating a pool for an unsupported asset should revert', async () => {
    await mockLendingPool.mock.getReserveNormalizedIncome.returns(
      parseEther('1000000000').sub(1)
    );
    await expect(
      governanceUser.BorrowerPools.createNewPool({
        poolOwner: user1.address,
        underlyingToken: otherToken,
        yieldProvider: mockLendingPool.address,
        minRate: minRateInput,
        maxRate: maxRateInput,
        rateSpacing: rateSpacingInput,
        maxBorrowableAmount: maxBorrowableAmount,
        loanDuration: loanDuration,
        distributionRate: distributionRate,
        cooldownPeriod: cooldownPeriod,
        repaymentPeriod: repaymentPeriod,
        lateRepayFeePerBondRate: lateRepayFeePerBondRate,
        establishmentFeeRate: establishmentFeeRate,
        repaymentFeeRate: repaymentFeeRate,
        liquidityRewardsActivationThreshold:
          liquidityRewardsActivationThreshold,
        earlyRepay: true,
      })
    ).to.be.revertedWith('PC_POOL_TOKEN_NOT_SUPPORTED');
  });
  it('Creating a pool for an existing borrower should revert', async () => {
    await expect(
      borrower.BorrowerPools.createNewPool({
        poolOwner: borrower.address,
        underlyingToken: otherToken,
        yieldProvider: mockLendingPool.address,
        minRate: minRateInput,
        maxRate: maxRateInput,
        rateSpacing: rateSpacingInput,
        maxBorrowableAmount: maxBorrowableAmount,
        loanDuration: loanDuration,
        distributionRate: distributionRate,
        cooldownPeriod: cooldownPeriod,
        repaymentPeriod: repaymentPeriod,
        lateRepayFeePerBondRate: lateRepayFeePerBondRate,
        establishmentFeeRate: establishmentFeeRate,
        repaymentFeeRate: repaymentFeeRate,
        liquidityRewardsActivationThreshold:
          liquidityRewardsActivationThreshold,
        earlyRepay: true,
      })
    ).to.be.revertedWith('PC_POOL_ALREADY_SET_FOR_BORROWER');
  });
  it('Creating a pool with a null identifier should revert', async () => {
    await expect(
      governanceUser.BorrowerPools.connect(
        ethers.constants.AddressZero
      ).createNewPool({
        poolOwner: ethers.constants.AddressZero,
        underlyingToken: otherToken,
        yieldProvider: mockLendingPool.address,
        minRate: minRateInput,
        maxRate: maxRateInput,
        rateSpacing: rateSpacingInput,
        maxBorrowableAmount: maxBorrowableAmount,
        loanDuration: loanDuration,
        distributionRate: distributionRate,
        cooldownPeriod: cooldownPeriod,
        repaymentPeriod: repaymentPeriod,
        lateRepayFeePerBondRate: lateRepayFeePerBondRate,
        establishmentFeeRate: establishmentFeeRate,
        repaymentFeeRate: repaymentFeeRate,
        liquidityRewardsActivationThreshold:
          liquidityRewardsActivationThreshold,
        earlyRepay: true,
      })
    ).to.be.revertedWith('PC_ZERO_POOL');
  });
  it('Creating a pool for an unrecorded borrower should pass', async () => {
    await expect(
      governanceUser.BorrowerPools.createNewPool({
        poolOwner: user1.address,
        underlyingToken: otherToken,
        yieldProvider: mockLendingPool.address,
        minRate: minRateInput,
        maxRate: maxRateInput,
        rateSpacing: rateSpacingInput,
        maxBorrowableAmount: maxBorrowableAmount,
        loanDuration: loanDuration,
        distributionRate: distributionRate,
        cooldownPeriod: cooldownPeriod,
        repaymentPeriod: repaymentPeriod,
        lateRepayFeePerBondRate: lateRepayFeePerBondRate,
        establishmentFeeRate: establishmentFeeRate,
        repaymentFeeRate: repaymentFeeRate,
        liquidityRewardsActivationThreshold:
          liquidityRewardsActivationThreshold,
        earlyRepay: true,
      })
    )
      .to.emit(governanceUser.BorrowerPools, 'PoolCreated')
      .withArgs([
        user1.address,
        otherToken,
        mockLendingPool.address,
        minRateInput,
        maxRateInput,
        rateSpacingInput,
        maxBorrowableAmount,
        loanDuration,
        distributionRate,
        cooldownPeriod,
        repaymentPeriod,
        lateRepayFeePerBondRate,
        establishmentFeeRate,
        repaymentFeeRate,
        liquidityRewardsActivationThreshold,
        true,
      ]);
  });
  it('Creating a pool with right rate spacing should pass', async () => {
    const minRateInput = parseEther('0.05');
    const maxRateInput = parseEther('0.25');
    const rateSpacingInput = parseEther('0.01');
    await expect(
      governanceUser.BorrowerPools.createNewPool({
        poolOwner: user1.address,
        underlyingToken: otherToken,
        yieldProvider: mockLendingPool.address,
        minRate: minRateInput,
        maxRate: maxRateInput,
        rateSpacing: rateSpacingInput,
        maxBorrowableAmount: maxBorrowableAmount,
        loanDuration: loanDuration,
        distributionRate: distributionRate,
        cooldownPeriod: cooldownPeriod,
        repaymentPeriod: repaymentPeriod,
        lateRepayFeePerBondRate: lateRepayFeePerBondRate,
        establishmentFeeRate: establishmentFeeRate,
        repaymentFeeRate: repaymentFeeRate,
        liquidityRewardsActivationThreshold:
          liquidityRewardsActivationThreshold,
        earlyRepay: true,
      })
    )
      .to.emit(governanceUser.BorrowerPools, 'PoolCreated')
      .withArgs([
        user1.address,
        otherToken,
        mockLendingPool.address,
        minRateInput,
        maxRateInput,
        rateSpacingInput,
        maxBorrowableAmount,
        loanDuration,
        distributionRate,
        cooldownPeriod,
        repaymentPeriod,
        lateRepayFeePerBondRate,
        establishmentFeeRate,
        repaymentFeeRate,
        liquidityRewardsActivationThreshold,
        true,
      ]);
  });
  it('Creating a pool with misaligned rates should revert', async () => {
    const minRateInput = parseEther('0.05');
    const maxRateInput = parseEther('0.3');
    const rateSpacingInput = parseEther('0.1');
    await expect(
      governanceUser.BorrowerPools.createNewPool({
        poolOwner: user1.address,
        underlyingToken: otherToken,
        yieldProvider: mockLendingPool.address,
        minRate: minRateInput,
        maxRate: maxRateInput,
        rateSpacing: rateSpacingInput,
        maxBorrowableAmount: maxBorrowableAmount,
        loanDuration: loanDuration,
        distributionRate: distributionRate,
        cooldownPeriod: cooldownPeriod,
        repaymentPeriod: repaymentPeriod,
        lateRepayFeePerBondRate: lateRepayFeePerBondRate,
        establishmentFeeRate: establishmentFeeRate,
        repaymentFeeRate: repaymentFeeRate,
        liquidityRewardsActivationThreshold:
          liquidityRewardsActivationThreshold,
        earlyRepay: true,
      })
    ).to.revertedWith('PC_RATE_SPACING_COMPLIANCE');
  });
  it('Creating a pool with establishment rate too high should revert', async () => {
    const establishmentFeeRateInput = parseEther('2');
    await expect(
      governanceUser.BorrowerPools.createNewPool({
        poolOwner: user1.address,
        underlyingToken: otherToken,
        yieldProvider: mockLendingPool.address,
        minRate: minRateInput,
        maxRate: maxRateInput,
        rateSpacing: rateSpacingInput,
        maxBorrowableAmount: maxBorrowableAmount,
        loanDuration: loanDuration,
        distributionRate: distributionRate,
        cooldownPeriod: cooldownPeriod,
        repaymentPeriod: repaymentPeriod,
        lateRepayFeePerBondRate: lateRepayFeePerBondRate,
        establishmentFeeRate: establishmentFeeRateInput,
        repaymentFeeRate: repaymentFeeRate,
        liquidityRewardsActivationThreshold:
          liquidityRewardsActivationThreshold,
        earlyRepay: true,
      })
    ).to.revertedWith('PC_ESTABLISHMENT_FEES_TOO_HIGH');
  });
  it('Allowing a borrower with an address whithout governance role should revert', async () => {
    await expect(
      user1.BorrowerPools.allow(user1.address, borrower.address)
    ).to.be.revertedWith(
      `AccessControl: account ${user1.address.toLowerCase()} is missing role 0x71840dc4906352362b0cdaf79870196c8e42acafade72d5d5a6d59291253ceb1`
    );
  });
  it('Allowing an address for the null identifier pool should revert', async () => {
    await expect(
      governanceUser.BorrowerPools.allow(
        user1.address,
        ethers.constants.AddressZero
      )
    ).to.be.revertedWith('PC_ZERO_POOL');
  });
  it('Allowing the zero address should revert', async () => {
    await expect(
      governanceUser.BorrowerPools.allow(
        ethers.constants.AddressZero,
        borrower.address
      )
    ).to.be.revertedWith('PC_ZERO_ADDRESS');
  });
  it('Allowing a borrower without pool should revert', async () => {
    await expect(
      governanceUser.BorrowerPools.allow(user1.address, user1.address)
    ).to.be.revertedWith('PC_POOL_NOT_ACTIVE');
  });
  it('Allowing a borrower with a pool should pass', async () => {
    await expect(
      governanceUser.BorrowerPools.allow(borrower.address, borrower.address)
    ).to.emit(governanceUser.BorrowerPools, 'BorrowerAllowed');
  });
  it('Disallowing a borrower with an address whithout governance role should revert', async () => {
    await expect(
      user1.BorrowerPools.disallow(user1.address, borrower.address)
    ).to.be.revertedWith(
      `AccessControl: account ${user1.address.toLowerCase()} is missing role 0x71840dc4906352362b0cdaf79870196c8e42acafade72d5d5a6d59291253ceb1`
    );
  });
  it('Disallowing a borrower without pool should revert', async () => {
    await expect(
      governanceUser.BorrowerPools.disallow(user1.address, user1.address)
    ).to.be.revertedWith('PC_POOL_NOT_ACTIVE');
  });
  it('Disallowing for the zero identifier pool should revert', async () => {
    await expect(
      governanceUser.BorrowerPools.disallow(
        ethers.constants.AddressZero,
        ethers.constants.AddressZero
      )
    ).to.be.revertedWith('PC_ZERO_POOL');
  });
  it('Disallowing a borrower with a pool should pass', async () => {
    await governanceUser.BorrowerPools.allow(
      borrower.address,
      borrower.address
    );
    await expect(
      governanceUser.BorrowerPools.disallow(borrower.address, borrower.address)
    ).to.emit(governanceUser.BorrowerPools, 'BorrowerDisallowed');
  });
});
