import debugModule from 'debug';
import {ethers, network} from 'hardhat';
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
  const {getNamedAccounts} = hre;

  // keep ts support on hre members
  const {deployer} = await getNamedAccounts();
  const {deploy} = deployments;

  const Token1: Token1 = await ethers.getContract('Token1');
  const MockYearnRegistry: MockYearnRegistry = await ethers.getContract(
    'MockYearnRegistry'
  );

  // deploy
  let networkName = network.name;
  if (['localhost', 'hardhat'].includes(network.name)) {
    networkName = process.env.HARDHAT_FORK!;
  }
  const tokenAddress = networkConfig[networkName].fDAI ?? Token1.address;

  const YearnFinanceWrapper = await deploy('YearnFinanceWrapper', {
    contract: 'YearnFinanceWrapper',
    from: deployer,
    log: true,
    args: [tokenAddress, MockYearnRegistry.address, 'Test Wrapper', 'TW'],
  });

  // Print all contracts info pretty
  log('YearnFinanceWrapper: ' + YearnFinanceWrapper.address);
};
export default func;
func.tags = ['All', 'yearnFinanceWrapper', 'local', 'test'];
