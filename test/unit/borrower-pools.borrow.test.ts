import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {MockContract} from 'ethereum-waffle';
import {BigNumber} from 'ethers';
import {deployments, ethers} from 'hardhat';

import {BorrowerPools, Token1, YearnFinanceWrapper} from '../../typechain';
import {
  checkPoolUtil,
  checkPositionRepartitionUtil,
  checkTickUtil,
  computeBondsQuantity,
  setupFixture,
} from '../utils';
import {
  FIRST_BOND_ISSUANCE_INDEX,
  NEXT_BOND_ISSUANCE_INDEX,
  WAD,
} from '../utils/constants';
import {PoolParameters, User} from '../utils/types';
import {expect} from './helpers/chai-setup';
import {setupTestContracts} from './utils';

const setup = deployments.createFixture(async () => {
  return setupFixture('All');
});

describe('Borrower Pools - Borrow', async function () {
  let positionManager: User, borrower: User, governanceUser: User;
  let positionManagerSigner: SignerWithAddress;
  let BorrowerPools: BorrowerPools;
  let poolTokenContract: Token1;
  let yearnFinanceWrapper: YearnFinanceWrapper;
  let poolParameters: PoolParameters;
  let mockYearn: MockContract;
  let depositRate: BigNumber,
    minRate: BigNumber,
    rateSpacing: BigNumber,
    loanDuration: BigNumber,
    repaymentPeriod: BigNumber,
    maxBorrowableAmount: BigNumber;
  let poolToken: string;
  const depositAmount: BigNumber = WAD.mul(20); //20 tokens deposited : arbitrary amount for testing purpose
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let checkPoolState: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let checkPositionRepartition: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let checkTickAmounts: any;

  beforeEach(async () => {
    const {deployer, mocks, users} = await setup();
    const {
      deployedToken1,
      deployedYearnFinanceWrapper,
      deployedBorrowerPools,
      governance,
      testBorrower,
      testPositionManager,
      poolTokenAddress,
    } = await setupTestContracts(deployer, mocks, users);
    BorrowerPools = deployedBorrowerPools;
    poolTokenContract = deployedToken1;
    poolParameters = await BorrowerPools.getPoolParameters(
      testBorrower.address
    );
    minRate = poolParameters.minRate;
    rateSpacing = poolParameters.rateSpacing;
    depositRate = minRate.add(rateSpacing); //Tokens deposited at the min_rate + rate_spacing
    loanDuration = poolParameters.loanDuration;
    repaymentPeriod = poolParameters.repaymentPeriod;
    maxBorrowableAmount = poolParameters.maxBorrowableAmount;
    positionManager = testPositionManager;
    borrower = testBorrower;
    governanceUser = governance;
    poolToken = poolTokenAddress;
    checkPoolState = checkPoolUtil(borrower);
    checkPositionRepartition = checkPositionRepartitionUtil(borrower);
    checkTickAmounts = checkTickUtil(borrower);
    mockYearn = mocks.YearnFinanceWrapper;
    yearnFinanceWrapper = deployedYearnFinanceWrapper;
    positionManagerSigner = await ethers.getSigner(positionManager.address);

    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );
  });

  it('Borrowing in a paused pool should revert', async function () {
    await expect(governanceUser.BorrowerPools.freezePool()).to.emit(
      governanceUser.BorrowerPools,
      'Paused'
    );
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, depositAmount)
    ).to.revertedWith('Pausable: paused');
  });
  it('Borrowing in a defaulted pool should revert', async function () {
    const borrowAmount = depositAmount;
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');
    await ethers.provider.send('evm_increaseTime', [
      loanDuration.add(repaymentPeriod).add(1).toNumber(),
    ]);
    await expect(
      governanceUser.BorrowerPools.setDefault(borrower.address)
    ).to.emit(governanceUser.BorrowerPools, 'Default');

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, depositAmount)
    ).to.revertedWith('BP_POOL_DEFAULTED');
  });
  it('Borrowing more than the total deposited amount should revert', async function () {
    const borrowAmount = depositAmount.mul(2);
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.be.revertedWith('BP_BORROW_OUT_OF_BOUND_AMOUNT');
  });
  it('Borrowing more than the max borrowable amount should revert', async function () {
    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      maxBorrowableAmount
    );
    const borrowAmount = maxBorrowableAmount.add(1);
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.be.revertedWith('BP_BORROW_MAX_BORROWABLE_AMOUNT_EXCEEDED');
  });
  it('Estimating loan rate while active loan should return 0', async function () {
    const borrowAmount = depositAmount;
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    const estimatedRate = await borrower.BorrowerPools.estimateLoanRate(
      depositAmount.div(2),
      borrower.address
    );
    expect(estimatedRate.eq(BigNumber.from(0)));
  });
  it('Estimating loan rate for more than max borrowable amount should return the same as max borrowable amount', async function () {
    await positionManager.BorrowerPools.deposit(
      minRate,
      borrower.address,
      poolToken,
      positionManager.address,
      maxBorrowableAmount
    );

    let estimatedRate = await borrower.BorrowerPools.estimateLoanRate(
      maxBorrowableAmount,
      borrower.address
    );
    expect(estimatedRate.eq(minRate));

    estimatedRate = await borrower.BorrowerPools.estimateLoanRate(
      maxBorrowableAmount.mul(2),
      borrower.address
    );
    expect(estimatedRate.eq(minRate));
  });
  it('Estimating loan rate should return the right rate', async function () {
    const newDepositRate = depositRate.add(rateSpacing.mul(2));
    await positionManager.BorrowerPools.deposit(
      newDepositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount.mul(2)
    );

    let estimatedRate = await borrower.BorrowerPools.estimateLoanRate(
      depositAmount.div(2),
      borrower.address
    );
    expect(estimatedRate.eq(depositRate));

    estimatedRate = await borrower.BorrowerPools.estimateLoanRate(
      depositAmount,
      borrower.address
    );
    expect(estimatedRate.eq(depositRate));

    estimatedRate = await borrower.BorrowerPools.estimateLoanRate(
      depositAmount.mul(2),
      borrower.address
    );
    expect(estimatedRate.eq(depositRate.add(rateSpacing)));

    estimatedRate = await borrower.BorrowerPools.estimateLoanRate(
      depositAmount.mul(3),
      borrower.address
    );
    const expectedRate = depositRate.add(rateSpacing.mul(3).div(2));
    expect(estimatedRate.eq(expectedRate));
  });
  it('Borrowing from a single tick should update the tick data accordingly', async function () {
    const borrowAmount = depositAmount;
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: BigNumber.from(0),
      lowerInterestRate: depositRate,
      averageBorrowRate: depositRate,
      normalizedBorrowedAmount: borrowAmount,
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount,
      adjustedRemainingAmount: BigNumber.from(0),
      normalizedUsedAmount: depositAmount,
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
  });
  it.only('Borrowing from subsequent multiple ticks should update the ticks data accordingly', async function () {
    const borrowAmount = depositAmount.mul(2);
    const newDepositRate = depositRate.add(rateSpacing);
    await positionManager.BorrowerPools.deposit(
      newDepositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount.mul(2)
    );

    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount,
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount,
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount.mul(2),
      }
    );

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    const firstExpectedBondsQuantity = await computeBondsQuantity(
      depositAmount,
      depositRate,
      loanDuration
    );
    const secondExpectedBondsQuantity = await computeBondsQuantity(
      depositAmount,
      newDepositRate,
      loanDuration
    );
    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: depositAmount,
      lowerInterestRate: depositRate,
      averageBorrowRate: depositRate.add(newDepositRate).div(2),
      normalizedBorrowedAmount: borrowAmount,
    });

    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: BigNumber.from(0),
      normalizedUsedAmount: depositAmount,
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkTickAmounts(borrower.address, depositRate.add(rateSpacing), {
      adjustedTotalAmount: depositAmount,
      adjustedRemainingAmount: depositAmount.div(2),
      normalizedUsedAmount: depositAmount,
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: firstExpectedBondsQuantity,
        normalizedAmount: BigNumber.from(0),
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount,
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: secondExpectedBondsQuantity,
        normalizedAmount: depositAmount,
      }
    );
  });
  it('Borrowing from non subsequent multiple ticks should update the ticks data accordingly', async function () {
    const borrowAmount = depositAmount.mul(2);
    const newDepositRate = depositRate.add(rateSpacing.mul(2));
    await positionManager.BorrowerPools.deposit(
      newDepositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount.mul(2)
    );

    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount,
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount.mul(2),
      }
    );

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    const firstExpectedBondsQuantity = await computeBondsQuantity(
      depositAmount,
      depositRate,
      loanDuration
    );
    const secondExpectedBondsQuantity = await computeBondsQuantity(
      depositAmount,
      newDepositRate,
      loanDuration
    );
    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: depositAmount,
      lowerInterestRate: depositRate,
      averageBorrowRate: depositRate.add(newDepositRate).div(2),
      normalizedBorrowedAmount: borrowAmount,
    });

    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: BigNumber.from(0),
      normalizedUsedAmount: depositAmount,
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkTickAmounts(borrower.address, newDepositRate, {
      adjustedTotalAmount: depositAmount,
      adjustedRemainingAmount: depositAmount.div(2),
      normalizedUsedAmount: depositAmount,
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: firstExpectedBondsQuantity,
        normalizedAmount: BigNumber.from(0),
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount,
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: secondExpectedBondsQuantity,
        normalizedAmount: depositAmount,
      }
    );
  });
  it('Depositing after a borrow should send the amount into the pending amount', async function () {
    const borrowAmount = depositAmount;
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );

    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: BigNumber.from(0),
      lowerInterestRate: depositRate,
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: BigNumber.from(0),
      normalizedUsedAmount: depositAmount,
      adjustedPendingDepositAmount: depositAmount.div(2),
    });
    const expectedBondsQuantity = await computeBondsQuantity(
      depositAmount,
      depositRate,
      loanDuration
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: expectedBondsQuantity,
        normalizedAmount: BigNumber.from(0),
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: NEXT_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );
  });
  it('Borrowing multiple times from a single tick should update the tick data accordingly', async function () {
    const borrowAmount = depositAmount.div(2);
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: depositAmount.div(2),
      lowerInterestRate: depositRate,
      averageBorrowRate: depositRate,
      normalizedBorrowedAmount: borrowAmount,
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: depositAmount.div(4),
      normalizedUsedAmount: depositAmount.div(2),
      adjustedPendingDepositAmount: BigNumber.from(0),
    });

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'FurtherBorrow');
    const firstBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      depositRate,
      loanDuration
    );

    const secondBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      depositRate,
      loanDuration.sub(1)
    );

    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: BigNumber.from(0),
      lowerInterestRate: depositRate,
      averageBorrowRate: depositRate,
      normalizedBorrowedAmount: borrowAmount.mul(2),
    });

    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: BigNumber.from(0),
      bondsQuantity: firstBondsQuantity.add(secondBondsQuantity),
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
  });
  it('Borrowing multiple times for a total amount higher than the maximum borrowable amount should revert', async function () {
    const borrowAmount = depositAmount.div(2);
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, depositAmount.mul(100))
    ).to.revertedWith('BP_BORROW_MAX_BORROWABLE_AMOUNT_EXCEEDED');
  });
  it('Borrowing multiple times from multiple ticks should update the ticks data accordingly', async function () {
    const borrowAmount = depositAmount.div(2);
    const newDepositRate = depositRate.add(rateSpacing);
    await positionManager.BorrowerPools.deposit(
      newDepositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );

    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    const expectedBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      depositRate,
      loanDuration
    );
    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: depositAmount.mul(3).div(2),
      lowerInterestRate: depositRate,
      averageBorrowRate: depositRate,
      normalizedBorrowedAmount: borrowAmount,
      bondsIssuedQuantity: expectedBondsQuantity,
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: depositAmount.div(4),
      normalizedUsedAmount: borrowAmount,
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkTickAmounts(borrower.address, depositRate.add(rateSpacing), {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: depositAmount.div(2),
      normalizedUsedAmount: BigNumber.from(0),
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: expectedBondsQuantity,
        normalizedAmount: depositAmount.div(2),
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount.mul(2))
    ).to.emit(borrower.BorrowerPools, 'FurtherBorrow');

    const firstExpectedBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      depositRate,
      loanDuration.sub(1)
    );
    const secondExpectedBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      newDepositRate,
      loanDuration.sub(1)
    );
    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: depositAmount.div(2),
      lowerInterestRate: depositRate,
      normalizedBorrowedAmount: borrowAmount.mul(3),
      bondsIssuedQuantity: expectedBondsQuantity
        .add(firstExpectedBondsQuantity)
        .add(secondExpectedBondsQuantity),
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: BigNumber.from(0),
      bondsQuantity: expectedBondsQuantity.add(firstExpectedBondsQuantity),
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkTickAmounts(borrower.address, depositRate.add(rateSpacing), {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: depositAmount.div(4),
      bondsQuantity: secondExpectedBondsQuantity,
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: expectedBondsQuantity.add(firstExpectedBondsQuantity),
        normalizedAmount: BigNumber.from(0),
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: secondExpectedBondsQuantity,
        normalizedAmount: depositAmount.div(2),
      }
    );
  });
  it('Borrowing multiple times after maturity of the original loan should revert', async function () {
    const borrowAmount = depositAmount.div(2);
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    await ethers.provider.send('evm_increaseTime', [
      loanDuration.mul(2).toNumber(),
    ]);

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.revertedWith('BP_MULTIPLE_BORROW_AFTER_MATURITY');
  });
  it('Borrowing multiple times should not impact pending amounts', async function () {
    const borrowAmount = depositAmount.div(2);
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );

    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: depositAmount.div(2),
      lowerInterestRate: depositRate,
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: depositAmount.div(4),
      normalizedUsedAmount: depositAmount.div(2),
      adjustedPendingDepositAmount: depositAmount.div(2),
    });
    let expectedBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      depositRate,
      loanDuration
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: expectedBondsQuantity,
        normalizedAmount: depositAmount.div(2),
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: NEXT_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'FurtherBorrow');

    expectedBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      depositRate,
      loanDuration
    );
    const additionalExpectedBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      depositRate,
      loanDuration.sub(2)
    );
    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: BigNumber.from(0),
      lowerInterestRate: depositRate,
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: BigNumber.from(0),
      bondsQuantity: expectedBondsQuantity.add(additionalExpectedBondsQuantity),
      adjustedPendingDepositAmount: depositAmount.div(2),
    });

    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: NEXT_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );
  });
  it('Borrowing multiple times from a single tick should use accrued fees during that time', async function () {
    const borrowAmount = depositAmount.div(2);
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: depositAmount.div(2),
      lowerInterestRate: depositRate,
      averageBorrowRate: depositRate,
      normalizedBorrowedAmount: borrowAmount,
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: depositAmount.div(4),
      normalizedUsedAmount: depositAmount.div(2),
      adjustedPendingDepositAmount: BigNumber.from(0),
    });

    await yearnFinanceWrapper.getReserveNormalizedIncome(
      '0x5f25FEF2a34D7F1E3e330830060AaBaA3eD14009'
    );
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount.mul(2))
    ).to.emit(borrower.BorrowerPools, 'FurtherBorrow');
    const firstBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      depositRate,
      loanDuration
    );
    const secondBondsQuantity = await computeBondsQuantity(
      borrowAmount.mul(2),
      depositRate,
      loanDuration.sub(2)
    );
    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: BigNumber.from(0),
      lowerInterestRate: depositRate,
      averageBorrowRate: depositRate,
      normalizedBorrowedAmount: borrowAmount.mul(3),
      bondsIssuedQuantity: firstBondsQuantity.add(secondBondsQuantity),
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: BigNumber.from(0),
      bondsQuantity: firstBondsQuantity.add(secondBondsQuantity),
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
  });
  it('Borrowing multiple times from a tick should use the accrued fees in the meantime then pass to the next tick', async function () {
    const borrowAmount = depositAmount.div(2);
    const newDepositRate = depositRate.add(rateSpacing);
    await positionManager.BorrowerPools.deposit(
      newDepositRate,
      borrower.address,
      poolToken,
      positionManager.address,
      depositAmount
    );

    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );

    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount)
    ).to.emit(borrower.BorrowerPools, 'Borrow');

    const expectedBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      depositRate,
      loanDuration
    );
    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: depositAmount.mul(3).div(2),
      lowerInterestRate: depositRate,
      averageBorrowRate: depositRate,
      normalizedBorrowedAmount: borrowAmount,
      bondsIssuedQuantity: expectedBondsQuantity,
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: depositAmount.div(4),
      normalizedUsedAmount: borrowAmount,
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkTickAmounts(borrower.address, depositRate.add(rateSpacing), {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: depositAmount.div(2),
      normalizedUsedAmount: BigNumber.from(0),
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: expectedBondsQuantity,
        normalizedAmount: depositAmount.div(2),
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: BigNumber.from(0),
        normalizedAmount: depositAmount,
      }
    );

    await yearnFinanceWrapper.getReserveNormalizedIncome(
      '0x5f18C75AbDAe578b483E5F43f12a39cF75b973a9'
    );
    await expect(
      borrower.BorrowerPools.borrow(borrower.address, borrowAmount.mul(3))
    ).to.emit(borrower.BorrowerPools, 'FurtherBorrow');

    const firstExpectedBondsQuantity = await computeBondsQuantity(
      borrowAmount.mul(2),
      depositRate,
      loanDuration.sub(2)
    );
    const secondExpectedBondsQuantity = await computeBondsQuantity(
      borrowAmount,
      newDepositRate,
      loanDuration.sub(2)
    );
    await checkPoolState(borrower.address, {
      normalizedAvailableDeposits: depositAmount.mul(3).div(2),
      lowerInterestRate: depositRate,
      normalizedBorrowedAmount: borrowAmount.mul(4),
      bondsIssuedQuantity: expectedBondsQuantity
        .add(firstExpectedBondsQuantity)
        .add(secondExpectedBondsQuantity),
    });
    await checkTickAmounts(borrower.address, depositRate, {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: BigNumber.from(0),
      bondsQuantity: expectedBondsQuantity.add(firstExpectedBondsQuantity),
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkTickAmounts(borrower.address, depositRate.add(rateSpacing), {
      adjustedTotalAmount: depositAmount.div(2),
      adjustedRemainingAmount: depositAmount.div(4),
      bondsQuantity: secondExpectedBondsQuantity,
      adjustedPendingDepositAmount: BigNumber.from(0),
    });
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: depositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: expectedBondsQuantity.add(firstExpectedBondsQuantity),
        normalizedAmount: BigNumber.from(0),
      }
    );
    await checkPositionRepartition(
      {
        ownerAddress: borrower.address,
        rate: newDepositRate,
        adjustedAmount: depositAmount.div(2),
        bondsIssuanceIndex: FIRST_BOND_ISSUANCE_INDEX,
      },
      {
        bondsQuantity: secondExpectedBondsQuantity,
        normalizedAmount: depositAmount.mul(3).div(2),
      }
    );
  });
});
