import debugModule from 'debug';
import {ethers} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
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

  // deploy
  await deploy('MockYearnRegistry', {
    contract: 'MockYearnRegistry',
    from: deployer,
    log: true,
  });

  const YearnRegistry = <MockYearnRegistry>(
    await ethers.getContract('MockYearnRegistry', deployer)
  );
  // Print all contracts info pretty
  log('YearnRegistry: ' + YearnRegistry.address);

  // await hre.tenderly.persistArtifacts({
  //   name: 'YearnRegistry',
  //   address: YearnRegistry.address,
  // });
};
export default func;
func.tags = ['All', 'YearnRegistry'];
