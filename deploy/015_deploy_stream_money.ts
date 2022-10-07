import debugModule from 'debug';
import {parseEther} from 'ethers/lib/utils';
import {ethers} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {developmentChains, networkConfig} from '../helper-hardhat-config';
import {StreamMoney} from '../typechain/StreamMoney';

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

  await catchUnknownSigner(
    deploy('StreamMoney', {
      contract: 'StreamMoney',
      from: deployer,
      proxy: {
        owner: governance,
        proxyContract: 'OpenZeppelinTransparentProxy', // can't use the UUPS proxy because it inherits from ownable
        proxy: true,
        execute: {
          init: {
            methodName: 'initialize',
            args: [
              hostAddress,
              parseEther('1000'),
              parseEther('604800'), // 1 week in seconds
            ],
          },
        },
      },
      log: true,
    })
  );
  const StreamMoneyDeployer = <StreamMoney>(
    await ethers.getContract('StreamMoney', deployer)
  );

  log('StreamMoney proxy address: ' + StreamMoneyDeployer.address);
};
export default func;
func.tags = ['All', 'streamMoney', 'production', 'local', 'test'];
