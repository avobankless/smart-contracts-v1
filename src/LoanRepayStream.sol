// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {ISuperfluid, 
    ISuperToken, 
    ISuperApp,
    ISuperAgreement,
    SuperAppDefinitions} 
    from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

import {ISuperToken} 
    from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";

import {IConstantFlowAgreementV1} 
    from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

import {CFAv1Library} 
    from "@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";

import {SuperAppBase} 
    from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "./BorrowerPools.sol";

contract LoanRepayStream is SuperAppBase {

    ISuperfluid private _host; // host
    IConstantFlowAgreementV1 private _cfa; // the stored constant flow agreement class address
    ISuperToken private _acceptedToken; // accepted token
    address private _sender;

    constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        ISuperToken acceptedToken,
        address sender) {
        assert(address(host) != address(0));
        assert(address(cfa) != address(0));
        assert(address(acceptedToken) != address(0));
        assert(address(sender) != address(0));
        //assert(!_host.isApp(ISuperApp(sender)));

        _host = host;
        _cfa = cfa;
        _acceptedToken = acceptedToken;
        _sender = sender;

        uint256 configWord =
            SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.AFTER_AGREEMENT_TERMINATED_NOOP;

        _host.registerApp(configWord);
    }

    function currentsender()
        external view
        returns (
            uint256 startTime,
            address sender,
            int96 flowRate
        )
    {
        if (_sender != address(0)) {
            (startTime, flowRate,,) = _cfa.getFlow(_acceptedToken, address(this), _sender);
            sender = _sender;
        }
    }

    event senderChanged(address sender); //what is this?

    /// @dev If a new stream is opened, or an existing one is opened
    function _updateOutflow(bytes calldata ctx)
        private
        returns (bytes memory newCtx)
    {
      newCtx = ctx;
      // @dev This will give me the new flowRate, as it is called in after callbacks
      int96 netFlowRate = _cfa.getNetFlow(_acceptedToken, address(this));
      (,int96 outFlowRate,,) = _cfa.getFlow(_acceptedToken, address(this), _sender);
      int96 inFlowRate = netFlowRate + outFlowRate;
      if (inFlowRate < 0 ) inFlowRate = -inFlowRate; // Fixes issue when inFlowRate is negative

      // @dev If inFlowRate === 0, then delete existing flow.
      if (outFlowRate != int96(0)){
        (newCtx, ) = _host.callAgreementWithContext(
            _cfa,
            abi.encodeWithSelector(
                _cfa.updateFlow.selector,
                _acceptedToken,
                _sender,
                inFlowRate,
                new bytes(0) // placeholder
            ),
            "0x",
            newCtx
        );
      } else if (inFlowRate == int96(0)) {
        // @dev if inFlowRate is zero, delete outflow.
          (newCtx, ) = _host.callAgreementWithContext(
              _cfa,
              abi.encodeWithSelector(
                  _cfa.deleteFlow.selector,
                  _acceptedToken,
                  address(this),
                  _sender,
                  new bytes(0) // placeholder
              ),
              "0x",
              newCtx
          );
      } else {
      // @dev If there is no existing outflow, then create new flow to equal inflow
          (newCtx, ) = _host.callAgreementWithContext(
              _cfa,
              abi.encodeWithSelector(
                  _cfa.createFlow.selector,
                  _acceptedToken,
                  _sender,
                  inFlowRate,
                  new bytes(0) // placeholder
              ),
              "0x",
              newCtx
          );
      }
    }

    // @dev Change the sender of the total flow
    function _changesender( address newsender ) internal {
        require(newsender != address(0), "New sender is zero address");
        // @dev because our app is registered as final, we can't take downstream apps
        require(!_host.isApp(ISuperApp(newsender)), "New sender can not be a superApp");
        if (newsender == _sender) return ;
        // @dev delete flow to old sender
        _host.callAgreement(
            _cfa,
            abi.encodeWithSelector(
                _cfa.deleteFlow.selector,
                _acceptedToken,
                address(this),
                _sender,
                new bytes(0)
            ),
            "0x"
        );
        // @dev create flow to new sender
        _host.callAgreement(
            _cfa,
            abi.encodeWithSelector(
                _cfa.createFlow.selector,
                _acceptedToken,
                newsender,
                _cfa.getNetFlow(_acceptedToken, address(this)),
                new bytes(0)
            ),
            "0x"
        );
        // @dev set global sender to new sender
        _sender = newsender;

        emit senderChanged(_sender);
    }

    /**************************************************************************
     * SuperApp callbacks
     *************************************************************************/

    function afterAgreementCreated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32, // _agreementId,
        bytes calldata /*_agreementData*/,
        bytes calldata ,// _cbdata,
        bytes calldata _ctx
    )
        external override
        onlyExpected(_superToken, _agreementClass)
        onlyHost
        returns (bytes memory newCtx)
    {
        return _updateOutflow(_ctx);
    }

    function afterAgreementUpdated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32 ,//_agreementId,
        bytes calldata /*_agreementData*/,
        bytes calldata ,//_cbdata,
        bytes calldata _ctx
    )
        external override
        onlyExpected(_superToken, _agreementClass)
        onlyHost
        returns (bytes memory newCtx)
    {
        return _updateOutflow(_ctx);
    }

    function afterAgreementTerminated(
        ISuperToken _superToken,
        address _agreementClass,
        bytes32 ,//_agreementId,
        bytes calldata /*_agreementData*/,
        bytes calldata ,//_cbdata,
        bytes calldata _ctx
    )
        external override
        onlyHost
        returns (bytes memory newCtx)
    {
        // According to the app basic law, we should never revert in a termination callback
        if (!_isSameToken(_superToken) || !_isCFAv1(_agreementClass)) return _ctx;
        return _updateOutflow(_ctx);
    }

    function _isSameToken(ISuperToken superToken) private view returns (bool) {
        return address(superToken) == address(_acceptedToken);
    }

    function _isCFAv1(address agreementClass) private view returns (bool) {
        return ISuperAgreement(agreementClass).agreementType()
            == keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    }

    modifier onlyHost() {
        require(msg.sender == address(_host), "LoanRepayStream: support only one host");
        _;
    }

    modifier onlyExpected(ISuperToken superToken, address agreementClass) {
        require(_isSameToken(superToken), "LoanRepayStream: not accepted token");
        require(_isCFAv1(agreementClass), "LoanRepayStream: only CFAv1 supported");
        _;
    }

}