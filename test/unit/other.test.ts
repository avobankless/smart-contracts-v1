import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {MockContract} from 'ethereum-waffle';
import {BigNumber} from 'ethers';
import {parseEther} from 'ethers/lib/utils';
import {deployments, ethers} from 'hardhat';

import {BorrowerPools, Token1, YearnFinanceWrapper} from '../../typechain';
import {PositionManager} from '../../typechain/PositionManager';
import {
  checkPoolUtil,
  checkPositionRepartitionUtil,
  checkTickUtil,
  setupFixture,
} from '../utils';
import {WAD} from '../utils/constants';
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
  let PositionManager: PositionManager;
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
      deployedPositionManager,
    } = await setupTestContracts(deployer, mocks, users);
    BorrowerPools = deployedBorrowerPools;
    PositionManager = deployedPositionManager;
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

  it('Calling getAllPoolAddresses should return all the addresses of the existing pools', async function () {
    const poolsAddresses = await BorrowerPools.getPoolsAddresses();
    console.log('🚀 ~ poolsAddresses', poolsAddresses);
    expect(poolsAddresses.length).to.equal(1);
    expect(poolsAddresses[0]).to.equal(borrower.address);
  });
  it('Depositing should work', async function () {
    await expect(
      positionManager.PositionManager.deposit(
        positionManager.address,
        // depositAmount,
        parseEther('100'),
        // depositRate,
        parseEther('0.06'),
        borrower.address,
        poolToken
      )
    ).to.emit(PositionManager, 'Deposit');
  });
  it.only('borrowing should increase balance of the account', async function () {
    await positionManager.PositionManager.deposit(
      positionManager.address,
      parseEther('100'),
      parseEther('0.06'),
      borrower.address,
      poolToken
    );
    await borrower.BorrowerPools.borrow(borrower.address, parseEther('10'));
    const balance = await poolTokenContract.balanceOf(borrower.address);
    expect(balance).to.equal(parseEther('10'));
  });
});
