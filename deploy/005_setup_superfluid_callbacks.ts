import debugModule from 'debug';
import {network} from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {networkConfig} from '../helper-hardhat-config';
import {BORROWER_CALLER_ROLE} from '../test/utils/constants';

import {BorrowerPools} from '../typechain';
import {SuperfluidCallbacks} from '../typechain/SuperfluidCallbacks';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const log = debugModule('deploy-setup');
  log.enabled = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {deployments} = hre as any;
  const {ethers, getNamedAccounts} = hre;

  // keep ts support on hre members
  const {governance} = await getNamedAccounts();
  const {catchUnknownSigner, execute} = deployments;

  const BorrowerPoolsGovernance = <BorrowerPools>(
    await ethers.getContract('BorrowerPools', governance)
  );

  // Set tokenToSuperToken mapping
  let networkName = network.name;
  if (['localhost', 'hardhat'].includes(network.name)) {
    networkName = process.env.HARDHAT_FORK!;
  }

  await BorrowerPoolsGovernance.setTokenToSuperToken(
    networkConfig[networkName].fDAI!,
    networkConfig[networkName].sDAI!
  );

  const SuperfluidCallbacksGovernance = <SuperfluidCallbacks>(
    await ethers.getContract('SuperfluidCallbacks', governance)
  );

  // set roles

  const isRoleSetForSuperfluidCallbacks = await BorrowerPoolsGovernance.hasRole(
    BORROWER_CALLER_ROLE,
    SuperfluidCallbacksGovernance.address
  );
  if (isRoleSetForSuperfluidCallbacks) {
    log(
      'Position role already set to:' + SuperfluidCallbacksGovernance.address
    );
    log('No further execution of this script');
    return true;
  }
  log('Set borrow caller role to: ' + SuperfluidCallbacksGovernance.address);
  await catchUnknownSigner(
    execute(
      'BorrowerPools',
      {from: governance},
      'grantRole',
      BORROWER_CALLER_ROLE,
      SuperfluidCallbacksGovernance.address
    )
  );

  // Prevent re-execution by returning true
};
func.id = 'setup';
export default func;
func.tags = ['All', 'setup', 'local', 'production', 'test'];
