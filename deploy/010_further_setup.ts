import debugModule from 'debug';
import {parseEther} from 'ethers/lib/utils';
import {network} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {networkConfig} from '../helper-hardhat-config';
import {Token1} from '../typechain';

import {MockYearnRegistry} from '../typechain/MockYearnRegistry';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const log = debugModule('deploy-setup');
  log.enabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {deployments} = hre as any;
  const {ethers, getNamedAccounts} = hre;
  const {deployer} = await getNamedAccounts();

  // keep ts support on hre members
  const {governance} = await getNamedAccounts();
  const {catchUnknownSigner, execute} = deployments;

  const Vault = <any>await ethers.getContract('Vault', governance);
  await Vault.connect(await ethers.getSigner(deployer)).setDepositLimit(
    parseEther('10000')
  );

  const Token1 = <Token1>await ethers.getContract('Token1');
  let networkName = network.name;
  if (['localhost', 'hardhat'].includes(network.name)) {
    networkName = process.env.HARDHAT_FORK!;
  }
  const tokenAddress = networkConfig[networkName].fDAI ?? Token1.address;

  const YearnRegistry = <MockYearnRegistry>(
    await ethers.getContract('MockYearnRegistry', governance)
  );

  await YearnRegistry.newVault(tokenAddress, Vault.address);
};
func.id = 'setup';
export default func;
func.tags = ['All', 'furtherSetup', 'local', 'test'];
