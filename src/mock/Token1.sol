// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token1 is ERC20("Token1", "T1") {

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override(ERC20) returns (bool) {
        uint256 _allowance = super.allowance(from, msg.sender);
        if (_allowance != type(uint256).max) {
            _approve(from, _msgSender(), _allowance - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}