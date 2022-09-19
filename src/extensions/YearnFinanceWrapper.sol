// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

import {VaultAPI, BaseWrapper} from "./BaseWraper.sol";

contract YearnFinanceWrapper is ERC20, BaseWrapper {
  /// @notice The EIP-712 typehash for the contract's domain
  bytes32 public constant DOMAIN_TYPEHASH =
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
  bytes32 public immutable DOMAIN_SEPARATOR;

  /// @notice The EIP-712 typehash for the permit struct used by the contract
  bytes32 public constant PERMIT_TYPEHASH =
    keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

  /// @notice A record of states for signing / validating signatures
  mapping(address => uint256) public nonces;

  address public affiliate;

  address public pendingAffiliate;

  modifier onlyAffiliate() {
    require(msg.sender == affiliate);
    _;
  }

  constructor(
    address _token,
    address _registry,
    string memory name,
    string memory symbol
  ) public BaseWrapper(_token, _registry) ERC20(name, symbol) {
    DOMAIN_SEPARATOR = keccak256(
      abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256(bytes("1")), _getChainId(), address(this))
    );
    affiliate = msg.sender;
    // decimals(uint8(ERC20(address(token)).decimals()));
  }

  function _getChainId() internal view returns (uint256) {
    uint256 chainId;
    assembly {
      chainId := chainid()
    }
    return chainId;
  }

  function setAffiliate(address _affiliate) external onlyAffiliate {
    pendingAffiliate = _affiliate;
  }

  function acceptAffiliate() external {
    require(msg.sender == pendingAffiliate);
    affiliate = msg.sender;
  }

  function _shareValue(uint256 numShares) internal view returns (uint256) {
    uint256 totalShares = totalSupply();

    if (totalShares > 0) {
      return (totalVaultBalance(address(this)) * (numShares)) / (totalShares);
    } else {
      return numShares;
    }
  }

  function pricePerShare() public view returns (uint256) {
    uint256 pricePerShare;
    if (totalSupply() == 0) {
      return 1e18;
    } else {
      pricePerShare = (totalVaultBalance(address(this)) * (10**uint256(decimals()))) / (totalSupply());
    }
    return pricePerShare;
  }

  function _sharesForValue(uint256 amount) internal view returns (uint256) {
    // total wrapper assets before deposit (assumes deposit already occured)
    uint256 totalBalance = totalVaultBalance(address(this));
    if (totalBalance > amount) {
      return (totalSupply() * (amount)) / (totalBalance - (amount));
    } else {
      return amount;
    }
  }

  function deposit(uint256 amount) external returns (uint256 deposited) {
    deposited = _deposit(msg.sender, address(this), amount, true); // `true` = pull from `msg.sender`
    uint256 shares = _sharesForValue(deposited); // NOTE: Must be calculated after deposit is handled
    _mint(msg.sender, shares);
  }

  function withdraw(
    address _address,
    uint256 _amount,
    address _to
  ) external returns (uint256) {
    return withdraw(balanceOf(msg.sender));
  }

  function withdraw(uint256 shares) public returns (uint256 withdrawn) {
    withdrawn = _withdraw(address(this), msg.sender, _shareValue(shares), true); // `true` = withdraw from `bestVault`
    _burn(msg.sender, shares);
  }

  function migrate() external onlyAffiliate returns (uint256) {
    return _migrate(address(this));
  }

  function migrate(uint256 amount) external onlyAffiliate returns (uint256) {
    return _migrate(address(this), amount);
  }

  function migrate(uint256 amount, uint256 maxMigrationLoss) external onlyAffiliate returns (uint256) {
    return _migrate(address(this), amount, maxMigrationLoss);
  }

  /**
   * @notice Triggers an approval from owner to spends
   * @param owner The address to approve from
   * @param spender The address to be approved
   * @param amount The number of tokens that are approved (2^256-1 means infinite)
   * @param deadline The time at which to expire the signature
   * @param v The recovery byte of the signature
   * @param r Half of the ECDSA signature pair
   * @param s Half of the ECDSA signature pair
   */
  function permit(
    address owner,
    address spender,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    require(owner != address(0), "permit: signature");
    require(block.timestamp <= deadline, "permit: expired");

    bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, amount, nonces[owner]++, deadline));
    bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

    address signatory = ecrecover(digest, v, r, s);
    require(signatory == owner, "permit: unauthorized");

    _approve(owner, spender, amount);
  }

  function getReserveNormalizedIncome() public view returns (uint256) {
    // TODO: Scale to ray accordingly to the decimals of the token
    return pricePerShare() * 1e9; // Scales result to RAY
  }
}
