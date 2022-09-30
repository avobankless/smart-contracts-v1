import debugModule from 'debug';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {networkConfig} from '../helper-hardhat-config';

import {BorrowerPools, PoolLogic} from '../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const log = debugModule('deploy-setup');
  log.enabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {deployments} = hre as any;
  const {ethers, getNamedAccounts, network} = hre;

  // keep ts support on hre members
  const {deployer, governance} = await getNamedAccounts();
  const {deploy, catchUnknownSigner} = deployments;

  log('Governance: ' + governance);
  log('Deployer: ' + deployer);
  const PoolLogic = <PoolLogic>await ethers.getContract('PoolLogic', deployer);

  // Deploy proxy
  await catchUnknownSigner(
    deploy('BorrowerPools', {
      contract: 'BorrowerPools',
      from: deployer,
      libraries: {
        PoolLogic: PoolLogic.address,
      },
      proxy: {
        owner: governance,
        proxy: true,
        execute: {
          init: {
            methodName: 'initialize',
            args: [
              governance,
              networkConfig[network.name].superFluidHost!,
              networkConfig[network.name].registrationKey ?? '',
            ],
          },
        },
      },
      log: true,
    })
  );

  const BorrowerPoolsDeployer = <BorrowerPools>(
    await ethers.getContract('BorrowerPools', deployer)
  );

  // Print all contracts info pretty
  log('BorrowerPools proxy address: ' + BorrowerPoolsDeployer.address);
};
export default func;
func.tags = ['All', 'BorrowerPools'];
func.dependencies = ['PoolLogic'];
