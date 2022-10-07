// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <=0.8.13;

import "./interfaces/RegistryApi.sol";

contract MockYearnRegistry is RegistryAPI {

    address override public governance;
    mapping(address => uint256) override public numVaults;
    mapping(address => mapping(uint256 => address)) override public vaults;

    constructor() {
        governance = msg.sender;
    }

    function latestVault(address token) override external view returns (address) {
        return vaults[token][numVaults[token] - 1];
    }

    function newVault(address token, address vault) external {
        vaults[token][numVaults[token]] = vault;
        numVaults[token] += 1;
    }
}