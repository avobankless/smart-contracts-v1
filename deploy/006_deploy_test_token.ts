import debugModule from 'debug';
import {ethers} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {Token1} from '../typechain/Token1';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const log = debugModule('deploy-setup');
  log.enabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {deployments} = hre as any;
  const {catchUnknownSigner} = deployments;
  const {getNamedAccounts} = hre;

  // keep ts support on hre members
  const {deployer, governance} = await getNamedAccounts();
  const {deploy} = deployments;

  // deploy

  await catchUnknownSigner(
    deploy('Token1', {
      contract: 'Token1',
      from: deployer,
      proxy: {
        owner: governance,
        proxy: true,
        execute: {
          init: {
            methodName: 'initialize',
          },
        },
      },
      log: true,
    })
  );

  const Token1Deployer = <Token1>(
    await ethers.getContract('BorrowerPools', deployer)
  );

  // Print all contracts info pretty
  log('Token1 proxy address: ' + Token1Deployer.address);
};

export default func;
func.tags = ['All', 'token1', 'local', 'test'];
