import {Contract} from 'ethers';
import {parseEther} from 'ethers/lib/utils';
import {deployments, ethers, getNamedAccounts} from 'hardhat';
import {networkConfig} from '../../helper-hardhat-config';
import {BorrowerPools} from '../../typechain/BorrowerPools';
import {StreamMoney__factory} from '../../typechain/factories/StreamMoney__factory';
import {StreamMoney} from '../../typechain/StreamMoney';
import {setupFixture} from '../utils';
import {bufferTime, minPenalty, minStreamTime} from '../utils/constants';
import {expect} from './helpers/chai-setup';
import {setupTestContracts} from './utils/index';

const setup = deployments.createFixture(async () => {
  return setupFixture('All');
});

describe('Superfluid Stream Money - Goerli fork', function () {
  const amount = parseEther('1000');
  let borrower: string;
  let fDAI: Contract;
  let sDAIAddress = networkConfig.goerli.sDAI!;
  let borrowerPools: BorrowerPools;
  let streamMoney: StreamMoney;

  beforeEach(async function () {
    const {borrower: account} = await getNamedAccounts();
    borrower = account;

    const {deployer, mocks, users} = await setup();
    const {deployedBorrowerPools} = await setupTestContracts(
      deployer,
      mocks,
      users
    );

    borrowerPools = deployedBorrowerPools;

    const chainName = process.env.HARDHAT_FORK ?? 'localhost';
    fDAI = await ethers.getContractAt('Token1', networkConfig[chainName].fDAI!);

    const StreamMoney = <StreamMoney__factory>(
      await ethers.getContractFactory('StreamMoney')
    );
    streamMoney = await StreamMoney.deploy();
    streamMoney.initialize(
      networkConfig[chainName].superFluidHost!,
      minPenalty,
      minStreamTime
    );
    await fDAI.mint(borrower, amount);
    await fDAI
      .connect(await ethers.getSigner(borrower))
      .approve(streamMoney.address, amount);

    await streamMoney
      .connect(await ethers.getSigner(borrower))
      .depositErc20(fDAI.address, amount);

    await streamMoney
      .connect(await ethers.getSigner(borrower))
      .upgradeToken(fDAI.address, sDAIAddress, amount);

    const balance = await streamMoney.getSFTokenBalance(borrower, sDAIAddress);
    expect(parseInt(balance._hex, 16)).to.be.gt(99);
  });

  it('Creating a stream should work', async function () {
    const streamTime = minStreamTime;

    const flowRate = Math.floor(
      Number(amount) / (streamTime + bufferTime + minStreamTime)
    );

    await expect(
      streamMoney
        .connect(await ethers.getSigner(borrower))
        .startStream(
          borrowerPools.address,
          sDAIAddress,
          String(flowRate),
          bufferTime,
          minStreamTime
        )
    ).to.emit(streamMoney, 'StreamInitiated');
  });

  it('');
});
