import debugModule from 'debug';
import {ethers, network} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {networkConfig} from '../helper-hardhat-config';
import {Token1} from '../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const log = debugModule('deploy-setup');
  log.enabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {deployments} = hre as any;
  const {getNamedAccounts} = hre;

  // keep ts support on hre members
  const {deployer} = await getNamedAccounts();
  const {deploy} = deployments;

  const Token1 = <Token1>await ethers.getContract('Token1');
  let networkName = network.name;
  if (['localhost', 'hardhat'].includes(network.name)) {
    networkName = process.env.HARDHAT_FORK!;
  }
  const tokenAddress = networkConfig[networkName].fDAI ?? Token1.address;

  // deploy
  const Vault = await deploy('Vault', {
    contract: 'Vault',
    from: deployer,
    log: true,
    args: [
      tokenAddress,
      deployer,
      deployer,
      'Test Vault',
      'TV',
      deployer,
      deployer,
    ],
  });

  // Print all contracts info pretty
  log('Vault: ' + Vault.address);
};
export default func;
func.tags = ['All', 'vault', 'local', 'test'];
