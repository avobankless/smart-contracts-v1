import {BigNumber} from 'ethers';
import {deployments, ethers} from 'hardhat';

import {BorrowerPools} from '../../typechain';
import {checkTickUtil, computeBondsQuantity, setupFixture} from '../utils';
import {WAD} from '../utils/constants';
import {PoolParameters, PoolState, User} from '../utils/types';
import {expect} from './helpers/chai-setup';
import {setupTestContracts} from './utils';

const setup = deployments.createFixture(async () => {
  return setupFixture('All');
});

describe('Borrower Pools - Default', function () {
  let positionManager: User, borrower: User, governanceUser: User;
  let BorrowerPools: BorrowerPools;
  let poolParameters: PoolParameters;
  let poolState: PoolState;
  let depositRate: BigNumber,
    minRate: BigNumber,
    rateSpacing: BigNumber,
    loanDuration: BigNumber,
    repaymentPeriod: BigNumber;
  let poolToken: string;
  const depositAmount: BigNumber = WAD.mul(20); //20 tokens deposited : arbitrary amount for testing purpose
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let checkTickAmounts: any;

  beforeEach(async () => {
    const {deployer, mocks, users} = await setup();
    const {
      deployedBorrowerPools,
      testBorrower,
      testPositionManager,
      governance,
      poolTokenAddress,
    } = await setupTestContracts(deployer, mocks, users);
    BorrowerPools = deployedBorrowerPools;
    borrower = testBorrower;
    positionManager = testPositionManager;
    governanceUser = governance;
    poolParameters = await BorrowerPools.getPoolParameters(borrower.address);
    poolState = await BorrowerPools.getPoolState(borrower.address);
    minRate = poolParameters.minRate;
    rateSpacing = poolParameters.rateSpacing;
    depositRate = minRate.add(rateSpacing); //Tokens deposited at the min_rate + rate_spacing
    loanDuration = poolParameters.loanDuration;
    repaymentPeriod = poolParameters.repaymentPeriod;
    poolToken = poolTokenAddress;
    checkTickAmounts = checkTickUtil(borrower);
  });

  it('Defaulting a pool with an address that does not have the governance role should revert', async function () {
    await expect(
      borrower.BorrowerPools.setDefault(borrower.address)
    ).to.be.revertedWith(
      `AccessControl: account ${borrower.address.toLowerCase()} is missing role 0x71840dc4906352362b0cdaf79870196c8e42acafade72d5d5a6d59291253ceb1`
    );
  });
  it('Defaulting a pool without an ongoing loan should revert', async function () {
    await expect(
      governanceUser.BorrowerPools.setDefault(borrower.address)
    ).to.be.revertedWith('PC_NO_ONGOING_LOAN');
  });
  it('Defaulting a pool should set the flag to true', async function () {
    const borrowAmount = depositAmount;
    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );
    await borrower.BorrowerPools.borrow(borrower.address, borrowAmount);

    let defaultTimestamp = await borrower.BorrowerPools.getDefaultTimestamp(
      borrower.address
    );
    expect(poolState.defaulted).to.be.false;
    expect(defaultTimestamp).eq(BigNumber.from(0));

    await ethers.provider.send('evm_increaseTime', [
      loanDuration.add(repaymentPeriod).add(1).toNumber(),
    ]);

    await expect(governanceUser.BorrowerPools.setDefault(borrower.address))
      .to.emit(governanceUser.BorrowerPools, 'Default')
      .withArgs(borrower.address, BigNumber.from(0));

    poolState = await BorrowerPools.getPoolState(borrower.address);
    defaultTimestamp = await borrower.BorrowerPools.getDefaultTimestamp(
      borrower.address
    );
    expect(poolState.defaulted).to.be.true;
    expect(defaultTimestamp).gt(BigNumber.from(0));
  });
  it('Defaulting a pool should set repayment amounts', async function () {
    const borrowAmount = depositAmount;
    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );
    await borrower.BorrowerPools.borrow(borrower.address, borrowAmount);

    await ethers.provider.send('evm_increaseTime', [
      loanDuration.add(repaymentPeriod).add(1).toNumber(),
    ]);

    await expect(governanceUser.BorrowerPools.setDefault(borrower.address))
      .to.emit(governanceUser.BorrowerPools, 'Default')
      .withArgs(borrower.address, BigNumber.from(0));

    const repayAmountsBefore = await borrower.BorrowerPools.getRepayAmounts(
      borrower.address,
      false
    );

    await ethers.provider.send('evm_increaseTime', [loanDuration.toNumber()]);

    const repayAmountsAfter = await borrower.BorrowerPools.getRepayAmounts(
      borrower.address,
      false
    );

    expect(repayAmountsBefore[0]).eq(repayAmountsAfter[0]);
    expect(repayAmountsBefore[1]).eq(repayAmountsAfter[1]);
    expect(repayAmountsBefore[2]).eq(repayAmountsAfter[2]);
  });
  it('Defaulting a pool before repayment period is over should revert', async function () {
    const borrowAmount = depositAmount;
    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );
    await borrower.BorrowerPools.borrow(borrower.address, borrowAmount);

    expect(poolState.defaulted).to.be.false;

    await expect(
      governanceUser.BorrowerPools.setDefault(borrower.address)
    ).to.be.revertedWith('PC_REPAYMENT_PERIOD_ONGOING');
  });
  it('Defaulting a pool twice should revert', async function () {
    const borrowAmount = depositAmount;
    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );
    await borrower.BorrowerPools.borrow(borrower.address, borrowAmount);

    expect(poolState.defaulted).to.be.false;

    await ethers.provider.send('evm_increaseTime', [
      loanDuration.add(repaymentPeriod).add(1).toNumber(),
    ]);

    await expect(governanceUser.BorrowerPools.setDefault(borrower.address))
      .to.emit(governanceUser.BorrowerPools, 'Default')
      .withArgs(borrower.address, BigNumber.from(0));

    poolState = await BorrowerPools.getPoolState(borrower.address);
    expect(poolState.defaulted).to.be.true;

    await expect(
      governanceUser.BorrowerPools.setDefault(borrower.address)
    ).to.be.revertedWith('PC_POOL_DEFAULTED');
  });
  it('Defaulting should lock deposit', async function () {
    const borrowAmount = depositAmount;
    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );
    await borrower.BorrowerPools.borrow(borrower.address, borrowAmount);

    await ethers.provider.send('evm_increaseTime', [
      loanDuration.add(repaymentPeriod).add(1).toNumber(),
    ]);

    await expect(governanceUser.BorrowerPools.setDefault(borrower.address))
      .to.emit(governanceUser.BorrowerPools, 'Default')
      .withArgs(borrower.address, BigNumber.from(0));

    await expect(
      positionManager.PositionManager.deposit(
        positionManager.address,
        depositAmount,
        depositRate,
        borrower.address,
        poolToken
      )
    ).to.be.revertedWith('BP_POOL_DEFAULTED');

    // await expect(borrower.BorrowerPools.repay()).to.be.revertedWith(
    //   'BP_POOL_DEFAULTED'
    // );
  });
  it('Defaulting a pool should distribute the remaining liquidity rewards reserve to bonds holders on a single tick', async function () {
    const borrowAmount = depositAmount;
    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );
    await borrower.BorrowerPools.borrow(borrower.address, borrowAmount);
    await borrower.BorrowerPools.topUpLiquidityRewards(depositAmount);

    await checkTickAmounts(borrower.address, depositRate, {
      accruedFees: BigNumber.from(0),
    });

    await ethers.provider.send('evm_increaseTime', [
      loanDuration.add(repaymentPeriod).add(1).toNumber(),
    ]);

    await expect(governanceUser.BorrowerPools.setDefault(borrower.address))
      .to.emit(governanceUser.BorrowerPools, 'Default')
      .withArgs(borrower.address, depositAmount);

    await checkTickAmounts(borrower.address, depositRate, {
      accruedFees: depositAmount,
    });
  });
  it('Defaulting a pool should distribute the remaining liquidity rewards reserve to bonds holders on multiple ticks', async function () {
    const borrowAmount = depositAmount.mul(2);
    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );
    await positionManager.BorrowerPools.deposit(
      depositRate.add(rateSpacing),
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );
    await borrower.BorrowerPools.borrow(borrower.address, borrowAmount);
    await borrower.BorrowerPools.topUpLiquidityRewards(depositAmount);

    await checkTickAmounts(borrower.address, depositRate, {
      accruedFees: BigNumber.from(0),
    });
    await checkTickAmounts(borrower.address, depositRate.add(rateSpacing), {
      accruedFees: BigNumber.from(0),
    });

    await ethers.provider.send('evm_increaseTime', [
      loanDuration.add(repaymentPeriod).add(1).toNumber(),
    ]);

    await expect(governanceUser.BorrowerPools.setDefault(borrower.address))
      .to.emit(governanceUser.BorrowerPools, 'Default')
      .withArgs(borrower.address, depositAmount);

    const firstBondsQuantity = await computeBondsQuantity(
      depositAmount,
      depositRate,
      poolParameters.loanDuration
    );
    const secondBondsQuantity = await computeBondsQuantity(
      depositAmount,
      depositRate.add(rateSpacing),
      poolParameters.loanDuration
    );
    const totalBondsQuantity = firstBondsQuantity.add(secondBondsQuantity);

    await checkTickAmounts(borrower.address, depositRate, {
      accruedFees: depositAmount
        .mul(firstBondsQuantity)
        .div(totalBondsQuantity),
    });
    await checkTickAmounts(borrower.address, depositRate.add(rateSpacing), {
      accruedFees: depositAmount
        .mul(secondBondsQuantity)
        .div(totalBondsQuantity),
    });
  });
});
