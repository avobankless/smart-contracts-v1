// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "./IPositionManager.sol";

/**
 * @title IPositionDescriptor
 * @notice Generates the SVG artwork for lenders positions
 **/
interface IPositionDescriptor {
  /**
   * @notice Emitted after the string identifier of a pool has been set
   * @param poolIdentifier The string identifier of the pool
   * @param ownerAddress The owner identifier of the pool
   **/
  event SetPoolIdentifier(address poolIdentifier, address ownerAddress);

  /**
   * @notice Get the pool identifier corresponding to the input pool owner 
   * @param ownerAddress The identifier of the pool
   **/
  function getPoolIdentifier(address ownerAddress) external view returns (address);

  /**
   * @notice Set the pool string identifier corresponding to the input pool owner 
   * @param poolIdentifier The string identifier to associate with the corresponding pool owner 
   * @param ownerAddress The identifier of the pool
   **/
  function setPoolIdentifier(address poolIdentifier, address ownerAddress) external;

  /**
   * @notice Returns the encoded svg for positions artwork
   * @param position The address of the position manager contract
   * @param tokenId The tokenId of the position
   **/
  function tokenURI(IPositionManager position, uint128 tokenId) external view returns (string memory);
}
