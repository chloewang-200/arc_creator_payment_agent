// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PayRouter} from "../src/PayRouter.sol";

contract DeployPayRouter is Script {
    function run() external returns (PayRouter) {
        // Get deployment parameters from environment
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address feeReceiver = vm.envAddress("FEE_RECEIVER_ADDRESS");
        uint16 feeBps = uint16(vm.envUint("FEE_BPS"));

        // Log deployment info
        console.log("Deploying PayRouter contract...");
        console.log("USDC Address:", usdcAddress);
        console.log("Fee Receiver:", feeReceiver);
        console.log("Fee BPS:", feeBps);

        // Deploy
        vm.startBroadcast();
        PayRouter payRouter = new PayRouter(usdcAddress, feeReceiver, feeBps);
        vm.stopBroadcast();

        console.log("PayRouter deployed at:", address(payRouter));

        return payRouter;
    }
}

