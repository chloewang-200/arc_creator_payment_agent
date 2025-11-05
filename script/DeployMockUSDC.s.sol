// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() external returns (MockUSDC) {
        console.log("Deploying MockUSDC contract to Arc Testnet...");
        console.log("Deployer address:", msg.sender);

        // Deploy
        vm.startBroadcast();
        MockUSDC mockUSDC = new MockUSDC();
        vm.stopBroadcast();

        console.log("MockUSDC deployed at:", address(mockUSDC));
        console.log("Initial supply minted to deployer: 1,000,000 USDC");
        console.log("Faucet available: 100 USDC per call (max 1000 USDC per address)");

        return mockUSDC;
    }
}
