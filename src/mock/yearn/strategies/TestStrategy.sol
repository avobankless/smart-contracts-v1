// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <=0.8.13;

import "./BaseStrategy.sol";

contract TestStrategy is BaseStrategy {
    constructor(address _vault) BaseStrategy(_vault) {}

    function name() external pure override returns (string memory) {
        return "TestStrategy";
    }

    // When exiting the position, wait this many times to give everything back
    uint256 countdownTimer = 3;

    // NOTE: This is a test-only function
    function _takeFunds(uint256 amount) public {
        IERC20(want).transfer(msg.sender, amount);
    }

    function estimatedTotalAssets() public view override returns (uint256) {
        // For mock, this is just everything we have
        return IERC20(want).balanceOf(address(this));
    }

    function prepareReturn(uint256 _debtOutstanding)
        internal
        override
        returns (uint256 _profit)
    {
        // During testing, send this contract some tokens to simulate "Rewards"
        uint256 reserve = getReserve();
        uint256 total = IERC20(want).balanceOf(address(this));
        if (total > reserve + _debtOutstanding)
            _profit = total - reserve - _debtOutstanding;
    }

    function adjustPosition(uint256 _debtOutstanding) internal override {
        // Whatever we have "free", consider it "invested" now
        uint256 total = IERC20(want).balanceOf(address(this));
        if (total > _debtOutstanding) {
            setReserve(total - _debtOutstanding);
        } else {
            setReserve(0);
        }
    }

    function liquidatePosition(uint256 _amountNeeded)
        internal
        override
        returns (uint256 _amountFreed)
    {
        uint256 reserve = getReserve();
        if (_amountNeeded >= reserve) {
            // Give back the entire reserves
            _amountFreed = reserve;
        } else {
            // Give back a portion of the reserves
            _amountFreed = _amountNeeded;
        }
        setReserve(reserve - _amountFreed);
    }

    function exitPosition() internal override {
        // Dump 1/N of original position each time this is called
        setReserve(
            IERC20(want).balanceOf(address(this)) * (countdownTimer - 1) / countdownTimer
        );
        countdownTimer -= 1; // NOTE: This should never be called after it hits 0
    }

    function prepareMigration(address _newStrategy) internal override {
        // Nothing needed here because no additional tokens/tokenized positions for mock
    }

    function protectedTokens()
        internal
        view
        override
        returns (address[] memory)
    {
        return new address[](0); // No additional tokens/tokenized positions for mock
    }

    function delegatedAssets() override external view returns (uint256) {
        return 0;
    }

    function isActive() override external view returns (bool) {
        return true;
    }
}