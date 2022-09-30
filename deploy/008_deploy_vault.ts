import debugModule from 'debug';
import {ethers} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
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

  // deploy
  const Vault = await deploy('Vault', {
    contract: 'Vault',
    from: deployer,
    log: true,
    args: [
      Token1.address,
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
