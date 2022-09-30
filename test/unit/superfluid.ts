import {Contract} from 'ethers';
import {parseEther} from 'ethers/lib/utils';
import {ethers, getNamedAccounts} from 'hardhat';
import {StreamMoney} from '../../typechain/StreamMoney';
import {expect} from './helpers/chai-setup';

describe('Superfluid Stream Money - Goerli fork', async function () {
  let host: Contract;
  let StreamMoney: StreamMoney;
  let fDAI: Contract;
  let sDAI = '0xb5191e4e65e658a154d5f2927962ce91d5e17a35';
  let account: string;
  const amount = parseEther('1000');
  const fDAIAddress = '0x1714B9AF0BF10F9EdE7aEE00584B2B731437EdFA';
  const fDAIContractName = 'Token1';
  const streamMoneyAddress = '0x7e79F0Bb019DA3303237FD8917aE0A28d2474d2B';
  const borrowerPoolsAddress = '0x605f6E5298F573Ae77d0a7626F25E64Ee44F5A42';

  beforeEach(async function () {
    const {deployer} = await getNamedAccounts();
    account = deployer;

    fDAI = await ethers.getContractAt(fDAIContractName, fDAIAddress);

    StreamMoney = await ethers.getContractAt('StreamMoney', streamMoneyAddress);
  });

  it('Token upgrade should work', async function () {
    await fDAI.mint(account, amount);
    await fDAI.approve(StreamMoney.address, amount);

    await StreamMoney.depositErc20(fDAI.address, amount);

    await StreamMoney.upgradeToken(fDAI.address, sDAI, 100);

    const balance = await StreamMoney.getSFTokenBalance(account, sDAI);
    expect(parseInt(balance._hex, 16)).to.be.gt(100);

    await StreamMoney.startStream(
      borrowerPoolsAddress,
      sDAI,
      '100000000000000',
      String(60 * 60),
      String(24 * 60 * 60),
      {gasPrice: 30000000000, gasLimit: 10000000, from: account}
    );
  });
});
