import debugModule from 'debug';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // if (hre.network.config.chainId !== 31337) {
  //   return;
  // }

  const log = debugModule('deploy-setup');
  log.enabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {deployments} = hre as any;
  const {getNamedAccounts} = hre;

  // keep ts support on hre members
  const {deployer} = await getNamedAccounts();
  const {deploy} = deployments;

  // deploy lib
  const Multicall2 = await deploy('Multicall2', {
    contract: 'Multicall2',
    from: deployer,
    log: true,
  });

  // Print all contracts info pretty
  log('Multicall2library: ' + Multicall2.address);

  // await hre.tenderly.persistArtifacts({
  //   name: 'Multicall2',
  //   address: Multicall2.address,
  // });
};
export default func;
func.tags = ['All', 'Multicall2'];
