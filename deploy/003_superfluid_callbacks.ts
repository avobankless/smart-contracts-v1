import debugModule from 'debug';
import {network} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {networkConfig} from '../helper-hardhat-config';

import {SuperfluidCallbacks} from '../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const log = debugModule('deploy-setup');
  log.enabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {deployments} = hre as any;
  const {ethers, getNamedAccounts} = hre;

  // keep ts support on hre members
  const {deployer, governance} = await getNamedAccounts();
  const {deploy, catchUnknownSigner} = deployments;

  const borrowerPools = await ethers.getContract('BorrowerPools', deployer);

  let networkName = network.name;

  if (['localhost', 'hardhat'].includes(network.name)) {
    networkName = process.env.HARDHAT_FORK!;
  }

  // deploy position descriptor
  await catchUnknownSigner(
    deploy('SuperfluidCallbacks', {
      contract: 'SuperfluidCallbacks',
      from: deployer,
      proxy: {
        owner: governance,
        proxy: true,
        execute: {
          init: {
            methodName: 'initialize',
            args: [
              borrowerPools.address,
              networkConfig[networkName].superFluidHost!,
              networkConfig[networkName].registrationKey ?? '',
            ],
          },
        },
      },
      log: true,
    })
  );

  const SuperfluidCallbacksDeployer = <SuperfluidCallbacks>(
    await ethers.getContract('SuperfluidCallbacks', deployer)
  );
  log(
    'SuperfluidCallbacks proxy address: ' + SuperfluidCallbacksDeployer.address
  );
};
export default func;
func.tags = ['All', 'superfluidCallbacks', 'test', 'local', 'production'];
func.dependencies = ['borrowerPools'];
