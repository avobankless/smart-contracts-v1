import debugModule from 'debug';
import {parseEther} from 'ethers/lib/utils';
import {ethers, upgrades} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {developmentChains, networkConfig} from '../helper-hardhat-config';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const log = debugModule('deploy-setup');
  log.enabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {deployments} = hre as any;
  const {getNamedAccounts, network} = hre;

  // keep ts support on hre members
  const {deployer, governance} = await getNamedAccounts();
  const {deploy, catchUnknownSigner} = deployments;
  const chainName: string = network.name;

  let hostAddress: string;

  if (developmentChains.includes(chainName)) {
    hostAddress = networkConfig[process.env.HARDHAT_FORK!].superFluidHost!;
  } else {
    hostAddress = networkConfig[network.name].superFluidHost!;
  }

  // deploy
  const StreamMoneyFactory = await ethers.getContractFactory('StreamMoney');
  const StreamMoneyDeployer = await upgrades.deployProxy(StreamMoneyFactory, [
    hostAddress,
    parseEther('1000'),
    parseEther('604800'), // 1 week in seconds
  ]);

  const implementation = await hre.upgrades.erc1967.getImplementationAddress(
    StreamMoneyDeployer.address
  );

  log('StreamMoney proxy address: ' + StreamMoneyDeployer.address);
  log('StreamMoney implementation address: ' + implementation);
};
export default func;
func.tags = ['All', 'streamMoney', 'production', 'local', 'test'];
