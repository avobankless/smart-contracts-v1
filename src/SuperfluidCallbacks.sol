// SPDX-License-Identifier: AGPL-3.0

pragma solidity >=0.8.0 <=0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./BorrowerPools.sol";

import {ISuperfluid, ISuperToken} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {SuperAppDefinitions} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";
import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import {CFAv1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";

// agreement type
bytes32 constant CFA_ID = keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");

contract SuperfluidCallbacks is Initializable {
  using CFAv1Library for CFAv1Library.InitData;
  CFAv1Library.InitData public cfaV1Lib;
  BorrowerPools private borrowerPools;

   modifier onlyHost() {
        if (msg.sender != address(cfaV1Lib.host)) revert Unauthorized();
        _;
    }

  function initialize(
    BorrowerPools _borrowerPools,
    ISuperfluid host,
    string calldata registrationKey
  ) public initializer {

    assert(address(host) != address(0));
    assert(address(_borrowerPools) != address(0));

    borrowerPools = _borrowerPools;

    cfaV1Lib = CFAv1Library.InitData({
            host: host,
            cfa: IConstantFlowAgreementV1(address(host.getAgreementClass(CFA_ID)))
        });


    uint256 configWord = SuperAppDefinitions.APP_LEVEL_FINAL |
      SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
      SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
      SuperAppDefinitions.AFTER_AGREEMENT_UPDATED_NOOP |
      SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP |
      SuperAppDefinitions.AFTER_AGREEMENT_TERMINATED_NOOP;

    cfaV1Lib.host.registerAppWithKey(configWord, registrationKey);
  }

  struct Borrow {
    address origin;
    address sender;
    uint128 loanAmount;
    int96 flowRate;
  }

  function afterAgreementCreated(
    ISuperToken _superToken, /*superToken*/
    address _agreementClass, /*agreementClass*/
    bytes32, /*agreementId*/
    bytes calldata _agreementData, /*agreementData*/
    bytes calldata, /*cbdata*/
    bytes calldata _ctx /*ctx*/
  )
    external
    virtual
    onlyHost
    returns (
      bytes memory newCtx/*newCtx*/
    )
  {
    console.log("afterAgreement fired");
    if (_agreementClass != address(cfaV1Lib.cfa)) revert InvalidAgreement();

    Borrow memory borrow;

    {
    (borrow.origin, ) = abi.decode(_agreementData, (address, address));
    }

    {
      ISuperfluid.Context memory decompiledContext = cfaV1Lib.host.decodeCtx(_ctx);
      (borrow.sender,borrow.loanAmount) = abi.decode(decompiledContext.userData, (address, uint128));
    }

    {
      (,borrow.flowRate, , ) = cfaV1Lib.cfa.getFlow(_superToken, borrow.origin, address(this));
    }

    console.log(1);
    borrowerPools.borrow(borrow.sender, borrow.loanAmount, _superToken, borrow.flowRate);
    console.log(2);

    return _ctx;
  }
}
