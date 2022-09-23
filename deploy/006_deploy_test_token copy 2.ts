import debugModule from 'debug';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const log = debugModule('deploy-setup');
  log.enabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {deployments} = hre as any;
  const {getNamedAccounts} = hre;

  // keep ts support on hre members
  const {deployer} = await getNamedAccounts();
  const {deploy} = deployments;

  // deploy
  const Token1 = await deploy('Token1', {
    contract: 'Token1',
    from: deployer,
    log: true,
  });

  // Print all contracts info pretty
  log('Token1: ' + Token1.address);
};
export default func;
func.tags = ['All', 'Token1'];
