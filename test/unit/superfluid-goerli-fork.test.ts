import {ConstantFlowAgreementV1} from '@superfluid-finance/sdk-core';
import {
  IAgreementV1Options,
  IConfig,
} from '@superfluid-finance/sdk-core/dist/module/interfaces';
import {BigNumber, Contract} from 'ethers';
import {parseEther} from 'ethers/lib/utils';
import {deployments, ethers} from 'hardhat';
import {networkConfig} from '../../helper-hardhat-config';
import {BorrowerPools} from '../../typechain/BorrowerPools';
import {StreamMoney__factory} from '../../typechain/factories/StreamMoney__factory';
import {StreamMoney} from '../../typechain/StreamMoney';
import {SuperfluidCallbacks} from '../../typechain/SuperfluidCallbacks';
import {setupFixture} from '../utils';
import {
  bufferTime,
  loanDuration,
  minPenalty,
  minStreamTime,
} from '../utils/constants';
import {PoolParameters, User} from '../utils/types';
import {expect} from './helpers/chai-setup';
import {setupTestContracts} from './utils/index';

const setup = deployments.createFixture(async () => {
  return setupFixture('test');
});

describe('Superfluid Stream Money - Goerli fork', function () {
  const amount = parseEther('1000');
  const abi = ethers.utils.defaultAbiCoder;
  const streamTime = minStreamTime;
  let fDAI: Contract;
  let sDAI: Contract;
  let sDAIAddress = networkConfig.goerli.sDAI!;
  let borrowerPools: BorrowerPools;
  let superfluidCallbacks: SuperfluidCallbacks;
  let streamMoney: StreamMoney;
  let borrower: User;
  let positionManager: User;
  let poolToken: string;
  let poolParameters: PoolParameters;
  let depositRate: BigNumber,
    minRate: BigNumber,
    rateSpacing: BigNumber,
    amountToRepay: BigNumber;
  let flowRate: Number;
  let cfaV1: ConstantFlowAgreementV1;
  // let sf: Framework;

  beforeEach(async function () {
    const {deployer, mocks, users} = await setup();

    const {
      deployedBorrowerPools,
      deployedSuperfluidCallbacks,
      testPositionManager,
      testBorrower,
      poolTokenAddress,
    } = await setupTestContracts(deployer, mocks, users);

    borrower = testBorrower;

    borrowerPools = deployedBorrowerPools;

    superfluidCallbacks = deployedSuperfluidCallbacks;
    positionManager = testPositionManager;
    poolParameters = await borrowerPools.getPoolParameters(borrower.address);
    minRate = poolParameters.minRate;
    rateSpacing = poolParameters.rateSpacing;
    depositRate = minRate.add(rateSpacing); //Tokens deposited at the min_rate + rate_spacing
    poolToken = poolTokenAddress;

    const chainName = process.env.HARDHAT_FORK ?? 'localhost';
    fDAI = await ethers.getContractAt('Token1', networkConfig[chainName].fDAI!);

    sDAI = await ethers.getContractAt(
      'SuperToken',
      networkConfig[chainName].sDAI!
    );

    const StreamMoney = <StreamMoney__factory>(
      await ethers.getContractFactory('StreamMoney')
    );
    streamMoney = await StreamMoney.deploy();
    streamMoney.initialize(
      networkConfig[chainName].superFluidHost!,
      minPenalty,
      minStreamTime
    );

    // position manager deposits to borrow
    await fDAI.mint(positionManager.address, amount);
    await fDAI
      .connect(await ethers.getSigner(positionManager.address))
      .approve(borrowerPools.address, amount);
    await positionManager.BorrowerPools.deposit(
      depositRate,
      borrower.address,
      fDAI.address,
      positionManager.address,
      amount
    );
    //

    amountToRepay = await borrowerPools.getRepaymentAmount(
      borrower.address,
      amount
    );

    // approve streamMoney
    await fDAI.mint(borrower.address, amountToRepay);
    await fDAI
      .connect(await ethers.getSigner(borrower.address))
      .approve(streamMoney.address, amountToRepay);

    await streamMoney
      .connect(await ethers.getSigner(borrower.address))
      .depositErc20(fDAI.address, amountToRepay);

    await streamMoney
      .connect(await ethers.getSigner(borrower.address))
      .upgradeToken(fDAI.address, sDAIAddress, amountToRepay);

    const balance = await streamMoney.getSFTokenBalance(
      borrower.address,
      sDAIAddress
    );
    expect(parseInt(balance._hex, 16)).to.be.gt(99);
    //

    // approve superfluid callbacks contract
    await fDAI.mint(borrower.address, amountToRepay);
    await fDAI
      .connect(await ethers.getSigner(borrower.address))
      .approve(sDAI.address, amountToRepay);

    await sDAI
      .connect(await ethers.getSigner(borrower.address))
      .upgrade(amountToRepay);
    await sDAI
      .connect(await ethers.getSigner(borrower.address))
      .approve(superfluidCallbacks.address, amountToRepay);
    //

    flowRate = Math.floor(
      Number(amountToRepay) / (streamTime + bufferTime + minStreamTime)
    );

    const config: IConfig = {
      resolverAddress: networkConfig[chainName].superFluidResolver!,
      hostAddress: networkConfig[chainName].superFluidHost!,
      cfaV1Address: networkConfig[chainName].superFluidCFAv1!,
      idaV1Address: networkConfig[chainName].superFluidIDAv1!,
      governanceAddress: '',
    };

    const options: IAgreementV1Options = {
      config: config,
    };

    cfaV1 = new ConstantFlowAgreementV1(options);
  });

  it('Calling getRepaymentAmount should return repay value', async function () {
    const repaymentAmount = await borrowerPools.getRepaymentAmount(
      borrower.address,
      amount
    );
    expect(repaymentAmount).to.be.gt(amount);
  });

  it('Creating a stream through the stream money contract should work', async function () {
    await expect(
      streamMoney
        .connect(await ethers.getSigner(borrower.address))
        .startStream(
          superfluidCallbacks.address,
          sDAIAddress,
          String(flowRate),
          bufferTime,
          minStreamTime,
          amount
        )
    ).to.emit(streamMoney, 'StreamInitiated');
  });

  it.only('Creating a stream directly to the superfluid callback contract should let the borrower lend', async function () {
    const userData = abi.encode(
      ['address', 'uint128'],
      [borrower.address, amount]
    );

    const createFlowOperation = cfaV1.createFlow({
      superToken: sDAIAddress,
      receiver: superfluidCallbacks.address,
      flowRate: String(amountToRepay.div(loanDuration)),
      userData: userData,
      overrides: {
        gasLimit: 30000000,
      },
    });
    const txnResponse = await createFlowOperation.exec(
      await ethers.getSigner(borrower.address)
    );
    console.log('🚀 ~ txnResponse', txnResponse);
    await txnResponse.wait();
    console.log('🚀 ~ txnResponse', txnResponse);
    const borrowerAfterBalance = await fDAI.balanceOf(borrower.address);
    expect(borrowerAfterBalance).to.be.equal(amount);
  });
});
