//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

/// @title ACDMPlatform for selling and buying ACDM token
/// @author AkylbekAD
/// @notice You can participate at 'onTrade' rounds and buy ACDMT at 'onSale'

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ACDMPlatform is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter internal orderID;
    Counters.Counter internal roundID;

    enum Status{onNone, onSale, onTrade}


    struct Info {
        uint256 nextRoundStart;
        uint256 lastTradeVolume;
        uint256 lastRoundPrice;
        Status roundStatus;
    }

    struct Order {
        address seller;
        uint256 amountACDM;
        uint256 priceETH;
    }

    mapping (uint256 => Order) public orders;
    mapping (address => uint256) public sellerOrderID;
    mapping (address => bool) public isRegistered;
    mapping (address => address) public referred;

    Info public roundInfo;
    address public ACDMToken;
    address public DAOAdress;
    uint256 public roundTime;

    /// @dev Bytes format for ADMIN role
    bytes32 public constant ADMIN = keccak256("ADMIN");

    event Registered (address newPartipant);
    event SaleRoundStarted (uint256 roundID, uint256 timestamp);
    event BoughtACDM (address buyer, uint256 amountACDM);
    event TradeRoundStarted (uint256 roundID, uint256 timestamp);
    event OrderAdded (address seller, uint256 orderID, uint256 amountACDM, uint256 priceETH);
    event OrderRemoved (address seller);
    event OrderRedeemed (address buyer, uint256 orderID, uint256 amountACDM, uint256 amountETH);

    /// @dev Checks have already user registered
    modifier registered() {
        require(isRegistered[msg.sender], "You must register before participate");
        _;
    }

    /// @dev First round price for 1 ACDMT is 0.00001 ETH
    constructor(address _DAOAdress, address _ACDMToken, uint256 _roundTime) {
        ACDMToken = _ACDMToken;
        DAOAdress = _DAOAdress;
        roundTime = _roundTime;
        roundInfo.lastRoundPrice = 1e13;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN, msg.sender);
    }

    /// @notice You must register before parrticipate at platform, set referrer or your address
    /// @param referrer is the address of account how invite you to the platform, or yours if there is no referrer
    /** @dev Sender must register before participate at platform, if referrer also has his referrer,
        it sets on 'referred2' mapping
    */
    function register(address referrer) external {
        require(referrer != msg.sender, "You can not set yourself as referrer");
        require(!isRegistered[msg.sender], "You have registered already");
            
        isRegistered[msg.sender] = true;
        referred[msg.sender] = referrer;

        emit Registered (msg.sender);
    }

    /// @notice Finishs 'onTrade' round and starts 'onSale' round
    /// @dev Mints new ACDM tokens for sale, amount of minted determined by 'onTrade' round
    function startSaleRound() external registered() {
        require(roundInfo.roundStatus != Status.onSale, "Round is already 'onSale'");
        require(block.timestamp > roundInfo.nextRoundStart, "Round time did not pass");

        roundInfo.nextRoundStart = roundTime + block.timestamp;
        roundInfo.roundStatus = Status.onSale;
        roundInfo.lastTradeVolume = 0;
        roundID.increment();

        /// @dev First round starts with 100000 ACDM tokens
        if(getRoundNumber() == 1) {
            IERC20(ACDMToken).mint(address(this), 100000000000);
        } else {
            IERC20(ACDMToken).mint(address(this), ((roundInfo.lastTradeVolume / getPrice()) * 10 ** 12));
        }

        emit SaleRoundStarted (roundID.current(), block.timestamp);
    }

    /// @notice Buy ACDM token at 'onSale' round with ETH
    /// @dev ETH amount must be more then price for 0.000001 ACDM
    function buyACDMToken() external payable registered() nonReentrant() {
        require(roundInfo.roundStatus == Status.onSale, "Round status is not 'onSale'");

        uint256 amount = msg.value / getPrice();

        /// @dev If sender have been referred then referer gets 5% of msg.value
        /// @dev If sender have been referred by someone how was referred too - he will get 3% of msg.value
        if(referred[msg.sender] != address(0)) {
            referred[msg.sender].call{value: (((msg.value * 100) * 5) / 10000)}("");
            if(referred[referred[msg.sender]] != address(0)) {
                referred[referred[msg.sender]].call{value: (((msg.value * 100) * 3) / 10000)}("");
            }
        }

        IERC20(ACDMToken).transfer(msg.sender, amount);

        emit BoughtACDM (msg.sender, amount);
    }

    /// @notice Finishs 'onSale' round burning unsaled ACDM tokens and starts 'onTrade' round
    /// @dev 'lastRoundPrice' rises every time 'onSale' round ends
    function startTradeRound() external registered() {
        require(roundInfo.roundStatus != Status.onTrade, "Round is already 'onTrade'");
        require(block.timestamp > roundInfo.nextRoundStart, "Round time did not pass");

        roundInfo.nextRoundStart = roundTime + block.timestamp;
        roundInfo.roundStatus = Status.onTrade;
        roundInfo.lastRoundPrice = getPrice();

        uint256 remainder = IERC20(ACDMToken).balanceOf(address(this));
        IERC20(ACDMToken).burn(address(this), remainder);

        emit TradeRoundStarted (roundID.current(), block.timestamp);
    }

    /// @notice Add order for selling your ACDM tokens for ETH
    /// @dev Each seller gets his own orderID
    /// @param amountACDM Tokens amount want to be sold for ETH
    /// @param priceETH value of ETH need to be payed for all selling ACDM tokens
    function addOrder(uint256 amountACDM, uint256 priceETH) external registered() nonReentrant() {
        require(roundInfo.roundStatus == Status.onTrade, "Round is not 'onTrade'");
        
        IERC20(ACDMToken).transferFrom(msg.sender, address(this), amountACDM);

        if(sellerOrderID[msg.sender] == 0) {
            orderID.increment();
            uint256 id = orderID.current();
            sellerOrderID[msg.sender] = id;

            orders[id].seller = msg.sender;
            orders[id].amountACDM = amountACDM;
            orders[id].priceETH = priceETH;
        } else {
            uint256 id = sellerOrderID[msg.sender];

            orders[id].seller = msg.sender;
            orders[id].amountACDM += amountACDM;
            orders[id].priceETH = priceETH;
        }
        emit OrderAdded (msg.sender, orderID.current(), amountACDM, priceETH);
    }

    /// @notice Returns sellers ACDM tokens remainder from his order
    function removeOrder() external registered() nonReentrant() {
        IERC20(ACDMToken).transfer(msg.sender, orders[sellerOrderID[msg.sender]].amountACDM);
        orders[sellerOrderID[msg.sender]].amountACDM = 0;
        orders[sellerOrderID[msg.sender]].priceETH = 0;

        emit OrderRemoved (msg.sender);
    }

    /// @notice Call it to buy ACDM tokens at 'onTrade' round for ETH from seller
    /// @param orderId Each seller has its own orderID, get it from 'sellerOrderID' 
    /// @dev Seller always gets 95% ETH, if amount is little, buyer would get no ACDM tokens
    function redeemOrder(uint256 orderId) external payable registered() nonReentrant() {
        require(roundInfo.roundStatus == Status.onTrade, "Trade time is over");

        uint256 boughtAmount = (((orders[orderId].amountACDM * 1e12) / orders[orderId].priceETH) / 1e12) * msg.value;
        require(boughtAmount <= orders[orderId].amountACDM, "Seller dont have enough ACDM");
        
        payable (orders[orderId].seller).transfer((msg.value * 95) / 100);

        /** @dev Each referrer (1 and 2) gets 2.5% of ETH from each redeemOrder,
            but if there is no referrers, then 2.5% or 5% goes to DAOVotings contract.
        */
        uint256 fee = ((msg.value * 100) * 25) / 100000;

        if(referred[msg.sender] != address(0)) {
            referred[msg.sender].call{value: fee}("");
            if(referred[referred[msg.sender]] != address(0)) {
                referred[referred[msg.sender]].call{value: fee}("");
            } else {
                DAOAdress.call{value:fee}("");
            }
        } else {
            DAOAdress.call{value:fee}("");
        }

        /// @dev each redeemOrder increases ETH trade volume and next round ACDM minting
        roundInfo.lastTradeVolume += msg.value;

        orders[orderId].amountACDM -= boughtAmount;
        orders[orderId].priceETH -= msg.value;
        IERC20(ACDMToken).transfer(msg.sender, boughtAmount);

        emit OrderRedeemed (msg.sender, orderID.current(), boughtAmount, msg.value);
    }
    
    /// @notice Get amount of ACDM for 1 ETH at current 'onSale' round
    /// @dev This formula represents price - 'lastRoundPrice * 1,03 + 0,000004'
    function getPrice() public view returns(uint256) {
        if (getRoundNumber() == 1) {
            return 10000000000000;
        } else {
            return (roundInfo.lastRoundPrice + (roundInfo.lastRoundPrice / 100*3) + 4000000000000);
        }
    }

    /// @notice Returns current roundID
    function getRoundNumber() public view returns(uint256 currentNumber) {
        return roundID.current();
    }

    function getBalance() public view returns(uint256) {
        return address(this).balance;
    }
}
