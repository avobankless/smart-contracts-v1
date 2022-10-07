// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.0 <=0.8.13;

library Roles {
  bytes32 public constant BORROWER_ROLE = keccak256("BORROWER_ROLE");
  bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
  bytes32 public constant POSITION_ROLE = keccak256("POSITION_ROLE");
  bytes32 public constant BORROW_CALLER_ROLE = keccak256("BORROW_CALLER_ROLE");
}
